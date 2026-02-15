/**
 * Tests for TeamTreeProvider.
 * Verifies tree data generation for members and tasks.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { TeamTreeProvider, SquadTreeItem } from '../../views/SquadTreeProvider';
import {
    MockSquadDataProvider,
    createMockMembers,
    createMockTasks,
} from '../mocks/squadDataProvider';

suite('TeamTreeProvider Test Suite', () => {
    let provider: TeamTreeProvider;
    let mockDataProvider: MockSquadDataProvider;

    setup(() => {
        const members = createMockMembers();
        const tasks = createMockTasks();
        mockDataProvider = new MockSquadDataProvider({ members, tasks });
        provider = new TeamTreeProvider(mockDataProvider as never);
    });

    suite('getChildren', () => {
        test('returns squad members at root level (no element)', async () => {
            const children = await provider.getChildren();
            const members = children.filter(c => c.itemType === 'member');

            assert.strictEqual(members.length, 3);
            assert.strictEqual(members[0].label, 'Danny');
            assert.strictEqual(members[1].label, 'Rusty');
            assert.strictEqual(members[2].label, 'Linus');
        });

        test('root items include members and Recent Activity section', async () => {
            const children = await provider.getChildren();
            const members = children.filter(c => c.itemType === 'member');
            const sections = children.filter(c => c.itemType === 'section');

            assert.strictEqual(members.length, 3);
            assert.strictEqual(sections.length, 1);
            assert.strictEqual(sections[0].label, 'Recent Activity');
        });

        test('root member items are collapsible', async () => {
            const children = await provider.getChildren();
            const members = children.filter(c => c.itemType === 'member');

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
            const children = await provider.getChildren();
            const danny = children.find((c) => c.label === 'Danny');

            assert.ok(danny);
            assert.ok(danny.iconPath instanceof vscode.ThemeIcon);
            assert.strictEqual((danny.iconPath as vscode.ThemeIcon).id, 'sync~spin');
        });

        test('idle member has person icon', async () => {
            const children = await provider.getChildren();
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
            const children = await provider.getChildren();
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
            const children = await provider.getChildren();
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

    // ─── Recent Activity Section Tests ──────────────────────────────────────
    // NOTE: These tests are for the upcoming "Recent Activity" feature
    // that Rusty is adding to show log entries in the sidebar.

    suite('Recent Activity Section (for future feature)', () => {

        test('getChildren at root returns Recent Activity section (when implemented)', async function() {
            const children = await provider.getChildren();
            const recentActivity = children.find(c => c.label === 'Recent Activity');
            
            if (recentActivity) {
                assert.strictEqual(recentActivity.itemType, 'section');
            }
        });

        test('Recent Activity section is collapsible (when implemented)', async function() {
            const children = await provider.getChildren();
            const recentActivity = children.find(c => c.label === 'Recent Activity');
            
            if (recentActivity) {
                assert.strictEqual(
                    recentActivity.collapsibleState,
                    vscode.TreeItemCollapsibleState.Collapsed
                );
            }
        });

        test('expanding Recent Activity returns log entry items (when implemented)', async function() {
            this.skip(); // Skip until feature is implemented
            
            const sectionItem = new SquadTreeItem(
                'Recent Activity',
                vscode.TreeItemCollapsibleState.Collapsed,
                'section'
            );
            
            const logItems = await provider.getChildren(sectionItem);
            
            assert.ok(Array.isArray(logItems), 'Should return array of log items');
        });

        test('log entry items have correct labels with date and topic (when implemented)', async function() {
            this.skip(); // Skip until feature is implemented
            
            const sectionItem = new SquadTreeItem(
                'Recent Activity',
                vscode.TreeItemCollapsibleState.Collapsed,
                'section'
            );
            
            const logItems = await provider.getChildren(sectionItem);
            
            if (logItems.length > 0) {
                const firstLog = logItems[0];
                // Expected format: "2026-02-15: topic-name"
                assert.ok(firstLog.label.includes(':'), 'Log label should include date:topic format');
            }
        });

        test('log entry items are not collapsible (when implemented)', async function() {
            this.skip(); // Skip until feature is implemented
            
            const sectionItem = new SquadTreeItem(
                'Recent Activity',
                vscode.TreeItemCollapsibleState.Collapsed,
                'section'
            );
            
            const logItems = await provider.getChildren(sectionItem);
            
            if (logItems.length > 0) {
                logItems.forEach(item => {
                    assert.strictEqual(
                        item.collapsibleState,
                        vscode.TreeItemCollapsibleState.None,
                        'Log items should not be collapsible'
                    );
                });
            }
        });

        test('log entry items have history icon (when implemented)', async function() {
            this.skip(); // Skip until feature is implemented
            
            const sectionItem = new SquadTreeItem(
                'Recent Activity',
                vscode.TreeItemCollapsibleState.Collapsed,
                'section'
            );
            
            const logItems = await provider.getChildren(sectionItem);
            
            if (logItems.length > 0) {
                const firstLog = logItems[0];
                assert.ok(firstLog.iconPath instanceof vscode.ThemeIcon);
                assert.strictEqual((firstLog.iconPath as vscode.ThemeIcon).id, 'history');
            }
        });

        test('log entry items have tooltip with summary (when implemented)', async function() {
            this.skip(); // Skip until feature is implemented
            
            const sectionItem = new SquadTreeItem(
                'Recent Activity',
                vscode.TreeItemCollapsibleState.Collapsed,
                'section'
            );
            
            const logItems = await provider.getChildren(sectionItem);
            
            if (logItems.length > 0) {
                const firstLog = logItems[0];
                assert.ok(firstLog.tooltip instanceof vscode.MarkdownString);
            }
        });

        test('log entry items have command to open log file (when implemented)', async function() {
            this.skip(); // Skip until feature is implemented
            
            const sectionItem = new SquadTreeItem(
                'Recent Activity',
                vscode.TreeItemCollapsibleState.Collapsed,
                'section'
            );
            
            const logItems = await provider.getChildren(sectionItem);
            
            if (logItems.length > 0) {
                const firstLog = logItems[0];
                assert.ok(firstLog.command);
                assert.strictEqual(firstLog.command!.command, 'squadui.openLogFile');
            }
        });

        test('Recent Activity shows only recent logs (last 7 days) (when implemented)', async function() {
            this.skip(); // Skip until feature is implemented
            
            const sectionItem = new SquadTreeItem(
                'Recent Activity',
                vscode.TreeItemCollapsibleState.Collapsed,
                'section'
            );
            
            await provider.getChildren(sectionItem);
            
            // All log items should be from within last 7 days
            // This would need actual date validation when implemented
            assert.ok(true, 'Placeholder for date filtering validation');
        });

        test('Recent Activity shows empty state when no logs (when implemented)', async function() {
            this.skip(); // Skip until feature is implemented
            
            const sectionItem = new SquadTreeItem(
                'Recent Activity',
                vscode.TreeItemCollapsibleState.Collapsed,
                'section'
            );
            
            await provider.getChildren(sectionItem);
            
            // Empty state might return empty array or a single "No recent activity" item
            // Placeholder assertion for when feature is implemented
            assert.ok(true, 'Placeholder for empty state validation');
        });
    });
});
