/**
 * Tests for DecisionsTreeProvider — the decisions tree view.
 *
 * Verifies:
 * - getChildren() returns decision items
 * - Decision items have correct itemType, icon, and command
 * - Description includes date and author
 * - refresh() fires change event
 * - Empty state handling
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { DecisionsTreeProvider, SquadTreeItem } from '../../views/SquadTreeProvider';
import { MockSquadDataProvider } from '../mocks/squadDataProvider';

const TEST_FIXTURES_ROOT = path.resolve(__dirname, '../../../test-fixtures');

suite('DecisionsTreeProvider', () => {
    let provider: DecisionsTreeProvider;
    let mockDataProvider: MockSquadDataProvider;
    let tempDir: string;

    setup(() => {
        tempDir = path.join(TEST_FIXTURES_ROOT, `temp-decisions-tree-${Date.now()}`);
        fs.mkdirSync(path.join(tempDir, '.ai-team'), { recursive: true });
    });

    teardown(() => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    suite('getChildren()', () => {
        test('returns decision items at root level', async () => {
            fs.writeFileSync(path.join(tempDir, '.ai-team', 'decisions.md'), [
                '## Use TypeScript',
                '**Date:** 2026-02-01',
                '**Author:** Linus',
                '',
                '## Adopt Mocha',
                '**Date:** 2026-02-10',
                '**Author:** Basher',
            ].join('\n'));

            mockDataProvider = new MockSquadDataProvider({ workspaceRoot: tempDir });
            provider = new DecisionsTreeProvider(mockDataProvider as never);

            const children = await provider.getChildren();

            assert.ok(Array.isArray(children), 'Should return array');
            assert.ok(children.length >= 2, 'Should have at least 2 decisions');
            for (const child of children) {
                assert.strictEqual(child.itemType, 'decision', 'All root items should be decisions');
            }
        });

        test('returns empty array for element children (decisions are leaf nodes)', async () => {
            mockDataProvider = new MockSquadDataProvider({ workspaceRoot: tempDir });
            provider = new DecisionsTreeProvider(mockDataProvider as never);

            const decisionItem = new SquadTreeItem(
                'Test Decision',
                vscode.TreeItemCollapsibleState.None,
                'decision'
            );

            const children = await provider.getChildren(decisionItem);

            assert.strictEqual(children.length, 0);
        });

        test('returns empty array when no decisions exist', async () => {
            const emptyDir = path.join(tempDir, 'empty');
            fs.mkdirSync(emptyDir, { recursive: true });

            mockDataProvider = new MockSquadDataProvider({ workspaceRoot: emptyDir });
            provider = new DecisionsTreeProvider(mockDataProvider as never);

            const children = await provider.getChildren();

            assert.strictEqual(children.length, 0);
        });
    });

    suite('decision item rendering', () => {
        setup(() => {
            fs.writeFileSync(path.join(tempDir, '.ai-team', 'decisions.md'), [
                '## Use TypeScript',
                '**Date:** 2026-02-01',
                '**Author:** Linus',
                'We will use TypeScript.',
            ].join('\n'));

            mockDataProvider = new MockSquadDataProvider({ workspaceRoot: tempDir });
            provider = new DecisionsTreeProvider(mockDataProvider as never);
        });

        test('decision items have notebook icon', async () => {
            const children = await provider.getChildren();
            assert.ok(children.length > 0);

            for (const child of children) {
                assert.ok(child.iconPath instanceof vscode.ThemeIcon);
                assert.strictEqual((child.iconPath as vscode.ThemeIcon).id, 'notebook');
            }
        });

        test('decision items have openDecision command', async () => {
            const children = await provider.getChildren();
            assert.ok(children.length > 0);

            for (const child of children) {
                assert.ok(child.command, 'Decision items should have command');
                assert.strictEqual(child.command!.command, 'squadui.openDecision');
            }
        });

        test('decision description includes date and author', async () => {
            const children = await provider.getChildren();
            assert.ok(children.length > 0);

            const desc = String(children[0].description);
            assert.ok(desc.includes('2026-02-01'), 'Description should include date');
            assert.ok(desc.includes('Linus'), 'Description should include author');
        });

        test('decision tooltip is a MarkdownString', async () => {
            const children = await provider.getChildren();
            assert.ok(children.length > 0);

            assert.ok(children[0].tooltip instanceof vscode.MarkdownString);
        });

        test('decision tooltip includes title', async () => {
            const children = await provider.getChildren();
            assert.ok(children.length > 0);

            const tooltip = children[0].tooltip as vscode.MarkdownString;
            assert.ok(tooltip.value.includes('Use TypeScript'));
        });
    });

    suite('getTreeItem()', () => {
        test('returns the element unchanged', async () => {
            fs.writeFileSync(path.join(tempDir, '.ai-team', 'decisions.md'), [
                '## Decision',
                '**Date:** 2026-01-01',
            ].join('\n'));
            mockDataProvider = new MockSquadDataProvider({ workspaceRoot: tempDir });
            provider = new DecisionsTreeProvider(mockDataProvider as never);

            const children = await provider.getChildren();
            if (children.length === 0) { return; }

            const treeItem = provider.getTreeItem(children[0]);

            assert.strictEqual(treeItem, children[0]);
        });
    });

    suite('refresh()', () => {
        test('fires onDidChangeTreeData event', () => {
            mockDataProvider = new MockSquadDataProvider({ workspaceRoot: tempDir });
            provider = new DecisionsTreeProvider(mockDataProvider as never);

            let eventFired = false;
            provider.onDidChangeTreeData(() => {
                eventFired = true;
            });

            provider.refresh();

            assert.ok(eventFired, 'onDidChangeTreeData should fire');
        });
    });
});
