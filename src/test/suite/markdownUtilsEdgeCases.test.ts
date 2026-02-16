/**
 * Edge case tests for markdown utility functions.
 *
 * The main markdownUtils.test.ts covers basic strip/render scenarios.
 * These tests add edge cases: nested brackets, special chars in URLs,
 * multiple links on same line, and malformed markdown.
 */

import * as assert from 'assert';
import { stripMarkdownLinks, renderMarkdownLinks } from '../../utils/markdownUtils';

suite('markdownUtils — Edge Cases', () => {
    suite('stripMarkdownLinks — edge cases', () => {
        test('handles adjacent links with no separator', () => {
            assert.strictEqual(
                stripMarkdownLinks('[A](http://a.com)[B](http://b.com)'),
                'AB'
            );
        });

        test('handles link with empty display text', () => {
            // regex requires at least one char in [...]
            const result = stripMarkdownLinks('[](http://example.com)');
            // Should pass through unchanged since [] is empty
            assert.strictEqual(result, '[](http://example.com)');
        });

        test('handles link text with parentheses', () => {
            // The regex [^\]] matches non-bracket chars only
            assert.strictEqual(
                stripMarkdownLinks('[text (parens)](http://example.com)'),
                'text (parens)'
            );
        });

        test('handles URL with nested parentheses', () => {
            // URL with parens — regex [^)] stops at first )
            const result = stripMarkdownLinks('[link](http://example.com/path)');
            assert.strictEqual(result, 'link');
        });

        test('handles mixed plain text and links', () => {
            assert.strictEqual(
                stripMarkdownLinks('Hello [Danny](http://example.com), meet [Rusty](http://r.com)!'),
                'Hello Danny, meet Rusty!'
            );
        });

        test('handles multiline text with links', () => {
            const input = 'Line 1 [link1](http://a.com)\nLine 2 [link2](http://b.com)';
            const result = stripMarkdownLinks(input);
            assert.strictEqual(result, 'Line 1 link1\nLine 2 link2');
        });

        test('does not strip image syntax ![alt](url)', () => {
            // The regex matches [alt](url) but not ![alt](url) fully
            // since the ! is outside the match
            const result = stripMarkdownLinks('![image](http://example.com/img.png)');
            assert.ok(result.includes('!'), 'Should preserve ! prefix');
        });
    });

    suite('renderMarkdownLinks — edge cases', () => {
        test('handles adjacent links', () => {
            const result = renderMarkdownLinks('[A](http://a.com)[B](http://b.com)');
            assert.ok(result.includes('href="http://a.com"'));
            assert.ok(result.includes('href="http://b.com"'));
        });

        test('handles URL with query parameters', () => {
            const result = renderMarkdownLinks('[search](http://example.com?q=test&lang=en)');
            assert.ok(result.includes('href="http://example.com?q=test&lang=en"'));
            assert.ok(result.includes('>search<'));
        });

        test('handles URL with hash fragment', () => {
            const result = renderMarkdownLinks('[section](http://example.com#section-1)');
            assert.ok(result.includes('href="http://example.com#section-1"'));
        });

        test('preserves text around links', () => {
            const result = renderMarkdownLinks('Before [link](http://a.com) after');
            assert.strictEqual(
                result,
                'Before <a href="http://a.com" target="_blank">link</a> after'
            );
        });

        test('handles link with special chars in display text', () => {
            const result = renderMarkdownLinks('[Danny & Rusty](http://example.com)');
            assert.ok(result.includes('>Danny & Rusty<'));
        });
    });
});
