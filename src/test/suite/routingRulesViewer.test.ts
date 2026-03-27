/**
 * Tests for SDK Phase 4 — Routing Rules Viewer.
 *
 * Validates:
 * - parseRoutingRules() SDK adapter function
 * - adaptRoutingRules() mapping function
 * - RoutingRulesTreeProvider tree data generation
 * - Edge cases: empty input, missing file, malformed data
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import type { RoutingRule } from '../../models';

// Lazy adapter import — same pattern as sdkAdapter.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
let adapterModule: any;
let adapterAvailable = false;

try {
    adapterModule = require('../../sdk-adapter/index');
    adapterAvailable = true;
} catch {
    // SDK adapter not available
}

// SDK type mirror for test fixtures
interface ParsedRoutingRule {
    workType: string;
    agents: string[];
    examples?: string[];
}

const TEST_FIXTURES_ROOT = path.resolve(__dirname, '../../../test-fixtures');

suite('Routing Rules Viewer (SDK Phase 4)', () => {

    suite('SDK Adapter — parseRoutingRules()', () => {

        test('adapter exports parseRoutingRules function', function () {
            if (!adapterAvailable) { this.skip(); return; }
            assert.strictEqual(typeof adapterModule.parseRoutingRules, 'function',
                'parseRoutingRules should be a function');
        });

        test('adapter exports adaptRoutingRules function', function () {
            if (!adapterAvailable) { this.skip(); return; }
            assert.strictEqual(typeof adapterModule.adaptRoutingRules, 'function',
                'adaptRoutingRules should be a function');
        });

        test('parseRoutingRules returns rules and warnings for valid content', async function () {
            if (!adapterAvailable) { this.skip(); return; }
            const routingPath = path.join(TEST_FIXTURES_ROOT, '.ai-team', 'routing.md');
            if (!fs.existsSync(routingPath)) { this.skip(); return; }

            const content = fs.readFileSync(routingPath, 'utf-8');
            const result = await adapterModule.parseRoutingRules(content);

            assert.ok(result, 'Should return a result object');
            assert.ok(Array.isArray(result.rules), 'Should have a rules array');
            assert.ok(Array.isArray(result.warnings), 'Should have a warnings array');
            assert.ok(result.rules.length > 0, 'Should parse at least one rule from fixture');
        });

        test('parseRoutingRules returns empty rules for empty content', async function () {
            if (!adapterAvailable) { this.skip(); return; }

            const result = await adapterModule.parseRoutingRules('');
            assert.ok(result, 'Should return a result object');
            assert.ok(Array.isArray(result.rules), 'Should have a rules array');
            assert.strictEqual(result.rules.length, 0, 'Empty content should yield no rules');
        });

        test('parseRoutingRules returns empty rules for content without table', async function () {
            if (!adapterAvailable) { this.skip(); return; }

            const content = '# Routing\n\nNo table here, just some text.\n';
            const result = await adapterModule.parseRoutingRules(content);
            assert.ok(result, 'Should return a result object');
            assert.strictEqual(result.rules.length, 0, 'Content without table should yield no rules');
        });
    });

    suite('SDK Adapter — adaptRoutingRules()', () => {

        test('capitalizes agent names from kebab-case', function () {
            if (!adapterAvailable) { this.skip(); return; }

            const rules: ParsedRoutingRule[] = [
                { workType: 'feature-dev', agents: ['rusty', 'linus'], examples: ['New features'] },
            ];
            const adapted: RoutingRule[] = adapterModule.adaptRoutingRules(rules);

            assert.strictEqual(adapted.length, 1);
            assert.strictEqual(adapted[0].agents[0], 'Rusty');
            assert.strictEqual(adapted[0].agents[1], 'Linus');
        });

        test('passes through already-capitalized names', function () {
            if (!adapterAvailable) { this.skip(); return; }

            const rules: ParsedRoutingRule[] = [
                { workType: 'feature-dev', agents: ['Rusty', 'Linus'], examples: ['New features'] },
            ];
            const adapted: RoutingRule[] = adapterModule.adaptRoutingRules(rules);

            assert.strictEqual(adapted[0].agents[0], 'Rusty');
            assert.strictEqual(adapted[0].agents[1], 'Linus');
        });

        test('preserves work type and examples', function () {
            if (!adapterAvailable) { this.skip(); return; }

            const rules: ParsedRoutingRule[] = [
                { workType: 'Bug Fix', agents: ['basher'], examples: ['Fix crash', 'Fix regression'] },
            ];
            const adapted: RoutingRule[] = adapterModule.adaptRoutingRules(rules);

            assert.strictEqual(adapted[0].workType, 'Bug Fix');
            assert.deepStrictEqual(adapted[0].examples, ['Fix crash', 'Fix regression']);
        });

        test('handles rules with no examples', function () {
            if (!adapterAvailable) { this.skip(); return; }

            const rules: ParsedRoutingRule[] = [
                { workType: 'docs', agents: ['danny'] },
            ];
            const adapted: RoutingRule[] = adapterModule.adaptRoutingRules(rules);

            assert.strictEqual(adapted.length, 1);
            assert.deepStrictEqual(adapted[0].examples, []);
        });

        test('handles empty rules array', function () {
            if (!adapterAvailable) { this.skip(); return; }

            const adapted: RoutingRule[] = adapterModule.adaptRoutingRules([]);
            assert.strictEqual(adapted.length, 0);
        });

        test('preserves @-prefixed agent names as-is', function () {
            if (!adapterAvailable) { this.skip(); return; }

            const rules: ParsedRoutingRule[] = [
                { workType: 'triage', agents: ['@copilot'], examples: [] },
            ];
            const adapted: RoutingRule[] = adapterModule.adaptRoutingRules(rules);

            assert.strictEqual(adapted[0].agents[0], '@copilot');
        });
    });

    suite('RoutingRulesTreeProvider', () => {

        let RoutingRulesTreeProvider: any;
        let providerAvailable = false;

        try {
            const viewsModule = require('../../views/RoutingRulesTreeProvider');
            RoutingRulesTreeProvider = viewsModule.RoutingRulesTreeProvider;
            providerAvailable = true;
        } catch {
            // Provider not available
        }

        test('provider class exists and is constructable', function () {
            if (!providerAvailable) { this.skip(); return; }
            const provider = new RoutingRulesTreeProvider(TEST_FIXTURES_ROOT, '.ai-team');
            assert.ok(provider, 'Provider should be constructable');
        });

        test('getRoutingPath returns correct path', function () {
            if (!providerAvailable) { this.skip(); return; }
            const provider = new RoutingRulesTreeProvider(TEST_FIXTURES_ROOT, '.ai-team');
            const expected = path.join(TEST_FIXTURES_ROOT, '.ai-team', 'routing.md');
            assert.strictEqual(provider.getRoutingPath(), expected);
        });

        test('getChildren returns items when routing.md exists', async function () {
            if (!providerAvailable) { this.skip(); return; }
            const routingPath = path.join(TEST_FIXTURES_ROOT, '.ai-team', 'routing.md');
            if (!fs.existsSync(routingPath)) { this.skip(); return; }

            const provider = new RoutingRulesTreeProvider(TEST_FIXTURES_ROOT, '.ai-team');
            const items = await provider.getChildren(undefined);

            assert.ok(items.length > 0, 'Should return at least one tree item');
            // First item should be a routing rule (not the empty message)
            assert.notStrictEqual(items[0].itemType, 'empty',
                'Should not show empty message when routing.md has rules');
        });

        test('getChildren returns empty message when routing.md does not exist', async function () {
            if (!providerAvailable) { this.skip(); return; }
            const tempDir = path.join(TEST_FIXTURES_ROOT, `temp-routing-${Date.now()}`);
            const squadDir = path.join(tempDir, '.ai-team');
            fs.mkdirSync(squadDir, { recursive: true });

            try {
                const provider = new RoutingRulesTreeProvider(tempDir, '.ai-team');
                const items = await provider.getChildren(undefined);

                assert.strictEqual(items.length, 1, 'Should return single empty message item');
                assert.strictEqual(items[0].itemType, 'empty');
                assert.ok(items[0].label.includes('No routing rules'),
                    'Empty message should mention no routing rules');
            } finally {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        });

        test('refresh() resets loaded state', async function () {
            if (!providerAvailable) { this.skip(); return; }
            const provider = new RoutingRulesTreeProvider(TEST_FIXTURES_ROOT, '.ai-team');

            // Load once
            await provider.getChildren(undefined);
            const rulesBeforeRefresh = provider.getRules();

            // Refresh clears loaded state
            provider.refresh();
            assert.deepStrictEqual(provider.getRules(), [],
                'Rules should be cleared after refresh');

            // Reload
            await provider.getChildren(undefined);
            const rulesAfterRefresh = provider.getRules();
            assert.ok(rulesAfterRefresh.length > 0 || rulesBeforeRefresh.length === 0,
                'Rules should reload after refresh');
        });
    });
});
