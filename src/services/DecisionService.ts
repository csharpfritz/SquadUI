import * as fs from 'fs';
import * as path from 'path';
import { DecisionEntry } from '../models';

export class DecisionService {
    
    /**
     * Reads all decisions from .ai-team/decisions recursively.
     * @param workspaceRoot Root path of the workspace
     */
    public async getDecisions(workspaceRoot: string): Promise<DecisionEntry[]> {
        const decisionsDir = path.join(workspaceRoot, '.ai-team', 'decisions');
        
        if (!fs.existsSync(decisionsDir)) {
            return [];
        }

        const decisions: DecisionEntry[] = [];
        await this.scanDirectory(decisionsDir, decisions);
        
        // Sort by date descending
        return decisions.sort((a, b) => b.date.localeCompare(a.date));
    }

    private async scanDirectory(dir: string, decisions: DecisionEntry[]): Promise<void> {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                await this.scanDirectory(fullPath, decisions);
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

            // Extract Title (first H1)
            let title = 'Untitled Decision';
            const titleMatch = content.match(/^#\s+(.+)$/m);
            if (titleMatch) {
                title = titleMatch[1].trim();
            }

            // Extract Metadata
            let author = 'Unknown';
            let date = '';
            
            // Simple regex for **Key:** Value
            const authorMatch = content.match(/\*\*Author:\*\*\s*(.+)$/m);
            if (authorMatch) author = authorMatch[1].trim();

            const dateMatch = content.match(/\*\*Date:\*\*\s*(.+)$/m);
            if (dateMatch) date = dateMatch[1].trim();

            // If no date found, use file stats
            if (!date) {
                const stats = fs.statSync(filePath);
                date = stats.birthtime.toISOString().split('T')[0];
            }

            return {
                title,
                author,
                date,
                content,
                filePath
            };
        } catch (error) {
            console.error(`Error parsing decision file ${filePath}:`, error);
            return null;
        }
    }
}
