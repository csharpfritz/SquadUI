/**
 * VS Code Copilot Chat participant for surfacing squad context.
 * Registers a @squad participant that responds to team, decisions, and status queries.
 *
 * Graceful degradation: if `vscode.chat.createChatParticipant` is unavailable
 * (older VS Code builds), registration is silently skipped.
 */

import * as vscode from 'vscode';
import { SquadDataProvider } from './SquadDataProvider';
import { SquadMember, isActiveStatus } from '../models';

/** Participant ID must match the one declared in package.json chatParticipants. */
const PARTICIPANT_ID = 'squadui.squad';

/** Metadata key used to identify which command was handled (for followups). */
interface SquadChatResultMetadata {
    command?: string;
}

/**
 * Attempts to register a @squad chat participant.
 * Returns the disposable participant, or undefined if the API is not available.
 */
export function registerSquadChatParticipant(
    dataProvider: SquadDataProvider,
    _squadFolder: '.squad' | '.ai-team'
): vscode.Disposable | undefined {
    if (!vscode.chat || typeof vscode.chat.createChatParticipant !== 'function') {
        console.log('SquadUI: vscode.chat API unavailable \u2014 @squad participant not registered');
        return undefined;
    }

    const handler: vscode.ChatRequestHandler = async (
        request: vscode.ChatRequest,
        _context: vscode.ChatContext,
        response: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<vscode.ChatResult> => {
        const command = request.command;
        try {
            if (command === 'team') {
                return await handleTeamCommand(dataProvider, response, token);
            } else if (command === 'decisions') {
                return await handleDecisionsCommand(dataProvider, response, token);
            } else if (command === 'status') {
                return await handleStatusCommand(dataProvider, response, token);
            } else {
                return await handleFreeformPrompt(request.prompt, dataProvider, response, token);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            response.markdown('\u26a0\ufe0f Error loading squad data: ' + message);
            return { errorDetails: { message } };
        }
    };

    const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, handler);
    participant.iconPath = new vscode.ThemeIcon('organization');

    participant.followupProvider = {
        provideFollowups(result: vscode.ChatResult): vscode.ChatFollowup[] {
            const meta = result.metadata as SquadChatResultMetadata | undefined;
            const answered = meta?.command;
            const followups: vscode.ChatFollowup[] = [];
            if (answered !== 'team') {
                followups.push({ prompt: 'Show team roster', label: '\ud83d\udc65 Team Roster', command: 'team' });
            }
            if (answered !== 'decisions') {
                followups.push({ prompt: 'Show recent decisions', label: '\ud83d\udccb Recent Decisions', command: 'decisions' });
            }
            if (answered !== 'status') {
                followups.push({ prompt: 'Show current status', label: '\ud83d\udcca Work Status', command: 'status' });
            }
            return followups;
        }
    };

    console.log('SquadUI: @squad chat participant registered');
    return participant;
}

async function handleTeamCommand(
    dataProvider: SquadDataProvider,
    response: vscode.ChatResponseStream,
    token: vscode.CancellationToken
): Promise<vscode.ChatResult> {
    response.progress('Loading team roster\u2026');
    const members = await dataProvider.getSquadMembers();
    if (token.isCancellationRequested) { return {}; }
    if (members.length === 0) {
        response.markdown('No squad members found. Run **Squad: Initialize** to set up your team.');
        return { metadata: { command: 'team' } };
    }
    response.markdown('## \ud83d\udc65 Squad Roster\n\n');
    response.markdown(formatRosterTable(members));
    response.markdown('\n\n*' + members.length + ' member(s) on the team.*');
    return { metadata: { command: 'team' } };
}

async function handleDecisionsCommand(
    dataProvider: SquadDataProvider,
    response: vscode.ChatResponseStream,
    token: vscode.CancellationToken
): Promise<vscode.ChatResult> {
    response.progress('Loading decisions\u2026');
    const decisions = await dataProvider.getDecisions();
    if (token.isCancellationRequested) { return {}; }
    if (decisions.length === 0) {
        response.markdown('No decisions recorded yet.');
        return { metadata: { command: 'decisions' } };
    }
    const recent = decisions.slice(0, 10);
    response.markdown('## \ud83d\udccb Recent Decisions\n\n');
    for (const d of recent) {
        const date = d.date ? ' *(' + d.date + ')*' : '';
        const author = d.author ? ' \u2014 ' + d.author : '';
        response.markdown('### ' + d.title + date + author + '\n');
        if (d.content) {
            const trimmed = d.content.length > 300 ? d.content.slice(0, 300) + '\u2026' : d.content;
            response.markdown(trimmed + '\n\n');
        }
    }
    if (decisions.length > 10) {
        response.markdown('\n*Showing 10 of ' + decisions.length + ' decisions.*');
    }
    return { metadata: { command: 'decisions' } };
}

async function handleStatusCommand(
    dataProvider: SquadDataProvider,
    response: vscode.ChatResponseStream,
    token: vscode.CancellationToken
): Promise<vscode.ChatResult> {
    response.progress('Loading work status\u2026');
    const [members, logEntries] = await Promise.all([
        dataProvider.getSquadMembers(),
        dataProvider.getLogEntries()
    ]);
    if (token.isCancellationRequested) { return {}; }
    if (members.length === 0) {
        response.markdown('No squad members found.');
        return { metadata: { command: 'status' } };
    }
    const active = members.filter(m => isActiveStatus(m.status));
    const idle = members.filter(m => !isActiveStatus(m.status));
    response.markdown('## \ud83d\udcca Current Work Status\n\n');
    response.markdown('**Active:** ' + active.length + ' \u00b7 **Idle:** ' + idle.length + ' \u00b7 **Total:** ' + members.length + '\n\n');
    if (active.length > 0) {
        response.markdown('### \ud83d\udfe2 Active Members\n\n');
        for (const m of active) {
            const activity = m.activityContext?.description || m.currentTask?.title || statusLabel(m.status);
            response.markdown('- **' + m.name + '** (' + m.role + ') \u2014 ' + activity + '\n');
        }
        response.markdown('\n');
    }
    if (idle.length > 0) {
        response.markdown('### \u26aa Idle Members\n\n');
        for (const m of idle) {
            response.markdown('- **' + m.name + '** (' + m.role + ')\n');
        }
        response.markdown('\n');
    }
    if (logEntries.length > 0) {
        const recentLogs = logEntries.slice(0, 5);
        response.markdown('### \ud83d\udcdd Recent Activity\n\n');
        for (const entry of recentLogs) {
            const participants = entry.participants.join(', ');
            response.markdown('- **' + entry.date + '** ' + entry.topic + ' \u2014 ' + participants + '\n');
            if (entry.summary) { response.markdown('  > ' + truncate(entry.summary, 150) + '\n'); }
        }
    }
    return { metadata: { command: 'status' } };
}

async function handleFreeformPrompt(
    prompt: string,
    dataProvider: SquadDataProvider,
    response: vscode.ChatResponseStream,
    token: vscode.CancellationToken
): Promise<vscode.ChatResult> {
    const lower = prompt.toLowerCase();
    if (matchesAny(lower, ['team', 'roster', 'member', 'who'])) {
        return handleTeamCommand(dataProvider, response, token);
    }
    if (matchesAny(lower, ['decision', 'decided', 'why', 'rationale'])) {
        return handleDecisionsCommand(dataProvider, response, token);
    }
    if (matchesAny(lower, ['status', 'progress', 'working', 'active', 'doing', 'busy'])) {
        return handleStatusCommand(dataProvider, response, token);
    }
    response.progress('Loading squad overview\u2026');
    const [members, decisions, logEntries] = await Promise.all([
        dataProvider.getSquadMembers(),
        dataProvider.getDecisions(),
        dataProvider.getLogEntries()
    ]);
    if (token.isCancellationRequested) { return {}; }
    const active = members.filter(m => isActiveStatus(m.status));
    response.markdown('## \ud83c\udfe0 Squad Overview\n\n');
    response.markdown('**Team:** ' + members.length + ' members (' + active.length + ' active)\n\n');
    if (members.length > 0) {
        response.markdown(formatRosterTable(members));
        response.markdown('\n');
    }
    if (decisions.length > 0) {
        const top3 = decisions.slice(0, 3);
        response.markdown('### Recent Decisions\n\n');
        for (const d of top3) {
            const date = d.date ? ' *(' + d.date + ')*' : '';
            response.markdown('- **' + d.title + '**' + date + '\n');
        }
    }
    if (logEntries.length > 0) {
        const top3 = logEntries.slice(0, 3);
        response.markdown('### Recent Activity\n\n');
        for (const entry of top3) {
            response.markdown('- **' + entry.date + '** ' + entry.topic + ' \u2014 ' + entry.participants.join(', ') + '\n');
        }
    }
    response.markdown('\n\ud83d\udca1 *Try `/team`, `/decisions`, or `/status` for focused views.*');
    return { metadata: { command: 'overview' } };
}

function formatRosterTable(members: SquadMember[]): string {
    const lines: string[] = [];
    lines.push('| Member | Role | Status |');
    lines.push('|--------|------|--------|');
    for (const m of members) {
        const icon = isActiveStatus(m.status) ? '\ud83d\udfe2' : '\u26aa';
        const statusText = m.activityContext?.shortLabel || statusLabel(m.status);
        lines.push('| ' + icon + ' ' + m.name + ' | ' + m.role + ' | ' + statusText + ' |');
    }
    return lines.join('\n');
}

function statusLabel(status: string): string {
    switch (status) {
        case 'working-on-issue': return 'Working on issue';
        case 'reviewing-pr': return 'Reviewing PR';
        case 'waiting-review': return 'Waiting for review';
        case 'working': return 'Working';
        case 'idle': return 'Idle';
        default: return status;
    }
}

function truncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) { return text; }
    return text.slice(0, maxLen) + '\u2026';
}

function matchesAny(text: string, keywords: string[]): boolean {
    return keywords.some(kw => text.includes(kw));
}
