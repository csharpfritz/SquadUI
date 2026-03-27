/**
 * Integration tests for SDK Data Model Harmonization (Phase 3).
 *
 * Validates the formalized adapter layer that maps SDK types to SquadUI types:
 * - Bulk mapping functions (adaptAgentsToMembers, adaptDecisionsToEntries)
 * - getSquadMetadata() high-level integration
 * - Round-trip consistency: fixture data → SDK parse → adapt → validate
 * - Edge cases: empty arrays, null fields, long strings, special characters
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import type { SquadMember, DecisionEntry, MemberStatus } from '../../models';

// ---------------------------------------------------------------------------
// Lazy adapter import — same pattern as sdkAdapter.test.ts
// ---------------------------------------------------------------------------
/* eslint-disable @typescript-eslint/no-explicit-any */
let adapter: any;
let adapterAvailable = false;

try {
    adapter = require('../../sdk-adapter/index');
    adapterAvailable = true;
} catch {
    // adapter not built yet
}

// SDK type mirrors for test fixtures
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

const TEST_FIXTURES_ROOT = path.resolve(__dirname, '../../../test-fixtures');

// ---------------------------------------------------------------------------
// Helpers
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

const VALID_STATUSES = new Set<MemberStatus>([
    'working-on-issue', 'reviewing-pr', 'waiting-review', 'working', 'idle',
]);

// ═══════════════════════════════════════════════════════════════════════════
// Test suites
// ═══════════════════════════════════════════════════════════════════════════

suite('SDK Model Harmonization — Bulk Mapping', () => {

    // ── adaptAgentsToMembers ──────────────────────────────────────────────

    suite('adaptAgentsToMembers()', () => {
        test('maps empty array to empty array', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const result: SquadMember[] = adapter.adaptAgentsToMembers([]);
            assert.deepStrictEqual(result, []);
        });

        test('maps single agent correctly', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const agents = [makeParsedAgent({ name: 'danny', role: 'Lead' })];
            const result: SquadMember[] = adapter.adaptAgentsToMembers(agents);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'Danny');
            assert.strictEqual(result[0].role, 'Lead');
            assert.strictEqual(result[0].status, 'idle');
        });

        test('maps multiple agents preserving order', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const agents = [
                makeParsedAgent({ name: 'alpha', role: 'Lead' }),
                makeParsedAgent({ name: 'beta', role: 'Dev' }),
                makeParsedAgent({ name: 'gamma', role: 'Tester' }),
                makeParsedAgent({ name: 'delta', role: 'DevOps' }),
                makeParsedAgent({ name: '@copilot', role: 'Coding Agent' }),
            ];
            const result: SquadMember[] = adapter.adaptAgentsToMembers(agents);
            assert.strictEqual(result.length, 5);
            assert.strictEqual(result[0].name, 'Alpha');
            assert.strictEqual(result[1].name, 'Beta');
            assert.strictEqual(result[2].name, 'Gamma');
            assert.strictEqual(result[3].name, 'Delta');
            assert.strictEqual(result[4].name, '@copilot');
        });

        test('applies defaultStatus option to all non-working agents', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const agents = [
                makeParsedAgent({ name: 'a', status: '✅ Active' }),
                makeParsedAgent({ name: 'b', status: 'Working on fix' }),
            ];
            const result: SquadMember[] = adapter.adaptAgentsToMembers(agents, { defaultStatus: 'reviewing-pr' });
            assert.strictEqual(result[0].status, 'reviewing-pr');
            assert.strictEqual(result[1].status, 'working'); // working overrides defaultStatus
        });

        test('all returned statuses are valid MemberStatus values', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const agents = [
                makeParsedAgent({ status: '✅ Active' }),
                makeParsedAgent({ status: 'Working' }),
                makeParsedAgent({ status: '🔨 Building' }),
                makeParsedAgent({ status: undefined }),
                makeParsedAgent({ status: '' }),
                makeParsedAgent({ status: '📋 Silent' }),
            ];
            const result: SquadMember[] = adapter.adaptAgentsToMembers(agents);
            for (const member of result) {
                assert.ok(VALID_STATUSES.has(member.status),
                    `Status "${member.status}" is not a valid MemberStatus`);
            }
        });
    });

    // ── adaptDecisionsToEntries ───────────────────────────────────────────

    suite('adaptDecisionsToEntries()', () => {
        test('maps empty array to empty array', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const result: DecisionEntry[] = adapter.adaptDecisionsToEntries([], 'decisions.md');
            assert.deepStrictEqual(result, []);
        });

        test('maps single decision with filePath', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const decisions = [makeParsedDecision({ title: 'Use ESLint' })];
            const result: DecisionEntry[] = adapter.adaptDecisionsToEntries(decisions, '/path/decisions.md');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].title, 'Use ESLint');
            assert.strictEqual(result[0].filePath, '/path/decisions.md');
        });

        test('maps multiple decisions preserving order', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const decisions = [
                makeParsedDecision({ title: 'Decision A', date: '2026-01-01' }),
                makeParsedDecision({ title: 'Decision B', date: '2026-02-01' }),
                makeParsedDecision({ title: 'Decision C', date: '2026-03-01' }),
            ];
            const result: DecisionEntry[] = adapter.adaptDecisionsToEntries(decisions, 'f.md');
            assert.strictEqual(result.length, 3);
            assert.strictEqual(result[0].title, 'Decision A');
            assert.strictEqual(result[1].title, 'Decision B');
            assert.strictEqual(result[2].title, 'Decision C');
        });

        test('assigns sequential lineNumbers based on array index', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const decisions = [
                makeParsedDecision({ title: 'D1' }),
                makeParsedDecision({ title: 'D2' }),
                makeParsedDecision({ title: 'D3' }),
            ];
            const result: DecisionEntry[] = adapter.adaptDecisionsToEntries(decisions, 'f.md');
            assert.strictEqual(result[0].lineNumber, 0);
            assert.strictEqual(result[1].lineNumber, 1);
            assert.strictEqual(result[2].lineNumber, 2);
        });

        test('applies lineNumberOffset option', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const decisions = [
                makeParsedDecision({ title: 'D1' }),
                makeParsedDecision({ title: 'D2' }),
            ];
            const result: DecisionEntry[] = adapter.adaptDecisionsToEntries(
                decisions, 'f.md', { lineNumberOffset: 10 },
            );
            assert.strictEqual(result[0].lineNumber, 10);
            assert.strictEqual(result[1].lineNumber, 11);
        });

        test('extracts date from body when SDK date is missing', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const decisions = [
                makeParsedDecision({
                    date: undefined,
                    body: '**Date:** 2026-06-15\nContent.',
                }),
            ];
            const result: DecisionEntry[] = adapter.adaptDecisionsToEntries(decisions, 'f.md');
            assert.strictEqual(result[0].date, '2026-06-15');
        });

        test('extracts author from body when SDK author is missing', function () {
            if (!adapterAvailable) { this.skip(); return; }
            const decisions = [
                makeParsedDecision({
                    author: undefined,
                    body: '**Author:** Danny\nContent.',
                }),
            ];
            const result: DecisionEntry[] = adapter.adaptDecisionsToEntries(decisions, 'f.md');
            assert.strictEqual(result[0].author, 'Danny');
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// Round-trip & Fixture-Based Tests
// ═══════════════════════════════════════════════════════════════════════════

suite('SDK Model Harmonization — Round-Trip', () => {

    test('agent round-trip: adapted member retains name and role from original', function () {
        if (!adapterAvailable) { this.skip(); return; }
        const original = makeParsedAgent({ name: 'linus', role: 'Backend Dev', status: '✅ Active' });
        const member: SquadMember = adapter.adaptParsedAgentToSquadMember(original);

        // Verify the adapted member can be matched back to the original
        assert.strictEqual(member.name, 'Linus');
        assert.strictEqual(member.role, original.role);
        assert.ok(VALID_STATUSES.has(member.status));
    });

    test('decision round-trip: adapted entry retains all SDK-provided fields', function () {
        if (!adapterAvailable) { this.skip(); return; }
        const original = makeParsedDecision({
            title: 'Use TypeScript Strict Mode',
            date: '2026-03-15',
            author: 'Basher',
            body: 'Strict mode catches more bugs at compile time.',
        });
        const entry: DecisionEntry = adapter.adaptParsedDecisionToDecisionEntry(
            original, '/workspace/decisions.md', 42,
        );

        assert.strictEqual(entry.title, original.title);
        assert.strictEqual(entry.date, original.date);
        assert.strictEqual(entry.author, original.author);
        assert.strictEqual(entry.content, original.body);
        assert.strictEqual(entry.filePath, '/workspace/decisions.md');
        assert.strictEqual(entry.lineNumber, 42);
    });

    test('bulk agent mapping matches individual mapping for each element', function () {
        if (!adapterAvailable) { this.skip(); return; }
        const agents = [
            makeParsedAgent({ name: 'danny', role: 'Lead', status: '✅ Active' }),
            makeParsedAgent({ name: 'rusty', role: 'Extension Dev', status: 'Working on UI' }),
            makeParsedAgent({ name: '@copilot', role: 'Coding Agent', status: undefined }),
        ];
        const bulkResult: SquadMember[] = adapter.adaptAgentsToMembers(agents);
        const individualResults: SquadMember[] = agents.map(
            (a: ParsedAgent) => adapter.adaptParsedAgentToSquadMember(a),
        );

        assert.strictEqual(bulkResult.length, individualResults.length);
        for (let i = 0; i < bulkResult.length; i++) {
            assert.deepStrictEqual(bulkResult[i], individualResults[i],
                `Mismatch at index ${i}`);
        }
    });

    test('fixture team.md produces valid SquadMembers via bulk mapping', function () {
        if (!adapterAvailable) { this.skip(); return; }

        // Build ParsedAgent fixtures from the test-fixtures team.md data
        const fixtureAgents: ParsedAgent[] = [
            { name: 'danny', role: 'Lead', skills: [], status: '✅ Active' },
            { name: 'rusty', role: 'Extension Dev', skills: [], status: '✅ Active' },
            { name: 'linus', role: 'Backend Dev', skills: [], status: '✅ Active' },
            { name: 'basher', role: 'Tester', skills: [], status: '✅ Active' },
            { name: 'livingston', role: 'DevOps/CI', skills: [], status: '📋 Silent' },
        ];

        const members: SquadMember[] = adapter.adaptAgentsToMembers(fixtureAgents);
        assert.strictEqual(members.length, 5);

        for (const member of members) {
            assert.ok(member.name.length > 0, 'Name should be non-empty');
            assert.ok(member.role.length > 0, 'Role should be non-empty');
            assert.ok(VALID_STATUSES.has(member.status),
                `${member.name} has invalid status: ${member.status}`);
        }

        // Verify capitalization
        assert.strictEqual(members[0].name, 'Danny');
        assert.strictEqual(members[4].name, 'Livingston');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// Edge Cases
// ═══════════════════════════════════════════════════════════════════════════

suite('SDK Model Harmonization — Edge Cases', () => {

    test('bulk mapping with 100 agents', function () {
        if (!adapterAvailable) { this.skip(); return; }
        const agents = Array.from({ length: 100 }, (_, i) =>
            makeParsedAgent({ name: `agent${i}`, role: `Role ${i}` }),
        );
        const result: SquadMember[] = adapter.adaptAgentsToMembers(agents);
        assert.strictEqual(result.length, 100);
        assert.strictEqual(result[0].name, 'Agent0');
        assert.strictEqual(result[99].name, 'Agent99');
    });

    test('bulk mapping with agent names containing special characters', function () {
        if (!adapterAvailable) { this.skip(); return; }
        const agents = [
            makeParsedAgent({ name: 'agent-with-dashes' }),
            makeParsedAgent({ name: 'agent_with_underscores' }),
            makeParsedAgent({ name: '忍者' }),
            makeParsedAgent({ name: '🤖bot' }),
            makeParsedAgent({ name: 'ALLCAPS' }),
        ];
        const result: SquadMember[] = adapter.adaptAgentsToMembers(agents);
        assert.strictEqual(result.length, 5);
        // All should produce valid SquadMembers without throwing
        for (const member of result) {
            assert.ok(typeof member.name === 'string');
            assert.ok(VALID_STATUSES.has(member.status));
        }
    });

    test('decisions with very long body text', function () {
        if (!adapterAvailable) { this.skip(); return; }
        const longBody = 'x'.repeat(50000);
        const decisions = [makeParsedDecision({ body: longBody })];
        const result: DecisionEntry[] = adapter.adaptDecisionsToEntries(decisions, 'f.md');
        assert.strictEqual(result[0].content?.length, 50000);
    });

    test('decisions with body containing all metadata patterns', function () {
        if (!adapterAvailable) { this.skip(); return; }
        const body = [
            '**Date:** 2026-04-01',
            '**Author:** Danny',
            '**By:** Rusty',
            '**Issue:** #42',
            '',
            'This decision covers many things.',
        ].join('\n');

        const decisions = [makeParsedDecision({ date: undefined, author: undefined, body })];
        const result: DecisionEntry[] = adapter.adaptDecisionsToEntries(decisions, 'f.md');
        assert.strictEqual(result[0].date, '2026-04-01');
        // **Author:** matches before **By:** due to the regex alternation order
        assert.ok(result[0].author === 'Danny' || result[0].author === 'Rusty',
            `Author should be Danny or Rusty, got: ${result[0].author}`);
    });

    test('decisions with empty body do not throw during metadata extraction', function () {
        if (!adapterAvailable) { this.skip(); return; }
        const decisions = [
            makeParsedDecision({ body: '', date: undefined, author: undefined }),
        ];
        const result: DecisionEntry[] = adapter.adaptDecisionsToEntries(decisions, 'f.md');
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].date, undefined);
        assert.strictEqual(result[0].author, undefined);
    });

    test('agent with null-like status values', function () {
        if (!adapterAvailable) { this.skip(); return; }
        const agents = [
            makeParsedAgent({ status: undefined }),
            makeParsedAgent({ status: '' }),
            makeParsedAgent({ status: '   ' }),
        ];
        const result: SquadMember[] = adapter.adaptAgentsToMembers(agents);
        for (const member of result) {
            assert.strictEqual(member.status, 'idle',
                'Null-like status should default to idle');
        }
    });

    test('defaultFilePath option used when filePath is empty', function () {
        if (!adapterAvailable) { this.skip(); return; }
        const entry: DecisionEntry = adapter.adaptParsedDecisionToDecisionEntry(
            makeParsedDecision(), '', undefined, { defaultFilePath: '/fallback/path.md' },
        );
        assert.strictEqual(entry.filePath, '/fallback/path.md');
    });

    test('decisions with special characters in title and body', function () {
        if (!adapterAvailable) { this.skip(); return; }
        const title = '使用 TypeScript — "strict" mode <enabled> & verified™';
        const body = 'Body with `code`, *emphasis*, **bold**, [link](url), and emoji 🎉';
        const decisions = [makeParsedDecision({ title, body })];
        const result: DecisionEntry[] = adapter.adaptDecisionsToEntries(decisions, 'f.md');
        assert.strictEqual(result[0].title, title);
        assert.strictEqual(result[0].content, body);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// getSquadMetadata() Integration
// ═══════════════════════════════════════════════════════════════════════════

suite('SDK Model Harmonization — getSquadMetadata()', () => {

    test('export exists and is a function', function () {
        if (!adapterAvailable) { this.skip(); return; }
        assert.strictEqual(typeof adapter.getSquadMetadata, 'function');
    });

    test('returns valid metadata shape for test-fixtures', async function () {
        if (!adapterAvailable) { this.skip(); return; }
        this.timeout(10000);

        const metadata = await adapter.getSquadMetadata(TEST_FIXTURES_ROOT);

        assert.ok(metadata, 'Should return metadata');
        assert.ok(Array.isArray(metadata.members), 'members should be an array');
        assert.ok(Array.isArray(metadata.decisions), 'decisions should be an array');
        assert.ok(Array.isArray(metadata.warnings), 'warnings should be an array');
        assert.ok(
            metadata.sdkVersion === null || typeof metadata.sdkVersion === 'string',
            'sdkVersion should be string or null',
        );
        assert.ok(
            metadata.config === null || typeof metadata.config === 'object',
            'config should be object or null',
        );
    });

    test('detects .ai-team folder in test-fixtures', async function () {
        if (!adapterAvailable) { this.skip(); return; }
        this.timeout(10000);

        const metadata = await adapter.getSquadMetadata(TEST_FIXTURES_ROOT);
        assert.strictEqual(metadata.squadFolder, '.ai-team',
            'test-fixtures uses .ai-team folder');
    });

    test('members from test-fixtures are valid SquadMembers', async function () {
        if (!adapterAvailable) { this.skip(); return; }
        this.timeout(10000);

        const metadata = await adapter.getSquadMetadata(TEST_FIXTURES_ROOT);

        // SDK should find members from team.md
        if (metadata.members.length > 0) {
            for (const member of metadata.members) {
                assert.ok(typeof member.name === 'string' && member.name.length > 0,
                    `Member name should be non-empty, got: "${member.name}"`);
                assert.ok(typeof member.role === 'string',
                    `Member role should be a string for ${member.name}`);
                assert.ok(VALID_STATUSES.has(member.status),
                    `${member.name} has invalid status: "${member.status}"`);
            }
        }
    });

    test('returns empty metadata for non-existent workspace', async function () {
        if (!adapterAvailable) { this.skip(); return; }
        this.timeout(10000);

        const metadata = await adapter.getSquadMetadata('/definitely/not/a/real/workspace');
        assert.ok(metadata, 'Should still return metadata object');
        assert.deepStrictEqual(metadata.members, []);
        assert.deepStrictEqual(metadata.decisions, []);
        assert.strictEqual(metadata.squadFolder, null);
    });

    test('returns metadata for workspace with no decisions.md', async function () {
        if (!adapterAvailable) { this.skip(); return; }
        this.timeout(10000);

        // Create a temp workspace with team.md but no decisions.md
        const tempDir = path.join(TEST_FIXTURES_ROOT, `temp-metadata-${Date.now()}`);
        fs.mkdirSync(path.join(tempDir, '.ai-team'), { recursive: true });
        fs.writeFileSync(
            path.join(tempDir, '.ai-team', 'team.md'),
            [
                '# Team',
                '',
                '## Members',
                '',
                '| Name | Role | Charter | Status |',
                '|------|------|---------|--------|',
                '| Solo | Developer | - | ✅ Active |',
            ].join('\n'),
        );

        try {
            const metadata = await adapter.getSquadMetadata(tempDir);
            assert.ok(metadata);
            assert.deepStrictEqual(metadata.decisions, []);
            assert.strictEqual(metadata.squadFolder, '.ai-team');
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// Adapter Type Exports
// ═══════════════════════════════════════════════════════════════════════════

suite('SDK Model Harmonization — Type Exports', () => {

    test('adapter exports adaptAgentsToMembers function', function () {
        if (!adapterAvailable) { this.skip(); return; }
        assert.strictEqual(typeof adapter.adaptAgentsToMembers, 'function');
    });

    test('adapter exports adaptDecisionsToEntries function', function () {
        if (!adapterAvailable) { this.skip(); return; }
        assert.strictEqual(typeof adapter.adaptDecisionsToEntries, 'function');
    });

    test('adapter exports getSquadMetadata function', function () {
        if (!adapterAvailable) { this.skip(); return; }
        assert.strictEqual(typeof adapter.getSquadMetadata, 'function');
    });

    test('SquadMetadata interface shape is correct via getSquadMetadata return', async function () {
        if (!adapterAvailable) { this.skip(); return; }
        this.timeout(10000);

        const metadata = await adapter.getSquadMetadata(TEST_FIXTURES_ROOT);
        const requiredKeys = ['members', 'decisions', 'config', 'sdkVersion', 'squadFolder', 'warnings'];
        for (const key of requiredKeys) {
            assert.ok(key in metadata, `SquadMetadata should have "${key}" property`);
        }
    });
});
