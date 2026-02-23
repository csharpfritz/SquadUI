/**
 * Tests for DecisionSearchService — search, filter, and ranking of decisions.
 *
 * Coverage:
 * - search(): full-text search with relevance ranking
 * - filterByDate(): inclusive date range filtering
 * - filterByAuthor(): case-insensitive author matching
 * - filter(): combined criteria chaining
 * - Edge cases: empty inputs, missing fields, malformed data
 */

import * as assert from 'assert';
import { DecisionSearchService, DecisionSearchCriteria } from '../../services/DecisionSearchService';
import { DecisionEntry } from '../../models';

/**
 * Helper to build a DecisionEntry with sensible defaults.
 */
function makeDecision(overrides: Partial<DecisionEntry> & { title: string }): DecisionEntry {
    return {
        filePath: '/fake/decisions.md',
        lineNumber: 0,
        ...overrides,
    };
}

suite('DecisionSearchService', () => {
    let service: DecisionSearchService;

    const decisions: DecisionEntry[] = [
        makeDecision({
            title: 'Use TypeScript for Extension',
            date: '2026-02-14',
            author: 'Linus',
            content: '## Use TypeScript for Extension\n**By:** Linus\nWe chose TypeScript for type safety.',
        }),
        makeDecision({
            title: 'CI Pipeline Configuration',
            date: '2026-02-15',
            author: 'Livingston',
            content: '## CI Pipeline Configuration\n**By:** Livingston\nGitHub Actions for CI/CD pipeline.',
        }),
        makeDecision({
            title: 'Lazy Activation Strategy',
            date: '2026-02-16',
            author: 'Danny',
            content: '## Lazy Activation Strategy\n**By:** Danny\nActivate on onView:squadMembers for performance.',
        }),
        makeDecision({
            title: 'TypeScript Strict Mode',
            date: '2026-02-17',
            author: 'Linus',
            content: '## TypeScript Strict Mode\n**By:** Linus\nEnable strict mode in tsconfig for safety.',
        }),
        makeDecision({
            title: 'Dashboard Tab Layout',
            date: '2026-02-18',
            author: 'Rusty',
            content: '## Dashboard Tab Layout\n**By:** Rusty\nUse tabbed layout for the dashboard webview.',
        }),
    ];

    setup(() => {
        service = new DecisionSearchService();
    });

    // ─── search() ────────────────────────────────────────────────────────

    suite('search()', () => {
        test('returns all decisions for empty query', () => {
            const results = service.search(decisions, '');
            assert.strictEqual(results.length, decisions.length);
        });

        test('returns all decisions for whitespace-only query', () => {
            const results = service.search(decisions, '   ');
            assert.strictEqual(results.length, decisions.length);
        });

        test('matches title text', () => {
            const results = service.search(decisions, 'Pipeline');
            assert.ok(results.length > 0, 'Should find at least one result');
            assert.strictEqual(results[0].title, 'CI Pipeline Configuration');
        });

        test('matches content text', () => {
            const results = service.search(decisions, 'GitHub Actions');
            assert.ok(results.length > 0, 'Should find CI Pipeline decision');
            assert.ok(results.some(d => d.title === 'CI Pipeline Configuration'));
        });

        test('matches author name', () => {
            const results = service.search(decisions, 'Rusty');
            assert.ok(results.length > 0, 'Should find Rusty\'s decisions');
            assert.strictEqual(results[0].title, 'Dashboard Tab Layout');
        });

        test('is case-insensitive', () => {
            const results = service.search(decisions, 'typescript');
            assert.ok(results.length >= 2, 'Should find both TypeScript decisions');
        });

        test('title matches rank higher than content-only matches', () => {
            // 'TypeScript' appears in title of two decisions; content-only in none extra
            const results = service.search(decisions, 'TypeScript');
            // Both TypeScript decisions should be at the top
            const topTitles = results.slice(0, 2).map(d => d.title);
            assert.ok(topTitles.includes('Use TypeScript for Extension'));
            assert.ok(topTitles.includes('TypeScript Strict Mode'));
        });

        test('multi-word query matches across fields', () => {
            const results = service.search(decisions, 'Linus strict');
            assert.ok(results.length > 0);
            // "TypeScript Strict Mode" by Linus should rank highest (matches in title + author)
            assert.strictEqual(results[0].title, 'TypeScript Strict Mode');
        });

        test('returns empty array for no matches', () => {
            const results = service.search(decisions, 'xyzzyNonExistent');
            assert.strictEqual(results.length, 0);
        });

        test('handles empty decisions array', () => {
            const results = service.search([], 'anything');
            assert.strictEqual(results.length, 0);
        });

        test('handles decisions with missing fields gracefully', () => {
            const sparse: DecisionEntry[] = [
                makeDecision({ title: 'Minimal Decision' }),
                makeDecision({ title: '', content: undefined, author: undefined }),
            ];
            // Should not throw
            const results = service.search(sparse, 'Minimal');
            assert.ok(results.length >= 1);
            assert.strictEqual(results[0].title, 'Minimal Decision');
        });
    });

    // ─── filterByDate() ──────────────────────────────────────────────────

    suite('filterByDate()', () => {
        test('filters to decisions within date range (inclusive)', () => {
            const start = new Date(2026, 1, 15); // Feb 15
            const end = new Date(2026, 1, 17);   // Feb 17
            const results = service.filterByDate(decisions, start, end);
            assert.strictEqual(results.length, 3);
            assert.ok(results.every(d => d.date! >= '2026-02-15' && d.date! <= '2026-02-17'));
        });

        test('single-day range returns only that day', () => {
            const day = new Date(2026, 1, 16); // Feb 16
            const results = service.filterByDate(decisions, day, day);
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].title, 'Lazy Activation Strategy');
        });

        test('excludes decisions without a date', () => {
            const withNoDate: DecisionEntry[] = [
                ...decisions,
                makeDecision({ title: 'No Date Decision' }),
            ];
            const start = new Date(2026, 0, 1);
            const end = new Date(2026, 11, 31);
            const results = service.filterByDate(withNoDate, start, end);
            assert.ok(!results.some(d => d.title === 'No Date Decision'));
        });

        test('returns empty when no decisions fall in range', () => {
            const start = new Date(2025, 0, 1);
            const end = new Date(2025, 0, 31);
            const results = service.filterByDate(decisions, start, end);
            assert.strictEqual(results.length, 0);
        });

        test('handles empty decisions array', () => {
            const start = new Date(2026, 0, 1);
            const end = new Date(2026, 11, 31);
            const results = service.filterByDate([], start, end);
            assert.strictEqual(results.length, 0);
        });
    });

    // ─── filterByAuthor() ────────────────────────────────────────────────

    suite('filterByAuthor()', () => {
        test('filters by exact author name (case-insensitive)', () => {
            const results = service.filterByAuthor(decisions, 'linus');
            assert.strictEqual(results.length, 2);
            assert.ok(results.every(d => d.author?.toLowerCase() === 'linus'));
        });

        test('filters by partial author name', () => {
            const results = service.filterByAuthor(decisions, 'Lin');
            assert.strictEqual(results.length, 2);
        });

        test('returns all decisions for empty author', () => {
            const results = service.filterByAuthor(decisions, '');
            assert.strictEqual(results.length, decisions.length);
        });

        test('returns all decisions for whitespace-only author', () => {
            const results = service.filterByAuthor(decisions, '   ');
            assert.strictEqual(results.length, decisions.length);
        });

        test('excludes decisions without an author', () => {
            const withNoAuthor: DecisionEntry[] = [
                ...decisions,
                makeDecision({ title: 'Anonymous', date: '2026-02-20' }),
            ];
            const results = service.filterByAuthor(withNoAuthor, 'Linus');
            assert.ok(!results.some(d => d.title === 'Anonymous'));
        });

        test('returns empty when no author matches', () => {
            const results = service.filterByAuthor(decisions, 'NonExistentAuthor');
            assert.strictEqual(results.length, 0);
        });

        test('handles empty decisions array', () => {
            const results = service.filterByAuthor([], 'Linus');
            assert.strictEqual(results.length, 0);
        });
    });

    // ─── filter() (combined) ─────────────────────────────────────────────

    suite('filter() — combined criteria', () => {
        test('applies all criteria together', () => {
            const criteria: DecisionSearchCriteria = {
                query: 'TypeScript',
                startDate: '2026-02-14',
                endDate: '2026-02-16',
                author: 'Linus',
            };
            const results = service.filter(decisions, criteria);
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].title, 'Use TypeScript for Extension');
        });

        test('returns all decisions with empty criteria', () => {
            const results = service.filter(decisions, {});
            assert.strictEqual(results.length, decisions.length);
        });

        test('applies only query when other fields are absent', () => {
            const results = service.filter(decisions, { query: 'Dashboard' });
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].title, 'Dashboard Tab Layout');
        });

        test('applies only date range when query/author are absent', () => {
            const results = service.filter(decisions, {
                startDate: '2026-02-17',
                endDate: '2026-02-18',
            });
            assert.strictEqual(results.length, 2);
        });

        test('applies only author when query/date are absent', () => {
            const results = service.filter(decisions, { author: 'Danny' });
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].title, 'Lazy Activation Strategy');
        });

        test('open-ended start date (endDate only)', () => {
            const results = service.filter(decisions, { endDate: '2026-02-15' });
            assert.strictEqual(results.length, 2);
        });

        test('open-ended end date (startDate only)', () => {
            const results = service.filter(decisions, { startDate: '2026-02-17' });
            assert.strictEqual(results.length, 2);
        });

        test('combined criteria with no matches returns empty', () => {
            const results = service.filter(decisions, {
                query: 'TypeScript',
                author: 'Rusty', // Rusty didn't write TypeScript decisions
            });
            assert.strictEqual(results.length, 0);
        });

        test('preserves search ranking order after date/author filters', () => {
            const criteria: DecisionSearchCriteria = {
                query: 'TypeScript',
                author: 'Linus',
            };
            const results = service.filter(decisions, criteria);
            assert.strictEqual(results.length, 2);
            // Both should be Linus's TypeScript decisions, ranked by relevance
            assert.ok(results[0].title.includes('TypeScript'));
            assert.ok(results[1].title.includes('TypeScript'));
        });
    });

    // ─── Edge Cases ──────────────────────────────────────────────────────

    suite('edge cases', () => {
        test('decisions with identical scores maintain stable order', () => {
            const identical: DecisionEntry[] = [
                makeDecision({ title: 'Alpha Feature', content: 'same content', author: 'A', date: '2026-01-01' }),
                makeDecision({ title: 'Beta Feature', content: 'same content', author: 'A', date: '2026-01-02' }),
            ];
            const results = service.search(identical, 'same content');
            assert.strictEqual(results.length, 2);
        });

        test('special regex characters in query do not throw', () => {
            // Shouldn't throw — query is used via includes(), not regex
            const results = service.search(decisions, '.*+?^${}()|[]\\');
            assert.strictEqual(results.length, 0);
        });

        test('very long query string does not throw', () => {
            const longQuery = 'word '.repeat(1000);
            const results = service.search(decisions, longQuery);
            assert.ok(Array.isArray(results));
        });

        test('filterByDate with reversed range returns empty', () => {
            const start = new Date(2026, 1, 18);
            const end = new Date(2026, 1, 14);
            const results = service.filterByDate(decisions, start, end);
            assert.strictEqual(results.length, 0);
        });

        test('filter with only whitespace query behaves like no query', () => {
            const results = service.filter(decisions, { query: '   ' });
            assert.strictEqual(results.length, decisions.length);
        });
    });
});
