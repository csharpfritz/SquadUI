/**
 * Service for browsing and downloading skills from external catalogs.
 *
 * Two sources:
 * 1. awesome-copilot — bradygaster/awesome-copilot GitHub repo README
 * 2. skills.sh — https://skills.sh leaderboard page
 *
 * Decoupled from VS Code — uses Node's built-in https module and fs.
 * Returns empty arrays on network failure; never throws from public methods.
 */

import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { Skill } from '../models';

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Service for fetching, searching, and installing skills from external catalogs.
 */
export class SkillCatalogService {

    /**
     * Fetches skill listings from one or both external sources.
     * Returns empty array on network failure — never throws.
     *
     * @param source - Which catalog to query: 'awesome-copilot', 'skills.sh', or 'all'
     */
    async fetchCatalog(source: 'awesome-copilot' | 'skills.sh' | 'all'): Promise<Skill[]> {
        const results: Skill[] = [];

        if (source === 'awesome-copilot' || source === 'all') {
            const awesomeSkills = await this.fetchAwesomeCopilot();
            results.push(...awesomeSkills);
        }

        if (source === 'skills.sh' || source === 'all') {
            const skillsShSkills = await this.fetchSkillsSh();
            results.push(...skillsShSkills);
        }

        if (source === 'all') {
            return this.deduplicateSkills(results);
        }

        return results;
    }

    /**
     * Searches skills by query string across name and description fields.
     * Case-insensitive substring match.
     *
     * @param query - Search string
     * @param source - Optional source filter (defaults to 'all')
     */
    async searchSkills(query: string, source?: 'awesome-copilot' | 'skills.sh' | 'all'): Promise<Skill[]> {
        const catalog = await this.fetchCatalog(source ?? 'all');
        const q = query.toLowerCase();
        return catalog.filter(skill =>
            skill.name.toLowerCase().includes(q) ||
            skill.description.toLowerCase().includes(q)
        );
    }

    /**
     * Downloads a skill and writes it to `.ai-team/skills/{name}/SKILL.md`.
     * Creates directories as needed.
     *
     * @param skill - The skill to download
     * @param teamRoot - Workspace root containing the .ai-team directory
     */
    async downloadSkill(skill: Skill, teamRoot: string): Promise<void> {
        const slug = this.slugify(skill.name);
        const skillDir = path.join(teamRoot, '.ai-team', 'skills', slug);
        const skillFile = path.join(skillDir, 'SKILL.md');

        fs.mkdirSync(skillDir, { recursive: true });

        // If the skill has content, write it directly.
        // Otherwise, build a stub from metadata.
        const content = skill.content ?? this.buildSkillStub(skill);
        fs.writeFileSync(skillFile, content, 'utf-8');
    }

    /**
     * Reads installed skills from `.ai-team/skills/` on disk.
     * Each subdirectory with a SKILL.md is treated as an installed skill.
     *
     * @param teamRoot - Workspace root containing the .ai-team directory
     */
    getInstalledSkills(teamRoot: string): Skill[] {
        const skillsDir = path.join(teamRoot, '.ai-team', 'skills');
        if (!fs.existsSync(skillsDir)) {
            return [];
        }

        const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
        const skills: Skill[] = [];

        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }

            const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
            if (!fs.existsSync(skillFile)) {
                continue;
            }

            const content = fs.readFileSync(skillFile, 'utf-8');
            const parsed = this.parseInstalledSkill(entry.name, content);
            skills.push(parsed);
        }

        return skills;
    }

    // ─── Private: Awesome-Copilot Fetching ──────────────────────────────────

    /**
     * Fetches and parses the awesome-copilot README from GitHub raw content.
     */
    private async fetchAwesomeCopilot(): Promise<Skill[]> {
        try {
            const url = 'https://raw.githubusercontent.com/bradygaster/awesome-copilot/main/README.md';
            const readme = await this.httpsGet(url);
            return this.parseAwesomeReadme(readme);
        } catch {
            return [];
        }
    }

    /**
     * Parses the awesome-copilot README markdown to extract skill entries.
     * Looks for markdown list items with links: `- [Name](url) - Description`
     */
    parseAwesomeReadme(markdown: string): Skill[] {
        const skills: Skill[] = [];
        const lines = markdown.split('\n');

        // Match markdown list items with links: - [Name](URL) - Description
        // Also handles * bullet style
        const linkItemRegex = /^[\s]*[-*]\s+\[([^\]]+)\]\(([^)]+)\)\s*[-–—]?\s*(.*)/;

        for (const line of lines) {
            const match = linkItemRegex.exec(line);
            if (!match) {
                continue;
            }

            const name = match[1].trim();
            const url = match[2].trim();
            const description = match[3].trim();

            // Skip non-skill entries (e.g., "Contributing", header links)
            if (!description || name.length < 2) {
                continue;
            }

            skills.push({
                name,
                description,
                source: 'awesome-copilot',
                url,
                confidence: 'high',
            });
        }

        return skills;
    }

    // ─── Private: skills.sh Fetching ────────────────────────────────────────

    /**
     * Fetches and parses the skills.sh leaderboard page.
     */
    private async fetchSkillsSh(): Promise<Skill[]> {
        try {
            const html = await this.httpsGet('https://skills.sh');
            return this.parseSkillsShHtml(html);
        } catch {
            return [];
        }
    }

    /**
     * Parses skills.sh HTML to extract skill listings.
     * Looks for common patterns: links with skill names and descriptions.
     */
    parseSkillsShHtml(html: string): Skill[] {
        const skills: Skill[] = [];

        // Strategy 1: Look for structured card/list patterns with href links
        // Common pattern: <a href="...">Name</a> with nearby description text
        const linkRegex = /<a[^>]+href="([^"]*)"[^>]*>([^<]+)<\/a>/gi;
        let linkMatch;

        // Collect all anchors with their surrounding context
        while ((linkMatch = linkRegex.exec(html)) !== null) {
            const url = linkMatch[1];
            const name = linkMatch[2].trim();

            // Skip navigation/boilerplate links
            if (this.isBoilerplateLink(name, url)) {
                continue;
            }

            // Look for a description near this link — search forward in the HTML
            const afterLink = html.substring(linkMatch.index, linkMatch.index + 500);
            const description = this.extractNearbyDescription(afterLink);

            if (name.length >= 2) {
                skills.push({
                    name,
                    description: description || name,
                    source: 'skills.sh',
                    url: url.startsWith('http') ? url : `https://skills.sh${url.startsWith('/') ? '' : '/'}${url}`,
                    confidence: description ? 'medium' : 'low',
                });
            }
        }

        // Strategy 2: Look for JSON-LD or structured data
        const jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
        let jsonMatch;
        while ((jsonMatch = jsonLdRegex.exec(html)) !== null) {
            try {
                const data = JSON.parse(jsonMatch[1]);
                const items = Array.isArray(data) ? data : (data.itemListElement ?? []);
                for (const item of items) {
                    const itemData = item.item ?? item;
                    if (itemData.name) {
                        skills.push({
                            name: itemData.name,
                            description: itemData.description ?? itemData.name,
                            source: 'skills.sh',
                            url: itemData.url ?? 'https://skills.sh',
                            confidence: 'medium',
                        });
                    }
                }
            } catch {
                // Malformed JSON-LD — skip
            }
        }

        return this.deduplicateSkills(skills);
    }

    // ─── Private: Deduplication ─────────────────────────────────────────────

    /**
     * Deduplicates skills by name (case-insensitive).
     * When duplicates exist, prefers the awesome-copilot version (higher confidence).
     */
    private deduplicateSkills(skills: Skill[]): Skill[] {
        const seen = new Map<string, Skill>();
        for (const skill of skills) {
            const key = skill.name.toLowerCase();
            const existing = seen.get(key);
            if (!existing) {
                seen.set(key, skill);
            } else if (skill.source === 'awesome-copilot' && existing.source !== 'awesome-copilot') {
                // Prefer awesome-copilot version
                seen.set(key, skill);
            }
        }
        return Array.from(seen.values());
    }

    // ─── Private: HTTP Client ───────────────────────────────────────────────

    /**
     * Makes an HTTPS GET request and returns the response body as a string.
     * Follows redirects (up to 5). Times out after REQUEST_TIMEOUT_MS.
     */
    private httpsGet(url: string, redirectCount = 0): Promise<string> {
        if (redirectCount > 5) {
            return Promise.reject(new Error('Too many redirects'));
        }

        return new Promise((resolve, reject) => {
            const req = https.get(url, {
                headers: {
                    'User-Agent': 'SquadUI-VSCode-Extension',
                    'Accept': 'text/html, text/plain, application/json',
                },
                timeout: REQUEST_TIMEOUT_MS,
            }, (res) => {
                // Follow redirects
                if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const redirectUrl = res.headers.location.startsWith('http')
                        ? res.headers.location
                        : new URL(res.headers.location, url).toString();
                    res.resume(); // drain the response
                    this.httpsGet(redirectUrl, redirectCount + 1).then(resolve, reject);
                    return;
                }

                if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
                    res.resume();
                    reject(new Error(`HTTP ${res.statusCode} from ${url}`));
                    return;
                }

                const chunks: Buffer[] = [];
                res.on('data', (chunk: Buffer) => chunks.push(chunk));
                res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
                res.on('error', reject);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error(`Request timed out: ${url}`));
            });

            req.on('error', reject);
        });
    }

    // ─── Private: Helpers ───────────────────────────────────────────────────

    /**
     * Converts a skill name to a filesystem-safe slug.
     */
    private slugify(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    /**
     * Builds a stub SKILL.md from skill metadata when full content isn't available.
     */
    private buildSkillStub(skill: Skill): string {
        const lines = [
            `# ${skill.name}`,
            '',
            skill.description,
            '',
        ];
        if (skill.url) {
            lines.push(`**Source:** [${skill.source}](${skill.url})`);
            lines.push('');
        }
        lines.push(`> Imported from ${skill.source} catalog`);
        lines.push('');
        return lines.join('\n');
    }

    /**
     * Parses an installed SKILL.md file into a Skill object.
     * Extracts name from the first heading, description from first paragraph.
     */
    private parseInstalledSkill(dirName: string, content: string): Skill {
        const lines = content.split('\n');

        let name = dirName;
        let description = '';
        let confidence: 'low' | 'medium' | 'high' | undefined;
        let source: 'awesome-copilot' | 'skills.sh' | 'local' = 'local';
        let bodyStartIndex = 0;

        // Detect YAML frontmatter (lines between --- markers)
        if (lines[0]?.trim() === '---') {
            const closingIndex = lines.indexOf('---', 1);
            if (closingIndex > 0) {
                bodyStartIndex = closingIndex + 1;
                for (let i = 1; i < closingIndex; i++) {
                    const fmMatch = /^(\w+):\s*"?([^"]*)"?\s*$/.exec(lines[i]);
                    if (!fmMatch) { continue; }
                    const key = fmMatch[1].toLowerCase();
                    const val = fmMatch[2].trim();
                    if (key === 'name' && val) { name = val; }
                    else if (key === 'description' && val) { description = val; }
                    else if (key === 'confidence' && (val === 'low' || val === 'medium' || val === 'high')) { confidence = val; }
                    else if (key === 'source' && val) { /* keep source as 'local' for installed skills */ }
                }
            }
        }

        // Fall back to heading detection if no name from frontmatter
        if (name === dirName) {
            const headingMatch = /^#\s+(.+)/.exec(lines[bodyStartIndex] ?? '');
            if (headingMatch) {
                name = headingMatch[1].trim();
            }
        }

        // Extract description from body if not set by frontmatter
        if (!description) {
            for (let i = bodyStartIndex; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line && !line.startsWith('#') && !line.startsWith('>') && !line.startsWith('**Source:**') && line !== '---') {
                    description = line;
                    break;
                }
            }
        }

        const skill: Skill = {
            name,
            description: description || name,
            source,
            content,
            slug: dirName,
        };
        if (confidence) { skill.confidence = confidence; }
        return skill;
    }

    /**
     * Checks if a link is likely navigation/boilerplate rather than a skill entry.
     */
    private isBoilerplateLink(name: string, url: string): boolean {
        const boilerplateNames = ['home', 'about', 'login', 'sign up', 'register', 'contact', 'privacy', 'terms', 'faq', 'help', 'blog', 'docs'];
        const lowerName = name.toLowerCase();
        if (boilerplateNames.some(b => lowerName === b)) {
            return true;
        }
        // Skip anchors, javascript:, mailto:, etc.
        if (url.startsWith('#') || url.startsWith('javascript:') || url.startsWith('mailto:')) {
            return true;
        }
        // Skip very short names (likely icons or nav items)
        if (name.length < 2 || /^[\s\d]+$/.test(name)) {
            return true;
        }
        return false;
    }

    /**
     * Extracts a description from HTML near a link by looking for text content
     * in nearby tags (p, span, div with description-like content).
     */
    private extractNearbyDescription(htmlFragment: string): string {
        // Look for text in <p>, <span>, <div>, <dd>, <td> tags after the link
        const descRegex = /<(?:p|span|div|dd|td)[^>]*>([^<]{10,200})<\//i;
        const match = descRegex.exec(htmlFragment);
        if (match) {
            return match[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
        }
        return '';
    }
}
