/**
 * Service for browsing and downloading skills from external catalogs.
 *
 * Two sources:
 * 1. awesome-copilot — github/awesome-copilot GitHub repo docs/README.skills.md
 * 2. skills.sh — https://skills.sh leaderboard page
 *
 * Decoupled from VS Code — uses Node's built-in https module and fs.
 * Returns empty arrays on network failure; never throws from public methods.
 */

import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { Skill } from '../models';
import { getSquadPath } from '../utils/squadFolderDetection';

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Service for fetching, searching, and installing skills from external catalogs.
 */
export class SkillCatalogService {

    /**
     * Fetches skill listings from one or both external sources.
     * Throws on network failure to allow command layer to show appropriate error.
     *
     * @param source - Which catalog to query: 'awesome-copilot', 'skills.sh', or 'all'
     */
    async fetchCatalog(source: 'awesome-copilot' | 'skills.sh' | 'all'): Promise<Skill[]> {
        const results: Skill[] = [];
        const errors: string[] = [];

        if (source === 'awesome-copilot' || source === 'all') {
            try {
                const awesomeSkills = await this.fetchAwesomeCopilot();
                results.push(...awesomeSkills);
            } catch (err) {
                errors.push(`awesome-copilot: ${err instanceof Error ? err.message : 'fetch failed'}`);
            }
        }

        if (source === 'skills.sh' || source === 'all') {
            try {
                const skillsShSkills = await this.fetchSkillsSh();
                results.push(...skillsShSkills);
            } catch (err) {
                errors.push(`skills.sh: ${err instanceof Error ? err.message : 'fetch failed'}`);
            }
        }

        // If all sources failed, throw with details
        if (results.length === 0 && errors.length > 0) {
            throw new Error(`Failed to fetch skills: ${errors.join(', ')}`);
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
            (skill.description || '').toLowerCase().includes(q)
        );
    }

    /**
     * Downloads a skill and writes it to `.squad/skills/{name}/SKILL.md` or `.ai-team/skills/{name}/SKILL.md`.
     * Creates directories as needed. Throws if the skill directory already exists
     * unless `force` is true.
     *
     * @param skill - The skill to download
     * @param teamRoot - Workspace root containing the squad directory
     * @param force - If true, overwrite an existing skill directory
     */
    async downloadSkill(skill: Skill, teamRoot: string, force = false): Promise<void> {
        const slug = this.slugify(skill.name);
        const skillDir = getSquadPath(teamRoot, path.join('skills', slug));
        const skillFile = path.join(skillDir, 'SKILL.md');

        // Duplicate protection: refuse to overwrite unless forced
        if (!force && fs.existsSync(skillDir)) {
            throw new Error(`Skill "${skill.name}" is already installed. Overwrite?`);
        }

        fs.mkdirSync(skillDir, { recursive: true });

        // Try to fetch real content if not already set
        let content = skill.content;
        if (!content) {
            content = await this.fetchSkillContent(skill);
        }
        if (!content) {
            content = this.buildSkillStub(skill);
        }

        fs.writeFileSync(skillFile, content, 'utf-8');
    }

    /**
     * Reads installed skills from `.squad/skills/` or `.ai-team/skills/` on disk.
     * Each subdirectory with a SKILL.md is treated as an installed skill.
     *
     * @param teamRoot - Workspace root containing the squad directory
     */
    getInstalledSkills(teamRoot: string): Skill[] {
        const skillsDir = getSquadPath(teamRoot, 'skills');
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
     * Fetches and parses the awesome-copilot skills page from GitHub raw content.
     * Throws on network failure.
     */
    private async fetchAwesomeCopilot(): Promise<Skill[]> {
        const url = 'https://raw.githubusercontent.com/github/awesome-copilot/main/docs/README.skills.md';
        const readme = await this.httpsGet(url);
        return this.parseAwesomeReadme(readme);
    }

    /**
     * Parses the awesome-copilot skills markdown to extract skill entries.
     * Handles both table rows: `| [Name](url) | Description | Assets |`
     * and list items: `- [Name](url) - Description`
     */
    parseAwesomeReadme(markdown: string): Skill[] {
        const skills: Skill[] = [];
        const lines = markdown.split('\n');

        // Table row: | [Name](../skills/name/SKILL.md) | Description | Assets |
        const tableRowRegex = /^\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*(.*?)\s*\|/;
        // List item: - [Name](url) - Description
        const linkItemRegex = /^[\s]*[-*]\s+\[([^\]]+)\]\(([^)]+)\)\s*[-–—]?\s*(.*)/;

        for (const line of lines) {
            // Skip table header separator rows
            if (/^\|\s*-+\s*\|/.test(line)) {
                continue;
            }

            const tableMatch = tableRowRegex.exec(line);
            if (tableMatch) {
                const name = tableMatch[1].trim();
                const relativeUrl = tableMatch[2].trim();
                // Strip HTML tags from description (e.g., <br />)
                const description = tableMatch[3].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

                if (!description || name.length < 2) {
                    continue;
                }

                // Convert relative paths to GitHub URLs
                const url = relativeUrl.startsWith('../skills/')
                    ? `https://github.com/github/awesome-copilot/tree/main/skills/${relativeUrl.replace('../skills/', '').replace('/SKILL.md', '')}`
                    : relativeUrl;

                skills.push({
                    name,
                    description,
                    source: 'awesome-copilot',
                    url,
                    confidence: 'high',
                });
                continue;
            }

            const listMatch = linkItemRegex.exec(line);
            if (listMatch) {
                const name = listMatch[1].trim();
                const url = listMatch[2].trim();
                const description = listMatch[3].trim();

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
        }

        return skills;
    }

    // ─── Private: skills.sh Fetching ────────────────────────────────────────

    /**
     * Fetches and parses the skills.sh leaderboard page.
     * Throws on network failure.
     */
    private async fetchSkillsSh(): Promise<Skill[]> {
        const html = await this.httpsGet('https://skills.sh');
        return this.parseSkillsShHtml(html);
    }

    /**
     * Parses skills.sh HTML to extract skill listings.
     * Looks for leaderboard entries with pattern: <a href="/{owner}/{repo}/{skill}">
     */
    parseSkillsShHtml(html: string): Skill[] {
        const skills: Skill[] = [];

        // Match leaderboard entry pattern: <a href="/{owner}/{repo}/{skill}"> with <h3> skill name inside
        // Pattern: <a ... href="/owner/repo/skill-name">...<h3>skill-name</h3>...<p>owner/repo</p>...</a>
        const entryRegex = /<a[^>]+href="\/([^/]+)\/([^/]+)\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let entryMatch;

        while ((entryMatch = entryRegex.exec(html)) !== null) {
            const owner = entryMatch[1];
            const repo = entryMatch[2];
            const skillSlug = entryMatch[3];
            const innerHtml = entryMatch[4];

            // Skip navigation links (only process 3-segment paths)
            if (!owner || !repo || !skillSlug) {
                continue;
            }

            // Extract skill name from <h3>
            const h3Match = /<h3[^>]*>([^<]+)<\/h3>/i.exec(innerHtml);
            if (!h3Match) {
                continue;
            }
            const name = h3Match[1].trim();

            // Extract description from <p> tag (should be owner/repo)
            const descMatch = /<p[^>]*class="[^"]*font-mono[^"]*"[^>]*>([^<]+)<\/p>/i.exec(innerHtml);
            const description = descMatch ? descMatch[1].trim() : `${owner}/${repo}`;

            // Build GitHub URL (not skills.sh URL)
            const url = `https://github.com/${owner}/${repo}`;

            skills.push({
                name,
                description,
                source: 'skills.sh',
                url,
                confidence: 'high',
            });
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

    // ─── Private: Skill Content Fetching ────────────────────────────────────

    /**
     * Attempts to fetch the actual skill content from the skill's URL.
     * For GitHub repo URLs, tries common prompt file paths in order.
     * Returns undefined if content cannot be fetched (caller falls back to stub).
     */
    async fetchSkillContent(skill: Skill): Promise<string | undefined> {
        if (!skill.url) {
            return undefined;
        }

        const ghRepo = this.parseGitHubRepoUrl(skill.url);
        if (ghRepo) {
            // If URL has a subpath (e.g., /tree/main/skills/agentic-eval), try SKILL.md there first
            const subpath = this.extractGitHubSubpath(skill.url);
            const candidatePaths: string[] = [];
            if (subpath) {
                candidatePaths.push(`${subpath}/SKILL.md`, `${subpath}/README.md`);
            }
            candidatePaths.push('.github/copilot-instructions.md', 'SKILL.md', 'README.md');

            for (const filePath of candidatePaths) {
                const rawUrl = `https://raw.githubusercontent.com/${ghRepo.owner}/${ghRepo.repo}/main/${filePath}`;
                try {
                    return await this.httpsGet(rawUrl);
                } catch {
                    // File not found at this path — try next
                }
            }
            return undefined;
        }

        // Not a GitHub repo URL — try fetching it directly as a raw file
        try {
            return await this.httpsGet(skill.url);
        } catch {
            return undefined;
        }
    }

    /**
     * Extracts the subpath from a GitHub tree/blob URL.
     * E.g., https://github.com/owner/repo/tree/main/skills/foo → 'skills/foo'
     */
    private extractGitHubSubpath(url: string): string | undefined {
        const match = /^https?:\/\/github\.com\/[^/]+\/[^/]+\/(?:tree|blob)\/[^/]+\/(.+)$/.exec(url);
        return match?.[1];
    }

    /**
     * Parses a GitHub repo URL into owner/repo components.
     * Returns undefined if the URL is not a GitHub repo URL.
     * Handles: https://github.com/{owner}/{repo}[/...]
     */
    private parseGitHubRepoUrl(url: string): { owner: string; repo: string } | undefined {
        const match = /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\/.*)?(?:\.git)?$/.exec(url);
        if (!match) {
            return undefined;
        }
        return { owner: match[1], repo: match[2] };
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
        if (skill.url) {
            lines.push(`> ⚠️ Full content could not be fetched from the source URL. Visit the link above for details.`);
        }
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
        const source: 'awesome-copilot' | 'skills.sh' | 'local' = 'local';
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
            for (let i = bodyStartIndex; i < lines.length; i++) {
                const headingMatch = /^#\s+(.+)/.exec(lines[i]);
                if (headingMatch) {
                    name = headingMatch[1].trim();
                    break;
                }
            }
        }

        // Strip "Skill: " prefix (case-insensitive)
        name = name.replace(/^skill:\s*/i, '');

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

}
