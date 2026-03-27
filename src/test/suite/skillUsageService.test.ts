/**
 * Tests for SkillUsageService - tracks skill references in orchestration logs.
 *
 * SkillUsageService has ZERO VS Code dependencies, making it ideal for unit testing.
 * It scans orchestration log entries for skill references, builds frequency maps,
 * and identifies unused skills.
 */

import * as assert from 'assert';
import * as path from 'path';
import { SkillUsageService } from '../../services/SkillUsageService';
import { OrchestrationLogEntry, Skill } from '../../models';

const FIXTURES_ROOT = path.join(__dirname, '..', '..', '..', 'test-fixtures', 'skills-scenario');

function makeLogEntry(overrides: Partial<OrchestrationLogEntry> & { date: string; topic: string }): OrchestrationLogEntry {
    return {
        timestamp: `${overrides.date}T00:00:00Z`,
        date: overrides.date,
        topic: overrides.topic,
        participants: overrides.participants ?? ['Linus'],
        summary: overrides.summary ?? '',
        decisions: overrides.decisions,
        outcomes: overrides.outcomes,
        whatWasDone: overrides.whatWasDone,
        relatedIssues: overrides.relatedIssues,
    };
}

function makeSkill(name: string, slug: string): Skill {
    return { name, description: '', source: 'local', slug };
}

suite('SkillUsageService', () => {
    let service: SkillUsageService;

    setup(() => {
        service = new SkillUsageService();
    });

    suite('discoverInstalledSkills', () => {
        test('discovers skills from test fixtures directory', () => {
            const skills = service.discoverInstalledSkills(FIXTURES_ROOT, '.ai-team');
            assert.ok(skills.length >= 3, `Expected at least 3 skills, got ${skills.length}`);
            const slugs = skills.map((s: Skill) => s.slug);
            assert.ok(slugs.includes('code-review'), 'Should find code-review skill');
            assert.ok(slugs.includes('testing'), 'Should find testing skill');
            assert.ok(slugs.includes('documentation'), 'Should find documentation skill');
        });

        test('extracts name from SKILL.md heading', () => {
            const skills = service.discoverInstalledSkills(FIXTURES_ROOT, '.ai-team');
            const codeReview = skills.find((s: Skill) => s.slug === 'code-review');
            assert.strictEqual(codeReview?.name, 'Code Review');
        });

        test('extracts name from YAML frontmatter', () => {
            const skills = service.discoverInstalledSkills(FIXTURES_ROOT, '.ai-team');
            const testing = skills.find((s: Skill) => s.slug === 'testing');
            assert.strictEqual(testing?.name, 'Testing Expert');
        });

        test('returns empty array for missing skills directory', () => {
            const skills = service.discoverInstalledSkills(FIXTURES_ROOT, '.nonexistent');
            assert.deepStrictEqual(skills, []);
        });
    });

    suite('buildSkillUsageData', () => {
        test('returns empty metrics when no skills and no logs', () => {
            const result = service.buildSkillUsageData('/nonexistent', '.ai-team', []);
            assert.strictEqual(result.metrics.length, 0);
            assert.strictEqual(result.unusedSkills.length, 0);
            assert.strictEqual(result.totalLogsScanned, 0);
        });

        test('counts skill references in log summaries', () => {
            const skills = [makeSkill('Code Review', 'code-review')];
            const logs = [
                makeLogEntry({ date: '2026-03-01', topic: 'sprint-1', summary: 'Ran code-review on the PR' }),
                makeLogEntry({ date: '2026-03-02', topic: 'sprint-2', summary: 'Applied code-review feedback' }),
            ];
            const result = service.buildSkillUsageData('/fake', '.ai-team', logs, skills);
            assert.strictEqual(result.metrics.length, 1);
            assert.strictEqual(result.metrics[0].totalReferences, 2);
            assert.strictEqual(result.metrics[0].skillName, 'Code Review');
        });

        test('counts skill references in decisions and outcomes', () => {
            const skills = [makeSkill('Testing Expert', 'testing')];
            const logs = [
                makeLogEntry({
                    date: '2026-03-01', topic: 'quality', summary: 'Quality sprint',
                    decisions: ['Use testing skill for all PRs'],
                    outcomes: ['testing framework integrated'],
                }),
            ];
            const result = service.buildSkillUsageData('/fake', '.ai-team', logs, skills);
            assert.strictEqual(result.metrics[0].totalReferences, 1);
        });

        test('counts skill references in whatWasDone', () => {
            const skills = [makeSkill('Code Review', 'code-review')];
            const logs = [
                makeLogEntry({
                    date: '2026-03-01', topic: 'review', summary: 'Sprint review',
                    whatWasDone: [{ agent: 'Linus', description: 'Applied code-review skill to all open PRs' }],
                }),
            ];
            const result = service.buildSkillUsageData('/fake', '.ai-team', logs, skills);
            assert.strictEqual(result.metrics[0].totalReferences, 1);
        });

        test('identifies unused installed skills', () => {
            const skills = [makeSkill('Code Review', 'code-review'), makeSkill('Documentation', 'documentation')];
            const logs = [makeLogEntry({ date: '2026-03-01', topic: 'review', summary: 'Used code-review on PR' })];
            const result = service.buildSkillUsageData('/fake', '.ai-team', logs, skills);
            assert.deepStrictEqual(result.unusedSkills, ['Documentation']);
        });

        test('builds trend data with correct dates', () => {
            const skills = [makeSkill('Code Review', 'code-review')];
            const logs = [
                makeLogEntry({ date: '2026-03-01', topic: 'day1', summary: 'Used code-review' }),
                makeLogEntry({ date: '2026-03-01', topic: 'day1b', summary: 'More code-review' }),
                makeLogEntry({ date: '2026-03-03', topic: 'day3', summary: 'code-review again' }),
            ];
            const result = service.buildSkillUsageData('/fake', '.ai-team', logs, skills);
            const trend = result.metrics[0].trend;
            assert.strictEqual(trend.length, 2);
            assert.strictEqual(trend[0].date, '2026-03-01');
            assert.strictEqual(trend[0].count, 2);
            assert.strictEqual(trend[1].date, '2026-03-03');
            assert.strictEqual(trend[1].count, 1);
        });

        test('sets lastUsed to most recent date', () => {
            const skills = [makeSkill('Code Review', 'code-review')];
            const logs = [
                makeLogEntry({ date: '2026-03-01', topic: 'a', summary: 'code-review' }),
                makeLogEntry({ date: '2026-03-15', topic: 'b', summary: 'code-review' }),
            ];
            const result = service.buildSkillUsageData('/fake', '.ai-team', logs, skills);
            assert.strictEqual(result.metrics[0].lastUsed, '2026-03-15');
        });

        test('marks never-used skills with undefined lastUsed', () => {
            const skills = [makeSkill('Documentation', 'documentation')];
            const logs = [makeLogEntry({ date: '2026-03-01', topic: 'a', summary: 'No skills used' })];
            const result = service.buildSkillUsageData('/fake', '.ai-team', logs, skills);
            assert.strictEqual(result.metrics[0].lastUsed, undefined);
        });

        test('sorts metrics by totalReferences descending', () => {
            const skills = [makeSkill('Testing Expert', 'testing'), makeSkill('Code Review', 'code-review')];
            const logs = [
                makeLogEntry({ date: '2026-03-01', topic: 'a', summary: 'code-review done' }),
                makeLogEntry({ date: '2026-03-02', topic: 'b', summary: 'code-review again' }),
                makeLogEntry({ date: '2026-03-03', topic: 'c', summary: 'testing applied' }),
            ];
            const result = service.buildSkillUsageData('/fake', '.ai-team', logs, skills);
            assert.strictEqual(result.metrics[0].skillName, 'Code Review');
            assert.strictEqual(result.metrics[0].totalReferences, 2);
            assert.strictEqual(result.metrics[1].skillName, 'Testing Expert');
            assert.strictEqual(result.metrics[1].totalReferences, 1);
        });

        test('reports totalLogsScanned correctly', () => {
            const result = service.buildSkillUsageData('/fake', '.ai-team', [
                makeLogEntry({ date: '2026-03-01', topic: 'a', summary: 'test' }),
                makeLogEntry({ date: '2026-03-02', topic: 'b', summary: 'test' }),
                makeLogEntry({ date: '2026-03-03', topic: 'c', summary: 'test' }),
            ], []);
            assert.strictEqual(result.totalLogsScanned, 3);
        });

        test('matches skill: prefix pattern', () => {
            const skills = [makeSkill('Code Review', 'code-review')];
            const logs = [makeLogEntry({ date: '2026-03-01', topic: 'a', summary: 'Applied skill: code-review to PR' })];
            const result = service.buildSkillUsageData('/fake', '.ai-team', logs, skills);
            assert.strictEqual(result.metrics[0].totalReferences, 1);
        });

        test('matches SKILL.md file reference', () => {
            const skills = [makeSkill('Code Review', 'code-review')];
            const logs = [makeLogEntry({ date: '2026-03-01', topic: 'a', summary: 'Read code-review/SKILL.md for instructions' })];
            const result = service.buildSkillUsageData('/fake', '.ai-team', logs, skills);
            assert.strictEqual(result.metrics[0].totalReferences, 1);
        });

        test('matches skill by display name', () => {
            const skills = [makeSkill('Testing Expert', 'testing')];
            const logs = [makeLogEntry({ date: '2026-03-01', topic: 'a', summary: 'Applied Testing Expert for coverage' })];
            const result = service.buildSkillUsageData('/fake', '.ai-team', logs, skills);
            assert.strictEqual(result.metrics[0].totalReferences, 1);
        });

        test('does not false-match short substrings', () => {
            const skills = [makeSkill('AI', 'ai')];
            const logs = [makeLogEntry({ date: '2026-03-01', topic: 'a', summary: 'This is mainly about testing' })];
            const result = service.buildSkillUsageData('/fake', '.ai-team', logs, skills);
            assert.strictEqual(result.metrics[0].totalReferences, 0);
        });

        test('all installed skills have isInstalled=true', () => {
            const skills = [makeSkill('Code Review', 'code-review')];
            const result = service.buildSkillUsageData('/fake', '.ai-team', [], skills);
            assert.strictEqual(result.metrics[0].isInstalled, true);
        });

        test('handles log entries with no text content gracefully', () => {
            const skills = [makeSkill('Code Review', 'code-review')];
            const logs = [makeLogEntry({ date: '2026-03-01', topic: 'empty', summary: '' })];
            const result = service.buildSkillUsageData('/fake', '.ai-team', logs, skills);
            assert.strictEqual(result.metrics[0].totalReferences, 0);
        });

        test('matches topic field for skill references', () => {
            const skills = [makeSkill('Code Review', 'code-review')];
            const logs = [makeLogEntry({ date: '2026-03-01', topic: 'code-review-session', summary: 'Sprint session' })];
            const result = service.buildSkillUsageData('/fake', '.ai-team', logs, skills);
            assert.strictEqual(result.metrics[0].totalReferences, 1);
        });

        test('uses test fixtures to discover and analyze skills', () => {
            const logs = [
                makeLogEntry({ date: '2026-03-01', topic: 'review', summary: 'Applied code-review skill' }),
                makeLogEntry({ date: '2026-03-02', topic: 'test', summary: 'Used Testing Expert for coverage' }),
            ];
            const result = service.buildSkillUsageData(FIXTURES_ROOT, '.ai-team', logs);
            assert.ok(result.metrics.length >= 3, 'Should discover all 3 fixture skills');
            assert.ok(result.unusedSkills.length >= 1, 'At least documentation should be unused');
            assert.ok(result.unusedSkills.includes('Documentation'), 'Documentation was never referenced');
        });

        test('counts each log entry at most once per skill', () => {
            const skills = [makeSkill('Code Review', 'code-review')];
            const logs = [makeLogEntry({ date: '2026-03-01', topic: 'review', summary: 'code-review code-review code-review' })];
            const result = service.buildSkillUsageData('/fake', '.ai-team', logs, skills);
            assert.strictEqual(result.metrics[0].totalReferences, 1);
        });
    });
});
