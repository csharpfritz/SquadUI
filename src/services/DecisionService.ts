/**
 * Service for parsing decisions from .ai-team/decisions.md and .ai-team/decisions/ directory.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DecisionEntry } from '../models';

export class DecisionService {
    /**
     * Parse decisions from both decisions.md and the decisions/ directory.
     * Returns decisions in reverse chronological order (newest first).
     */
    getDecisions(workspaceRoot: string): DecisionEntry[] {
        const decisions: DecisionEntry[] = [];

        // Parse canonical decisions.md
        this.parseDecisionsMd(workspaceRoot, decisions);

        // Also scan individual files in decisions/ directory
        const decisionsDir = path.join(workspaceRoot, '.ai-team', 'decisions');
        if (fs.existsSync(decisionsDir)) {
            this.scanDirectory(decisionsDir, decisions);
        }

        // Sort by date descending (newest first)
        return decisions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }

    private parseDecisionsMd(workspaceRoot: string, decisions: DecisionEntry[]): void {
        const filePath = path.join(workspaceRoot, '.ai-team', 'decisions.md');
        if (!fs.existsSync(filePath)) {
            return;
        }

        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const lines = fileContent.split('\n');

        // Known subsection headings to filter out
        const subsectionNames = new Set([
            'context', 'decision', 'decisions', 'rationale', 'impact',
            'alternatives considered', 'implementation details', 'implementation',
            'members', 'alumni', '@copilot', 'location', 'action required',
            'open questions', 'open questions / risks', 'related issues',
            'success metrics', 'scope decision', 'directive',
            'problem statement', 'data flow analysis', 'root cause',
            'the design gap', 'what should happen', 'recommended fix',
            'test cases to add', 'files to modify', 'for linus',
            'implementation phases', 'sprint goal', 'context & opportunity',
            'work items', 'risks & open questions', 'next steps', 'outcome',
            'success criteria'
        ]);

        // Match decisions at both ## and ### levels:
        // - ## headings are always potential decisions (original structured format)
        // - ### headings are decisions only if they have a date prefix (Scribe-merged inbox format)
        // Plain ### headings (Context, Decision, Rationale) are subsections, not decisions.

        let i = 0;
        while (i < lines.length) {
            const line = lines[i].trim();

            const hashCount = (line.match(/^#+/) || [''])[0].length;

            // Match ## or ### headings
            let headingMatch: RegExpMatchArray | null = null;
            let isDecisionHeading = false;
            if (hashCount === 2) {
                headingMatch = line.match(/^##\s+(.+)$/);
                isDecisionHeading = true; // ## is always a potential decision
            } else if (hashCount === 3) {
                headingMatch = line.match(/^###\s+(.+)$/);
                // ### is only a decision if it starts with a date prefix
                if (headingMatch && /^\d{4}-\d{2}-\d{2}/.test(headingMatch[1].trim())) {
                    isDecisionHeading = true;
                }
            }

            if (headingMatch && isDecisionHeading) {
                let title = headingMatch[1].trim();

                // Fix malformed headings like "## # Some Title" — strip leading "# "
                title = title.replace(/^#\s+/, '');
                // Extract date from heading prefix (e.g., "2026-02-14: Title" or "2026-02-14/15: Title")
                let date: string | undefined;
                const headingDateMatch = title.match(/^(\d{4}-\d{2}-\d{2})(?:\/\d+)?[:/]?\s*/);
                if (headingDateMatch) {
                    date = headingDateMatch[1];
                    title = title.replace(/^\d{4}-\d{2}-\d{2}(?:\/\d+)?[:/]?\s*/, '');
                }
                // Strip "User directive — " or "User directive - " prefix
                title = title.replace(/^User directive\s*[—–-]\s*/i, '');
                // Strip "Decision: " prefix
                title = title.replace(/^Decision:\s*/i, '');

                // Skip generic subsection headings
                const titleLower = title.toLowerCase();
                if (subsectionNames.has(titleLower) ||
                    titleLower.startsWith('items deferred')) {
                    i++;
                    continue;
                }
                let author: string | undefined;

                // Find the end of this section (next heading at same or higher level)
                let sectionEnd = lines.length;
                for (let j = i + 1; j < lines.length; j++) {
                    const nextLine = lines[j].trim();
                    const nextHash = (nextLine.match(/^#+/) || [''])[0].length;
                    if (nextHash > 0 && nextHash <= hashCount) {
                        sectionEnd = j;
                        break;
                    }
                }

                // Extract section content and metadata
                const sectionLines = lines.slice(i, sectionEnd);
                const content = sectionLines.join('\n');

                for (let j = i + 1; j < Math.min(i + 20, sectionEnd); j++) {
                    const metaLine = lines[j].trim();
                    const dateMatch = metaLine.match(/\*\*Date:\*\*\s*(.+)/);
                    if (dateMatch) {
                        // Extract first ISO date from value (handles "2026-02-14, refined 2026-02-15")
                        const isoMatch = dateMatch[1].trim().match(/(\d{4}-\d{2}-\d{2})/);
                        if (isoMatch) { date = isoMatch[1]; }
                    }
                    const authorMatch = metaLine.match(/\*\*Author:\*\*\s*(.+)/);
                    if (authorMatch) {
                        author = authorMatch[1].trim();
                    }
                    // Also match **By:** pattern used by Squad agents
                    const byMatch = metaLine.match(/\*\*By:\*\*\s*(.+)/);
                    if (byMatch && !author) {
                        author = byMatch[1].trim();
                    }
                }

                decisions.push({ title, date, author, content, filePath, lineNumber: i });
            }

            i++;
        }
    }

    private scanDirectory(dir: string, decisions: DecisionEntry[]): void {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                this.scanDirectory(fullPath, decisions);
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                const decision = this.parseDecisionFile(fullPath);
                if (decision) {
                    decisions.push(decision);
                }
            }
        }
    }

    private parseDecisionFile(filePath: string): DecisionEntry | null {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');

            let title = 'Untitled Decision';
            // Prefer H1 heading for title; fall back to H2/H3
            const h1Match = content.match(/^#\s+(?!#)(.+)$/m);
            const hMatch = h1Match || content.match(/^###?\s+(.+)$/m);
            let date: string | undefined;
            if (hMatch) {
                title = hMatch[1].trim();
                // Extract date from heading prefix (e.g., "2026-02-14: Title")
                const headingDateMatch = title.match(/^(\d{4}-\d{2}-\d{2})(?:\/\d+)?[:/]?\s*/);
                if (headingDateMatch) {
                    date = headingDateMatch[1];
                    title = title.replace(/^\d{4}-\d{2}-\d{2}(?:\/\d+)?[:/]?\s*/, '');
                }
                // Strip "User directive — " or "User directive - " prefix
                title = title.replace(/^User directive\s*[—–-]\s*/i, '');
                // Strip common decision doc prefixes
                title = title.replace(/^(?:Design Decision|Decision|Feature Summary|Context|Summary):\s*/i, '');
            }

            let author: string | undefined;

            const authorMatch = content.match(/\*\*(?:Author|By):\*\*\s*(.+)$/m);
            if (authorMatch) { author = authorMatch[1].trim(); }

            const dateMatch = content.match(/\*\*Date:\*\*\s*(.+)$/m);
            if (dateMatch) {
                const isoMatch = dateMatch[1].trim().match(/(\d{4}-\d{2}-\d{2})/);
                if (isoMatch) { date = isoMatch[1]; }
            }

            if (!date) {
                const stats = fs.statSync(filePath);
                date = stats.birthtime.toISOString().split('T')[0];
            }

            return { title, author, date, content, filePath, lineNumber: 0 };
        } catch (error) {
            console.error(`Error parsing decision file ${filePath}:`, error);
            return null;
        }
    }
}
