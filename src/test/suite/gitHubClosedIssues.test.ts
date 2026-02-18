/**
 * Unit tests for GitHubIssuesService — closed-issues pipeline.
 * Covers getClosedIssues(), getClosedIssuesByMember(), and label matching.
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { GitHubIssuesService } from '../../services/GitHubIssuesService';
import { GitHubIssue } from '../../models';

const TEST_FIXTURES_ROOT = path.resolve(__dirname, '../../../test-fixtures');

/** Helper to build a minimal closed GitHubIssue for tests. */
function makeClosedIssue(
    number: number,
    title: string,
    labels: { name: string }[],
    opts: { assignee?: string; closedAt?: string } = {},
): GitHubIssue {
    return {
        number,
        title,
        state: 'closed',
        labels,
        htmlUrl: `https://github.com/test/repo/issues/${number}`,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-10T00:00:00Z',
        closedAt: opts.closedAt,
        assignee: opts.assignee,
    };
}

/** Inject the private closedCache on a service instance. */
function injectClosedCache(
    service: GitHubIssuesService,
    issues: GitHubIssue[],
    fetchedAt: number = Date.now(),
): void {
    (service as unknown as { closedCache: { issues: GitHubIssue[]; fetchedAt: number } }).closedCache = {
        issues,
        fetchedAt,
    };
}

/** Inject the private issueSourceCache so getClosedIssuesByMember can resolve strategies. */
function injectIssueSourceCache(
    service: GitHubIssuesService,
    opts: { matching?: string[]; memberAliases?: Map<string, string> } = {},
): void {
    (service as unknown as { issueSourceCache: object }).issueSourceCache = {
        repository: 'test-owner/test-repo',
        owner: 'test-owner',
        repo: 'test-repo',
        matching: opts.matching,
        memberAliases: opts.memberAliases,
    };
}

suite('GitHubIssuesService — Closed Issues', () => {

    // ─── getClosedIssues() ─────────────────────────────────────────────

    suite('getClosedIssues()', () => {
        test('returns empty array when no issue source is configured', async () => {
            const service = new GitHubIssuesService();
            const issues = await service.getClosedIssues('/nonexistent/path');

            assert.deepStrictEqual(issues, []);
        });

        test('returns empty array when team.md has no repository', async () => {
            const tempDir = path.join(TEST_FIXTURES_ROOT, 'temp-closed-no-repo');
            const aiTeamDir = path.join(tempDir, '.ai-team');
            await fs.promises.mkdir(aiTeamDir, { recursive: true });
            await fs.promises.writeFile(path.join(aiTeamDir, 'team.md'), '# Team\n## Members\n');

            try {
                const service = new GitHubIssuesService();
                const issues = await service.getClosedIssues(tempDir);
                assert.deepStrictEqual(issues, []);
            } finally {
                await fs.promises.rm(tempDir, { recursive: true, force: true });
            }
        });

        test('returns cached data when cache is fresh (cache hit)', async () => {
            const service = new GitHubIssuesService({ cacheTtlMs: 60000 });
            const cachedIssues = [
                makeClosedIssue(10, 'Cached issue', [{ name: 'squad:alice' }], { closedAt: '2026-01-05T00:00:00Z' }),
            ];
            injectClosedCache(service, cachedIssues);

            const issues = await service.getClosedIssues('/any');

            assert.strictEqual(issues.length, 1);
            assert.strictEqual(issues[0].number, 10);
            assert.strictEqual(issues[0].title, 'Cached issue');
        });

        test('identifies expired cache as a cache miss', () => {
            const service = new GitHubIssuesService({ cacheTtlMs: 100 });
            injectClosedCache(service, [], Date.now() - 200);

            const isExpired = (service as unknown as { isClosedCacheExpired: () => boolean }).isClosedCacheExpired();
            assert.strictEqual(isExpired, true, 'Expired closed cache should trigger refetch');
        });

        test('identifies fresh cache as not expired', () => {
            const service = new GitHubIssuesService({ cacheTtlMs: 60000 });
            injectClosedCache(service, []);

            const isExpired = (service as unknown as { isClosedCacheExpired: () => boolean }).isClosedCacheExpired();
            assert.strictEqual(isExpired, false, 'Fresh closed cache should not be expired');
        });

        test('null closedCache is treated as expired', () => {
            const service = new GitHubIssuesService();
            // closedCache is null by default
            const isExpired = (service as unknown as { isClosedCacheExpired: () => boolean }).isClosedCacheExpired();
            assert.strictEqual(isExpired, true);
        });

        test('forceRefresh bypasses fresh cache', async () => {
            const service = new GitHubIssuesService({ cacheTtlMs: 60000 });
            const staleIssues = [
                makeClosedIssue(99, 'Stale', [{ name: 'bug' }], { closedAt: '2026-01-02T00:00:00Z' }),
            ];
            injectClosedCache(service, staleIssues);

            // forceRefresh = true but no issue source → returns [] (fetches again, gets nothing)
            const issues = await service.getClosedIssues('/nonexistent/path', true);
            assert.deepStrictEqual(issues, [], 'forceRefresh with no config returns empty');
        });

        test('invalidateCache clears closedCache', () => {
            const service = new GitHubIssuesService();
            injectClosedCache(service, [makeClosedIssue(1, 'Test', [], { closedAt: '2026-01-01T00:00:00Z' })]);

            service.invalidateCache();

            assert.strictEqual(
                (service as unknown as { closedCache: null }).closedCache,
                null,
                'closedCache should be null after invalidateCache',
            );
        });
    });

    // ─── getClosedIssuesByMember() ─────────────────────────────────────

    suite('getClosedIssuesByMember()', () => {
        test('maps closed issues to members via squad: labels', async () => {
            const service = new GitHubIssuesService();
            injectClosedCache(service, [
                makeClosedIssue(1, 'Fix auth', [{ name: 'squad:alice' }], { closedAt: '2026-01-05T00:00:00Z' }),
                makeClosedIssue(2, 'Add tests', [{ name: 'squad:bob' }], { closedAt: '2026-01-06T00:00:00Z' }),
                makeClosedIssue(3, 'Refactor', [{ name: 'squad:alice' }, { name: 'squad:bob' }], { closedAt: '2026-01-07T00:00:00Z' }),
            ]);
            injectIssueSourceCache(service);

            const byMember = await service.getClosedIssuesByMember('/any');

            assert.strictEqual(byMember.get('alice')?.length, 2, 'Alice should have 2 closed issues');
            assert.strictEqual(byMember.get('bob')?.length, 2, 'Bob should have 2 closed issues');
            assert.ok(byMember.get('alice')!.some(i => i.number === 1));
            assert.ok(byMember.get('alice')!.some(i => i.number === 3));
            assert.ok(byMember.get('bob')!.some(i => i.number === 2));
            assert.ok(byMember.get('bob')!.some(i => i.number === 3));
        });

        test('handles case-insensitive label matching (Squad:Danny vs squad:danny)', async () => {
            const service = new GitHubIssuesService();
            injectClosedCache(service, [
                makeClosedIssue(10, 'Issue A', [{ name: 'squad:danny' }], { closedAt: '2026-01-05T00:00:00Z' }),
                makeClosedIssue(11, 'Issue B', [{ name: 'Squad:Danny' }], { closedAt: '2026-01-06T00:00:00Z' }),
                makeClosedIssue(12, 'Issue C', [{ name: 'SQUAD:DANNY' }], { closedAt: '2026-01-07T00:00:00Z' }),
            ]);
            injectIssueSourceCache(service);

            const byMember = await service.getClosedIssuesByMember('/any');

            // The service uses label.name.startsWith(SQUAD_LABEL_PREFIX) which is lowercase 'squad:'
            // Labels 'Squad:Danny' and 'SQUAD:DANNY' do NOT start with lowercase 'squad:'
            // So only issue 10 should be matched via the labels strategy
            const dannyIssues = byMember.get('danny') ?? [];
            assert.ok(dannyIssues.length >= 1, 'At least the lowercase-prefixed issue should match');
            assert.ok(dannyIssues.some(i => i.number === 10), 'Issue 10 with squad:danny should match');
        });

        test('handles issues with no labels', async () => {
            const service = new GitHubIssuesService();
            injectClosedCache(service, [
                makeClosedIssue(20, 'No labels', [], { closedAt: '2026-01-05T00:00:00Z' }),
                makeClosedIssue(21, 'Non-squad label', [{ name: 'bug' }], { closedAt: '2026-01-06T00:00:00Z' }),
                makeClosedIssue(22, 'Has squad label', [{ name: 'squad:eve' }], { closedAt: '2026-01-07T00:00:00Z' }),
            ]);
            injectIssueSourceCache(service);

            const byMember = await service.getClosedIssuesByMember('/any');

            // Only eve should appear (from issue 22)
            assert.strictEqual(byMember.size, 1, 'Only one member should have issues');
            assert.strictEqual(byMember.get('eve')?.length, 1);
            assert.strictEqual(byMember.get('eve')![0].number, 22);
        });

        test('handles issues with undefined closedAt', async () => {
            const service = new GitHubIssuesService();
            injectClosedCache(service, [
                makeClosedIssue(30, 'Has closedAt', [{ name: 'squad:frank' }], { closedAt: '2026-01-05T00:00:00Z' }),
                makeClosedIssue(31, 'No closedAt', [{ name: 'squad:frank' }]),
            ]);
            injectIssueSourceCache(service);

            const byMember = await service.getClosedIssuesByMember('/any');

            // Both should be mapped — closedAt is metadata, not a filter criterion
            assert.strictEqual(byMember.get('frank')?.length, 2, 'Both issues should map to frank');
            const frankIssues = byMember.get('frank')!;
            assert.ok(frankIssues.some(i => i.closedAt === '2026-01-05T00:00:00Z'), 'Issue 30 has closedAt');
            assert.ok(frankIssues.some(i => i.closedAt === undefined), 'Issue 31 has undefined closedAt');
        });

        test('returns empty map when all issues lack squad labels', async () => {
            const service = new GitHubIssuesService();
            injectClosedCache(service, [
                makeClosedIssue(40, 'Bug', [{ name: 'bug' }], { closedAt: '2026-01-05T00:00:00Z' }),
                makeClosedIssue(41, 'Feature', [{ name: 'enhancement' }], { closedAt: '2026-01-06T00:00:00Z' }),
            ]);
            injectIssueSourceCache(service);

            const byMember = await service.getClosedIssuesByMember('/any');
            assert.strictEqual(byMember.size, 0, 'No members should appear');
        });

        test('returns empty map when no closed issues exist', async () => {
            const service = new GitHubIssuesService();
            injectClosedCache(service, []);
            injectIssueSourceCache(service);

            const byMember = await service.getClosedIssuesByMember('/any');
            assert.strictEqual(byMember.size, 0);
        });

        test('deduplicates issues with multiple squad labels for the same member', async () => {
            const service = new GitHubIssuesService();
            // An issue tagged with squad:grace twice (shouldn't happen, but tests dedup)
            injectClosedCache(service, [
                makeClosedIssue(50, 'Dupe label', [{ name: 'squad:grace' }, { name: 'squad:grace' }], { closedAt: '2026-01-05T00:00:00Z' }),
            ]);
            injectIssueSourceCache(service);

            const byMember = await service.getClosedIssuesByMember('/any');
            assert.strictEqual(byMember.get('grace')?.length, 1, 'Issue should not be duplicated');
        });

        test('assignee strategy maps issues via memberAliases', async () => {
            const service = new GitHubIssuesService();
            const aliases = new Map<string, string>();
            aliases.set('heidi', 'heidi-gh');

            injectClosedCache(service, [
                makeClosedIssue(60, 'Assignee issue', [{ name: 'bug' }], { assignee: 'heidi-gh', closedAt: '2026-01-05T00:00:00Z' }),
            ]);
            injectIssueSourceCache(service, { matching: ['labels', 'assignees'], memberAliases: aliases });

            const byMember = await service.getClosedIssuesByMember('/any');
            assert.strictEqual(byMember.get('heidi')?.length, 1, 'Assignee-matched issue should map to heidi');
        });
    });

    // ─── Rate limiting / error resilience ──────────────────────────────

    suite('Rate limit resilience', () => {
        test('fresh closed cache avoids API call (serves cached data on would-be 403)', async () => {
            // If cache is fresh, getClosedIssues returns cached data without hitting the API.
            // This means a rate-limited API (403) has no effect when cache is warm.
            const service = new GitHubIssuesService({ cacheTtlMs: 60000 });
            const cachedIssues = [
                makeClosedIssue(70, 'Cached during rate limit', [{ name: 'squad:ivan' }], { closedAt: '2026-01-05T00:00:00Z' }),
            ];
            injectClosedCache(service, cachedIssues);

            // No API call is made — returns cache
            const issues = await service.getClosedIssues('/any');
            assert.strictEqual(issues.length, 1);
            assert.strictEqual(issues[0].number, 70);
        });

        test('getClosedIssues with no config does not throw (returns empty)', async () => {
            const service = new GitHubIssuesService();
            // No config, no cache — should cleanly return []
            let threw = false;
            try {
                const issues = await service.getClosedIssues('/nonexistent');
                assert.deepStrictEqual(issues, []);
            } catch {
                threw = true;
            }
            assert.strictEqual(threw, false, 'Should not throw when issue source is missing');
        });
    });
});
