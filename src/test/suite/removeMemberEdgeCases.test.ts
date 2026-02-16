/**
 * Tests for removeMemberCommand.ts — slug generation and edge case parsing.
 *
 * The main removeMemberCommand.test.ts covers table parsing. These tests
 * focus on the slug normalization logic and edge cases in member name handling.
 */

import * as assert from 'assert';

/**
 * Replicates the slug generation logic from removeMemberCommand.ts
 * to test it in isolation.
 */
function generateSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

suite('removeMemberCommand — Slug Generation', () => {
    test('simple lowercase name', () => {
        assert.strictEqual(generateSlug('danny'), 'danny');
    });

    test('mixed case name', () => {
        assert.strictEqual(generateSlug('Danny'), 'danny');
    });

    test('name with spaces', () => {
        assert.strictEqual(generateSlug('Danny Ocean'), 'danny-ocean');
    });

    test('name with special characters', () => {
        assert.strictEqual(generateSlug('José García'), 'jos-garc-a');
    });

    test('name with @ prefix', () => {
        assert.strictEqual(generateSlug('@copilot'), 'copilot');
    });

    test('name with multiple spaces', () => {
        assert.strictEqual(generateSlug('Danny   Ocean'), 'danny-ocean');
    });

    test('name with hyphens (already slugged)', () => {
        assert.strictEqual(generateSlug('danny-ocean'), 'danny-ocean');
    });

    test('name with underscores', () => {
        assert.strictEqual(generateSlug('danny_ocean'), 'danny-ocean');
    });

    test('name with leading/trailing spaces', () => {
        assert.strictEqual(generateSlug('  danny  '), 'danny');
    });

    test('empty string returns empty', () => {
        assert.strictEqual(generateSlug(''), '');
    });

    test('single character name', () => {
        assert.strictEqual(generateSlug('A'), 'a');
    });

    test('name with numbers', () => {
        assert.strictEqual(generateSlug('Agent 007'), 'agent-007');
    });
});
