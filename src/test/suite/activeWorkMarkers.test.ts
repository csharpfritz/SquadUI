/**
 * Tests for active-work marker detection in SquadDataProvider.
 * Validates that marker files in .ai-team/active-work/ override member status
 * to 'working' when fresh, and are ignored when stale (>5 min) or non-.md.
 *
 * Written test-first — tests will FAIL until Linus implements detectActiveMarkers()
 * and the getSquadMembers() integration (see danny-active-work-markers.md).
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { SquadDataProvider } from '../../services/SquadDataProvider';
import { isActiveStatus } from '../../models';

const TEST_FIXTURES_ROOT = path.resolve(__dirname, '../../../test-fixtures');

/** Helper: write a minimal team.md with the given members (all idle, no logs). */
function writeTeamMd(aiTeamDir: string, members: { name: string; role: string }[]): void {
    const rows = members
        .map(m => `| ${m.name} | ${m.role} | \`.ai-team/agents/${m.name.toLowerCase()}/charter.md\` | ✅ Active |`)
        .join('\n');
    fs.writeFileSync(path.join(aiTeamDir, 'team.md'), [
        '# Team',
        '',
        '## Members',
        '',
        '| Name | Role | Charter | Status |',
        '|------|------|---------|--------|',
        rows,
    ].join('\n'));
}

/** Helper: create a marker file with optional content. */
function writeMarker(activeWorkDir: string, filename: string, content?: string): string {
    const filePath = path.join(activeWorkDir, filename);
    fs.writeFileSync(filePath, content ?? `agent: ${filename.replace(/\.md$/, '')}\nstarted: 2026-02-18T14:32:00Z\ntask: test\n`);
    return filePath;
}

/** Staleness threshold used by the design (5 minutes). */
const STALENESS_THRESHOLD_MS = 300_000;

suite('SquadDataProvider — Active-Work Markers', () => {
    let tempDir: string;

    setup(() => {
        tempDir = path.join(TEST_FIXTURES_ROOT, `temp-active-markers-${Date.now()}`);
    });

    teardown(async () => {
        try {
            await fs.promises.rm(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    // ─── 1. No active-work directory — backward compatible ────────────────

    test('getSquadMembers() works normally when active-work directory does not exist', async () => {
        const dir = path.join(tempDir, 'no-active-work');
        const aiTeamDir = path.join(dir, '.ai-team');
        fs.mkdirSync(aiTeamDir, { recursive: true });
        writeTeamMd(aiTeamDir, [
            { name: 'Linus', role: 'Backend Dev' },
            { name: 'Rusty', role: 'Extension Dev' },
        ]);

        const provider = new SquadDataProvider(dir, '.ai-team', 0);
        const members = await provider.getSquadMembers();

        assert.strictEqual(members.length, 2, 'Should return both members');
        assert.strictEqual(members[0].status, 'idle', 'Linus should be idle');
        assert.strictEqual(members[1].status, 'idle', 'Rusty should be idle');
    });

    // ─── 2. Empty active-work directory — no status overrides ─────────────

    test('empty active-work directory causes no status overrides', async () => {
        const dir = path.join(tempDir, 'empty-active-work');
        const aiTeamDir = path.join(dir, '.ai-team');
        const activeWorkDir = path.join(aiTeamDir, 'active-work');
        fs.mkdirSync(activeWorkDir, { recursive: true });
        writeTeamMd(aiTeamDir, [
            { name: 'Linus', role: 'Backend Dev' },
        ]);

        const provider = new SquadDataProvider(dir, '.ai-team', 0);
        const members = await provider.getSquadMembers();

        assert.strictEqual(members.length, 1);
        assert.strictEqual(members[0].status, 'idle', 'Linus should remain idle');
    });

    // ─── 3. Active marker for known member ────────────────────────────────

    test('active marker overrides member status to working', async () => {
        const dir = path.join(tempDir, 'active-marker');
        const aiTeamDir = path.join(dir, '.ai-team');
        const activeWorkDir = path.join(aiTeamDir, 'active-work');
        fs.mkdirSync(activeWorkDir, { recursive: true });
        writeTeamMd(aiTeamDir, [
            { name: 'Linus', role: 'Backend Dev' },
            { name: 'Rusty', role: 'Extension Dev' },
        ]);

        // Create a fresh marker for Linus
        writeMarker(activeWorkDir, 'linus.md');

        const provider = new SquadDataProvider(dir, '.ai-team', 0);
        const members = await provider.getSquadMembers();

        const linus = members.find(m => m.name === 'Linus');
        const rusty = members.find(m => m.name === 'Rusty');
        assert.ok(linus, 'Linus should be in members');
        assert.ok(rusty, 'Rusty should be in members');
        assert.strictEqual(linus!.status, 'working', 'Linus should be working (has fresh marker)');
        assert.strictEqual(rusty!.status, 'idle', 'Rusty should remain idle (no marker)');
    });

    // ─── 4. Marker overrides log-based idle ───────────────────────────────

    test('marker overrides log-based idle status', async () => {
        const dir = path.join(tempDir, 'override-idle');
        const aiTeamDir = path.join(dir, '.ai-team');
        const activeWorkDir = path.join(aiTeamDir, 'active-work');
        const logDir = path.join(aiTeamDir, 'orchestration-log');
        fs.mkdirSync(activeWorkDir, { recursive: true });
        fs.mkdirSync(logDir, { recursive: true });

        writeTeamMd(aiTeamDir, [
            { name: 'Linus', role: 'Backend Dev' },
            { name: 'Danny', role: 'Lead' },
        ]);

        // Write a log where Danny is the most recent participant (Linus would be idle)
        fs.writeFileSync(path.join(logDir, '2026-02-18-session.md'), [
            '# Session',
            '',
            '**Date:** 2026-02-18',
            '**Participants:** Danny',
            '',
            '## Summary',
            'Danny working solo.',
        ].join('\n'));

        // Create a fresh marker for Linus — should override log-derived idle
        writeMarker(activeWorkDir, 'linus.md');

        const provider = new SquadDataProvider(dir, '.ai-team', 0);
        const members = await provider.getSquadMembers();

        const linus = members.find(m => m.name === 'Linus');
        assert.ok(linus, 'Linus should be in members');
        assert.strictEqual(linus!.status, 'working',
            'Marker should override log-based idle — Linus is actively working');
    });

    // ─── 5. Stale marker (mtime > 5 min ago) — ignored ───────────────────

    test('stale marker (mtime > 5 min) is ignored, member stays idle', async () => {
        const dir = path.join(tempDir, 'stale-marker');
        const aiTeamDir = path.join(dir, '.ai-team');
        const activeWorkDir = path.join(aiTeamDir, 'active-work');
        fs.mkdirSync(activeWorkDir, { recursive: true });
        writeTeamMd(aiTeamDir, [
            { name: 'Linus', role: 'Backend Dev' },
        ]);

        // Create marker, then backdate its mtime to 10 minutes ago
        const markerPath = writeMarker(activeWorkDir, 'linus.md');
        const tenMinutesAgo = new Date(Date.now() - STALENESS_THRESHOLD_MS - 300_000);
        fs.utimesSync(markerPath, tenMinutesAgo, tenMinutesAgo);

        const provider = new SquadDataProvider(dir, '.ai-team', 0);
        const members = await provider.getSquadMembers();

        const linus = members.find(m => m.name === 'Linus');
        assert.ok(linus, 'Linus should be in members');
        assert.strictEqual(linus!.status, 'idle',
            'Stale marker should be ignored — Linus stays idle');
    });

    // ─── 6. Fresh marker (mtime < 5 min ago) — respected ─────────────────

    test('fresh marker (mtime < 5 min) is respected, member becomes working', async () => {
        const dir = path.join(tempDir, 'fresh-marker');
        const aiTeamDir = path.join(dir, '.ai-team');
        const activeWorkDir = path.join(aiTeamDir, 'active-work');
        fs.mkdirSync(activeWorkDir, { recursive: true });
        writeTeamMd(aiTeamDir, [
            { name: 'Rusty', role: 'Extension Dev' },
        ]);

        // Create marker — just written, so mtime is now (well within 5-minute window)
        writeMarker(activeWorkDir, 'rusty.md');

        const provider = new SquadDataProvider(dir, '.ai-team', 0);
        const members = await provider.getSquadMembers();

        const rusty = members.find(m => m.name === 'Rusty');
        assert.ok(rusty, 'Rusty should be in members');
        assert.strictEqual(rusty!.status, 'working',
            'Fresh marker should set Rusty to working');
    });

    // ─── 7. Non-.md files in active-work/ — ignored ──────────────────────

    test('non-.md files in active-work/ are ignored', async () => {
        const dir = path.join(tempDir, 'non-md-files');
        const aiTeamDir = path.join(dir, '.ai-team');
        const activeWorkDir = path.join(aiTeamDir, 'active-work');
        fs.mkdirSync(activeWorkDir, { recursive: true });
        writeTeamMd(aiTeamDir, [
            { name: 'Linus', role: 'Backend Dev' },
        ]);

        // Write non-.md files that should be ignored
        fs.writeFileSync(path.join(activeWorkDir, '.gitkeep'), '');
        fs.writeFileSync(path.join(activeWorkDir, 'linus.txt'), 'not a marker');
        fs.writeFileSync(path.join(activeWorkDir, 'linus.yaml'), 'agent: linus');

        const provider = new SquadDataProvider(dir, '.ai-team', 0);
        const members = await provider.getSquadMembers();

        const linus = members.find(m => m.name === 'Linus');
        assert.ok(linus, 'Linus should be in members');
        assert.strictEqual(linus!.status, 'idle',
            'Non-.md files should not trigger working status');
    });

    // ─── 8. Multiple markers — multiple members working ──────────────────

    test('multiple markers set multiple members to working', async () => {
        const dir = path.join(tempDir, 'multi-markers');
        const aiTeamDir = path.join(dir, '.ai-team');
        const activeWorkDir = path.join(aiTeamDir, 'active-work');
        fs.mkdirSync(activeWorkDir, { recursive: true });
        writeTeamMd(aiTeamDir, [
            { name: 'Linus', role: 'Backend Dev' },
            { name: 'Rusty', role: 'Extension Dev' },
            { name: 'Basher', role: 'Tester' },
        ]);

        writeMarker(activeWorkDir, 'linus.md');
        writeMarker(activeWorkDir, 'rusty.md');
        // No marker for Basher

        const provider = new SquadDataProvider(dir, '.ai-team', 0);
        const members = await provider.getSquadMembers();

        const linus = members.find(m => m.name === 'Linus');
        const rusty = members.find(m => m.name === 'Rusty');
        const basher = members.find(m => m.name === 'Basher');

        assert.strictEqual(linus!.status, 'working', 'Linus should be working');
        assert.strictEqual(rusty!.status, 'working', 'Rusty should be working');
        assert.strictEqual(basher!.status, 'idle', 'Basher should be idle (no marker)');
    });

    // ─── 9. Marker for unknown member — doesn't crash ────────────────────

    test('marker for unknown member does not crash or affect known members', async () => {
        const dir = path.join(tempDir, 'unknown-member');
        const aiTeamDir = path.join(dir, '.ai-team');
        const activeWorkDir = path.join(aiTeamDir, 'active-work');
        fs.mkdirSync(activeWorkDir, { recursive: true });
        writeTeamMd(aiTeamDir, [
            { name: 'Linus', role: 'Backend Dev' },
        ]);

        // Marker for a member not in the roster
        writeMarker(activeWorkDir, 'ghost-agent.md');

        const provider = new SquadDataProvider(dir, '.ai-team', 0);
        const members = await provider.getSquadMembers();

        assert.strictEqual(members.length, 1, 'Should still have exactly 1 member');
        assert.strictEqual(members[0].name, 'Linus');
        assert.strictEqual(members[0].status, 'idle',
            'Unknown marker should not affect Linus');
    });

    // ─── 10. Case-insensitive slug matching ──────────────────────────────

    test('marker slug matches member name case-insensitively', async () => {
        const dir = path.join(tempDir, 'case-insensitive');
        const aiTeamDir = path.join(dir, '.ai-team');
        const activeWorkDir = path.join(aiTeamDir, 'active-work');
        fs.mkdirSync(activeWorkDir, { recursive: true });
        writeTeamMd(aiTeamDir, [
            { name: 'Linus', role: 'Backend Dev' },
        ]);

        // Marker filename is lowercase, member name is capitalized
        writeMarker(activeWorkDir, 'linus.md');

        const provider = new SquadDataProvider(dir, '.ai-team', 0);
        const members = await provider.getSquadMembers();

        const linus = members.find(m => m.name === 'Linus');
        assert.ok(linus, 'Linus should be in members');
        assert.strictEqual(linus!.status, 'working',
            'Lowercase slug "linus" should match capitalized member name "Linus"');
    });

    // ─── Boundary: marker at exactly the staleness threshold ─────────────

    test('marker at exactly the staleness boundary is treated as stale', async () => {
        const dir = path.join(tempDir, 'boundary-stale');
        const aiTeamDir = path.join(dir, '.ai-team');
        const activeWorkDir = path.join(aiTeamDir, 'active-work');
        fs.mkdirSync(activeWorkDir, { recursive: true });
        writeTeamMd(aiTeamDir, [
            { name: 'Linus', role: 'Backend Dev' },
        ]);

        // Set mtime to exactly 5 minutes + 1 second ago (just past the threshold)
        const markerPath = writeMarker(activeWorkDir, 'linus.md');
        const justPastThreshold = new Date(Date.now() - STALENESS_THRESHOLD_MS - 1000);
        fs.utimesSync(markerPath, justPastThreshold, justPastThreshold);

        const provider = new SquadDataProvider(dir, '.ai-team', 0);
        const members = await provider.getSquadMembers();

        const linus = members.find(m => m.name === 'Linus');
        assert.strictEqual(linus!.status, 'idle',
            'Marker just past the 5-min threshold should be stale');
    });

    test('marker just under the staleness boundary is fresh', async () => {
        const dir = path.join(tempDir, 'boundary-fresh');
        const aiTeamDir = path.join(dir, '.ai-team');
        const activeWorkDir = path.join(aiTeamDir, 'active-work');
        fs.mkdirSync(activeWorkDir, { recursive: true });
        writeTeamMd(aiTeamDir, [
            { name: 'Linus', role: 'Backend Dev' },
        ]);

        // Set mtime to 4 minutes 50 seconds ago (within threshold)
        const markerPath = writeMarker(activeWorkDir, 'linus.md');
        const justUnderThreshold = new Date(Date.now() - STALENESS_THRESHOLD_MS + 10_000);
        fs.utimesSync(markerPath, justUnderThreshold, justUnderThreshold);

        const provider = new SquadDataProvider(dir, '.ai-team', 0);
        const members = await provider.getSquadMembers();

        const linus = members.find(m => m.name === 'Linus');
        assert.strictEqual(linus!.status, 'working',
            'Marker 10 seconds before the threshold should still be fresh');
    });

    // ─── Marker + existing log working status ────────────────────────────

    test('marker does not double-set status for already-working member', async () => {
        const dir = path.join(tempDir, 'already-working');
        const aiTeamDir = path.join(dir, '.ai-team');
        const activeWorkDir = path.join(aiTeamDir, 'active-work');
        const logDir = path.join(aiTeamDir, 'orchestration-log');
        fs.mkdirSync(activeWorkDir, { recursive: true });
        fs.mkdirSync(logDir, { recursive: true });

        writeTeamMd(aiTeamDir, [
            { name: 'Danny', role: 'Lead' },
        ]);

        // Danny appears as working in logs (most recent participant with an in-progress task)
        fs.writeFileSync(path.join(logDir, '2026-02-18-session.md'), [
            '# Session',
            '',
            '**Date:** 2026-02-18',
            '**Participants:** Danny',
            '',
            '## Tasks',
            '',
            '- [ ] #59 — Fix idle status (in_progress, Danny)',
            '',
            '## Summary',
            'Danny is fixing the idle status bug.',
        ].join('\n'));

        // Also has a fresh marker
        writeMarker(activeWorkDir, 'danny.md');

        const provider = new SquadDataProvider(dir, '.ai-team', 0);
        const members = await provider.getSquadMembers();

        const danny = members.find(m => m.name === 'Danny');
        assert.ok(danny, 'Danny should be in members');
        assert.ok(isActiveStatus(danny!.status),
            'Danny should be working (from either log or marker — no conflict)');
    });
});
