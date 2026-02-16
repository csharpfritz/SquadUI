/**
 * Tests for DecisionService — individual decision file parsing and directory scanning.
 *
 * Covers:
 * - parseDecisionFile(): parsing individual .md files in decisions/ directory
 * - scanDirectory(): recursive directory traversal
 * - getDecisions(): integration of decisions.md + decisions/ directory
 * - Edge cases: malformed files, missing metadata, nested directories
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { DecisionService } from '../../services/DecisionService';

const TEST_FIXTURES_ROOT = path.resolve(__dirname, '../../../test-fixtures');

suite('DecisionService — File Parsing', () => {
    let service: DecisionService;
    let tempDir: string;

    setup(() => {
        service = new DecisionService();
        tempDir = path.join(TEST_FIXTURES_ROOT, `temp-decision-files-${Date.now()}`);
        fs.mkdirSync(path.join(tempDir, '.ai-team', 'decisions'), { recursive: true });
    });

    teardown(() => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    // ─── parseDecisionFile() Tests ──────────────────────────────────────

    suite('parseDecisionFile()', () => {
        test('parses decision file with H1 heading', () => {
            const filePath = path.join(tempDir, '.ai-team', 'decisions', 'use-mocha.md');
            fs.writeFileSync(filePath, [
                '# Use Mocha for Testing',
                '',
                '**Date:** 2026-02-10',
                '**Author:** Basher',
                '',
                'We chose Mocha over Jest for VS Code extension testing.',
            ].join('\n'));

            const result = (service as any).parseDecisionFile(filePath);

            assert.ok(result, 'Should return a decision');
            assert.strictEqual(result.title, 'Use Mocha for Testing');
            assert.strictEqual(result.date, '2026-02-10');
            assert.strictEqual(result.author, 'Basher');
            assert.ok(result.content.includes('Mocha over Jest'));
        });

        test('parses decision file with H2 heading (no H1)', () => {
            const filePath = path.join(tempDir, '.ai-team', 'decisions', 'use-sqlite.md');
            fs.writeFileSync(filePath, [
                '## Use SQLite for Local Storage',
                '',
                '**Date:** 2026-01-20',
                '**By:** Linus',
                '',
                'SQLite provides zero-config local storage.',
            ].join('\n'));

            const result = (service as any).parseDecisionFile(filePath);

            assert.ok(result);
            assert.strictEqual(result.title, 'Use SQLite for Local Storage');
            assert.strictEqual(result.date, '2026-01-20');
            assert.strictEqual(result.author, 'Linus');
        });

        test('extracts date from heading prefix', () => {
            const filePath = path.join(tempDir, '.ai-team', 'decisions', 'dated-heading.md');
            fs.writeFileSync(filePath, [
                '### 2026-03-01: Use ESLint over TSLint',
                '',
                'TSLint is deprecated.',
            ].join('\n'));

            const result = (service as any).parseDecisionFile(filePath);

            assert.ok(result);
            assert.strictEqual(result.date, '2026-03-01');
            assert.strictEqual(result.title, 'Use ESLint over TSLint');
        });

        test('strips "Decision:" prefix from title', () => {
            const filePath = path.join(tempDir, '.ai-team', 'decisions', 'prefixed.md');
            fs.writeFileSync(filePath, [
                '# Decision: Adopt Conventional Commits',
                '',
                '**Date:** 2026-02-15',
            ].join('\n'));

            const result = (service as any).parseDecisionFile(filePath);

            assert.ok(result);
            assert.strictEqual(result.title, 'Adopt Conventional Commits');
        });

        test('strips "User directive" prefix from title', () => {
            const filePath = path.join(tempDir, '.ai-team', 'decisions', 'directive.md');
            fs.writeFileSync(filePath, [
                '# User directive — No Auto Merging',
                '',
                '**Date:** 2026-02-20',
            ].join('\n'));

            const result = (service as any).parseDecisionFile(filePath);

            assert.ok(result);
            assert.strictEqual(result.title, 'No Auto Merging');
        });

        test('falls back to file creation date when no date metadata', () => {
            const filePath = path.join(tempDir, '.ai-team', 'decisions', 'no-date.md');
            fs.writeFileSync(filePath, [
                '# Some Decision Without Date',
                '',
                'No date metadata here.',
            ].join('\n'));

            const result = (service as any).parseDecisionFile(filePath);

            assert.ok(result);
            assert.ok(result.date, 'Should have a date from file creation time');
            assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(result.date), 'Date should be YYYY-MM-DD format');
        });

        test('returns "Untitled Decision" when no heading found', () => {
            const filePath = path.join(tempDir, '.ai-team', 'decisions', 'no-heading.md');
            fs.writeFileSync(filePath, 'Just some text without any heading.\n**Date:** 2026-02-10');

            const result = (service as any).parseDecisionFile(filePath);

            assert.ok(result);
            assert.strictEqual(result.title, 'Untitled Decision');
        });

        test('returns null for unreadable file', () => {
            const result = (service as any).parseDecisionFile('/nonexistent/file.md');

            assert.strictEqual(result, null);
        });

        test('matches **By:** pattern for author', () => {
            const filePath = path.join(tempDir, '.ai-team', 'decisions', 'by-pattern.md');
            fs.writeFileSync(filePath, [
                '# Use Prettier',
                '',
                '**By:** Rusty',
                '**Date:** 2026-03-05',
            ].join('\n'));

            const result = (service as any).parseDecisionFile(filePath);

            assert.ok(result);
            assert.strictEqual(result.author, 'Rusty');
        });

        test('prefers **Author:** over **By:**', () => {
            const filePath = path.join(tempDir, '.ai-team', 'decisions', 'dual-author.md');
            fs.writeFileSync(filePath, [
                '# Use Vitest',
                '',
                '**Author:** Danny',
                '**By:** Rusty',
            ].join('\n'));

            const result = (service as any).parseDecisionFile(filePath);

            assert.ok(result);
            assert.strictEqual(result.author, 'Danny');
        });
    });

    // ─── scanDirectory() Tests ──────────────────────────────────────────

    suite('scanDirectory()', () => {
        test('finds .md files in decisions directory', () => {
            fs.writeFileSync(
                path.join(tempDir, '.ai-team', 'decisions', 'decision-a.md'),
                '# Decision A\n**Date:** 2026-01-01'
            );
            fs.writeFileSync(
                path.join(tempDir, '.ai-team', 'decisions', 'decision-b.md'),
                '# Decision B\n**Date:** 2026-01-02'
            );

            const decisions: any[] = [];
            (service as any).scanDirectory(path.join(tempDir, '.ai-team', 'decisions'), decisions);

            assert.strictEqual(decisions.length, 2);
        });

        test('ignores non-.md files', () => {
            fs.writeFileSync(
                path.join(tempDir, '.ai-team', 'decisions', 'decision.md'),
                '# Decision\n**Date:** 2026-01-01'
            );
            fs.writeFileSync(
                path.join(tempDir, '.ai-team', 'decisions', 'readme.txt'),
                'Not a decision'
            );

            const decisions: any[] = [];
            (service as any).scanDirectory(path.join(tempDir, '.ai-team', 'decisions'), decisions);

            assert.strictEqual(decisions.length, 1);
        });

        test('recurses into subdirectories', () => {
            const inboxDir = path.join(tempDir, '.ai-team', 'decisions', 'inbox');
            fs.mkdirSync(inboxDir, { recursive: true });
            fs.writeFileSync(
                path.join(inboxDir, 'basher-testing.md'),
                '# Testing Decision\n**Date:** 2026-02-10'
            );

            const decisions: any[] = [];
            (service as any).scanDirectory(path.join(tempDir, '.ai-team', 'decisions'), decisions);

            assert.strictEqual(decisions.length, 1);
            assert.strictEqual(decisions[0].title, 'Testing Decision');
        });

        test('handles empty directory', () => {
            const decisions: any[] = [];
            (service as any).scanDirectory(path.join(tempDir, '.ai-team', 'decisions'), decisions);

            assert.strictEqual(decisions.length, 0);
        });
    });

    // ─── getDecisions() Integration ─────────────────────────────────────

    suite('getDecisions() — Integration', () => {
        test('combines decisions.md and decisions/ directory', () => {
            // Write decisions.md
            fs.writeFileSync(path.join(tempDir, '.ai-team', 'decisions.md'), [
                '## Use TypeScript',
                '**Date:** 2026-02-01',
                'TypeScript is the way.',
            ].join('\n'));

            // Write individual decision file
            fs.writeFileSync(
                path.join(tempDir, '.ai-team', 'decisions', 'use-mocha.md'),
                '# Use Mocha\n**Date:** 2026-02-10'
            );

            const decisions = service.getDecisions(tempDir);

            assert.ok(decisions.length >= 2, 'Should have at least 2 decisions');
            const titles = decisions.map(d => d.title);
            assert.ok(titles.includes('Use TypeScript'));
            assert.ok(titles.includes('Use Mocha'));
        });

        test('returns decisions sorted by date descending', () => {
            fs.writeFileSync(path.join(tempDir, '.ai-team', 'decisions.md'), [
                '## Old Decision',
                '**Date:** 2025-01-01',
                '',
                '## New Decision',
                '**Date:** 2026-06-15',
            ].join('\n'));

            const decisions = service.getDecisions(tempDir);

            assert.ok(decisions.length >= 2);
            const oldIdx = decisions.findIndex(d => d.title === 'Old Decision');
            const newIdx = decisions.findIndex(d => d.title === 'New Decision');
            assert.ok(newIdx < oldIdx, 'Newer decision should come first');
        });

        test('returns empty array when no decisions exist', () => {
            const emptyDir = path.join(tempDir, 'empty-workspace');
            fs.mkdirSync(emptyDir, { recursive: true });

            const decisions = service.getDecisions(emptyDir);

            assert.deepStrictEqual(decisions, []);
        });

        test('handles missing decisions/ directory gracefully', () => {
            // Only decisions.md, no decisions/ directory
            fs.writeFileSync(path.join(tempDir, '.ai-team', 'decisions.md'), [
                '## Single Decision',
                '**Date:** 2026-03-01',
            ].join('\n'));

            // Remove the decisions/ directory
            fs.rmSync(path.join(tempDir, '.ai-team', 'decisions'), { recursive: true, force: true });

            const decisions = service.getDecisions(tempDir);

            assert.strictEqual(decisions.length, 1);
            assert.strictEqual(decisions[0].title, 'Single Decision');
        });
    });
});
