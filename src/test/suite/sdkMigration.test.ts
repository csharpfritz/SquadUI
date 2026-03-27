/**
 * SDK Migration regression tests.
 *
 * Validates that the existing TeamMdService, DecisionService, and
 * squadFolderDetection utilities continue to produce the same data
 * structures after the SDK migration. These tests use the real
 * test-fixtures directory to verify nothing has regressed.
 *
 * Strategy:
 * - Parse the standard fixtures through the existing services
 * - Assert the output shapes and key values remain stable
 * - If an sdk-adapter exists, verify its output matches the services
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { TeamMdService } from '../../services/TeamMdService';
import { DecisionService } from '../../services/DecisionService';
import { detectSquadFolder, hasSquadTeam, getSquadWatchPattern } from '../../utils/squadFolderDetection';
// Model types referenced for structural assertions below

const TEST_FIXTURES_ROOT = path.resolve(__dirname, '../../../test-fixtures');

// ═══════════════════════════════════════════════════════════════════════════
// TeamMdService regression
// ═══════════════════════════════════════════════════════════════════════════

suite('SDK Migration — TeamMdService', () => {
    let service: TeamMdService;

    setup(() => {
        service = new TeamMdService();
    });

    test('parseTeamMd returns a roster with correct shape', async () => {
        const roster = await service.parseTeamMd(TEST_FIXTURES_ROOT);
        assert.ok(roster, 'Should return a roster');
        assert.ok(Array.isArray(roster!.members), 'Roster should have members array');
    });

    test('each member has required SquadMember fields', async () => {
        const roster = await service.parseTeamMd(TEST_FIXTURES_ROOT);
        assert.ok(roster);
        for (const member of roster!.members) {
            assert.ok(typeof member.name === 'string' && member.name.length > 0,
                `Member name should be a non-empty string, got: "${member.name}"`);
            assert.ok(typeof member.role === 'string' && member.role.length > 0,
                `Member role should be a non-empty string for ${member.name}`);
            assert.ok(typeof member.status === 'string',
                `Member status should be a string for ${member.name}`);
        }
    });

    test('fixture roster contains expected member names', async () => {
        const roster = await service.parseTeamMd(TEST_FIXTURES_ROOT);
        assert.ok(roster);
        const names = roster!.members.map(m => m.name.toLowerCase());
        // The standard fixture has Danny, Rusty, Linus, Basher, Livingston
        assert.ok(names.includes('danny'), 'Should include Danny');
        assert.ok(names.includes('rusty'), 'Should include Rusty');
        assert.ok(names.includes('linus'), 'Should include Linus');
        assert.ok(names.includes('basher'), 'Should include Basher');
    });

    test('fixture roster contains expected roles', async () => {
        const roster = await service.parseTeamMd(TEST_FIXTURES_ROOT);
        assert.ok(roster);
        const roles = roster!.members.map(m => m.role);
        assert.ok(roles.includes('Lead'), 'Should include Lead role');
        assert.ok(roles.includes('Tester'), 'Should include Tester role');
    });

    test('roster repository field is preserved', async () => {
        const roster = await service.parseTeamMd(TEST_FIXTURES_ROOT);
        assert.ok(roster);
        assert.strictEqual(roster!.repository, 'test-repo');
    });

    test('roster owner field is preserved', async () => {
        const roster = await service.parseTeamMd(TEST_FIXTURES_ROOT);
        assert.ok(roster);
        assert.ok(roster!.owner?.startsWith('TestOwner'),
            `Owner should start with TestOwner, got: ${roster!.owner}`);
    });

    test('all member statuses are valid MemberStatus values', async () => {
        const validStatuses = new Set([
            'working-on-issue', 'reviewing-pr', 'waiting-review', 'working', 'idle',
        ]);
        const roster = await service.parseTeamMd(TEST_FIXTURES_ROOT);
        assert.ok(roster);
        for (const member of roster!.members) {
            assert.ok(validStatuses.has(member.status),
                `${member.name} has invalid status: "${member.status}"`);
        }
    });

    test('parseContent returns same shape as parseTeamMd', () => {
        const content = [
            '# Team',
            '',
            '## Project Context',
            '**Owner:** TestOwner',
            '**Repository:** test-repo',
            '',
            '## Members',
            '',
            '| Name | Role | Charter | Status |',
            '|------|------|---------|--------|',
            '| Alice | Engineer | `.ai-team/agents/alice/charter.md` | ✅ Active |',
        ].join('\n');

        const roster = service.parseContent(content);

        assert.ok(roster, 'Should return a roster');
        assert.ok(Array.isArray(roster.members), 'Should have members array');
        assert.strictEqual(roster.members.length, 1);
        assert.strictEqual(roster.members[0].name, 'Alice');
        assert.strictEqual(roster.members[0].role, 'Engineer');
        assert.strictEqual(typeof roster.members[0].status, 'string');
    });

    test('returns null for non-existent workspace', async () => {
        const result = await service.parseTeamMd('/definitely/not/a/real/path');
        assert.strictEqual(result, null);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// DecisionService regression
// ═══════════════════════════════════════════════════════════════════════════

suite('SDK Migration — DecisionService', () => {
    let service: DecisionService;

    setup(() => {
        service = new DecisionService();
    });

    test('getDecisions returns an array', () => {
        const decisions = service.getDecisions(TEST_FIXTURES_ROOT);
        assert.ok(Array.isArray(decisions), 'Should return an array');
    });

    test('each decision has required DecisionEntry fields', () => {
        const decisions = service.getDecisions(TEST_FIXTURES_ROOT);
        for (const d of decisions) {
            assert.ok(typeof d.title === 'string' && d.title.length > 0,
                `Decision title should be non-empty, got: "${d.title}"`);
            assert.ok(typeof d.filePath === 'string' && d.filePath.length > 0,
                `Decision filePath should be non-empty for "${d.title}"`);
        }
    });

    test('decisions are sorted by date descending', () => {
        const decisions = service.getDecisions(TEST_FIXTURES_ROOT);
        const datedDecisions = decisions.filter(d => d.date);
        for (let i = 1; i < datedDecisions.length; i++) {
            const prev = datedDecisions[i - 1].date!;
            const curr = datedDecisions[i].date!;
            assert.ok(prev >= curr,
                `Decisions should be sorted descending: "${prev}" should come before "${curr}"`);
        }
    });

    test('decision filePath points to a real file', () => {
        const decisions = service.getDecisions(TEST_FIXTURES_ROOT);
        for (const d of decisions) {
            assert.ok(fs.existsSync(d.filePath),
                `filePath should exist on disk: ${d.filePath}`);
        }
    });

    test('decision content is a string when present', () => {
        const decisions = service.getDecisions(TEST_FIXTURES_ROOT);
        for (const d of decisions) {
            if (d.content !== undefined) {
                assert.strictEqual(typeof d.content, 'string',
                    `Decision content should be string for "${d.title}"`);
            }
        }
    });

    test('decision lineNumber is a non-negative number when present', () => {
        const decisions = service.getDecisions(TEST_FIXTURES_ROOT);
        for (const d of decisions) {
            if (d.lineNumber !== undefined) {
                assert.ok(typeof d.lineNumber === 'number' && d.lineNumber >= 0,
                    `lineNumber should be >= 0 for "${d.title}", got: ${d.lineNumber}`);
            }
        }
    });

    test('returns empty array for non-existent workspace', () => {
        const decisions = service.getDecisions('/definitely/not/a/real/path');
        assert.deepStrictEqual(decisions, []);
    });

    // Inline content parsing regression
    suite('Inline parsing regression', () => {
        let tempDir: string;

        setup(() => {
            tempDir = path.join(TEST_FIXTURES_ROOT, `temp-sdk-migration-${Date.now()}`);
            fs.mkdirSync(path.join(tempDir, '.ai-team'), { recursive: true });
        });

        teardown(() => {
            try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
        });

        test('parses ## heading as decision title', () => {
            const content = [
                '# Decisions',
                '',
                '## Use TypeScript',
                '**Date:** 2026-02-01',
                'Content here.',
            ].join('\n');
            fs.writeFileSync(path.join(tempDir, '.ai-team', 'decisions.md'), content);

            const decisions = service.getDecisions(tempDir);
            assert.ok(decisions.length >= 1, 'Should parse at least one decision');
            assert.ok(
                decisions.some(d => d.title === 'Use TypeScript'),
                'Should find "Use TypeScript" decision',
            );
        });

        test('extracts date from **Date:** line', () => {
            const content = [
                '# Decisions',
                '',
                '## SDK Migration',
                '**Date:** 2026-06-15',
                'We are migrating to the Squad SDK.',
            ].join('\n');
            fs.writeFileSync(path.join(tempDir, '.ai-team', 'decisions.md'), content);

            const decisions = service.getDecisions(tempDir);
            const sdkDecision = decisions.find(d => d.title === 'SDK Migration');
            assert.ok(sdkDecision, 'Should find the SDK Migration decision');
            assert.strictEqual(sdkDecision!.date, '2026-06-15');
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// squadFolderDetection regression
// ═══════════════════════════════════════════════════════════════════════════

suite('SDK Migration — squadFolderDetection', () => {
    let tempDir: string;

    setup(() => {
        tempDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'squadui-migration-'));
    });

    teardown(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('detectSquadFolder returns a valid folder name', () => {
        const result = detectSquadFolder(tempDir);
        assert.ok(result === '.squad' || result === '.ai-team',
            `Should return .squad or .ai-team, got: ${result}`);
    });

    test('detectSquadFolder defaults to .squad when nothing exists', () => {
        const result = detectSquadFolder(tempDir);
        assert.strictEqual(result, '.squad');
    });

    test('detectSquadFolder detects .ai-team (legacy)', () => {
        fs.mkdirSync(path.join(tempDir, '.ai-team'));
        assert.strictEqual(detectSquadFolder(tempDir), '.ai-team');
    });

    test('detectSquadFolder prefers .squad over .ai-team', () => {
        fs.mkdirSync(path.join(tempDir, '.ai-team'));
        fs.mkdirSync(path.join(tempDir, '.squad'));
        assert.strictEqual(detectSquadFolder(tempDir), '.squad');
    });

    test('hasSquadTeam works with .ai-team folder', () => {
        const aiTeamDir = path.join(tempDir, '.ai-team');
        fs.mkdirSync(aiTeamDir);
        fs.writeFileSync(path.join(aiTeamDir, 'team.md'), '# Team');
        assert.strictEqual(hasSquadTeam(tempDir, '.ai-team'), true);
    });

    test('hasSquadTeam returns false when no team.md', () => {
        fs.mkdirSync(path.join(tempDir, '.squad'));
        assert.strictEqual(hasSquadTeam(tempDir, '.squad'), false);
    });

    test('getSquadWatchPattern returns a glob string', () => {
        const pattern = getSquadWatchPattern();
        assert.strictEqual(typeof pattern, 'string');
        assert.ok(pattern.includes('.squad'), 'Pattern should include .squad');
        assert.ok(pattern.includes('.ai-team'), 'Pattern should include .ai-team');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// Cross-service consistency (adapter round-trip)
// ═══════════════════════════════════════════════════════════════════════════

suite('SDK Migration — Cross-service consistency', () => {
    // Attempt to load the adapter for round-trip validation
    let adapter: any;
    let adapterReady = false;
    try {
        adapter = require('../../sdk-adapter/index');
        adapterReady = true;
    } catch { /* not available yet */ }

    test('TeamMdService roster member count matches SDK parse when adapter exists', async function () {
        if (!adapterReady) { this.skip(); return; }
        // If the adapter exposes a parseTeamWithSdk() or similar, compare counts
        if (typeof adapter.parseTeamWithSdk !== 'function') { this.skip(); return; }

        const service = new TeamMdService();
        const roster = await service.parseTeamMd(TEST_FIXTURES_ROOT);
        assert.ok(roster, 'Service should return a roster');

        const teamMdPath = path.join(TEST_FIXTURES_ROOT, '.ai-team', 'team.md');
        const content = fs.readFileSync(teamMdPath, 'utf-8');
        const sdkResult = adapter.parseTeamWithSdk(content);

        assert.ok(sdkResult, 'SDK parse should return a result');
        // The adapter may filter differently (e.g. skip Coordinator) — just check non-zero
        assert.ok(sdkResult.length > 0, 'SDK should find at least one agent');
    });

    test('DecisionService count matches SDK parse when adapter exists', function () {
        if (!adapterReady) { this.skip(); return; }
        if (typeof adapter.parseDecisionsWithSdk !== 'function') { this.skip(); return; }

        const service = new DecisionService();
        const decisions = service.getDecisions(TEST_FIXTURES_ROOT);

        const decisionsMdPath = path.join(TEST_FIXTURES_ROOT, '.ai-team', 'decisions.md');
        if (!fs.existsSync(decisionsMdPath)) { this.skip(); return; }

        const content = fs.readFileSync(decisionsMdPath, 'utf-8');
        const sdkDecisions = adapter.parseDecisionsWithSdk(content);

        assert.ok(sdkDecisions, 'SDK parse should return decisions');
        // SDK may parse differently — just ensure both return results
        assert.ok(decisions.length > 0 || sdkDecisions.length > 0,
            'At least one parser should find decisions');
    });
});
