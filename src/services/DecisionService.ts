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

        let i = 0;
        while (i < lines.length) {
            const line = lines[i].trim();

            // Match ## headings only (not # title or ### sub-headings)
            const headingMatch = line.match(/^##\s+(.+)$/);
            if (headingMatch && !line.startsWith('###')) {
                const title = headingMatch[1].trim();
                let date: string | undefined;
                let author: string | undefined;

                // Find the end of this section (next ## heading or EOF)
                let sectionEnd = lines.length;
                for (let j = i + 1; j < lines.length; j++) {
                    const nextLine = lines[j].trim();
                    if (nextLine.match(/^##\s+/) && !nextLine.startsWith('###')) {
                        sectionEnd = j;
                        break;
                    }
                }

                // Extract section content and metadata
                const sectionLines = lines.slice(i, sectionEnd);
                const content = sectionLines.join('\n');

                for (let j = i + 1; j < Math.min(i + 10, sectionEnd); j++) {
                    const metaLine = lines[j].trim();
                    const dateMatch = metaLine.match(/\*\*Date:\*\*\s*(.+)/);
                    if (dateMatch) {
                        date = dateMatch[1].trim();
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
            const titleMatch = content.match(/^###?\s+(.+)$/m);
            if (titleMatch) {
                title = titleMatch[1].trim();
            }

            let author: string | undefined;
            let date: string | undefined;

            const authorMatch = content.match(/\*\*(?:Author|By):\*\*\s*(.+)$/m);
            if (authorMatch) { author = authorMatch[1].trim(); }

            const dateMatch = content.match(/\*\*Date:\*\*\s*(.+)$/m);
            if (dateMatch) { date = dateMatch[1].trim(); }

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
