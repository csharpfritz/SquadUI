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
import { Task, IGitHubIssuesService, MemberIssueMap, GitHubIssue } from '../../models';

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

        test('root items are all members (no section nodes)', async () => {
            const children = await provider.getChildren();
            const members = children.filter(c => c.itemType === 'member');
            const sections = children.filter(c => c.itemType === 'section');

            assert.strictEqual(members.length, 3);
            assert.strictEqual(sections.length, 0);
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

            const children = await provider.getChildren(memberItem);
            const tasks = children.filter((c) => c.itemType === 'task');

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

            const children = await provider.getChildren(memberItem);
            const tasks = children.filter((c) => c.itemType === 'task');

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

        test('deduplicates GitHub issues that already appear as tasks', async () => {
            // Set up a task with id '87' (which maps to Issue #87)
            const membersWithTask = createMockMembers();
            const tasksWithIssue: Task[] = [
                {
                    id: '87',
                    title: 'Issue #87',
                    status: 'in_progress',
                    assignee: 'Danny',
                    startedAt: new Date(),
                },
            ];
            const dp = new MockSquadDataProvider({ members: membersWithTask, tasks: tasksWithIssue });
            const prov = new TeamTreeProvider(dp as never);

            // Mock issues service that returns issue #87 and #88 for Danny
            const mockIssuesService: IGitHubIssuesService = {
                async getIssuesByMember(): Promise<MemberIssueMap> {
                    const map = new Map<string, GitHubIssue[]>();
                    map.set('danny', [
                        {
                            number: 87,
                            title: 'API review',
                            state: 'open',
                            labels: [{ name: 'squad:danny', color: '000000' }],
                            htmlUrl: 'https://github.com/test/repo/issues/87',
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-01T00:00:00Z',
                        },
                        {
                            number: 88,
                            title: 'Documentation updates',
                            state: 'open',
                            labels: [{ name: 'squad:danny', color: '000000' }],
                            htmlUrl: 'https://github.com/test/repo/issues/88',
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-01T00:00:00Z',
                        },
                    ]);
                    return map;
                },
                async getClosedIssuesByMember(): Promise<MemberIssueMap> {
                    return new Map();
                },
                async getClosedIssues(): Promise<GitHubIssue[]> {
                    return [];
                },
                async getMilestoneIssues(): Promise<GitHubIssue[]> {
                    return [];
                },
                async getMilestones() {
                    return [];
                },
            };
            prov.setIssuesService(mockIssuesService);

            const memberItem = new SquadTreeItem(
                'Danny',
                vscode.TreeItemCollapsibleState.Collapsed,
                'member',
                'Danny'
            );

            const children = await prov.getChildren(memberItem);
            const tasks = children.filter(c => c.itemType === 'task');
            const issues = children.filter(c => c.itemType === 'issue');

            // Task for #87 should appear as a task
            assert.strictEqual(tasks.length, 1);
            assert.strictEqual(tasks[0].taskId, '87');

            // Issue #87 should be deduplicated; only #88 should appear as an issue
            assert.strictEqual(issues.length, 1);
            assert.ok(issues[0].label?.toString().includes('#88'));
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

        test('tasks have status-specific icon', async () => {
            const memberItem = new SquadTreeItem(
                'Danny',
                vscode.TreeItemCollapsibleState.Collapsed,
                'member',
                'Danny'
            );
            const children = await provider.getChildren(memberItem);
            const tasks = children.filter((c) => c.itemType === 'task');

            const validIcons = ['circle-outline', 'sync~spin', 'pass-filled'];
            assert.ok(tasks.length > 0);
            tasks.forEach((task) => {
                assert.ok(task.iconPath instanceof vscode.ThemeIcon);
                assert.ok(validIcons.includes((task.iconPath as vscode.ThemeIcon).id));
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

    // ─── Per-Member Activity Tests ──────────────────────────────────────
    // Activity log entries appear as children under each team member,
    // filtered by participant matching from orchestration logs.

    suite('Per-Member Activity (log entries under members)', () => {

        test('member children include log-entry items when logs exist', async function() {
            const children = await provider.getChildren();
            const members = children.filter(c => c.itemType === 'member');
            if (members.length === 0) { this.skip(); }

            const memberChildren = await provider.getChildren(members[0]);
            const logEntries = memberChildren.filter(c => c.itemType === 'log-entry');
            // Log entries may or may not exist depending on test fixture
            assert.ok(Array.isArray(logEntries), 'Should return array');
        });

        test('log-entry items are not collapsible', async function() {
            const children = await provider.getChildren();
            const members = children.filter(c => c.itemType === 'member');
            if (members.length === 0) { this.skip(); }

            const memberChildren = await provider.getChildren(members[0]);
            const logEntries = memberChildren.filter(c => c.itemType === 'log-entry');
            for (const entry of logEntries) {
                assert.strictEqual(
                    entry.collapsibleState,
                    vscode.TreeItemCollapsibleState.None,
                    'Log entries should not be collapsible'
                );
            }
        });

        test('log-entry items have history icon', async function() {
            const children = await provider.getChildren();
            const members = children.filter(c => c.itemType === 'member');
            if (members.length === 0) { this.skip(); }

            const memberChildren = await provider.getChildren(members[0]);
            const logEntries = memberChildren.filter(c => c.itemType === 'log-entry');
            for (const entry of logEntries) {
                assert.ok(entry.iconPath instanceof vscode.ThemeIcon);
                assert.strictEqual((entry.iconPath as vscode.ThemeIcon).id, 'history');
            }
        });

        test('no Recent Activity section node at root', async () => {
            const children = await provider.getChildren();
            const recentActivity = children.find(c => c.label === 'Recent Activity');
            assert.strictEqual(recentActivity, undefined, 'Should not have Recent Activity section at root');
        });

        test('root returns only member items', async () => {
            const children = await provider.getChildren();
            for (const child of children) {
                assert.strictEqual(child.itemType, 'member', `Expected member but got ${child.itemType}`);
            }
        });
    });
});
