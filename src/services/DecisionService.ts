/**
 * Service for parsing decisions from .ai-team/decisions.md.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DecisionEntry } from '../models';

export class DecisionService {
    /**
     * Parse decisions.md and return structured decision entries.
     * Looks for ## and ### headings as decision titles,
     * extracts date and author from nearby metadata lines.
     */
    getDecisions(workspaceRoot: string): DecisionEntry[] {
        const filePath = path.join(workspaceRoot, '.ai-team', 'decisions.md');
        if (!fs.existsSync(filePath)) {
            return [];
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const decisions: DecisionEntry[] = [];

        let i = 0;
        while (i < lines.length) {
            const line = lines[i].trim();

            // Match ## headings (but not the top-level # title)
            const headingMatch = line.match(/^##\s+(.+)$/);
            if (headingMatch && !line.startsWith('###')) {
                const title = headingMatch[1].trim();
                let date: string | undefined;
                let author: string | undefined;

                // Scan next lines for metadata
                for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                    const metaLine = lines[j].trim();
                    const dateMatch = metaLine.match(/\*\*Date:\*\*\s*(.+)/);
                    if (dateMatch) {
                        date = dateMatch[1].trim();
                    }
                    const authorMatch = metaLine.match(/\*\*Author:\*\*\s*(.+)/);
                    if (authorMatch) {
                        author = authorMatch[1].trim();
                    }
                    // Stop scanning at next heading
                    if (j > i + 1 && metaLine.startsWith('#')) {
                        break;
                    }
                }

                decisions.push({ title, date, author, filePath });
            }

            i++;
        }

        return decisions;
    }
}
