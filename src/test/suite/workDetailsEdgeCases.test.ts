/**
 * Edge case tests for WorkDetailsWebview rendering logic.
 *
 * Tests the actual WorkDetailsWebview class (not TestableWebviewContent)
 * for edge cases in HTML generation: renderMarkdown, renderTable,
 * getInitials, and escapeHtml via the private methods.
 */

import * as assert from 'assert';
import { WorkDetailsWebview } from '../../views/WorkDetailsWebview';

suite('WorkDetailsWebview — Edge Cases', () => {
    let webview: WorkDetailsWebview;

    setup(() => {
        const extensionUri = { fsPath: '/test' } as any;
        webview = new WorkDetailsWebview(extensionUri);
    });

    teardown(() => {
        webview.dispose();
    });

    // ─── getInitials() Edge Cases ───────────────────────────────────────

    suite('getInitials()', () => {
        test('handles hyphenated names', () => {
            const getInitials = (webview as any).getInitials.bind(webview);
            // "Mary-Jane Watson" → ["Mary-Jane", "Watson"] → MJ? No: MW
            // split by space gives "Mary-Jane" and "Watson", charAt(0) = M, W
            assert.strictEqual(getInitials('Mary-Jane Watson'), 'MW');
        });

        test('handles single character name', () => {
            const getInitials = (webview as any).getInitials.bind(webview);
            assert.strictEqual(getInitials('X'), 'X');
        });

        test('handles all uppercase name', () => {
            const getInitials = (webview as any).getInitials.bind(webview);
            assert.strictEqual(getInitials('ALICE BOB'), 'AB');
        });

        test('handles lowercase name (uppercases first chars)', () => {
            const getInitials = (webview as any).getInitials.bind(webview);
            assert.strictEqual(getInitials('alice bob'), 'AB');
        });
    });

    // ─── renderInline() Edge Cases ──────────────────────────────────────

    suite('renderInline()', () => {
        test('handles text with no formatting', () => {
            const renderInline = (webview as any).renderInline.bind(webview);
            assert.strictEqual(renderInline('plain text'), 'plain text');
        });

        test('handles multiple bold sections', () => {
            const renderInline = (webview as any).renderInline.bind(webview);
            const result = renderInline('**a** and **b**');
            assert.ok(result.includes('<strong>a</strong>'));
            assert.ok(result.includes('<strong>b</strong>'));
        });

        test('handles mixed bold and code', () => {
            const renderInline = (webview as any).renderInline.bind(webview);
            const result = renderInline('**bold** and `code`');
            assert.ok(result.includes('<strong>bold</strong>'));
            assert.ok(result.includes('<code>code</code>'));
        });

        test('handles unclosed bold (no match)', () => {
            const renderInline = (webview as any).renderInline.bind(webview);
            const result = renderInline('**unclosed');
            assert.strictEqual(result, '**unclosed');
        });

        test('handles unclosed inline code (no match)', () => {
            const renderInline = (webview as any).renderInline.bind(webview);
            const result = renderInline('`unclosed');
            assert.strictEqual(result, '`unclosed');
        });
    });

    // ─── renderTable() Edge Cases ───────────────────────────────────────

    suite('renderTable()', () => {
        test('returns empty string for empty lines array', () => {
            const renderTable = (webview as any).renderTable.bind(webview);
            assert.strictEqual(renderTable([]), '');
        });

        test('handles single row table (no separator)', () => {
            const renderTable = (webview as any).renderTable.bind(webview);
            const result = renderTable(['| A | B |']);

            assert.ok(result.includes('<table class="md-table">'));
            assert.ok(result.includes('<td>'));
            assert.ok(!result.includes('<thead>'));
        });

        test('handles table with fewer data cells than header cells', () => {
            const renderTable = (webview as any).renderTable.bind(webview);
            const result = renderTable([
                '| H1 | H2 | H3 |',
                '|----|----|----|',
                '| A |',
            ]);

            assert.ok(result.includes('<table class="md-table">'));
            assert.ok(result.includes('<th>H1</th>'));
            assert.ok(result.includes('<td>A</td>'));
        });

        test('handles alignment separator with colons', () => {
            const renderTable = (webview as any).renderTable.bind(webview);
            const result = renderTable([
                '| Left | Center | Right |',
                '|:-----|:------:|------:|',
                '| A | B | C |',
            ]);

            assert.ok(result.includes('<thead>'));
            assert.ok(result.includes('<th>Left</th>'));
            assert.ok(result.includes('<td>A</td>'));
        });
    });

    // ─── renderMarkdown() Edge Cases ────────────────────────────────────

    suite('renderMarkdown()', () => {
        test('handles empty string', () => {
            const renderMarkdown = (webview as any).renderMarkdown.bind(webview);
            const result = renderMarkdown('');
            assert.strictEqual(result, '');
        });

        test('handles string with only newlines', () => {
            const renderMarkdown = (webview as any).renderMarkdown.bind(webview);
            const result = renderMarkdown('\n\n\n');
            assert.ok(result.includes('<br>'));
        });

        test('handles text with HTML entities that need escaping', () => {
            const renderMarkdown = (webview as any).renderMarkdown.bind(webview);
            const result = renderMarkdown('A & B < C');
            assert.ok(result.includes('&amp;'));
            assert.ok(result.includes('&lt;'));
        });
    });

    // ─── getStatusBadge() Edge Cases ────────────────────────────────────

    suite('getStatusBadge()', () => {
        test('all valid statuses return badge objects', () => {
            const getStatusBadge = (webview as any).getStatusBadge.bind(webview);

            const pending = getStatusBadge('pending');
            assert.strictEqual(pending.label, 'Pending');
            assert.strictEqual(pending.class, 'badge-pending');

            const inProgress = getStatusBadge('in_progress');
            assert.strictEqual(inProgress.label, 'In Progress');
            assert.strictEqual(inProgress.class, 'badge-in-progress');

            const completed = getStatusBadge('completed');
            assert.strictEqual(completed.label, 'Completed');
            assert.strictEqual(completed.class, 'badge-completed');
        });
    });

    // ─── getMemberStatusBadge() ─────────────────────────────────────────

    suite('getMemberStatusBadge()', () => {
        test('all valid statuses return badge objects', () => {
            const getMemberStatusBadge = (webview as any).getMemberStatusBadge.bind(webview);

            const working = getMemberStatusBadge('working');
            assert.strictEqual(working.label, 'Working');
            assert.strictEqual(working.class, 'badge-working');

            const idle = getMemberStatusBadge('idle');
            assert.strictEqual(idle.label, 'Idle');
            assert.strictEqual(idle.class, 'badge-idle');
        });
    });

    // ─── dispose() ──────────────────────────────────────────────────────

    suite('dispose()', () => {
        test('dispose is safe to call multiple times', () => {
            assert.doesNotThrow(() => {
                webview.dispose();
                webview.dispose();
            });
        });
    });
});
