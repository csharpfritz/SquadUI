/**
 * Tests for IssueDetailWebview.ts — pure helper methods and HTML generation.
 *
 * Covers:
 * - getContrastColor: black/white text based on background luminance
 * - escapeHtml: XSS protection for user-generated content
 * - formatDateString: ISO date formatting with fallback
 * - getHtmlContent: full HTML output validation
 */

import * as assert from 'assert';
import { IssueDetailWebview } from '../../views/IssueDetailWebview';
import { GitHubIssue } from '../../models';

suite('IssueDetailWebview', () => {
    let webview: IssueDetailWebview;

    setup(() => {
        const extensionUri = { fsPath: '/test' } as any;
        webview = new IssueDetailWebview(extensionUri);
    });

    teardown(() => {
        webview.dispose();
    });

    // ─── getContrastColor() Tests ───────────────────────────────────────────

    suite('getContrastColor()', () => {
        test('returns black text for light backgrounds', () => {
            const getContrastColor = (webview as any).getContrastColor.bind(webview);

            const white = getContrastColor('ffffff');
            assert.strictEqual(white, '#000000', 'White background should have black text');
        });

        test('returns white text for dark backgrounds', () => {
            const getContrastColor = (webview as any).getContrastColor.bind(webview);

            const black = getContrastColor('000000');
            assert.strictEqual(black, '#ffffff', 'Black background should have white text');
        });

        test('threshold at 0.5 luminance', () => {
            const getContrastColor = (webview as any).getContrastColor.bind(webview);

            // Luminance = (0.299 * 128 + 0.587 * 128 + 0.114 * 128) / 255 ≈ 0.502
            const midGray = getContrastColor('808080');
            assert.strictEqual(midGray, '#000000', 'Mid-gray should have black text (luminance > 0.5)');
        });

        test('returns white text for dark gray', () => {
            const getContrastColor = (webview as any).getContrastColor.bind(webview);

            const darkGray = getContrastColor('404040');
            assert.strictEqual(darkGray, '#ffffff', 'Dark gray should have white text');
        });

        test('returns black text for light gray', () => {
            const getContrastColor = (webview as any).getContrastColor.bind(webview);

            const lightGray = getContrastColor('c0c0c0');
            assert.strictEqual(lightGray, '#000000', 'Light gray should have black text');
        });

        test('handles colors without # prefix', () => {
            const getContrastColor = (webview as any).getContrastColor.bind(webview);

            const result = getContrastColor('ff0000');
            assert.ok(result === '#000000' || result === '#ffffff', 'Should return valid contrast color');
        });
    });

    // ─── escapeHtml() Tests ─────────────────────────────────────────────────

    suite('escapeHtml()', () => {
        test('escapes ampersand (&)', () => {
            const escapeHtml = (webview as any).escapeHtml.bind(webview);

            const result = escapeHtml('A & B');
            assert.strictEqual(result, 'A &amp; B');
        });

        test('escapes less-than (<)', () => {
            const escapeHtml = (webview as any).escapeHtml.bind(webview);

            const result = escapeHtml('A < B');
            assert.strictEqual(result, 'A &lt; B');
        });

        test('escapes greater-than (>)', () => {
            const escapeHtml = (webview as any).escapeHtml.bind(webview);

            const result = escapeHtml('A > B');
            assert.strictEqual(result, 'A &gt; B');
        });

        test('escapes double quote (")', () => {
            const escapeHtml = (webview as any).escapeHtml.bind(webview);

            const result = escapeHtml('Say "hello"');
            assert.strictEqual(result, 'Say &quot;hello&quot;');
        });

        test("escapes single quote (')", () => {
            const escapeHtml = (webview as any).escapeHtml.bind(webview);

            const result = escapeHtml("It's fine");
            assert.strictEqual(result, "It&#039;s fine");
        });

        test('escapes multiple special characters', () => {
            const escapeHtml = (webview as any).escapeHtml.bind(webview);

            const result = escapeHtml('<script>alert("XSS")</script>');
            assert.strictEqual(result, '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
        });

        test('leaves safe text unchanged', () => {
            const escapeHtml = (webview as any).escapeHtml.bind(webview);

            const result = escapeHtml('Safe text 123');
            assert.strictEqual(result, 'Safe text 123');
        });
    });

    // ─── formatDateString() Tests ───────────────────────────────────────────

    suite('formatDateString()', () => {
        test('formats valid ISO dates', () => {
            const formatDateString = (webview as any).formatDateString.bind(webview);

            const result = formatDateString('2024-01-15T10:30:00Z');
            assert.ok(result.includes('2024') || result.includes('15'), 'Should format date');
            assert.notStrictEqual(result, '2024-01-15T10:30:00Z', 'Should transform ISO format');
        });

        test('returns "Invalid Date" for invalid dates', () => {
            const formatDateString = (webview as any).formatDateString.bind(webview);

            const result = formatDateString('not-a-date');
            assert.strictEqual(result, 'Invalid Date');
        });

        test('returns "Invalid Date" for empty date', () => {
            const formatDateString = (webview as any).formatDateString.bind(webview);

            const result = formatDateString('');
            assert.strictEqual(result, 'Invalid Date');
        });

        test('formats ISO date with timezone', () => {
            const formatDateString = (webview as any).formatDateString.bind(webview);

            const result = formatDateString('2024-12-25T00:00:00+00:00');
            assert.ok(result.includes('2024') || result.includes('25'), 'Should format date with timezone');
        });
    });

    // ─── getHtmlContent() Tests ─────────────────────────────────────────────

    suite('getHtmlContent()', () => {
        test('produces valid HTML with issue number', () => {
            const issue: GitHubIssue = {
                number: 42,
                title: 'Test Issue',
                body: 'Test body',
                state: 'open',
                htmlUrl: 'https://github.com/test/repo/issues/42',
                assignee: 'testuser',
                labels: [],
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-02T00:00:00Z',
            };

            const getHtmlContent = (webview as any).getHtmlContent.bind(webview);
            const html = getHtmlContent(issue);

            assert.ok(html.includes('#42'), 'Should include issue number');
        });

        test('produces valid HTML with issue title', () => {
            const issue: GitHubIssue = {
                number: 1,
                title: 'Fix critical bug',
                body: 'Description',
                state: 'open',
                htmlUrl: 'https://github.com/test/repo/issues/1',
                assignee: undefined,
                labels: [],
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            };

            const getHtmlContent = (webview as any).getHtmlContent.bind(webview);
            const html = getHtmlContent(issue);

            assert.ok(html.includes('Fix critical bug'), 'Should include issue title');
        });

        test('shows Open badge for open issues', () => {
            const issue: GitHubIssue = {
                number: 1,
                title: 'Open Issue',
                body: '',
                state: 'open',
                htmlUrl: 'https://github.com/test/repo/issues/1',
                assignee: undefined,
                labels: [],
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            };

            const getHtmlContent = (webview as any).getHtmlContent.bind(webview);
            const html = getHtmlContent(issue);

            assert.ok(html.includes('badge-open'), 'Should have open badge class');
            assert.ok(html.includes('Open'), 'Should display "Open" text');
        });

        test('shows Closed badge for closed issues', () => {
            const issue: GitHubIssue = {
                number: 2,
                title: 'Closed Issue',
                body: '',
                state: 'closed',
                htmlUrl: 'https://github.com/test/repo/issues/2',
                assignee: undefined,
                labels: [],
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-02T00:00:00Z',
            };

            const getHtmlContent = (webview as any).getHtmlContent.bind(webview);
            const html = getHtmlContent(issue);

            assert.ok(html.includes('badge-closed'), 'Should have closed badge class');
            assert.ok(html.includes('Closed'), 'Should display "Closed" text');
        });

        test('renders labels with colors', () => {
            const issue: GitHubIssue = {
                number: 3,
                title: 'Issue with labels',
                body: '',
                state: 'open',
                htmlUrl: 'https://github.com/test/repo/issues/3',
                assignee: undefined,
                labels: [
                    { name: 'bug', color: 'd73a4a' },
                    { name: 'enhancement', color: 'a2eeef' },
                ],
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            };

            const getHtmlContent = (webview as any).getHtmlContent.bind(webview);
            const html = getHtmlContent(issue);

            assert.ok(html.includes('bug'), 'Should include bug label');
            assert.ok(html.includes('enhancement'), 'Should include enhancement label');
            assert.ok(html.includes('#d73a4a'), 'Should include bug color');
            assert.ok(html.includes('#a2eeef'), 'Should include enhancement color');
        });

        test('shows assignee when present', () => {
            const issue: GitHubIssue = {
                number: 4,
                title: 'Assigned Issue',
                body: '',
                state: 'open',
                htmlUrl: 'https://github.com/test/repo/issues/4',
                assignee: 'alice',
                labels: [],
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            };

            const getHtmlContent = (webview as any).getHtmlContent.bind(webview);
            const html = getHtmlContent(issue);

            assert.ok(html.includes('alice'), 'Should show assignee name');
        });

        test('shows Unassigned when assignee is null', () => {
            const issue: GitHubIssue = {
                number: 5,
                title: 'Unassigned Issue',
                body: '',
                state: 'open',
                htmlUrl: 'https://github.com/test/repo/issues/5',
                assignee: undefined,
                labels: [],
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            };

            const getHtmlContent = (webview as any).getHtmlContent.bind(webview);
            const html = getHtmlContent(issue);

            assert.ok(html.includes('Unassigned'), 'Should show Unassigned text');
        });

        test('renders body text', () => {
            const issue: GitHubIssue = {
                number: 6,
                title: 'Issue with body',
                body: 'This is the issue description',
                state: 'open',
                htmlUrl: 'https://github.com/test/repo/issues/6',
                assignee: undefined,
                labels: [],
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            };

            const getHtmlContent = (webview as any).getHtmlContent.bind(webview);
            const html = getHtmlContent(issue);

            assert.ok(html.includes('This is the issue description'), 'Should render body text');
        });

        test('shows "No description provided" when body is empty', () => {
            const issue: GitHubIssue = {
                number: 7,
                title: 'Issue without body',
                body: '',
                state: 'open',
                htmlUrl: 'https://github.com/test/repo/issues/7',
                assignee: undefined,
                labels: [],
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            };

            const getHtmlContent = (webview as any).getHtmlContent.bind(webview);
            const html = getHtmlContent(issue);

            assert.ok(html.includes('No description provided'), 'Should show no description message');
        });

        test('includes CSP meta tag', () => {
            const issue: GitHubIssue = {
                number: 8,
                title: 'CSP Test',
                body: '',
                state: 'open',
                htmlUrl: 'https://github.com/test/repo/issues/8',
                assignee: undefined,
                labels: [],
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            };

            const getHtmlContent = (webview as any).getHtmlContent.bind(webview);
            const html = getHtmlContent(issue);

            assert.ok(html.includes('Content-Security-Policy'), 'Should include CSP meta tag');
        });

        test('escapes special characters in title', () => {
            const issue: GitHubIssue = {
                number: 9,
                title: '<script>alert("XSS")</script>',
                body: '',
                state: 'open',
                htmlUrl: 'https://github.com/test/repo/issues/9',
                assignee: undefined,
                labels: [],
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            };

            const getHtmlContent = (webview as any).getHtmlContent.bind(webview);
            const html = getHtmlContent(issue);

            assert.ok(html.includes('&lt;script&gt;'), 'Should escape < in title');
            assert.ok(!html.includes('<script>alert'), 'Should not have unescaped script tag');
        });

        test('escapes special characters in body', () => {
            const issue: GitHubIssue = {
                number: 10,
                title: 'Safe Title',
                body: '<img src=x onerror=alert(1)>',
                state: 'open',
                htmlUrl: 'https://github.com/test/repo/issues/10',
                assignee: undefined,
                labels: [],
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            };

            const getHtmlContent = (webview as any).getHtmlContent.bind(webview);
            const html = getHtmlContent(issue);

            assert.ok(html.includes('&lt;img'), 'Should escape < in body');
            assert.ok(!html.includes('<img src=x'), 'Should not have unescaped img tag');
        });

        test('includes Open in GitHub button', () => {
            const issue: GitHubIssue = {
                number: 11,
                title: 'Button Test',
                body: '',
                state: 'open',
                htmlUrl: 'https://github.com/test/repo/issues/11',
                assignee: undefined,
                labels: [],
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            };

            const getHtmlContent = (webview as any).getHtmlContent.bind(webview);
            const html = getHtmlContent(issue);

            assert.ok(html.includes('openInGithub'), 'Should include button element');
            assert.ok(html.includes('Open in GitHub'), 'Should include button text');
        });

        test('includes correct GitHub URL in button', () => {
            const issue: GitHubIssue = {
                number: 12,
                title: 'URL Test',
                body: '',
                state: 'open',
                htmlUrl: 'https://github.com/test/repo/issues/12',
                assignee: undefined,
                labels: [],
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            };

            const getHtmlContent = (webview as any).getHtmlContent.bind(webview);
            const html = getHtmlContent(issue);

            assert.ok(html.includes('https://github.com/test/repo/issues/12'), 'Should include correct URL');
        });
    });
});
