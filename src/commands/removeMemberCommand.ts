import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/** Names to exclude from the remove-member QuickPick (non-removable roles). */
const EXCLUDED_NAMES = new Set(['scribe', 'ralph', '@copilot']);

interface MemberRow {
    name: string;
    slug: string;
    line: string;
    lineIndex: number;
}

/**
 * Parse the Members table in team.md and return removable rows.
 */
function parseMemberRows(teamMdPath: string): MemberRow[] {
    const content = fs.readFileSync(teamMdPath, 'utf-8');
    const lines = content.split('\n');
    const rows: MemberRow[] = [];

    let inMembersTable = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('## Members')) {
            inMembersTable = true;
            continue;
        }
        if (inMembersTable && line.startsWith('##')) {
            break; // next section
        }
        if (!inMembersTable) {
            continue;
        }
        // Skip header and separator rows
        if (line.startsWith('|--') || line.includes('| Name')) {
            continue;
        }
        if (!line.startsWith('|')) {
            continue;
        }

        const cells = line.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length < 1) {
            continue;
        }
        const name = cells[0];
        if (EXCLUDED_NAMES.has(name.toLowerCase())) {
            continue;
        }

        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        rows.push({ name, slug, line, lineIndex: i });
    }
    return rows;
}

export function registerRemoveMemberCommand(
    _context: vscode.ExtensionContext,
    onMemberRemoved: () => void
): vscode.Disposable {
    return vscode.commands.registerCommand('squadui.removeMember', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('Squad: No workspace folder open. Open a folder first.');
            return;
        }

        const teamRoot = workspaceFolder.uri.fsPath;
        const teamMdPath = path.join(teamRoot, '.ai-team', 'team.md');

        if (!fs.existsSync(teamMdPath)) {
            vscode.window.showErrorMessage('Squad: team.md not found. Initialize your squad first.');
            return;
        }

        const rows = parseMemberRows(teamMdPath);
        if (rows.length === 0) {
            vscode.window.showInformationMessage('No removable team members found.');
            return;
        }

        // QuickPick showing current members
        const picks: vscode.QuickPickItem[] = rows.map(r => ({
            label: r.name,
            description: r.slug,
        }));

        const picked = await vscode.window.showQuickPick(picks, {
            placeHolder: 'Select a team member to remove',
            title: 'Remove Team Member',
        });
        if (!picked) {
            return; // cancelled
        }

        const member = rows.find(r => r.name === picked.label);
        if (!member) {
            return;
        }

        // Confirmation dialog
        const confirm = await vscode.window.showWarningMessage(
            `Remove ${member.name} from the team? They'll be moved to alumni.`,
            { modal: true },
            'Remove'
        );
        if (confirm !== 'Remove') {
            return; // cancelled
        }

        // Move agent directory to alumni
        const agentDir = path.join(teamRoot, '.ai-team', 'agents', member.slug);
        const alumniDir = path.join(teamRoot, '.ai-team', 'agents', '_alumni', member.slug);

        if (fs.existsSync(agentDir)) {
            fs.mkdirSync(path.join(teamRoot, '.ai-team', 'agents', '_alumni'), { recursive: true });
            fs.renameSync(agentDir, alumniDir);
        }

        // Remove row from team.md
        const content = fs.readFileSync(teamMdPath, 'utf-8');
        const lines = content.split('\n');
        lines.splice(member.lineIndex, 1);
        fs.writeFileSync(teamMdPath, lines.join('\n'), 'utf-8');

        vscode.window.showInformationMessage(`Removed ${member.name} — moved to alumni`);
        onMemberRemoved();
    });
}
