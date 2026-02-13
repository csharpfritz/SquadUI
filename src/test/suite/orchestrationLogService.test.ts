/**
 * Unit tests for OrchestrationLogService table-format extraction.
 * Verifies extractOutcomeFromTable, extractHeadingTitle, and
 * extractSummaryFallback correctly handle metadata-table log entries.
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { OrchestrationLogService } from '../../services/OrchestrationLogService';

const TEST_FIXTURES_ROOT = path.resolve(__dirname, '../../../test-fixtures');

suite('OrchestrationLogService — Table Format Extraction', () => {
    let service: OrchestrationLogService;

    setup(() => {
        service = new OrchestrationLogService();
    });

    suite('extractOutcomeFromTable()', () => {
        test('extracts value from | **Outcome** | value | row', () => {
            const content = [
                '| Field | Value |',
                '|-------|-------|',
                '| **Agent routed** | Kamala (Lead) |',
                '| **Outcome** | Completed — PRD with 25 work items |',
            ].join('\n');

            const result = service.extractOutcomeFromTable(content);
            assert.strictEqual(result, 'Completed — PRD with 25 work items');
        });

        test('strips markdown bold from outcome value', () => {
            const content = '| **Outcome** | **Success** — all tests pass |';
            const result = service.extractOutcomeFromTable(content);
            assert.strictEqual(result, 'Success — all tests pass');
        });

        test('strips code spans from outcome value', () => {
            const content = '| **Outcome** | Deployed to `production` |';
            const result = service.extractOutcomeFromTable(content);
            assert.strictEqual(result, 'Deployed to production');
        });

        test('returns null when no Outcome row exists', () => {
            const content = [
                '| Field | Value |',
                '|-------|-------|',
                '| **Agent routed** | Kamala |',
            ].join('\n');

            const result = service.extractOutcomeFromTable(content);
            assert.strictEqual(result, null);
        });

        test('returns null for empty content', () => {
            assert.strictEqual(service.extractOutcomeFromTable(''), null);
        });
    });

    suite('extractHeadingTitle()', () => {
        test('extracts text after em dash from heading', () => {
            const content = '### 2026-02-13T14:15 — Design system architecture and write PRD';
            const result = service.extractHeadingTitle(content);
            assert.strictEqual(result, 'Design system architecture and write PRD');
        });

        test('falls back to full heading text when no em dash', () => {
            const content = '## Setup initial scaffolding';
            const result = service.extractHeadingTitle(content);
            assert.strictEqual(result, 'Setup initial scaffolding');
        });

        test('handles h1 headings', () => {
            const content = '# 2026-01-01 — New year kickoff';
            const result = service.extractHeadingTitle(content);
            assert.strictEqual(result, 'New year kickoff');
        });

        test('returns null for content with no headings', () => {
            const content = 'Just some paragraph text\nwith no headings.';
            const result = service.extractHeadingTitle(content);
            assert.strictEqual(result, null);
        });
    });

    suite('extractSummaryFallback() — table row skipping', () => {
        test('skips table rows (lines starting with |)', () => {
            const content = [
                '### 2026-02-13T14:15 — Design system',
                '',
                '| Field | Value |',
                '|-------|-------|',
                '| **Agent routed** | Kamala (Lead) |',
                '| **Outcome** | Completed |',
            ].join('\n');

            const service = new OrchestrationLogService();
            // Access private method via any cast for testing
            const result = (service as any).extractSummaryFallback(content);
            // Should not contain table pipe characters
            assert.ok(!result.includes('|'), `Summary should not contain table pipes, got: "${result}"`);
        });

        test('returns "No summary available" when only table rows exist after heading', () => {
            const content = [
                '### 2026-02-13T14:15 — Design system',
                '',
                '| Field | Value |',
                '|-------|-------|',
                '| **Outcome** | Done |',
            ].join('\n');

            const result = (service as any).extractSummaryFallback(content);
            assert.strictEqual(result, 'No summary available');
        });

        test('still extracts prose paragraphs that appear after tables', () => {
            const content = [
                '### Heading',
                '',
                '| Field | Value |',
                '|-------|-------|',
                '',
                'This is actual summary text.',
            ].join('\n');

            const result = (service as any).extractSummaryFallback(content);
            assert.strictEqual(result, 'This is actual summary text.');
        });
    });

    suite('parseLogFile() — table-format integration', () => {
        let tempDir: string;

        setup(async () => {
            tempDir = path.join(TEST_FIXTURES_ROOT, 'temp-table-format');
            const logDir = path.join(tempDir, '.ai-team', 'orchestration-log');
            await fs.promises.mkdir(logDir, { recursive: true });
        });

        teardown(async () => {
            try {
                await fs.promises.rm(tempDir, { recursive: true, force: true });
            } catch {
                // Ignore cleanup errors
            }
        });

        test('table-only entry gets summary from Outcome, not raw table text', async () => {
            const logDir = path.join(tempDir, '.ai-team', 'orchestration-log');
            const content = [
                '### 2026-02-13T14:15 — Design system architecture and write PRD',
                '',
                '| Field | Value |',
                '|-------|-------|',
                '| **Agent routed** | Kamala (Lead) |',
                '| **Why chosen** | Architecture design — Lead\'s primary domain |',
                '| **Mode** | `sync` |',
                '| **Outcome** | Completed — PRD with 25 work items across 4 phases |',
            ].join('\n');

            await fs.promises.writeFile(
                path.join(logDir, '2026-02-13T1415-design-system.md'),
                content
            );

            const entry = await service.parseLogFile(
                path.join(logDir, '2026-02-13T1415-design-system.md')
            );

            // Summary should come from Outcome, not raw table text
            assert.ok(!entry.summary.includes('|'), `Summary should not contain pipe chars, got: "${entry.summary}"`);
            assert.ok(entry.summary.includes('Completed'), `Summary should contain "Completed", got: "${entry.summary}"`);
            assert.ok(entry.summary.includes('PRD'), `Summary should mention PRD, got: "${entry.summary}"`);
        });

        test('entry with ## Summary section still uses that section (priority 1)', async () => {
            const logDir = path.join(tempDir, '.ai-team', 'orchestration-log');
            const content = [
                '### 2026-02-13T14:15 — Some task',
                '',
                '| Field | Value |',
                '|-------|-------|',
                '| **Outcome** | Table outcome text |',
                '',
                '## Summary',
                'This is the explicit summary section.',
            ].join('\n');

            await fs.promises.writeFile(
                path.join(logDir, '2026-02-13T1415-with-summary.md'),
                content
            );

            const entry = await service.parseLogFile(
                path.join(logDir, '2026-02-13T1415-with-summary.md')
            );

            assert.strictEqual(entry.summary, 'This is the explicit summary section.');
        });

        test('existing prose-based logs still parse correctly', async () => {
            // Verify the existing fixture files still work
            const files = await service.discoverLogFiles(TEST_FIXTURES_ROOT);
            const multiTaskFile = files.find(f => f.includes('2026-02-12-multiple-tasks'));
            assert.ok(multiTaskFile, 'Should find existing fixture');

            const entry = await service.parseLogFile(multiTaskFile);

            assert.ok(entry.summary, 'Existing prose log should still have summary');
            assert.ok(entry.summary.length > 0, 'Summary should not be empty');
            assert.ok(entry.participants.length > 0, 'Should still extract participants');
        });
    });
});
