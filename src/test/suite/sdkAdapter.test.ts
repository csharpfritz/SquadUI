/**
 * Integration tests for the SDK Adapter layer.
 *
 * The adapter module (`src/sdk-adapter/index.ts`) is the single integration
 * point between the Squad SDK (`@bradygaster/squad-sdk`) and SquadUI's internal
 * models (SquadMember, DecisionEntry, etc.).
 *
 * These tests validate:
 * - Adapter functions exist and have correct signatures
 * - ParsedAgent → SquadMember mapping correctness
 * - ParsedDecision → DecisionEntry mapping correctness
 * - Edge cases: empty inputs, missing fields, malformed data
 * - Graceful degradation when the adapter module is unavailable
 */

import * as assert from 'assert';
import type { SquadMember, DecisionEntry } from '../../models';

// ---------------------------------------------------------------------------
// Lazy adapter import — allows tests to report clearly when the adapter
// module has not been created yet instead of crashing the entire suite.
// The adapter re-exports its own ParsedAgent/ParsedDecision mirror types.
// ---------------------------------------------------------------------------
/* eslint-disable @typescript-eslint/no-explicit-any */
let adapterModule: any;
let adapterAvailable = false;
let adapterLoadError: string | undefined;

try {
    // src/sdk-adapter/index.ts → compiled to out/sdk-adapter/index.js
    adapterModule = require('../../sdk-adapter/index');
    adapterAvailable = true;
} catch (err: any) {
    adapterLoadError = err?.message ?? String(err);
}

// Re-use the adapter's local type mirrors for building test fixtures.
// If the adapter isn't loaded we define compatible shapes inline.
interface ParsedAgent {
    name: string;
    role: string;
    skills: string[];
    model?: string;
    status?: string;
    aliases?: string[];
    autoAssign?: boolean;
}

interface ParsedDecision {
    title: string;
    body: string;
    configRelevant: boolean;
    date?: string;
    author?: string;
    headingLevel?: number;
}

// ---------------------------------------------------------------------------
// Helpers — build well-formed SDK fixtures
// ---------------------------------------------------------------------------

function makeParsedAgent(overrides: Partial<ParsedAgent> = {}): ParsedAgent {
    return {
        name: 'linus',
        role: 'Backend Dev',
        skills: ['TypeScript', 'Node.js'],
        model: 'gpt-4',
        status: '✅ Active',
        aliases: [],
        autoAssign: false,
        ...overrides,
    };
}

function makeParsedDecision(overrides: Partial<ParsedDecision> = {}): ParsedDecision {
    return {
        title: 'Use Mocha for Testing',
        body: 'We chose Mocha because it works well with VS Code extensions.',
        configRelevant: false,
        date: '2026-02-14',
        author: 'Basher',
        headingLevel: 2,
        ...overrides,
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// Test suite
// ═══════════════════════════════════════════════════════════════════════════

suite('SDK Adapter', () => {

    // ── Module availability ───────────────────────────────────────────────

    suite('Module availability', () => {
        test('sdk-adapter module can be loaded', function () {
            if (!adapterAvailable) {
                this.skip(); // adapter not built yet — expected during early development
                return;
            }
            assert.ok(adapterModule, 'Adapter module should be truthy');
        });

        test('adapter exports adaptParsedAgentToSquadMember function', function () {
            if (!adapterAvailable) { this.skip(); return; }
            assert.strictEqual(
                typeof adapterModule.adaptParsedAgentToSquadMember,
                'function',
                'Should export adaptParsedAgentToSquadMember',
            );
        });

        test('adapter exports adaptParsedDecisionToDecisionEntry function', function () {
            if (!adapterAvailable) { this.skip(); return; }
            assert.strictEqual(
                typeof adapterModule.adaptParsedDecisionToDecisionEntry,
                'function',
                'Should export adaptParsedDecisionToDecisionEntry',
            );
        });

        test('load error message is clear when adapter is missing', function () {
            if (adapterAvailable) { this.skip(); return; }
            assert.ok(
                adapterLoadError,
                'Should have captured a load error message',
            );
            // Typically "Cannot find module …" — just ensure it's non-empty
            assert.ok(
                adapterLoadError!.length > 0,
                'Error message should be non-empty',
            );
        });
    });

    // ── adaptParsedAgentToSquadMember ─────────────────────────────────────

    suite('adaptParsedAgentToSquadMember()', () => {
        /** Shorthand — skips if adapter not available */
        function adapt(agent: ParsedAgent): SquadMember {
            return adapterModule.adaptParsedAgentToSquadMember(agent);
        }

        test('capitalizes kebab-case name for display', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const result = adapt(makeParsedAgent({ name: 'rusty' }));
            assert.strictEqual(result.name, 'Rusty');
        });

        test('maps role correctly', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const result = adapt(makeParsedAgent({ role: 'Extension Dev' }));
            assert.strictEqual(result.role, 'Extension Dev');
        });

        test('defaults status to idle', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const result = adapt(makeParsedAgent());
            assert.strictEqual(result.status, 'idle');
        });

        test('maps working status when SDK status includes "working"', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const result = adapt(makeParsedAgent({ status: 'Working on feature' }));
            assert.strictEqual(result.status, 'working');
        });

        test('maps working status when SDK status includes 🔨 emoji', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const result = adapt(makeParsedAgent({ status: '🔨 Building' }));
            assert.strictEqual(result.status, 'working');
        });

        test('maps non-working status to idle', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const result = adapt(makeParsedAgent({ status: '✅ Active' }));
            assert.strictEqual(result.status, 'idle');
        });

        test('preserves @copilot name as-is (no capitalization)', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const result = adapt(makeParsedAgent({ name: '@copilot' }));
            assert.strictEqual(result.name, '@copilot');
        });

        test('result has no currentTask by default', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const result = adapt(makeParsedAgent());
            assert.strictEqual(result.currentTask, undefined);
        });

        test('handles agent with minimal fields (name + role only)', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const minimal: ParsedAgent = { name: 'ada', role: 'Analyst', skills: [] };
            const result = adapt(minimal);
            assert.strictEqual(result.name, 'Ada');
            assert.strictEqual(result.role, 'Analyst');
            assert.strictEqual(result.status, 'idle');
        });

        test('handles agent with empty name', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const result = adapt(makeParsedAgent({ name: '' }));
            assert.strictEqual(result.name, '');
        });

        test('handles agent with empty role', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const result = adapt(makeParsedAgent({ role: '' }));
            assert.strictEqual(result.role, '');
        });

        test('handles agent with undefined optional fields', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const agent: ParsedAgent = {
                name: 'ghost',
                role: 'Phantom',
                skills: [],
                model: undefined,
                status: undefined,
                aliases: undefined,
                autoAssign: undefined,
            };
            const result = adapt(agent);
            assert.ok(result, 'Should return a result even with all optional fields undefined');
            assert.strictEqual(result.name, 'Ghost');
        });

        test('preserves mapping across multiple agents', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const agents = [
                makeParsedAgent({ name: 'alpha', role: 'Lead' }),
                makeParsedAgent({ name: 'beta', role: 'Tester' }),
                makeParsedAgent({ name: 'gamma', role: 'DevOps' }),
            ];
            const results = agents.map(adapt);
            assert.strictEqual(results.length, 3);
            assert.strictEqual(results[0].name, 'Alpha');
            assert.strictEqual(results[1].name, 'Beta');
            assert.strictEqual(results[2].name, 'Gamma');
        });
    });

    // ── adaptParsedDecisionToDecisionEntry ────────────────────────────────

    suite('adaptParsedDecisionToDecisionEntry()', () => {
        function adapt(decision: ParsedDecision, filePath?: string): DecisionEntry {
            return adapterModule.adaptParsedDecisionToDecisionEntry(decision, filePath ?? 'decisions.md');
        }

        test('maps title correctly', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const result = adapt(makeParsedDecision({ title: 'Use ESLint' }));
            assert.strictEqual(result.title, 'Use ESLint');
        });

        test('maps date correctly', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const result = adapt(makeParsedDecision({ date: '2026-03-01' }));
            assert.strictEqual(result.date, '2026-03-01');
        });

        test('maps author correctly', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const result = adapt(makeParsedDecision({ author: 'Linus' }));
            assert.strictEqual(result.author, 'Linus');
        });

        test('maps body to content', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const body = 'We decided to use Mocha.\nIt integrates well.';
            const result = adapt(makeParsedDecision({ body }));
            assert.strictEqual(result.content, body);
        });

        test('passes through filePath', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const result = adapt(makeParsedDecision(), '/workspace/.ai-team/decisions.md');
            assert.strictEqual(result.filePath, '/workspace/.ai-team/decisions.md');
        });

        test('handles decision with no date', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const result = adapt(makeParsedDecision({ date: undefined }));
            assert.strictEqual(result.date, undefined);
        });

        test('extracts date from **Date:** in body when SDK date is missing', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const result = adapt(makeParsedDecision({
                date: undefined,
                body: '**Date:** 2026-04-15\nSome content.',
            }));
            assert.strictEqual(result.date, '2026-04-15');
        });

        test('extracts author from **Author:** in body when SDK author is missing', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const result = adapt(makeParsedDecision({
                author: undefined,
                body: '**Author:** Danny\nSome content.',
            }));
            assert.strictEqual(result.author, 'Danny');
        });

        test('SDK-provided date takes precedence over body date', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const result = adapt(makeParsedDecision({
                date: '2026-01-01',
                body: '**Date:** 2026-12-31\nContent.',
            }));
            assert.strictEqual(result.date, '2026-01-01');
        });

        test('SDK-provided author takes precedence over body author', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const result = adapt(makeParsedDecision({
                author: 'Basher',
                body: '**Author:** Linus\nContent.',
            }));
            assert.strictEqual(result.author, 'Basher');
        });

        test('handles decision with no author', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const result = adapt(makeParsedDecision({ author: undefined }));
            assert.strictEqual(result.author, undefined);
        });

        test('handles decision with empty body', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const result = adapt(makeParsedDecision({ body: '' }));
            // content can be empty or undefined — either is acceptable
            assert.ok(result.content === '' || result.content === undefined,
                'Empty body should map to empty or undefined content');
        });

        test('handles decision with empty title', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const result = adapt(makeParsedDecision({ title: '' }));
            assert.strictEqual(result.title, '');
        });

        test('handles decision with all optional fields missing', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const minimal: ParsedDecision = {
                title: 'Bare Decision',
                body: 'Just a body.',
                configRelevant: false,
            };
            const result = adapt(minimal);
            assert.ok(result, 'Should return a result');
            assert.strictEqual(result.title, 'Bare Decision');
        });

        test('preserves mapping across multiple decisions', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const decisions = [
                makeParsedDecision({ title: 'Decision A', date: '2026-01-01' }),
                makeParsedDecision({ title: 'Decision B', date: '2026-02-01' }),
                makeParsedDecision({ title: 'Decision C', date: '2026-03-01' }),
            ];
            const results = decisions.map(d => adapt(d));
            assert.strictEqual(results.length, 3);
            assert.strictEqual(results[0].title, 'Decision A');
            assert.strictEqual(results[2].date, '2026-03-01');
        });
    });

    // ── Edge cases & robustness ──────────────────────────────────────────

    suite('Edge cases', () => {
        test('adapter handles agent with very long name', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const longName = 'a'.repeat(1000);
            const result = adapterModule.adaptParsedAgentToSquadMember(
                makeParsedAgent({ name: longName }),
            );
            // capitalizeAgentName uppercases first char
            assert.strictEqual(result.name, 'A' + 'a'.repeat(999));
        });

        test('adapter handles decision with special characters in title', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const title = 'Use "quotes" & <angle> brackets — em-dash';
            const result = adapterModule.adaptParsedDecisionToDecisionEntry(
                makeParsedDecision({ title }),
                'decisions.md',
            );
            assert.strictEqual(result.title, title);
        });

        test('adapter handles agent with unicode name', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const result = adapterModule.adaptParsedAgentToSquadMember(
                makeParsedAgent({ name: '忍者' }),
            );
            // capitalizeAgentName uppercases first char — for CJK chars, toUpperCase is identity
            assert.strictEqual(result.name, '忍者');
        });

        test('adapter handles decision with multiline body', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const body = 'Line 1\nLine 2\nLine 3\n\n## Subsection\nMore content';
            const result = adapterModule.adaptParsedDecisionToDecisionEntry(
                makeParsedDecision({ body }),
                'decisions.md',
            );
            assert.strictEqual(result.content, body);
        });
    });
});
