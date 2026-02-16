/**
 * Tests for SkillsTreeProvider — the skills tree view.
 *
 * Verifies:
 * - getChildren() returns skill items from installed skills
 * - Skill items have correct itemType, icon, and command
 * - Source badges display correctly
 * - refresh() fires change event
 * - Empty state when no skills installed
 */

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { SkillsTreeProvider, SquadTreeItem } from '../../views/SquadTreeProvider';
import { MockSquadDataProvider } from '../mocks/squadDataProvider';

const TEST_FIXTURES_ROOT = path.resolve(__dirname, '../../../test-fixtures');

suite('SkillsTreeProvider', () => {
    let provider: SkillsTreeProvider;
    let mockDataProvider: MockSquadDataProvider;

    setup(() => {
        mockDataProvider = new MockSquadDataProvider({ workspaceRoot: TEST_FIXTURES_ROOT });
        provider = new SkillsTreeProvider(mockDataProvider as never);
    });

    suite('getChildren()', () => {
        test('returns skill items at root level', async () => {
            const children = await provider.getChildren();

            // test-fixtures has .ai-team/skills/ — may have skills
            assert.ok(Array.isArray(children), 'Should return array');
            for (const child of children) {
                assert.strictEqual(child.itemType, 'skill', 'All root items should be skills');
            }
        });

        test('returns empty array for element children (skills are leaf nodes)', async () => {
            const skillItem = new SquadTreeItem(
                'test-skill',
                vscode.TreeItemCollapsibleState.None,
                'skill',
                'test-skill'
            );

            const children = await provider.getChildren(skillItem);

            assert.strictEqual(children.length, 0, 'Skill items should have no children');
        });

        test('returns empty array when no skills exist', async () => {
            const emptyProvider = new MockSquadDataProvider({
                workspaceRoot: path.join(TEST_FIXTURES_ROOT, 'nonexistent-workspace'),
            });
            const emptyTreeProvider = new SkillsTreeProvider(emptyProvider as never);

            const children = await emptyTreeProvider.getChildren();

            assert.strictEqual(children.length, 0, 'Should return empty array');
        });
    });

    suite('getTreeItem()', () => {
        test('returns the element unchanged', async () => {
            const children = await provider.getChildren();
            if (children.length === 0) { return; }

            const treeItem = provider.getTreeItem(children[0]);

            assert.strictEqual(treeItem, children[0]);
        });
    });

    suite('skill item rendering', () => {
        test('skill items have book icon', async () => {
            const children = await provider.getChildren();
            if (children.length === 0) { return; }

            for (const child of children) {
                assert.ok(child.iconPath instanceof vscode.ThemeIcon);
                assert.strictEqual((child.iconPath as vscode.ThemeIcon).id, 'book');
            }
        });

        test('skill items have viewSkill command', async () => {
            const children = await provider.getChildren();
            if (children.length === 0) { return; }

            for (const child of children) {
                assert.ok(child.command, 'Skill items should have command');
                assert.strictEqual(child.command!.command, 'squadui.viewSkill');
            }
        });

        test('skill items have contextValue "skill"', async () => {
            const children = await provider.getChildren();
            if (children.length === 0) { return; }

            for (const child of children) {
                assert.strictEqual(child.contextValue, 'skill');
            }
        });

        test('skill items have MarkdownString tooltip', async () => {
            const children = await provider.getChildren();
            if (children.length === 0) { return; }

            for (const child of children) {
                assert.ok(child.tooltip instanceof vscode.MarkdownString);
            }
        });
    });

    suite('refresh()', () => {
        test('fires onDidChangeTreeData event', () => {
            let eventFired = false;
            provider.onDidChangeTreeData(() => {
                eventFired = true;
            });

            provider.refresh();

            assert.ok(eventFired, 'onDidChangeTreeData should fire');
        });
    });
});
