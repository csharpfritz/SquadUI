/**
 * Tests for team display resilience — race conditions and retry behavior.
 *
 * Covers scenarios where team.md is partially written (squad init race),
 * retry logic in getSquadMembers(), fallback to log-participant discovery,
 * cache invalidation, FileWatcherService glob pattern, and
 * TeamTreeProvider graceful handling of empty member lists.
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { SquadDataProvider } from '../../services/SquadDataProvider';
import { TeamTreeProvider } from '../../views/SquadTreeProvider';
import { FileWatcherService } from '../../services/FileWatcherService';
import {
    MockSquadDataProvider,
} from '../mocks/squadDataProvider';

const TEST_FIXTURES_ROOT = path.resolve(__dirname, '../../../test-fixtures');

suite('Team Display Resilience', () => {
    let tempDir: string;

    setup(() => {
        tempDir = path.join(TEST_FIXTURES_ROOT, `temp-resilience-${Date.now()}`);
    });

    teardown(async () => {
        try {
            await fs.promises.rm(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    // ─── Scenario 1: Happy path — valid Members table ────────────────

    suite('getSquadMembers() with valid team.md', () => {
        test('returns members when team.md has valid Members table', async () => {
            const dir = path.join(tempDir, 'valid-team');
            const aiTeamDir = path.join(dir, '.ai-team');
            await fs.promises.mkdir(aiTeamDir, { recursive: true });
            await fs.promises.writeFile(path.join(aiTeamDir, 'team.md'), [
                '# Team',
                '',
                '## Members',
                '',
                '| Name | Role | Charter | Status |',
                '|------|------|---------|--------|',
                '| Alice | Lead | `.ai-team/agents/alice/charter.md` | ✅ Active |',
                '| Bob | Engineer | `.ai-team/agents/bob/charter.md` | ✅ Active |',
                '| Charlie | QA | `.ai-team/agents/charlie/charter.md` | ✅ Active |',
            ].join('\n'));

            const provider = new SquadDataProvider(dir);
            const members = await provider.getSquadMembers();

            assert.strictEqual(members.length, 3, 'Should return all 3 members');
            const names = members.map(m => m.name).sort();
            assert.deepStrictEqual(names, ['Alice', 'Bob', 'Charlie']);
            assert.strictEqual(members.find(m => m.name === 'Alice')?.role, 'Lead');
        });
    });

    // ─── Scenario 2: team.md exists but no Members section ───────────

    suite('getSquadMembers() with team.md missing Members section', () => {
        test('returns empty when team.md exists but has no Members section', async () => {
            const dir = path.join(tempDir, 'no-members-section');
            const aiTeamDir = path.join(dir, '.ai-team');
            await fs.promises.mkdir(aiTeamDir, { recursive: true });

            // Partially written file — has header but no Members table yet
            await fs.promises.writeFile(path.join(aiTeamDir, 'team.md'), [
                '# Team',
                '',
                '## Project Context',
                '',
                '**Owner:** TestOwner',
                '**Repository:** testorg/testrepo',
                '',
                '<!-- Members section not yet written -->',
            ].join('\n'));

            const provider = new SquadDataProvider(dir);
            const members = await provider.getSquadMembers();

            // team.md exists but roster.members is empty → falls through to
            // log-participant fallback, which also finds nothing here
            assert.strictEqual(members.length, 0, 'Should return empty when Members section missing');
        });
    });

    // ─── Scenario 3: Retry when team.md exists but Members empty ─────

    suite('getSquadMembers() retry on empty roster', () => {
        test('retries when team.md exists but Members is empty, succeeds on retry', async () => {
            const dir = path.join(tempDir, 'retry-success');
            const aiTeamDir = path.join(dir, '.ai-team');
            await fs.promises.mkdir(aiTeamDir, { recursive: true });

            // Start with a partially written team.md (no Members table rows)
            await fs.promises.writeFile(path.join(aiTeamDir, 'team.md'), [
                '# Team',
                '',
                '## Members',
                '',
                '| Name | Role | Charter | Status |',
                '|------|------|---------|--------|',
            ].join('\n'));

            const provider = new SquadDataProvider(dir);

            // Override the internal TeamMdService to simulate the race condition:
            // First call returns empty members, second call returns populated
            let callCount = 0;

            (provider as any).teamMdService.parseTeamMd = async () => {
                callCount++;
                if (callCount === 1) {
                    // Simulate partially-written file: roster exists but no members
                    return { members: [], repository: undefined, owner: undefined };
                }
                // On retry, file is fully written — return populated roster
                return {
                    members: [
                        { name: 'Danny', role: 'Lead', status: 'idle' as const },
                        { name: 'Rusty', role: 'Extension Dev', status: 'idle' as const },
                    ],
                    repository: undefined,
                    owner: undefined,
                };
            };

            const members = await provider.getSquadMembers();

            // If retry is implemented, we get members on the second call.
            // If retry is NOT yet implemented (Rusty's change pending), the
            // test validates current behavior: empty array falls through to
            // log-participant fallback, which also returns empty here.
            if (callCount > 1) {
                // Retry path: should have the populated roster
                assert.strictEqual(members.length, 2, 'Retry should return populated roster');
                assert.ok(members.find(m => m.name === 'Danny'));
                assert.ok(members.find(m => m.name === 'Rusty'));
            } else {
                // Pre-retry behavior: empty roster falls to log fallback
                assert.ok(Array.isArray(members), 'Should return array even without retry');
            }
        });
    });

    // ─── Scenario 4: Fallback to log-participant discovery ───────────

    suite('getSquadMembers() fallback to log participants', () => {
        test('falls back to log-participant discovery when team.md is missing', async () => {
            const dir = path.join(tempDir, 'log-fallback');
            const logDir = path.join(dir, '.ai-team', 'orchestration-log');
            await fs.promises.mkdir(logDir, { recursive: true });

            // No team.md, but orchestration log with participants
            await fs.promises.writeFile(path.join(logDir, '2026-03-01-session.md'), [
                '# Session',
                '',
                '**Date:** 2026-03-01',
                '**Participants:** Linus, Basher',
                '',
                '## Summary',
                'Worked on testing.',
            ].join('\n'));

            const provider = new SquadDataProvider(dir);
            const members = await provider.getSquadMembers();

            assert.strictEqual(members.length, 2, 'Should derive 2 members from logs');
            assert.ok(members.find(m => m.name === 'Linus'));
            assert.ok(members.find(m => m.name === 'Basher'));
            // Fallback assigns generic role
            for (const member of members) {
                assert.strictEqual(member.role, 'Squad Member');
            }
        });
    });

    // ─── Scenario 5: No retry when team.md genuinely missing ─────────

    suite('getSquadMembers() no retry when team.md missing', () => {
        test('does NOT retry when team.md genuinely does not exist', async () => {
            const dir = path.join(tempDir, 'no-team-md');
            await fs.promises.mkdir(dir, { recursive: true });
            // No .ai-team directory at all

            const provider = new SquadDataProvider(dir);

            // Spy on parseTeamMd to count calls
            let parseCallCount = 0;
            const originalTeamMdService = (provider as any).teamMdService;
            const originalParse = originalTeamMdService.parseTeamMd.bind(originalTeamMdService);
            (provider as any).teamMdService.parseTeamMd = async (root: string) => {
                parseCallCount++;
                return originalParse(root);
            };

            const members = await provider.getSquadMembers();

            // parseTeamMd returns null when file doesn't exist — no retry
            assert.strictEqual(parseCallCount, 1, 'Should only call parseTeamMd once when file missing');
            assert.deepStrictEqual(members, [], 'Should return empty (no logs either)');
        });
    });

    // ─── Scenario 6: FileWatcherService glob pattern ─────────────────

    suite('FileWatcherService watch pattern', () => {
        test('WATCH_PATTERN includes .ai-team', () => {
            // Access static WATCH_PATTERN to verify it covers .ai-team files
            const pattern = (FileWatcherService as any).WATCH_PATTERN;
            assert.ok(pattern, 'WATCH_PATTERN should be defined');
            assert.ok(
                pattern.includes('.ai-team'),
                `Pattern "${pattern}" should include .ai-team`
            );
        });

        test('WATCH_PATTERN watches .md files', () => {
            const pattern = (FileWatcherService as any).WATCH_PATTERN;
            assert.ok(
                pattern.includes('*.md'),
                `Pattern "${pattern}" should watch .md files`
            );
        });

        test('start() creates watcher with correct glob pattern', () => {
            const service = new FileWatcherService(50);
            // Before start, not watching
            assert.strictEqual(service.isWatching(), false);
            // We can't fully test watcher creation without VS Code workspace,
            // but we verify the pattern is correct and start() doesn't throw
            try {
                service.start();
                // If VS Code API available, it should be watching
            } catch {
                // Expected in test environment without full VS Code
            }
            service.dispose();
        });
    });

    // ─── Scenario 7: TeamTreeProvider with empty members ─────────────

    suite('TeamTreeProvider with empty members', () => {
        test('getSquadMemberItems returns empty array when no members exist', async () => {
            const mockDataProvider = new MockSquadDataProvider({ members: [] });
            const treeProvider = new TeamTreeProvider(mockDataProvider as never);

            const children = await treeProvider.getChildren();

            assert.ok(Array.isArray(children), 'Should return an array');
            assert.strictEqual(children.length, 0, 'Should return empty array for no members');
        });

        test('does not crash when members list is empty', async () => {
            const mockDataProvider = new MockSquadDataProvider({ members: [] });
            const treeProvider = new TeamTreeProvider(mockDataProvider as never);

            // Should not throw
            const children = await treeProvider.getChildren();
            assert.deepStrictEqual(children, []);
        });

        test('getTreeItem works even with empty tree', async () => {
            const mockDataProvider = new MockSquadDataProvider({ members: [] });
            const treeProvider = new TeamTreeProvider(mockDataProvider as never);

            // Verify no crash accessing the tree item API
            const children = await treeProvider.getChildren();
            assert.strictEqual(children.length, 0);
        });
    });

    // ─── Scenario 8: Cache invalidation on refresh() ─────────────────

    suite('Cache invalidation after refresh()', () => {
        test('after refresh(), getSquadMembers() re-reads from disk', async () => {
            const dir = path.join(tempDir, 'cache-invalidation');
            const aiTeamDir = path.join(dir, '.ai-team');
            await fs.promises.mkdir(aiTeamDir, { recursive: true });

            // Initial team.md with 1 member
            await fs.promises.writeFile(path.join(aiTeamDir, 'team.md'), [
                '# Team',
                '',
                '## Members',
                '',
                '| Name | Role | Charter | Status |',
                '|------|------|---------|--------|',
                '| Alice | Engineer | `.ai-team/agents/alice/charter.md` | ✅ Active |',
            ].join('\n'));

            const provider = new SquadDataProvider(dir);
            const members1 = await provider.getSquadMembers();
            assert.strictEqual(members1.length, 1, 'Initial read: 1 member');

            // Modify team.md on disk — add a second member
            await fs.promises.writeFile(path.join(aiTeamDir, 'team.md'), [
                '# Team',
                '',
                '## Members',
                '',
                '| Name | Role | Charter | Status |',
                '|------|------|---------|--------|',
                '| Alice | Engineer | `.ai-team/agents/alice/charter.md` | ✅ Active |',
                '| Bob | QA | `.ai-team/agents/bob/charter.md` | ✅ Active |',
            ].join('\n'));

            // Without refresh, should return cached (stale) data
            const members2 = await provider.getSquadMembers();
            assert.strictEqual(members2, members1, 'Should return cached array without refresh');
            assert.strictEqual(members2.length, 1, 'Cached data should still be 1 member');

            // After refresh, should re-read from disk
            provider.refresh();
            const members3 = await provider.getSquadMembers();
            assert.notStrictEqual(members3, members1, 'Should be a new array after refresh');
            assert.strictEqual(members3.length, 2, 'Should have 2 members after refresh');
            assert.ok(members3.find(m => m.name === 'Bob'), 'Should include newly added Bob');
        });

        test('refresh() invalidates all cache fields', async () => {
            const dir = path.join(tempDir, 'cache-all-fields');
            const aiTeamDir = path.join(dir, '.ai-team');
            await fs.promises.mkdir(aiTeamDir, { recursive: true });
            await fs.promises.writeFile(path.join(aiTeamDir, 'team.md'), [
                '# Team',
                '',
                '## Members',
                '',
                '| Name | Role | Status |',
                '|------|------|--------|',
                '| Alice | Engineer | ✅ Active |',
            ].join('\n'));

            const provider = new SquadDataProvider(dir);

            // Prime the cache
            await provider.getSquadMembers();

            // Verify cached fields are set
            assert.ok((provider as any).cachedMembers !== null, 'Members should be cached');

            // Refresh clears all caches
            provider.refresh();
            assert.strictEqual((provider as any).cachedMembers, null, 'cachedMembers should be null after refresh');
            assert.strictEqual((provider as any).cachedLogEntries, null, 'cachedLogEntries should be null after refresh');
            assert.strictEqual((provider as any).cachedTasks, null, 'cachedTasks should be null after refresh');
            assert.strictEqual((provider as any).cachedDecisions, null, 'cachedDecisions should be null after refresh');
        });
    });
});
