/**
 * Unit tests for the normalizeEol utility.
 */

import * as assert from 'assert';
import { normalizeEol, EOL } from '../../utils/eol';
import * as os from 'os';

suite('normalizeEol', () => {
    test('passes through LF-only content unchanged', () => {
        const input = 'line1\nline2\nline3';
        assert.strictEqual(normalizeEol(input), 'line1\nline2\nline3');
    });

    test('converts CRLF to LF', () => {
        const input = 'line1\r\nline2\r\nline3';
        assert.strictEqual(normalizeEol(input), 'line1\nline2\nline3');
    });

    test('converts standalone CR to LF', () => {
        const input = 'line1\rline2\rline3';
        assert.strictEqual(normalizeEol(input), 'line1\nline2\nline3');
    });

    test('handles mixed line endings in same string', () => {
        const input = 'line1\r\nline2\nline3\rline4';
        assert.strictEqual(normalizeEol(input), 'line1\nline2\nline3\nline4');
    });

    test('handles empty string', () => {
        assert.strictEqual(normalizeEol(''), '');
    });

    test('handles string with no line endings', () => {
        assert.strictEqual(normalizeEol('single line'), 'single line');
    });

    test('handles consecutive CRLF pairs', () => {
        const input = 'a\r\n\r\nb';
        assert.strictEqual(normalizeEol(input), 'a\n\nb');
    });
});

suite('EOL constant', () => {
    test('matches os.EOL', () => {
        assert.strictEqual(EOL, os.EOL);
    });
});
