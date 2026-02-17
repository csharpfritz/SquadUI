/**
 * Service for reading and parsing orchestration log files.
 * Logs are stored in `.squad/log/` or `.squad/orchestration-log/` directories
 * (or legacy `.ai-team/log/` or `.ai-team/orchestration-log/`).
 */

import * as fs from 'fs';
import * as path from 'path';
import { OrchestrationLogEntry, Task, MemberStatus } from '../models';

/**
 * Service for discovering and parsing orchestration log files.
 * Handles malformed/missing files gracefully.
 */
export class OrchestrationLogService {
    /** Log directory names to search (in order of preference) */
    private static readonly LOG_DIRECTORIES = ['orchestration-log', 'log'];
    private squadFolder: '.squad' | '.ai-team';

    constructor(squadFolder: '.squad' | '.ai-team' = '.ai-team') {
        this.squadFolder = squadFolder;
    }

    /**
     * Discovers all log files in the orchestration-log directory.
     * Searches for .md files in `.squad/orchestration-log/` or `.squad/log/`
     * (or legacy `.ai-team/orchestration-log/` or `.ai-team/log/`).
     * 
     * @param teamRoot - Root directory containing the squad folder
     * @returns Array of absolute paths to log files
     */
    async discoverLogFiles(teamRoot: string): Promise<string[]> {
        const squadDir = path.join(teamRoot, this.squadFolder);
        
        // Collect files from ALL log directories (union)
        const allFiles: string[] = [];

        for (const dirName of OrchestrationLogService.LOG_DIRECTORIES) {
            const logDir = path.join(squadDir, dirName);
            
            try {
                const exists = await this.directoryExists(logDir);
                if (!exists) {
                    continue;
                }

                const files = await fs.promises.readdir(logDir);
                const mdFiles = files
                    .filter(file => file.endsWith('.md') && !file.toLowerCase().startsWith('readme'))
                    .map(file => path.join(logDir, file));

                allFiles.push(...mdFiles);
            } catch (error) {
                // Directory doesn't exist or isn't readable, try next
                continue;
            }
        }

        return allFiles.sort();
    }

    /**
     * Parses a single log file into an OrchestrationLogEntry.
     * 
     * Expected format:
     * ```
     * # {Topic Title}
     * 
     * **Date:** {YYYY-MM-DD}
     * **Participants:** {Name1}, {Name2}
     * 
     * ## Summary
     * {Summary text}
     * 
     * ## Decisions
     * - {Decision 1}
     * - {Decision 2}
     * 
     * ## Outcomes
     * - {Outcome 1}
     * - {Outcome 2}
     * 
     * ## Related Issues
     * - #{issue_number}
     * ```
     * 
     * @param filePath - Absolute path to the log file
     * @returns Parsed log entry
     * @throws Error if file cannot be read
     */
    async parseLogFile(filePath: string): Promise<OrchestrationLogEntry> {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const filename = path.basename(filePath);

        // Extract date and topic from filename: YYYY-MM-DD-topic.md or YYYY-MM-DDThhmm-topic.md
        const filenameMatch = filename.match(/^(\d{4}-\d{2}-\d{2})(?:T\d{4})?-(.+)\.md$/);
        const date = filenameMatch?.[1] ?? this.extractDateFromContent(content) ?? new Date().toISOString().split('T')[0];
        const topic = filenameMatch?.[2] ?? this.extractTitleFromContent(content) ?? 'unknown';

        return {
            timestamp: this.extractTimestamp(content, date),
            date,
            topic,
            participants: this.extractParticipants(content),
            summary: this.extractSection(content, 'Summary')
                ?? this.extractOutcomeFromTable(content)
                ?? this.extractHeadingTitle(content)
                ?? this.extractSummaryFallback(content),
            decisions: this.extractListSection(content, 'Decisions'),
            outcomes: this.extractListSection(content, 'Outcomes'),
            relatedIssues: this.extractRelatedIssues(content),
            whatWasDone: this.extractWhatWasDone(content),
        };
    }

    /**
     * Parses all log files in the orchestration-log directory.
     * 
     * @param teamRoot - Root directory containing the .ai-team folder
     * @returns Array of parsed log entries, sorted by date (newest first)
     */
    async parseAllLogs(teamRoot: string): Promise<OrchestrationLogEntry[]> {
        const logFiles = await this.discoverLogFiles(teamRoot);
        const entries: OrchestrationLogEntry[] = [];

        for (const filePath of logFiles) {
            try {
                const entry = await this.parseLogFile(filePath);
                entries.push(entry);
            } catch (error) {
                // Skip malformed files, log warning in production
                console.warn(`Failed to parse log file ${filePath}:`, error);
            }
        }

        // Sort by date descending (newest first)
        return entries.sort((a, b) => b.date.localeCompare(a.date));
    }

    /**
     * Derives member states from log entries.
     * Members who appear in recent entries are considered 'working',
     * others default to 'idle'.
     * 
     * @param entries - Parsed log entries
     * @returns Map of member name to their current state
     */
    getMemberStates(entries: OrchestrationLogEntry[]): Map<string, MemberStatus> {
        const states = new Map<string, MemberStatus>();

        if (entries.length === 0) {
            return states;
        }

        // Get all unique participants across all entries
        const allParticipants = new Set<string>();
        for (const entry of entries) {
            for (const participant of entry.participants) {
                allParticipants.add(participant);
            }
        }

        // Find the most recent entry
        const sortedEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date));
        const mostRecentEntry = sortedEntries[0];
        const mostRecentParticipants = new Set(mostRecentEntry.participants);

        // Members in the most recent log are 'working', others are 'idle'
        for (const participant of allParticipants) {
            states.set(participant, mostRecentParticipants.has(participant) ? 'working' : 'idle');
        }

        return states;
    }

    /**
     * Extracts active tasks from log entries.
     * Tasks are derived from related issues and outcomes.
     * 
     * @param entries - Parsed log entries
     * @returns Array of active tasks
     */
    getActiveTasks(entries: OrchestrationLogEntry[]): Task[] {
        const tasks: Task[] = [];
        const seenTaskIds = new Set<string>();

        // Sort entries by date descending to process most recent first
        const sortedEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date));

        // Track which entries produced #NNN tasks, so we know where to try prose extraction
        const entriesWithIssueTasks = new Set<number>();

        for (let i = 0; i < sortedEntries.length; i++) {
            const entry = sortedEntries[i];
            let entryProducedIssueTasks = false;

            // Extract tasks from related issues
            if (entry.relatedIssues) {
                for (const issueRef of entry.relatedIssues) {
                    const taskId = issueRef.replace('#', '').trim();
                    if (taskId && !seenTaskIds.has(taskId)) {
                        seenTaskIds.add(taskId);
                        entryProducedIssueTasks = true;

                        // Determine assignee from participants (first participant for now)
                        const assignee = entry.participants[0] ?? 'unknown';

                        tasks.push({
                            id: taskId,
                            title: `Issue #${taskId}`,
                            description: entry.summary,
                            status: 'in_progress',
                            assignee,
                            startedAt: new Date(entry.date),
                        });
                    }
                }
            }

            // Extract tasks from outcomes that reference issues
            if (entry.outcomes) {
                for (const outcome of entry.outcomes) {
                    const issueMatches = outcome.match(/#(\d+)/g);
                    if (issueMatches) {
                        for (const match of issueMatches) {
                            const taskId = match.replace('#', '');
                            if (!seenTaskIds.has(taskId)) {
                                seenTaskIds.add(taskId);
                                entryProducedIssueTasks = true;

                                const assignee = entry.participants[0] ?? 'unknown';
                                const isCompleted = outcome.toLowerCase().includes('completed') || 
                                                   outcome.toLowerCase().includes('done') ||
                                                   outcome.toLowerCase().includes('✅');

                                tasks.push({
                                    id: taskId,
                                    title: `Issue #${taskId}`,
                                    description: outcome,
                                    status: isCompleted ? 'completed' : 'in_progress',
                                    assignee,
                                    startedAt: new Date(entry.date),
                                    completedAt: isCompleted ? new Date(entry.date) : undefined,
                                });
                            }
                        }
                    }
                }
            }

            if (entryProducedIssueTasks) {
                entriesWithIssueTasks.add(i);
            }
        }

        // Second pass: extract prose-based tasks for entries that produced no #NNN tasks.
        // Process "What Was Done" entries first (richer, per-agent data), then synthetic fallback.
        const proseEntries = sortedEntries
            .map((entry, i) => ({ entry, i }))
            .filter(({ entry, i }) => !entriesWithIssueTasks.has(i) && entry.participants.length > 0);

        // Path 1: "What Was Done" section — per-agent work items (highest priority)
        for (const { entry } of proseEntries) {
            if (!entry.whatWasDone || entry.whatWasDone.length === 0) {
                continue;
            }
            for (const item of entry.whatWasDone) {
                const taskId = this.generateProseTaskId(entry.date, item.agent);
                if (!seenTaskIds.has(taskId)) {
                    seenTaskIds.add(taskId);
                    tasks.push({
                        id: taskId,
                        title: this.truncateTitle(item.description),
                        description: item.description,
                        status: 'completed',
                        assignee: item.agent,
                        startedAt: new Date(entry.date),
                        completedAt: new Date(entry.date),
                    });
                }
            }
        }

        // Path 2: Entries without "What Was Done" — synthetic task from summary + participant
        for (const { entry } of proseEntries) {
            if (entry.whatWasDone && entry.whatWasDone.length > 0) {
                continue;
            }
            if (!entry.summary || entry.participants.length === 0) {
                continue;
            }

            const assignee = entry.participants[0];
            const taskId = this.generateProseTaskId(entry.date, assignee);
            if (!seenTaskIds.has(taskId)) {
                seenTaskIds.add(taskId);

                const outcomeText = (entry.outcomes ?? []).join(' ');
                const combinedText = [entry.summary, outcomeText].join(' ');
                const isCompleted = this.isCompletionSignal(combinedText);

                tasks.push({
                    id: taskId,
                    title: this.truncateTitle(entry.summary),
                    description: entry.summary,
                    status: isCompleted ? 'completed' : 'in_progress',
                    assignee,
                    startedAt: new Date(entry.date),
                    completedAt: isCompleted ? new Date(entry.date) : undefined,
                });
            }
        }

        return tasks;
    }

    // ─── Private Helper Methods ────────────────────────────────────────────

    private async directoryExists(dirPath: string): Promise<boolean> {
        try {
            const stat = await fs.promises.stat(dirPath);
            return stat.isDirectory();
        } catch {
            return false;
        }
    }

    private extractTimestamp(content: string, fallbackDate: string): string {
        // Look for timestamp in content
        const timestampMatch = content.match(/\*\*(?:Timestamp|Time):\*\*\s*(.+)/i);
        if (timestampMatch) {
            return timestampMatch[1].trim();
        }

        // Fall back to date with midnight time
        return `${fallbackDate}T00:00:00Z`;
    }

    private extractDateFromContent(content: string): string | null {
        const dateMatch = content.match(/\*\*Date:\*\*\s*(\d{4}-\d{2}-\d{2})/i);
        return dateMatch?.[1] ?? null;
    }

    private extractTitleFromContent(content: string): string | null {
        const titleMatch = content.match(/^#\s+(.+)$/m);
        if (titleMatch) {
            // Convert title to slug
            return titleMatch[1]
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .substring(0, 50);
        }
        return null;
    }

    private extractParticipants(content: string): string[] {
        // Try "**Participants:**" format
        const participantsMatch = content.match(/\*\*Participants?:\*\*\s*(.+)/i);
        if (participantsMatch) {
            return participantsMatch[1]
                .split(/[,;]/)
                .map(p => p.trim())
                .filter(p => p.length > 0);
        }

        // Try "**Who worked:**" format
        const whoWorkedMatch = content.match(/\*\*Who worked:\*\*\s*(.+)/i);
        if (whoWorkedMatch) {
            return whoWorkedMatch[1]
                .split(/[,;]/)
                .map(p => p.trim())
                .filter(p => p.length > 0);
        }

        // Try "**Agent routed:**" format (orchestration-log entries)
        const agentRoutedMatch = content.match(/\*\*Agent routed\*\*\s*\|\s*(.+)/i);
        if (agentRoutedMatch) {
            // Format: "Name (Role) |" — extract just the name, strip role and trailing pipes
            return agentRoutedMatch[1]
                .split(/[,;]/)
                .map(p => p.replace(/\s*\(.*?\)\s*/g, '').replace(/\|/g, '').trim())
                .filter(p => p.length > 0);
        }

        // Try bullet list or table under "## Who Worked" section
        const whoWorkedSection = this.extractSection(content, 'Who Worked');
        if (whoWorkedSection) {
            // Try table format first: | Agent | Role |
            const tableParticipants = this.extractTableFirstColumn(whoWorkedSection);
            if (tableParticipants.length > 0) {
                return tableParticipants;
            }
            return this.extractListItems(whoWorkedSection);
        }

        // Fall back to extracting agent names from "## What Happened" or "## What Was Done" bullets
        const actionSection = this.extractSection(content, 'What Happened')
            ?? this.extractSection(content, 'What Was Done');
        if (actionSection) {
            const agents: string[] = [];
            for (const line of actionSection.split('\n')) {
                const match = line.match(/^\s*[-*]\s+\*\*(.+?):?\*\*:?\s/);
                if (match) {
                    const name = match[1].replace(/\s*\(.*?\)\s*$/, '').trim();
                    if (name && !agents.includes(name)) {
                        agents.push(name);
                    }
                }
            }
            if (agents.length > 0) { return agents; }
        }

        // Fall back to inline bold labels like "**Work done:**" followed by bullet items
        // with bold agent names: "- **Name** did something" or "- Name did something"
        const inlineLabelMatch = content.match(/\*\*(?:Work done|What happened|What was done):\*\*\s*\n([\s\S]*?)(?=\n\*\*|\n##\s|$)/i);
        if (inlineLabelMatch) {
            const agents: string[] = [];
            for (const line of inlineLabelMatch[1].split('\n')) {
                // Try bold name: "- **Gus** quality-reviewed..."
                const boldMatch = line.match(/^\s*[-*]\s+\*\*(.+?)\*\*\s/);
                if (boldMatch) {
                    const name = boldMatch[1].replace(/\s*\(.*?\)\s*$/, '').trim();
                    if (name && !agents.includes(name)) {
                        agents.push(name);
                    }
                    continue;
                }
                // Try unbolded name at start: "- Gus quality-reviewed..."
                const plainMatch = line.match(/^\s*[-*]\s+([A-Z][a-z]+)\s+/);
                if (plainMatch) {
                    const name = plainMatch[1];
                    if (name && !agents.includes(name)) {
                        agents.push(name);
                    }
                }
            }
            if (agents.length > 0) { return agents; }
        }

        // Last resort: scan all bullet items in the entire document for bold agent names
        const allAgents: string[] = [];
        for (const line of content.split('\n')) {
            const boldMatch = line.match(/^\s*[-*]\s+\*\*([A-Z][a-z]+)\*\*\s/);
            if (boldMatch) {
                const name = boldMatch[1];
                if (!allAgents.includes(name)) {
                    allAgents.push(name);
                }
            }
        }
        if (allAgents.length > 0) { return allAgents; }

        return [];
    }

    private extractSection(content: string, sectionName: string): string | null {
        // Match section header and capture content until next section or end
        const sectionRegex = new RegExp(
            `##\\s+${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`,
            'i'
        );
        const match = content.match(sectionRegex);
        return match?.[1]?.trim() ?? null;
    }

    private extractListSection(content: string, sectionName: string): string[] | undefined {
        const sectionContent = this.extractSection(content, sectionName);
        if (!sectionContent) {
            return undefined;
        }

        const items = this.extractListItems(sectionContent);
        return items.length > 0 ? items : undefined;
    }

    private extractListItems(content: string): string[] {
        const items: string[] = [];
        const lines = content.split('\n');

        for (const line of lines) {
            // Match lines starting with -, *, or numbered lists
            const listMatch = line.match(/^\s*[-*]\s+(.+)$/) || line.match(/^\s*\d+\.\s+(.+)$/);
            if (listMatch) {
                items.push(listMatch[1].trim());
            }
        }

        return items;
    }

    private extractSummaryFallback(content: string): string {
        // If no Summary section, use the first paragraph after the title
        const lines = content.split('\n');
        let inParagraph = false;
        const paragraphLines: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip title and metadata lines
            if (trimmed.startsWith('#') || trimmed.startsWith('**')) {
                continue;
            }

            // Skip section headers
            if (trimmed.startsWith('##')) {
                break;
            }

            // Skip table rows and separator rows
            if (trimmed.startsWith('|')) {
                continue;
            }

            // Collect paragraph content
            if (trimmed.length > 0) {
                inParagraph = true;
                paragraphLines.push(trimmed);
            } else if (inParagraph) {
                // End of paragraph
                break;
            }
        }

        return paragraphLines.join(' ') || 'No summary available';
    }

    /**
     * Extracts the Outcome value from a metadata table.
     * Matches `| **Outcome** | {value} |` rows.
     */
    extractOutcomeFromTable(content: string): string | null {
        const match = content.match(/\|\s*\*\*Outcome\*\*\s*\|\s*(.+?)\s*\|/i);
        if (!match) {
            return null;
        }
        // Strip markdown formatting (bold, code spans)
        return match[1].replace(/\*\*/g, '').replace(/`/g, '').trim() || null;
    }

    /**
     * Extracts the title text from a heading line, preferring text after an em dash.
     * E.g. `### 2026-02-13T14:15 — Design system architecture` → "Design system architecture"
     */
    extractHeadingTitle(content: string): string | null {
        const match = content.match(/^#{1,6}\s+.+?\s*—\s*(.+)$/m);
        if (match) {
            return match[1].trim();
        }
        // Fall back to full heading text (without the `###` prefix)
        const headingMatch = content.match(/^#{1,6}\s+(.+)$/m);
        return headingMatch?.[1]?.trim() ?? null;
    }

    private extractRelatedIssues(content: string): string[] | undefined {
        const issues: string[] = [];

        // Try dedicated section first
        const issuesSection = this.extractSection(content, 'Related Issues');
        if (issuesSection) {
            const issueMatches = issuesSection.match(/#\d+/g);
            if (issueMatches) {
                issues.push(...issueMatches);
            }
        }

        // Also scan whole content for issue references if section was empty
        if (issues.length === 0) {
            const contentMatches = content.match(/#\d+/g);
            if (contentMatches) {
                // Deduplicate
                const unique = [...new Set(contentMatches)];
                issues.push(...unique);
            }
        }

        return issues.length > 0 ? issues : undefined;
    }

    /**
     * Extracts agent names from the first column of a markdown table.
     * Skips header row and separator row (|---|).
     */
    private extractTableFirstColumn(tableContent: string): string[] {
        const names: string[] = [];
        const lines = tableContent.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            // Skip non-table lines, header separators
            if (!trimmed.startsWith('|') || trimmed.match(/^\|[\s-]+\|/)) {
                continue;
            }
            const cells = trimmed.split('|').map(c => c.trim()).filter(c => c.length > 0);
            if (cells.length >= 1) {
                const name = cells[0];
                // Skip header rows (common headers: "Agent", "Name", "Member")
                if (/^(agent|name|member|who)$/i.test(name)) {
                    continue;
                }
                // Skip bullet-prefixed entries (these are list items, not table data)
                if (name.startsWith('-') || name.startsWith('*')) {
                    continue;
                }
                names.push(name);
            }
        }

        return names;
    }

    /**
     * Parses the "## What Was Done" section into agent-attributed work items.
     * Format: `- **AgentName:** description text`
     */
    private extractWhatWasDone(content: string): { agent: string; description: string }[] | undefined {
        // Try "What Was Done" first, then fall back to "Summary" or "What Happened" for per-agent bullets
        let section = this.extractSection(content, 'What Was Done')
            ?? this.extractSection(content, 'Summary')
            ?? this.extractSection(content, 'What Happened');

        // Fall back to inline bold labels like "**Work done:**" followed by bullet items
        if (!section) {
            const inlineMatch = content.match(/\*\*(?:Work done|What happened|What was done):\*\*\s*\n([\s\S]*?)(?=\n\*\*|\n##\s|$)/i);
            if (inlineMatch) {
                section = inlineMatch[1];
            }
        }

        if (!section) {
            return undefined;
        }

        const items: { agent: string; description: string }[] = [];
        const lines = section.split('\n');

        for (const line of lines) {
            // Match: - **AgentName:** description or - **AgentName (WI-01):** description
            // Colon may be inside or outside bold markers
            const match = line.match(/^\s*[-*]\s+\*\*(.+?):?\*\*:?\s*(.+?)\r?$/);
            if (match) {
                // Strip parenthetical suffixes like "(WI-01/02)" from agent name
                const agent = match[1].replace(/\s*\(.*?\)\s*$/, '').trim();
                items.push({
                    agent,
                    description: match[2].trim(),
                });
                continue;
            }
            // Match unbolded: "- AgentName did something" (capitalized first word as agent)
            const plainMatch = line.match(/^\s*[-*]\s+([A-Z][a-z]+)\s+(.+?)\r?$/);
            if (plainMatch) {
                items.push({
                    agent: plainMatch[1],
                    description: plainMatch[2].trim(),
                });
            }
        }

        return items.length > 0 ? items : undefined;
    }

    /**
     * Checks if outcome text signals completion.
     */
    private isCompletionSignal(text: string): boolean {
        const lower = text.toLowerCase();
        return lower.includes('completed') ||
               lower.includes('done') ||
               lower.includes('✅') ||
               lower.includes('pass') ||
               lower.includes('succeeds');
    }

    /**
     * Generates a deterministic task ID from date and agent name.
     * Format: {date}-{agent-slug} (e.g., "2026-02-10-banner")
     */
    private generateProseTaskId(date: string, agentName: string): string {
        const slug = agentName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return `${date}-${slug}`;
    }

    /**
     * Truncates text to a max length, breaking at word boundaries.
     */
    private truncateTitle(text: string, maxLength: number = 60): string {
        if (text.length <= maxLength) {
            return text;
        }
        const truncated = text.substring(0, maxLength);
        const lastSpace = truncated.lastIndexOf(' ');
        return (lastSpace > maxLength * 0.5 ? truncated.substring(0, lastSpace) : truncated) + '…';
    }
}
