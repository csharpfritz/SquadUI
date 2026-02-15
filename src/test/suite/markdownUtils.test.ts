/**
 * Tests for markdown link utility functions.
 * Regression tests for issue #48 — markdown links in member names.
 */

import * as assert from 'assert';
import { stripMarkdownLinks, renderMarkdownLinks } from '../../utils/markdownUtils';

suite('markdownUtils', () => {

    suite('stripMarkdownLinks', () => {
        test('strips markdown link and returns display text', () => {
            assert.strictEqual(
                stripMarkdownLinks('[Danny](https://example.com)'),
                'Danny'
            );
        });

        test('strips multiple markdown links', () => {
            assert.strictEqual(
                stripMarkdownLinks('[Danny](https://a.com) and [Rusty](https://b.com)'),
                'Danny and Rusty'
            );
        });

        test('passes through plain text unchanged', () => {
            assert.strictEqual(stripMarkdownLinks('Danny'), 'Danny');
        });

        test('passes through empty string', () => {
            assert.strictEqual(stripMarkdownLinks(''), '');
        });

        test('handles link with complex URL', () => {
            assert.strictEqual(
                stripMarkdownLinks('[Danny](https://github.com/user?tab=repos&q=test)'),
                'Danny'
            );
        });

        test('handles link with spaces in display text', () => {
            assert.strictEqual(
                stripMarkdownLinks('[Danny Ocean](https://example.com)'),
                'Danny Ocean'
            );
        });

        test('handles text with brackets but no valid link syntax', () => {
            assert.strictEqual(
                stripMarkdownLinks('array[0] is (fine)'),
                'array[0] is (fine)'
            );
        });
    });

    suite('renderMarkdownLinks', () => {
        test('converts markdown link to anchor tag', () => {
            assert.strictEqual(
                renderMarkdownLinks('[Danny](https://example.com)'),
                '<a href="https://example.com" target="_blank">Danny</a>'
            );
        });

        test('converts multiple markdown links', () => {
            assert.strictEqual(
                renderMarkdownLinks('[Danny](https://a.com) and [Rusty](https://b.com)'),
                '<a href="https://a.com" target="_blank">Danny</a> and <a href="https://b.com" target="_blank">Rusty</a>'
            );
        });

        test('passes through plain text unchanged', () => {
            assert.strictEqual(renderMarkdownLinks('Danny'), 'Danny');
        });

        test('passes through empty string', () => {
            assert.strictEqual(renderMarkdownLinks(''), '');
        });

        test('handles link with spaces in display text', () => {
            assert.strictEqual(
                renderMarkdownLinks('[Danny Ocean](https://example.com)'),
                '<a href="https://example.com" target="_blank">Danny Ocean</a>'
            );
        });
    });
});
