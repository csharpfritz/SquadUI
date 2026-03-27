/**
 * Service for tracking skill usage across orchestration logs.
 *
 * Scans orchestration log entries for references to skills defined in
 * .ai-team/skills/ (or .squad/skills/). Builds frequency maps and
 * trend data for dashboard visualization.
 *
 * Pure TypeScript  no VS Code dependencies.
 */

import * as fs from 'fs';
import * as path from 'path';
import { OrchestrationLogEntry, Skill, SkillUsageData, SkillUsageMetric, SkillUsageDataPoint } from '../models';
import { normalizeEol } from '../utils/eol';

/**
 * Service for analyzing skill usage patterns in orchestration logs.
 */
export class SkillUsageService {

    /**
     * Builds complete skill usage data from installed skills and orchestration logs.
     *
     * @param teamRoot - Workspace root path
     * @param squadFolder - Squad folder name ('.ai-team' or '.squad')
     * @param logEntries - Parsed orchestration log entries
     * @param installedSkills - Optional pre-fetched installed skills array
     */
    buildSkillUsageData(
        teamRoot: string,
        squadFolder: string,
        logEntries: OrchestrationLogEntry[],
        installedSkills?: Skill[]
    ): SkillUsageData {
        // Discover installed skills
        const skills = installedSkills ?? this.discoverInstalledSkills(teamRoot, squadFolder);

        // Build lookup structures for matching
        const skillNames = skills.map(s => s.name.toLowerCase());
        const skillSlugs = skills.map(s => (s.slug ?? this.slugify(s.name)).toLowerCase());
        const skillDisplayNames = skills.map(s => s.name);

        // Build frequency map: slug -> { count, dates }
        const usageMap = new Map<string, { count: number; dates: Map<string, number> }>();

        for (const entry of logEntries) {
            const text = this.buildSearchableText(entry);
            const matchedSlugs = this.findSkillReferences(text, skillNames, skillSlugs, skillDisplayNames);

            for (const slug of matchedSlugs) {
                let usage = usageMap.get(slug);
                if (!usage) {
                    usage = { count: 0, dates: new Map() };
                    usageMap.set(slug, usage);
                }
                usage.count++;
                const dateCount = usage.dates.get(entry.date) ?? 0;
                usage.dates.set(entry.date, dateCount + 1);
            }
        }

        // Build metrics array
        const metrics: SkillUsageMetric[] = [];
        const usedSlugs = new Set<string>();

        for (const skill of skills) {
            const slug = (skill.slug ?? this.slugify(skill.name)).toLowerCase();
            const usage = usageMap.get(slug);
            usedSlugs.add(slug);

            const trend: SkillUsageDataPoint[] = [];
            if (usage) {
                // Sort dates chronologically
                const sortedDates = Array.from(usage.dates.entries())
                    .sort(([a], [b]) => a.localeCompare(b));
                for (const [date, count] of sortedDates) {
                    trend.push({ date, count });
                }
            }

            const lastUsed = trend.length > 0 ? trend[trend.length - 1].date : undefined;

            metrics.push({
                skillName: skill.name,
                slug: skill.slug ?? this.slugify(skill.name),
                totalReferences: usage?.count ?? 0,
                trend,
                lastUsed,
                isInstalled: true,
            });
        }

        // Check for skills referenced in logs but not installed
        for (const [slug, usage] of usageMap) {
            if (!usedSlugs.has(slug)) {
                const sortedDates = Array.from(usage.dates.entries())
                    .sort(([a], [b]) => a.localeCompare(b));
                const trend: SkillUsageDataPoint[] = sortedDates.map(([date, count]) => ({ date, count }));

                metrics.push({
                    skillName: slug,
                    slug,
                    totalReferences: usage.count,
                    trend,
                    lastUsed: trend.length > 0 ? trend[trend.length - 1].date : undefined,
                    isInstalled: false,
                });
            }
        }

        // Sort by total references descending
        metrics.sort((a, b) => b.totalReferences - a.totalReferences);

        // Identify unused installed skills
        const unusedSkills = metrics
            .filter(m => m.isInstalled && m.totalReferences === 0)
            .map(m => m.skillName);

        return {
            metrics,
            unusedSkills,
            totalLogsScanned: logEntries.length,
        };
    }

    /**
     * Discovers installed skills by scanning the skills/ directory.
     * Returns skill objects with name and slug populated.
     */
    discoverInstalledSkills(teamRoot: string, squadFolder: string): Skill[] {
        const skillsDir = path.join(teamRoot, squadFolder, 'skills');
        if (!fs.existsSync(skillsDir)) {
            return [];
        }

        try {
            const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
            const skills: Skill[] = [];

            for (const entry of entries) {
                if (!entry.isDirectory()) { continue; }

                const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
                let name = entry.name;

                if (fs.existsSync(skillFile)) {
                    const content = normalizeEol(fs.readFileSync(skillFile, 'utf-8'));
                    name = this.extractSkillName(entry.name, content);
                }

                skills.push({
                    name,
                    description: '',
                    source: 'local',
                    slug: entry.name,
                });
            }

            return skills;
        } catch {
            return [];
        }
    }

    /**
     * Extracts the display name from a SKILL.md file.
     * Checks YAML frontmatter first, then falls back to first heading.
     */
    private extractSkillName(dirName: string, content: string): string {
        const lines = content.split('\n');

        // Check frontmatter
        if (lines[0]?.trim() === '---') {
            const closingIndex = lines.indexOf('---', 1);
            if (closingIndex > 0) {
                for (let i = 1; i < closingIndex; i++) {
                    const match = /^name:\s*"?([^"]*)"?\s*$/.exec(lines[i]);
                    if (match?.[1]) {
                        return match[1].trim().replace(/^skill:\s*/i, '');
                    }
                }
            }
        }

        // Fall back to heading
        for (const line of lines) {
            const headingMatch = /^#\s+(.+)/.exec(line);
            if (headingMatch) {
                return headingMatch[1].trim().replace(/^skill:\s*/i, '');
            }
        }

        return dirName;
    }

    /**
     * Builds a searchable text blob from a log entry.
     * Combines summary, decisions, outcomes, and whatWasDone into one lowercased string.
     */
    private buildSearchableText(entry: OrchestrationLogEntry): string {
        const parts: string[] = [
            entry.topic,
            entry.summary,
        ];

        if (entry.decisions) {
            parts.push(...entry.decisions);
        }
        if (entry.outcomes) {
            parts.push(...entry.outcomes);
        }
        if (entry.whatWasDone) {
            for (const item of entry.whatWasDone) {
                parts.push(item.description);
            }
        }

        return parts.join(' ').toLowerCase();
    }

    /**
     * Finds skill references in a text blob.
     * Matches by:
     *   1. Skill slug (directory name) as a word boundary
     *   2. Skill display name (case-insensitive)
     *   3. "skill:" prefix patterns
     *   4. "SKILL.md" file references
     *
     * Returns deduplicated set of matched slugs.
     */
    private findSkillReferences(
        text: string,
        skillNames: string[],
        skillSlugs: string[],
        _skillDisplayNames: string[]
    ): Set<string> {
        const matched = new Set<string>();

        for (let i = 0; i < skillSlugs.length; i++) {
            const slug = skillSlugs[i];
            const name = skillNames[i];

            // Skip very short names that would produce false positives
            if (slug.length < 3 && name.length < 3) { continue; }

            // Match slug as word boundary (e.g., "code-review" in "ran code-review skill")
            const slugPattern = new RegExp(`\\b${this.escapeRegex(slug)}\\b`);
            if (slugPattern.test(text)) {
                matched.add(slug);
                continue;
            }

            // Match display name (case-insensitive, already lowered)
            if (name.length >= 3) {
                const namePattern = new RegExp(`\\b${this.escapeRegex(name)}\\b`);
                if (namePattern.test(text)) {
                    matched.add(slug);
                    continue;
                }
            }

            // Match "skill:{slug}" or "skill: {slug}" patterns
            const skillPrefixPattern = new RegExp(`skill:\\s*${this.escapeRegex(slug)}\\b`);
            if (skillPrefixPattern.test(text)) {
                matched.add(slug);
                continue;
            }

            // Match "{slug}/SKILL.md" file references
            if (text.includes(`${slug}/skill.md`)) {
                matched.add(slug);
            }
        }

        return matched;
    }

    /**
     * Escapes special regex characters in a string.
     */
    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Converts a name to a filesystem-safe slug.
     */
    private slugify(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
}
