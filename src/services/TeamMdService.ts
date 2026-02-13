/**
 * Service for reading and parsing team.md roster files.
 * Parses the Members table and extracts squad member information.
 */

import * as fs from 'fs';
import * as path from 'path';
import { SquadMember, TeamRoster } from '../models';

/**
 * Represents the @copilot capability profile parsed from team.md.
 */
export interface CopilotCapabilities {
    /** Whether auto-assign is enabled for @copilot */
    autoAssign: boolean;
    /** Tasks that are a good fit for @copilot */
    goodFit?: string[];
    /** Tasks that need review when routed to @copilot */
    needsReview?: string[];
    /** Tasks not suitable for @copilot */
    notSuitable?: string[];
}

/**
 * Extended roster with @copilot capabilities.
 */
export interface ExtendedTeamRoster extends TeamRoster {
    /** @copilot capability profile if present */
    copilotCapabilities?: CopilotCapabilities;
}

/**
 * Service for discovering and parsing team.md files.
 * Handles malformed/missing files gracefully.
 */
export class TeamMdService {
    private static readonly TEAM_MD_PATH = '.ai-team/team.md';

    /**
     * Parses a team.md file from the specified workspace root.
     * 
     * @param workspaceRoot - Root directory containing the .ai-team folder
     * @returns Parsed team roster, or null if file doesn't exist
     * @throws Error if file exists but cannot be parsed
     */
    async parseTeamMd(workspaceRoot: string): Promise<ExtendedTeamRoster | null> {
        const teamMdPath = path.join(workspaceRoot, TeamMdService.TEAM_MD_PATH);

        // Check if file exists
        try {
            await fs.promises.access(teamMdPath, fs.constants.R_OK);
        } catch {
            return null;
        }

        const content = await fs.promises.readFile(teamMdPath, 'utf-8');
        return this.parseContent(content);
    }

    /**
     * Parses the content of a team.md file.
     * 
     * @param content - Raw markdown content
     * @returns Parsed team roster
     */
    parseContent(content: string): ExtendedTeamRoster {
        const members = this.parseMembers(content);
        const repository = this.extractRepository(content);
        const owner = this.extractOwner(content);
        const copilotCapabilities = this.extractCopilotCapabilities(content);

        return {
            members,
            repository,
            owner,
            copilotCapabilities,
        };
    }

    // ─── Private Helper Methods ────────────────────────────────────────────

    /**
     * Parses the Members table from team.md content.
     * Expected format:
     * | Name | Role | Charter | Status |
     * |------|------|---------|--------|
     * | Danny | Lead | `.ai-team/agents/danny/charter.md` | ✅ Active |
     */
    private parseMembers(content: string): SquadMember[] {
        const members: SquadMember[] = [];

        // Find the Members section
        const membersSection = this.extractSection(content, 'Members');
        if (!membersSection) {
            return members;
        }

        // Parse markdown table
        const tableRows = this.parseMarkdownTable(membersSection);
        
        for (const row of tableRows) {
            const member = this.parseTableRow(row);
            if (member) {
                members.push(member);
            }
        }

        return members;
    }

    /**
     * Parses a markdown table into an array of row objects.
     * Handles the standard | Name | Role | Charter | Status | format.
     */
    private parseMarkdownTable(content: string): Map<string, string>[] {
        const rows: Map<string, string>[] = [];
        const lines = content.split('\n');
        let headers: string[] = [];
        let headerFound = false;

        for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip empty lines
            if (!trimmed) {
                continue;
            }

            // Skip lines that aren't table rows
            if (!trimmed.startsWith('|')) {
                continue;
            }

            // Parse table row
            const cells = trimmed
                .split('|')
                .slice(1, -1) // Remove empty first/last elements
                .map(cell => cell.trim());

            // First row is headers
            if (!headerFound) {
                headers = cells.map(h => h.toLowerCase());
                headerFound = true;
                continue;
            }

            // Skip separator row (|---|---|...)
            if (cells.every(cell => /^[-:]+$/.test(cell))) {
                continue;
            }

            // Create row object
            const rowData = new Map<string, string>();
            for (let i = 0; i < Math.min(headers.length, cells.length); i++) {
                rowData.set(headers[i], cells[i]);
            }

            if (rowData.size > 0) {
                rows.push(rowData);
            }
        }

        return rows;
    }

    /**
     * Converts a table row into a SquadMember.
     */
    private parseTableRow(row: Map<string, string>): SquadMember | null {
        const name = row.get('name');
        const role = row.get('role');
        const statusText = row.get('status') || '';

        if (!name || !role) {
            return null;
        }

        // Skip coordinator entries (they're in a separate section)
        if (role.toLowerCase() === 'coordinator') {
            return null;
        }

        // Determine status from emoji/text markers
        const status = this.parseStatusBadge(statusText);

        return {
            name,
            role,
            status,
        };
    }

    /**
     * Parses status badge text into MemberStatus.
     * Supported formats:
     * - ✅ Active -> 'idle' (available)
     * - 📋 Silent -> 'idle'
     * - 🔄 Monitor -> 'idle'
     * - 🤖 Coding Agent -> 'idle'
     * - Working indicators would be 'working'
     */
    private parseStatusBadge(statusText: string): 'working' | 'idle' {
        const text = statusText.toLowerCase();
        
        // For now, team.md defines configuration status, not runtime status
        // All members start as 'idle' until orchestration logs show them working
        // In the future, we might check for "🔨 Working" or similar markers
        if (text.includes('working') || text.includes('🔨')) {
            return 'working';
        }
        
        return 'idle';
    }

    /**
     * Extracts a section's content from markdown.
     */
    private extractSection(content: string, sectionName: string): string | null {
        const sectionRegex = new RegExp(
            `##\\s+${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`,
            'i'
        );
        const match = content.match(sectionRegex);
        return match?.[1]?.trim() ?? null;
    }

    /**
     * Extracts repository from Issue Source table.
     */
    private extractRepository(content: string): string | undefined {
        // Try Issue Source section table
        const repoMatch = content.match(/\*\*Repository\*\*\s*\|\s*([^\n|]+)/i);
        if (repoMatch) {
            return repoMatch[1].trim();
        }

        // Try Project Context section
        const contextMatch = content.match(/\*\*Repository:\*\*\s*(.+)/i);
        if (contextMatch) {
            return contextMatch[1].trim();
        }

        return undefined;
    }

    /**
     * Extracts owner from Project Context section.
     */
    private extractOwner(content: string): string | undefined {
        const ownerMatch = content.match(/\*\*Owner:\*\*\s*([^(]+)/i);
        if (ownerMatch) {
            return ownerMatch[1].trim();
        }
        return undefined;
    }

    /**
     * Extracts @copilot capability profile.
     */
    private extractCopilotCapabilities(content: string): CopilotCapabilities | undefined {
        // Check for copilot-auto-assign comment
        const autoAssignMatch = content.match(/<!--\s*copilot-auto-assign:\s*(true|false)\s*-->/i);
        const autoAssign = autoAssignMatch?.[1]?.toLowerCase() === 'true';

        // Look for Capabilities section (under Coding Agent section)
        const codingAgentSection = this.extractSection(content, 'Coding Agent');
        const capabilitiesSection = codingAgentSection 
            ? this.extractSubSection(codingAgentSection, 'Capabilities')
            : this.extractSection(content, '@copilot Capabilities');

        // Also check for inline capabilities format
        const inlineCapabilities = this.extractInlineCopilotCapabilities(content);

        if (!capabilitiesSection && !inlineCapabilities && !autoAssignMatch) {
            return undefined;
        }

        const capabilities: CopilotCapabilities = {
            autoAssign,
        };

        if (capabilitiesSection) {
            capabilities.goodFit = this.extractCapabilityList(capabilitiesSection, '🟢');
            capabilities.needsReview = this.extractCapabilityList(capabilitiesSection, '🟡');
            capabilities.notSuitable = this.extractCapabilityList(capabilitiesSection, '🔴');
        } else if (inlineCapabilities) {
            capabilities.goodFit = inlineCapabilities.goodFit;
            capabilities.needsReview = inlineCapabilities.needsReview;
            capabilities.notSuitable = inlineCapabilities.notSuitable;
        }

        return capabilities;
    }

    /**
     * Extracts a subsection from already-extracted section content.
     */
    private extractSubSection(sectionContent: string, subsectionName: string): string | null {
        const sectionRegex = new RegExp(
            `###\\s+${subsectionName}\\s*\\n([\\s\\S]*?)(?=\\n###\\s|$)`,
            'i'
        );
        const match = sectionContent.match(sectionRegex);
        return match?.[1]?.trim() ?? null;
    }

    /**
     * Extracts capability list items following an emoji marker.
     */
    private extractCapabilityList(content: string, emoji: string): string[] | undefined {
        const lines = content.split('\n');
        const items: string[] = [];
        let inSection = false;

        for (const line of lines) {
            const trimmed = line.trim();

            // Start of a capability section
            if (trimmed.includes(emoji)) {
                inSection = true;
                // Check if items are on the same line (inline format)
                const colonIndex = trimmed.indexOf(':');
                if (colonIndex !== -1) {
                    const inlineItems = trimmed.substring(colonIndex + 1).trim();
                    if (inlineItems) {
                        items.push(...inlineItems.split(',').map(s => s.trim()).filter(s => s));
                    }
                }
                continue;
            }

            // End when we hit another emoji section
            if (inSection && (trimmed.includes('🟢') || trimmed.includes('🟡') || trimmed.includes('🔴'))) {
                break;
            }

            // Collect list items
            if (inSection) {
                const listMatch = trimmed.match(/^[-*]\s+(.+)$/);
                if (listMatch) {
                    items.push(listMatch[1].trim());
                }
            }
        }

        return items.length > 0 ? items : undefined;
    }

    /**
     * Extracts inline @copilot capabilities (compact format).
     * Format: 🟢 Good fit: item1, item2, item3
     */
    private extractInlineCopilotCapabilities(content: string): Partial<CopilotCapabilities> | null {
        const result: Partial<CopilotCapabilities> = {};
        let found = false;

        // Match inline format: 🟢 Good fit: items...
        const goodFitMatch = content.match(/🟢\s*Good fit[^:]*:\s*([^\n]+)/i);
        if (goodFitMatch) {
            result.goodFit = goodFitMatch[1].split(',').map(s => s.trim()).filter(s => s);
            found = true;
        }

        const needsReviewMatch = content.match(/🟡\s*Needs review[^:]*:\s*([^\n]+)/i);
        if (needsReviewMatch) {
            result.needsReview = needsReviewMatch[1].split(',').map(s => s.trim()).filter(s => s);
            found = true;
        }

        const notSuitableMatch = content.match(/🔴\s*Not suitable[^:]*:\s*([^\n]+)/i);
        if (notSuitableMatch) {
            result.notSuitable = notSuitableMatch[1].split(',').map(s => s.trim()).filter(s => s);
            found = true;
        }

        return found ? result : null;
    }
}
