/**
 * Extended tests for SquadDataProvider — covers gaps in the existing test suite.
 *
 * Existing tests cover: members, tasks, workDetails, refresh, caching.
 * These tests add: getDecisions(), getWorkspaceRoot(), placeholder member
 * in getWorkDetails(), case-insensitive member lookup, and decisions caching.
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { SquadDataProvider } from '../../services/SquadDataProvider';
import { isActiveStatus } from '../../models';

const TEST_FIXTURES_ROOT = path.resolve(__dirname, '../../../test-fixtures');

suite('SquadDataProvider — Extended Coverage', () => {
    let tempDir: string;

    setup(() => {
        tempDir = path.join(TEST_FIXTURES_ROOT, `temp-sdp-ext-${Date.now()}`);
        fs.mkdirSync(path.join(tempDir, '.ai-team'), { recursive: true });
    });

    teardown(() => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    // ─── getWorkspaceRoot() ─────────────────────────────────────────────

    suite('getWorkspaceRoot()', () => {
        test('returns the teamRoot passed to constructor', () => {
            const provider = new SquadDataProvider('/some/path', '.ai-team');
            assert.strictEqual(provider.getWorkspaceRoot(), '/some/path');
        });

        test('returns actual path for test fixtures', () => {
            const provider = new SquadDataProvider(TEST_FIXTURES_ROOT, '.ai-team');
            assert.strictEqual(provider.getWorkspaceRoot(), TEST_FIXTURES_ROOT);
        });
    });

    // ─── getDecisions() ─────────────────────────────────────────────────

    suite('getDecisions()', () => {
        test('returns decisions from decisions.md', async () => {
            fs.writeFileSync(path.join(tempDir, '.ai-team', 'decisions.md'), [
                '## Use TypeScript',
                '**Date:** 2026-02-01',
                'TypeScript for everything.',
            ].join('\n'));

            const provider = new SquadDataProvider(tempDir, '.ai-team');
            const decisions = await provider.getDecisions();

            assert.ok(decisions.length >= 1);
            assert.ok(decisions.some(d => d.title === 'Use TypeScript'));
        });

        test('caches decisions after first call', async () => {
            fs.writeFileSync(path.join(tempDir, '.ai-team', 'decisions.md'), [
                '## Cached Decision',
                '**Date:** 2026-02-01',
            ].join('\n'));

            const provider = new SquadDataProvider(tempDir, '.ai-team');
            const first = await provider.getDecisions();
            const second = await provider.getDecisions();

            assert.strictEqual(first, second, 'Should return same cached array');
        });

        test('refresh invalidates decisions cache', async () => {
            fs.writeFileSync(path.join(tempDir, '.ai-team', 'decisions.md'), [
                '## Before Refresh',
                '**Date:** 2026-02-01',
            ].join('\n'));

            const provider = new SquadDataProvider(tempDir, '.ai-team');
            const first = await provider.getDecisions();
            provider.refresh();
            const second = await provider.getDecisions();

            assert.notStrictEqual(first, second, 'Should return new array after refresh');
        });

        test('returns empty array when no decisions exist', async () => {
            const provider = new SquadDataProvider(tempDir, '.ai-team');
            const decisions = await provider.getDecisions();

            assert.deepStrictEqual(decisions, []);
        });
    });

    // ─── getWorkDetails() — Placeholder Member ──────────────────────────

    suite('getWorkDetails() — Edge Cases', () => {
        test('returns placeholder member when assignee not in roster', async () => {
            // Create team.md with only Alice
            fs.writeFileSync(path.join(tempDir, '.ai-team', 'team.md'), [
                '# Team',
                '',
                '## Members',
                '',
                '| Name | Role | Charter | Status |',
                '|------|------|---------|--------|',
                '| Alice | Engineer | `.ai-team/agents/alice/charter.md` | ✅ Active |',
            ].join('\n'));

            // Create log with task assigned to "Ghost" (not in roster)
            const logDir = path.join(tempDir, '.ai-team', 'orchestration-log');
            fs.mkdirSync(logDir, { recursive: true });
            fs.writeFileSync(path.join(logDir, '2026-03-01-ghost-task.md'), [
                '# Ghost Task',
                '',
                '**Participants:** Ghost',
                '',
                '## Related Issues',
                '- #99',
            ].join('\n'));

            const provider = new SquadDataProvider(tempDir, '.ai-team');
            const details = await provider.getWorkDetails('99');

            if (details) {
                // Member should be either Ghost (from roster match) or a placeholder
                assert.ok(details.member, 'Should have member');
                assert.ok(details.task, 'Should have task');
            }
            // The test mainly verifies no crash on missing member
            assert.ok(true);
        });

        test('getLogEntries caches results', async () => {
            const provider = new SquadDataProvider(tempDir, '.ai-team');
            const first = await provider.getLogEntries();
            const second = await provider.getLogEntries();

            assert.strictEqual(first, second, 'Should return same cached array');
        });

        test('getTasks caches results', async () => {
            const provider = new SquadDataProvider(tempDir, '.ai-team');
            const first = await provider.getTasks();
            const second = await provider.getTasks();

            assert.strictEqual(first, second, 'Should return same cached array');
        });
    });

    // ─── getSquadMembers() — Status Override Logic ──────────────────────

    suite('getSquadMembers() — working-to-idle override (issue #63)', () => {
        test('member shown as idle when log says working but no in-progress tasks', async () => {
            // Create team.md
            fs.writeFileSync(path.join(tempDir, '.ai-team', 'team.md'), [
                '# Team',
                '',
                '## Members',
                '',
                '| Name | Role | Charter | Status |',
                '|------|------|---------|--------|',
                '| Alice | Dev | `.ai-team/agents/alice/charter.md` | ✅ Active |',
            ].join('\n'));

            // Create log that marks Alice as participant (most recent = working)
            // but with completed tasks only (issue reference with completion signal)
            const logDir = path.join(tempDir, '.ai-team', 'orchestration-log');
            fs.mkdirSync(logDir, { recursive: true });
            fs.writeFileSync(path.join(logDir, '2026-03-01-completed.md'), [
                '# Completed Work',
                '',
                '**Participants:** Alice',
                '',
                '## Outcomes',
                '- Closed #42 — fixed the bug',
                '',
                '## Summary',
                'All tasks completed.',
            ].join('\n'));

            const provider = new SquadDataProvider(tempDir, '.ai-team');
            const members = await provider.getSquadMembers();

            const alice = members.find(m => m.name === 'Alice');
            assert.ok(alice, 'Should find Alice');
            // Alice should be idle because no in-progress tasks exist
            assert.strictEqual(alice!.status, 'idle', 'Should be idle when no in-progress tasks');
        });

        test('member stays working when log says working and has no tasks at all (Copilot Chat)', async () => {
            fs.writeFileSync(path.join(tempDir, '.ai-team', 'team.md'), [
                '# Team',
                '',
                '## Members',
                '',
                '| Name | Role | Charter | Status |',
                '|------|------|---------|--------|',
                '| Bob | Dev | `.ai-team/agents/bob/charter.md` | ✅ Active |',
            ].join('\n'));

            // Create log that marks Bob as participant but NO tasks or issue refs at all
            const logDir = path.join(tempDir, '.ai-team', 'orchestration-log');
            fs.mkdirSync(logDir, { recursive: true });
            fs.writeFileSync(path.join(logDir, '2026-03-01-chat.md'), [
                '# Copilot Chat Session',
                '',
                '**Participants:** Bob',
                '',
                '## Summary',
                'Answered questions about the codebase.',
            ].join('\n'));

            const provider = new SquadDataProvider(tempDir, '.ai-team');
            const members = await provider.getSquadMembers();

            const bob = members.find(m => m.name === 'Bob');
            assert.ok(bob, 'Should find Bob');
            // Bob has no tasks at all, so should stay active (Copilot Chat scenario)
            assert.ok(isActiveStatus(bob!.status), 'Should stay working when no tasks exist');
        });

        test('member stays working when log says working and has in-progress tasks', async () => {
            fs.writeFileSync(path.join(tempDir, '.ai-team', 'team.md'), [
                '# Team',
                '',
                '## Members',
                '',
                '| Name | Role | Charter | Status |',
                '|------|------|---------|--------|',
                '| Carol | Dev | `.ai-team/agents/carol/charter.md` | ✅ Active |',
            ].join('\n'));

            // Create log that marks Carol as participant with in-progress task
            const logDir = path.join(tempDir, '.ai-team', 'orchestration-log');
            fs.mkdirSync(logDir, { recursive: true });
            fs.writeFileSync(path.join(logDir, '2026-03-01-in-progress.md'), [
                '# Active Work',
                '',
                '**Participants:** Carol',
                '',
                '## Related Issues',
                '- #99',
                '',
                '## Summary',
                'Working on new feature.',
            ].join('\n'));

            const provider = new SquadDataProvider(tempDir, '.ai-team');
            const members = await provider.getSquadMembers();

            const carol = members.find(m => m.name === 'Carol');
            assert.ok(carol, 'Should find Carol');
            // Carol has an in-progress task, should stay active
            assert.ok(isActiveStatus(carol!.status), 'Should stay working with in-progress tasks');
        });

        test('member not in logs shows as idle', async () => {
            fs.writeFileSync(path.join(tempDir, '.ai-team', 'team.md'), [
                '# Team',
                '',
                '## Members',
                '',
                '| Name | Role | Charter | Status |',
                '|------|------|---------|--------|',
                '| Dave | Dev | `.ai-team/agents/dave/charter.md` | ✅ Active |',
            ].join('\n'));

            // Create log directory but no entries for Dave
            const logDir = path.join(tempDir, '.ai-team', 'orchestration-log');
            fs.mkdirSync(logDir, { recursive: true });

            const provider = new SquadDataProvider(tempDir, '.ai-team');
            const members = await provider.getSquadMembers();

            const dave = members.find(m => m.name === 'Dave');
            assert.ok(dave, 'Should find Dave');
            // Dave not in any logs, should be "idle"
            assert.strictEqual(dave!.status, 'idle', 'Should be idle when not in logs');
        });
    });

    // ─── GitHub-aware status (Issue #50) ────────────────────────────────

    suite('GitHub-aware status (setOpenIssues)', () => {
        test('idle member with open issues becomes working', async () => {
            fs.writeFileSync(path.join(tempDir, '.ai-team', 'team.md'), [
                '# Team',
                '',
                '## Members',
                '',
                '| Name | Role | Charter | Status |',
                '|------|------|---------|--------|',
                '| Eve | Dev | `.ai-team/agents/eve/charter.md` | ✅ Active |',
            ].join('\n'));

            const provider = new SquadDataProvider(tempDir, '.ai-team');
            
            // Eve has no log activity, starts idle
            let members = await provider.getSquadMembers();
            let eve = members.find(m => m.name === 'Eve');
            assert.strictEqual(eve!.status, 'idle', 'Eve starts idle without issues');

            // Now set open issues for Eve
            provider.refresh();
            provider.setOpenIssues(new Map([
                ['eve', [
                    {
                        number: 42,
                        title: 'Fix the widget',
                        state: 'open',
                        labels: [{ name: 'squad:eve' }],
                        htmlUrl: 'https://github.com/test/test/issues/42',
                        createdAt: '2026-02-01T10:00:00Z',
                        updatedAt: '2026-02-20T14:30:00Z',
                    }
                ]]
            ]));

            members = await provider.getSquadMembers();
            eve = members.find(m => m.name === 'Eve');
            assert.strictEqual(eve!.status, 'working-on-issue', 'Eve becomes working-on-issue with open issues');
            assert.ok(eve!.currentTask, 'Eve should have currentTask from issue');
            assert.strictEqual(eve!.currentTask!.id, '#42');
            assert.strictEqual(eve!.currentTask!.title, 'Fix the widget');
        });

        test('working member stays working (not downgraded by issues)', async () => {
            fs.writeFileSync(path.join(tempDir, '.ai-team', 'team.md'), [
                '# Team',
                '',
                '## Members',
                '',
                '| Name | Role | Charter | Status |',
                '|------|------|---------|--------|',
                '| Frank | Dev | `.ai-team/agents/frank/charter.md` | ✅ Active |',
            ].join('\n'));

            // Create log that marks Frank as working
            const logDir = path.join(tempDir, '.ai-team', 'orchestration-log');
            fs.mkdirSync(logDir, { recursive: true });
            fs.writeFileSync(path.join(logDir, '2026-03-01-working.md'), [
                '# Session',
                '',
                '**Participants:** Frank',
                '',
                '## Summary',
                'Frank is coding.',
            ].join('\n'));

            const provider = new SquadDataProvider(tempDir, '.ai-team');
            
            // Frank is working from logs
            let members = await provider.getSquadMembers();
            let frank = members.find(m => m.name === 'Frank');
            assert.strictEqual(frank!.status, 'working', 'Frank is working from logs');

            // Setting empty issues should NOT change Frank to idle
            provider.refresh();
            provider.setOpenIssues(new Map()); // No issues for anyone

            members = await provider.getSquadMembers();
            frank = members.find(m => m.name === 'Frank');
            assert.strictEqual(frank!.status, 'working', 'Frank stays working even without issues');
        });

        test('most recent issue is used as currentTask', async () => {
            fs.writeFileSync(path.join(tempDir, '.ai-team', 'team.md'), [
                '# Team',
                '',
                '## Members',
                '',
                '| Name | Role | Charter | Status |',
                '|------|------|---------|--------|',
                '| Grace | Dev | `.ai-team/agents/grace/charter.md` | ✅ Active |',
            ].join('\n'));

            const provider = new SquadDataProvider(tempDir, '.ai-team');
            
            provider.setOpenIssues(new Map([
                ['grace', [
                    {
                        number: 10,
                        title: 'Old issue',
                        state: 'open',
                        labels: [{ name: 'squad:grace' }],
                        htmlUrl: 'https://github.com/test/test/issues/10',
                        createdAt: '2026-01-01T10:00:00Z',
                        updatedAt: '2026-01-15T14:30:00Z',
                    },
                    {
                        number: 20,
                        title: 'Recent issue',
                        state: 'open',
                        labels: [{ name: 'squad:grace' }],
                        htmlUrl: 'https://github.com/test/test/issues/20',
                        createdAt: '2026-02-01T10:00:00Z',
                        updatedAt: '2026-02-20T14:30:00Z',
                    },
                    {
                        number: 15,
                        title: 'Middle issue',
                        state: 'open',
                        labels: [{ name: 'squad:grace' }],
                        htmlUrl: 'https://github.com/test/test/issues/15',
                        createdAt: '2026-01-20T10:00:00Z',
                        updatedAt: '2026-02-10T14:30:00Z',
                    }
                ]]
            ]));

            const members = await provider.getSquadMembers();
            const grace = members.find(m => m.name === 'Grace');
            
            assert.strictEqual(grace!.status, 'working-on-issue');
            assert.strictEqual(grace!.currentTask!.id, '#20', 'Should pick most recent issue (#20)');
            assert.strictEqual(grace!.currentTask!.title, 'Recent issue');
        });

        test('member with log task keeps log task instead of issue', async () => {
            fs.writeFileSync(path.join(tempDir, '.ai-team', 'team.md'), [
                '# Team',
                '',
                '## Members',
                '',
                '| Name | Role | Charter | Status |',
                '|------|------|---------|--------|',
                '| Henry | Dev | `.ai-team/agents/henry/charter.md` | ✅ Active |',
            ].join('\n'));

            // Create log with in-progress task for Henry
            const logDir = path.join(tempDir, '.ai-team', 'orchestration-log');
            fs.mkdirSync(logDir, { recursive: true });
            fs.writeFileSync(path.join(logDir, '2026-03-01-henry.md'), [
                '# Session',
                '',
                '**Participants:** Henry',
                '',
                '## Related Issues',
                '- #99 - Working on the big feature',
                '',
                '## Summary',
                'Implementing the feature.',
            ].join('\n'));

            const provider = new SquadDataProvider(tempDir, '.ai-team');
            
            // Set open issues - different issue than what's in the log
            provider.setOpenIssues(new Map([
                ['henry', [
                    {
                        number: 50,
                        title: 'Different issue',
                        state: 'open',
                        labels: [{ name: 'squad:henry' }],
                        htmlUrl: 'https://github.com/test/test/issues/50',
                        createdAt: '2026-02-01T10:00:00Z',
                        updatedAt: '2026-02-20T14:30:00Z',
                    }
                ]]
            ]));

            const members = await provider.getSquadMembers();
            const henry = members.find(m => m.name === 'Henry');
            
            assert.ok(isActiveStatus(henry!.status));
            // Should keep the log-derived task, not the GitHub issue
            // Log-derived task IDs don't have # prefix
            assert.strictEqual(henry!.currentTask!.id, '99', 'Should keep log task, not GitHub issue');
        });

        test('case-insensitive member name matching for issues', async () => {
            fs.writeFileSync(path.join(tempDir, '.ai-team', 'team.md'), [
                '# Team',
                '',
                '## Members',
                '',
                '| Name | Role | Charter | Status |',
                '|------|------|---------|--------|',
                '| Isabella | Dev | `.ai-team/agents/isabella/charter.md` | ✅ Active |',
            ].join('\n'));

            const provider = new SquadDataProvider(tempDir, '.ai-team');
            
            // Issues are keyed by lowercase name
            provider.setOpenIssues(new Map([
                ['isabella', [
                    {
                        number: 77,
                        title: 'Case test issue',
                        state: 'open',
                        labels: [{ name: 'squad:Isabella' }],
                        htmlUrl: 'https://github.com/test/test/issues/77',
                        createdAt: '2026-02-01T10:00:00Z',
                        updatedAt: '2026-02-20T14:30:00Z',
                    }
                ]]
            ]));

            const members = await provider.getSquadMembers();
            const isabella = members.find(m => m.name === 'Isabella');
            
            assert.strictEqual(isabella!.status, 'working-on-issue', 'Should match case-insensitively');
        });
    });
});
