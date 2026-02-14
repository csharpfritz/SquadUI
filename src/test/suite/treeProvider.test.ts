/**
 * Tests for SquadTreeProvider.
 * Verifies tree data generation for members and tasks.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { SquadTreeProvider, SquadTreeItem } from '../../views/SquadTreeProvider';
import {
    MockSquadDataProvider,
    createMockMembers,
    createMockTasks,
} from '../mocks/squadDataProvider';

suite('SquadTreeProvider Test Suite', () => {
    let provider: SquadTreeProvider;
    let mockDataProvider: MockSquadDataProvider;

    setup(() => {
        const members = createMockMembers();
        const tasks = createMockTasks();
        mockDataProvider = new MockSquadDataProvider({ members, tasks });
        provider = new SquadTreeProvider(mockDataProvider as never);
    });

    suite('getChildren', () => {
        test('returns sections at root level (no element)', async () => {
            const children = await provider.getChildren();
            
            assert.strictEqual(children.length, 3);
            assert.strictEqual(children[0].label, 'Team');
            assert.strictEqual(children[0].contextValue, 'member-section');
            assert.strictEqual(children[1].label, 'Skills');
            assert.strictEqual(children[1].contextValue, 'skill-section');
            assert.strictEqual(children[2].label, 'Decisions');
            assert.strictEqual(children[2].contextValue, 'decision-section');
        });

        test('returns squad members under Team section', async () => {
            const section = new SquadTreeItem(
                'Team',
                vscode.TreeItemCollapsibleState.Expanded,
                'section'
            );
            section.contextValue = 'member-section';

            const members = await provider.getChildren(section);

            assert.strictEqual(members.length, 3);
            assert.strictEqual(members[0].label, 'Danny');
            assert.strictEqual(members[1].label, 'Rusty');
            assert.strictEqual(members[2].label, 'Linus');
        });

        test('returns skills under Skills section', async () => {
            // Note: SkillCatalogService is real in SquadTreeProvider, not mocked via dataProvider
            // But getSkillItems uses dataProvider.getWorkspaceRoot() which is mocked.
            // However, SkillCatalogService is instantiated inside SquadTreeProvider, 
            // so we might not see mocked skills unless we mock that service too or if it returns empty by default.
            
            const section = new SquadTreeItem(
                'Skills',
                vscode.TreeItemCollapsibleState.Expanded,
                'section'
            );
            section.contextValue = 'skill-section';

            const skills = await provider.getChildren(section);
            // Default behavior with no skills found is empty array
            assert.ok(Array.isArray(skills)); 
        });

        test('root member items are collapsible', async () => {
            const section = new SquadTreeItem(
                'Team',
                vscode.TreeItemCollapsibleState.Expanded,
                'section'
            );
            section.contextValue = 'member-section';
            
            const members = await provider.getChildren(section);

            members.forEach((item) => {
                assert.strictEqual(
                    item.collapsibleState,
                    vscode.TreeItemCollapsibleState.Collapsed
                );
            });
        });

        test('returns tasks for a member element', async () => {
            const memberItem = new SquadTreeItem(
                'Danny',
                vscode.TreeItemCollapsibleState.Collapsed,
                'member',
                'Danny'
            );

            const tasks = await provider.getChildren(memberItem);

            assert.strictEqual(tasks.length, 1);
            assert.strictEqual(tasks[0].label, 'Plan the heist');
            assert.strictEqual(tasks[0].itemType, 'task');
        });

        test('returns multiple tasks for member with multiple assignments', async () => {
            const memberItem = new SquadTreeItem(
                'Rusty',
                vscode.TreeItemCollapsibleState.Collapsed,
                'member',
                'Rusty'
            );

            const tasks = await provider.getChildren(memberItem);

            assert.strictEqual(tasks.length, 2);
            const taskTitles = tasks.map((t) => t.label);
            assert.ok(taskTitles.includes('Review code'));
            assert.ok(taskTitles.includes('Setup database'));
        });

        test('returns empty array for task element', async () => {
            const taskItem = new SquadTreeItem(
                'Some Task',
                vscode.TreeItemCollapsibleState.None,
                'task',
                'Danny',
                'task-1'
            );

            const children = await provider.getChildren(taskItem);

            assert.strictEqual(children.length, 0);
        });

        test('returns empty array for member with no memberId', async () => {
            const memberItem = new SquadTreeItem(
                'Unknown',
                vscode.TreeItemCollapsibleState.Collapsed,
                'member'
                // No memberId provided
            );

            const children = await provider.getChildren(memberItem);

            assert.strictEqual(children.length, 0);
        });
    });

    suite('getTreeItem', () => {
        test('returns the element unchanged', async () => {
            const children = await provider.getChildren();
            const item = children[0];

            const treeItem = provider.getTreeItem(item);

            assert.strictEqual(treeItem, item);
        });
    });

    suite('tree item icons', () => {
        test('working member has sync~spin icon', async () => {
            const section = new SquadTreeItem('Team', vscode.TreeItemCollapsibleState.Expanded, 'section');
            section.contextValue = 'member-section';
            const children = await provider.getChildren(section);
            const danny = children.find((c) => c.label === 'Danny');

            assert.ok(danny);
            assert.ok(danny.iconPath instanceof vscode.ThemeIcon);
            assert.strictEqual((danny.iconPath as vscode.ThemeIcon).id, 'sync~spin');
        });

        test('idle member has person icon', async () => {
            const section = new SquadTreeItem('Team', vscode.TreeItemCollapsibleState.Expanded, 'section');
            section.contextValue = 'member-section';
            const children = await provider.getChildren(section);
            const rusty = children.find((c) => c.label === 'Rusty');

            assert.ok(rusty);
            assert.ok(rusty.iconPath instanceof vscode.ThemeIcon);
            assert.strictEqual((rusty.iconPath as vscode.ThemeIcon).id, 'person');
        });

        test('tasks have tasklist icon', async () => {
            const memberItem = new SquadTreeItem(
                'Danny',
                vscode.TreeItemCollapsibleState.Collapsed,
                'member',
                'Danny'
            );
            const tasks = await provider.getChildren(memberItem);

            assert.ok(tasks.length > 0);
            tasks.forEach((task) => {
                assert.ok(task.iconPath instanceof vscode.ThemeIcon);
                assert.strictEqual((task.iconPath as vscode.ThemeIcon).id, 'tasklist');
            });
        });
    });

    suite('tree item descriptions', () => {
        test('member description includes role and status', async () => {
            const section = new SquadTreeItem('Team', vscode.TreeItemCollapsibleState.Expanded, 'section');
            section.contextValue = 'member-section';
            const children = await provider.getChildren(section);
            const danny = children.find((c) => c.label === 'Danny');

            assert.ok(danny);
            assert.ok(danny.description);
            const desc = String(danny.description);
            assert.ok(desc.includes('Lead'));
            // Check for status badge (⚡) or legacy 'working' text
            assert.ok(desc.includes('⚡') || desc.includes('working'), `Description "${desc}" should indicate working status`);
        });

        test('task description shows status', async () => {
            const memberItem = new SquadTreeItem(
                'Danny',
                vscode.TreeItemCollapsibleState.Collapsed,
                'member',
                'Danny'
            );
            const tasks = await provider.getChildren(memberItem);

            assert.ok(tasks.length > 0);
            assert.strictEqual(tasks[0].description, 'in_progress');
        });
    });

    suite('tree item commands', () => {
        test('task items have showWorkDetails command', async () => {
            const memberItem = new SquadTreeItem(
                'Danny',
                vscode.TreeItemCollapsibleState.Collapsed,
                'member',
                'Danny'
            );
            const tasks = await provider.getChildren(memberItem);

            assert.ok(tasks.length > 0);
            assert.ok(tasks[0].command);
            assert.strictEqual(tasks[0].command!.command, 'squadui.showWorkDetails');
            assert.deepStrictEqual(tasks[0].command!.arguments, ['task-1']);
        });
    });

    suite('refresh', () => {
        test('fires onDidChangeTreeData event', () => {
            let eventFired = false;
            provider.onDidChangeTreeData(() => {
                eventFired = true;
            });

            provider.refresh();

            assert.ok(eventFired, 'onDidChangeTreeData event should fire');
        });

        test('calls dataProvider.refresh()', () => {
            mockDataProvider.resetRefreshFlag();

            provider.refresh();

            assert.ok(
                mockDataProvider.wasRefreshCalled(),
                'dataProvider.refresh() should be called'
            );
        });
    });

    suite('tooltips', () => {
        test('member tooltip is a MarkdownString', async () => {
            const section = new SquadTreeItem('Team', vscode.TreeItemCollapsibleState.Expanded, 'section');
            section.contextValue = 'member-section';
            const children = await provider.getChildren(section);
            const danny = children.find((c) => c.label === 'Danny');

            assert.ok(danny);
            assert.ok(danny.tooltip instanceof vscode.MarkdownString);
        });

        test('task tooltip is a MarkdownString', async () => {
            const memberItem = new SquadTreeItem(
                'Danny',
                vscode.TreeItemCollapsibleState.Collapsed,
                'member',
                'Danny'
            );
            const tasks = await provider.getChildren(memberItem);

            assert.ok(tasks.length > 0);
            assert.ok(tasks[0].tooltip instanceof vscode.MarkdownString);
        });
    });
});
