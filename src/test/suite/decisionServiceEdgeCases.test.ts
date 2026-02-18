/**
 * Tests for DecisionService edge cases — error handling and hardening fixes.
 *
 * Covers:
 * - scanDirectory() handles non-existent directory gracefully
 * - parseDecisionFile() handles file read errors gracefully
 * - getDecisions() works when decisions.md exists but decisions/ directory does not
 * - getDecisions() works when neither decisions.md nor decisions/ directory exists
 * - getDecisions() handles empty decisions.md
 * - DecisionsTreeProvider.getDecisionItems() returns [] when service throws
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { DecisionService } from '../../services/DecisionService';
import { DecisionsTreeProvider } from '../../views/SquadTreeProvider';
import { MockSquadDataProvider } from '../mocks/squadDataProvider';

const TEST_FIXTURES_ROOT = path.resolve(__dirname, '../../../test-fixtures');

suite('DecisionService — Edge Cases (Hardening)', () => {
    let service: DecisionService;
    let tempDir: string;

    setup(() => {
        service = new DecisionService();
        tempDir = path.join(TEST_FIXTURES_ROOT, `temp-decision-edge-${Date.now()}`);
        fs.mkdirSync(tempDir, { recursive: true });
    });

    teardown(() => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    // ─── scanDirectory() Error Handling ─────────────────────────────────

    suite('scanDirectory() — error handling', () => {
        test('handles non-existent directory gracefully (returns empty, no throw)', () => {
            const decisions: any[] = [];
            const bogusPath = path.join(tempDir, 'does-not-exist', 'at-all');

            // Should not throw — the try/catch in scanDirectory returns silently
            assert.doesNotThrow(() => {
                (service as any).scanDirectory(bogusPath, decisions);
            });

            assert.strictEqual(decisions.length, 0, 'Should return empty array for missing dir');
        });
    });

    // ─── parseDecisionFile() Error Handling ─────────────────────────────

    suite('parseDecisionFile() — error handling', () => {
        test('returns null for non-existent file path', () => {
            const result = (service as any).parseDecisionFile(
                path.join(tempDir, 'nonexistent-file.md')
            );

            assert.strictEqual(result, null, 'Should return null when file cannot be read');
        });

        test('returns null for directory path instead of file', () => {
            const dirPath = path.join(tempDir, 'a-directory');
            fs.mkdirSync(dirPath, { recursive: true });

            const result = (service as any).parseDecisionFile(dirPath);

            assert.strictEqual(result, null, 'Should return null when path is a directory');
        });
    });

    // ─── getDecisions() Missing Resources ───────────────────────────────

    suite('getDecisions() — missing resources', () => {
        test('works when decisions.md exists but decisions/ directory does not', () => {
            // Create .ai-team with decisions.md but NO decisions/ subfolder
            fs.mkdirSync(path.join(tempDir, '.ai-team'), { recursive: true });
            fs.writeFileSync(path.join(tempDir, '.ai-team', 'decisions.md'), [
                '## Only in Markdown',
                '**Date:** 2026-03-01',
                '**Author:** Basher',
            ].join('\n'));

            // decisions/ directory intentionally absent
            assert.ok(!fs.existsSync(path.join(tempDir, '.ai-team', 'decisions')),
                'Precondition: decisions/ should not exist');

            const decisions = service.getDecisions(tempDir);

            assert.strictEqual(decisions.length, 1);
            assert.strictEqual(decisions[0].title, 'Only in Markdown');
        });

        test('works when neither decisions.md nor decisions/ directory exists', () => {
            // Create .ai-team but nothing inside
            fs.mkdirSync(path.join(tempDir, '.ai-team'), { recursive: true });

            assert.ok(!fs.existsSync(path.join(tempDir, '.ai-team', 'decisions.md')),
                'Precondition: decisions.md should not exist');
            assert.ok(!fs.existsSync(path.join(tempDir, '.ai-team', 'decisions')),
                'Precondition: decisions/ should not exist');

            const decisions = service.getDecisions(tempDir);

            assert.deepStrictEqual(decisions, [], 'Should return empty array');
        });

        test('returns empty array when .ai-team/ does not exist at all', () => {
            // tempDir has no .ai-team folder
            const bareDir = path.join(tempDir, 'bare-workspace');
            fs.mkdirSync(bareDir, { recursive: true });

            const decisions = service.getDecisions(bareDir);

            assert.deepStrictEqual(decisions, []);
        });

        test('handles empty decisions.md (file exists, no content)', () => {
            fs.mkdirSync(path.join(tempDir, '.ai-team'), { recursive: true });
            fs.writeFileSync(path.join(tempDir, '.ai-team', 'decisions.md'), '');

            const decisions = service.getDecisions(tempDir);

            assert.deepStrictEqual(decisions, [], 'Empty file should produce no decisions');
        });

        test('handles decisions.md with only whitespace', () => {
            fs.mkdirSync(path.join(tempDir, '.ai-team'), { recursive: true });
            fs.writeFileSync(path.join(tempDir, '.ai-team', 'decisions.md'), '   \n\n  \n');

            const decisions = service.getDecisions(tempDir);

            assert.deepStrictEqual(decisions, [], 'Whitespace-only file should produce no decisions');
        });
    });
});

suite('DecisionsTreeProvider — Error Handling (Hardening)', () => {
    test('getDecisionItems returns empty array when decisionService throws', async () => {
        const tempDir = path.join(TEST_FIXTURES_ROOT, `temp-tree-error-${Date.now()}`);
        fs.mkdirSync(tempDir, { recursive: true });

        try {
            const mockDataProvider = new MockSquadDataProvider({ workspaceRoot: tempDir });
            const provider = new DecisionsTreeProvider(mockDataProvider as never);

            // Replace decisionService with one that throws
            (provider as any).decisionService = {
                getDecisions: () => { throw new Error('Simulated service failure'); }
            };

            const children = await provider.getChildren();

            assert.ok(Array.isArray(children), 'Should return an array');
            assert.strictEqual(children.length, 0, 'Should return empty array on service error');
        } finally {
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
            } catch {
                // Ignore cleanup errors
            }
        }
    });
});
