/**
 * Acceptance test: validates the full data pipeline from orchestration log
 * fixtures through to SquadTreeProvider tree items.
 *
 * Pipeline under test:
 *   fixture files → OrchestrationLogService → SquadDataProvider → SquadTreeProvider
 *
 * Uses real fixture files in test-fixtures/acceptance-scenario/ — no service mocks.
 * VS Code APIs are available via the test electron host.
 */

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { SquadTreeProvider, SquadTreeItem } from '../../views/SquadTreeProvider';
import { SquadDataProvider } from '../../services/SquadDataProvider';

const ACCEPTANCE_FIXTURES = path.resolve(__dirname, '../../../test-fixtures/acceptance-scenario');

suite('Acceptance: Orchestration Logs → Tree View', () => {
    let dataProvider: SquadDataProvider;
    let treeProvider: SquadTreeProvider;

    setup(() => {
        dataProvider = new SquadDataProvider(ACCEPTANCE_FIXTURES);
        treeProvider = new SquadTreeProvider(dataProvider as never);
    });

    // ── Step 1-2: Given fixtures exist, verify data layer resolves correctly ──

    suite('data pipeline produces correct members and tasks', () => {
        test('all team.md members appear as squad members', async () => {
            const members = await dataProvider.getSquadMembers();
            const names = members.map(m => m.name);

            assert.ok(names.includes('Alice'), 'Alice should be in roster');
            assert.ok(names.includes('Bob'), 'Bob should be in roster');
            assert.ok(names.includes('Carol'), 'Carol should be in roster');
            assert.strictEqual(members.length, 3, 'Should have exactly 3 members');
        });

        test('member roles come from team.md', async () => {
            const members = await dataProvider.getSquadMembers();
            const alice = members.find(m => m.name === 'Alice')!;
            const bob = members.find(m => m.name === 'Bob')!;
            const carol = members.find(m => m.name === 'Carol')!;

            assert.strictEqual(alice.role, 'Lead');
            assert.strictEqual(bob.role, 'Backend Dev');
            assert.strictEqual(carol.role, 'Tester');
        });

        test('member in most recent log is working, others idle', async () => {
            const members = await dataProvider.getSquadMembers();
            const carol = members.find(m => m.name === 'Carol')!;
            const alice = members.find(m => m.name === 'Alice')!;
            const bob = members.find(m => m.name === 'Bob')!;

            assert.strictEqual(carol.status, 'working', 'Carol (most recent log) should be working');
            assert.strictEqual(alice.status, 'idle', 'Alice (older log) should be idle');
            assert.strictEqual(bob.status, 'idle', 'Bob (older log) should be idle');
        });

        test('tasks are extracted from related issues in logs', async () => {
            const aliceTasks = await dataProvider.getTasksForMember('Alice');
            const carolTasks = await dataProvider.getTasksForMember('Carol');

            assert.ok(aliceTasks.length > 0, 'Alice should have tasks from log #10/#11');
            assert.ok(carolTasks.length > 0, 'Carol should have tasks from log #12/#13');

            const aliceIds = aliceTasks.map(t => t.id);
            assert.ok(aliceIds.includes('10'), 'Alice should own task #10');
            assert.ok(aliceIds.includes('11'), 'Alice should own task #11');

            const carolIds = carolTasks.map(t => t.id);
            assert.ok(carolIds.includes('12'), 'Carol should own task #12');
            assert.ok(carolIds.includes('13'), 'Carol should own task #13');
        });
    });

    // ── Step 3-4: When SquadTreeProvider builds tree, members have correct children ──

    suite('tree view renders members at root', () => {
        test('root nodes are all team.md members', async () => {
            const roots = await treeProvider.getChildren();
            const members = roots.filter(r => r.itemType === 'member');
            const labels = members.map(r => r.label);

            assert.strictEqual(members.length, 3);
            assert.ok(labels.includes('Alice'));
            assert.ok(labels.includes('Bob'));
            assert.ok(labels.includes('Carol'));
        });

        test('all member root items have itemType "member"', async () => {
            const roots = await treeProvider.getChildren();
            const members = roots.filter(r => r.itemType === 'member');
            members.forEach(item => {
                assert.strictEqual(item.itemType, 'member');
            });
        });

        test('root items are collapsible', async () => {
            const roots = await treeProvider.getChildren();
            roots.forEach(item => {
                assert.strictEqual(
                    item.collapsibleState,
                    vscode.TreeItemCollapsibleState.Collapsed
                );
            });
        });
    });

    suite('member nodes expose correct task children', () => {
        test('Alice has task children from log entry', async () => {
            const aliceItem = new SquadTreeItem(
                'Alice',
                vscode.TreeItemCollapsibleState.Collapsed,
                'member',
                'Alice'
            );
            const children = await treeProvider.getChildren(aliceItem);
            const taskChildren = children.filter(c => c.itemType === 'task');

            assert.ok(taskChildren.length >= 2, 'Alice should have at least 2 task children');
            const titles = taskChildren.map(c => c.label);
            assert.ok(titles.some(t => String(t).includes('#10')), 'Should include task #10');
            assert.ok(titles.some(t => String(t).includes('#11')), 'Should include task #11');
        });

        test('Carol has task children from her log entry', async () => {
            const carolItem = new SquadTreeItem(
                'Carol',
                vscode.TreeItemCollapsibleState.Collapsed,
                'member',
                'Carol'
            );
            const children = await treeProvider.getChildren(carolItem);
            const taskChildren = children.filter(c => c.itemType === 'task');

            assert.ok(taskChildren.length >= 2, 'Carol should have at least 2 task children');
            const titles = taskChildren.map(c => c.label);
            assert.ok(titles.some(t => String(t).includes('#12')), 'Should include task #12');
            assert.ok(titles.some(t => String(t).includes('#13')), 'Should include task #13');
        });

        test('Bob has no task children (not first participant)', async () => {
            const bobItem = new SquadTreeItem(
                'Bob',
                vscode.TreeItemCollapsibleState.Collapsed,
                'member',
                'Bob'
            );
            const children = await treeProvider.getChildren(bobItem);
            const taskChildren = children.filter(c => c.itemType === 'task');

            assert.strictEqual(taskChildren.length, 0, 'Bob should have no tasks');
        });
    });

    // ── Step 5: Task items have correct labels, icons, and commands ──

    suite('task items have correct labels, icons, and commands', () => {
        let taskItems: SquadTreeItem[];

        setup(async () => {
            const carolItem = new SquadTreeItem(
                'Carol',
                vscode.TreeItemCollapsibleState.Collapsed,
                'member',
                'Carol'
            );
            const children = await treeProvider.getChildren(carolItem);
            taskItems = children.filter(c => c.itemType === 'task');
        });

        test('task labels include issue number', () => {
            assert.ok(taskItems.length >= 2);
            for (const task of taskItems) {
                assert.ok(
                    String(task.label).match(/#\d+/),
                    `Task label "${task.label}" should contain an issue reference`
                );
            }
        });

        test('task items use tasklist icon', () => {
            for (const task of taskItems) {
                assert.ok(task.iconPath instanceof vscode.ThemeIcon);
                assert.strictEqual(
                    (task.iconPath as vscode.ThemeIcon).id,
                    'tasklist',
                    'Task icon should be "tasklist"'
                );
            }
        });

        test('task items have showWorkDetails command', () => {
            for (const task of taskItems) {
                assert.ok(task.command, 'Task should have a command');
                assert.strictEqual(
                    task.command!.command,
                    'squadui.showWorkDetails',
                    'Command should be squadui.showWorkDetails'
                );
            }
        });

        test('task command arguments contain task ID', () => {
            for (const task of taskItems) {
                assert.ok(task.command?.arguments, 'Command should have arguments');
                assert.ok(task.command!.arguments!.length > 0, 'Should have at least one argument');
                const taskId = String(task.command!.arguments![0]);
                assert.ok(taskId.match(/^\d+$/), `Task ID "${taskId}" should be a numeric string`);
            }
        });

        test('task items are not collapsible (leaf nodes)', () => {
            for (const task of taskItems) {
                assert.strictEqual(
                    task.collapsibleState,
                    vscode.TreeItemCollapsibleState.None,
                    'Tasks should not be collapsible'
                );
            }
        });

        test('task description shows status', () => {
            for (const task of taskItems) {
                assert.ok(task.description, 'Task should have a description');
                assert.ok(
                    ['pending', 'in_progress', 'completed'].includes(String(task.description)),
                    `Task description "${task.description}" should be a valid status`
                );
            }
        });

        test('task tooltips are MarkdownStrings', () => {
            for (const task of taskItems) {
                assert.ok(
                    task.tooltip instanceof vscode.MarkdownString,
                    'Task tooltip should be a MarkdownString'
                );
            }
        });
    });

    suite('member item rendering', () => {
        test('working member (Carol) has sync~spin icon', async () => {
            const roots = await treeProvider.getChildren();
            const carol = roots.find(r => r.label === 'Carol');

            assert.ok(carol);
            assert.ok(carol.iconPath instanceof vscode.ThemeIcon);
            assert.strictEqual((carol.iconPath as vscode.ThemeIcon).id, 'sync~spin');
        });

        test('idle members (Alice, Bob) have person icon', async () => {
            const roots = await treeProvider.getChildren();
            for (const name of ['Alice', 'Bob']) {
                const item = roots.find(r => r.label === name);
                assert.ok(item, `Should find ${name}`);
                assert.ok(item!.iconPath instanceof vscode.ThemeIcon);
                assert.strictEqual(
                    (item!.iconPath as vscode.ThemeIcon).id,
                    'person',
                    `${name} should have person icon`
                );
            }
        });

        test('member descriptions include role and status', async () => {
            const roots = await treeProvider.getChildren();
            const carol = roots.find(r => r.label === 'Carol');

            assert.ok(carol);
            const desc = String(carol.description);
            assert.ok(desc.includes('Tester'), 'Description should include role');
            assert.ok(desc.includes('working'), 'Description should include status');
        });

        test('member tooltips are MarkdownStrings', async () => {
            const roots = await treeProvider.getChildren();
            const members = roots.filter(r => r.itemType === 'member');
            for (const item of members) {
                assert.ok(
                    item.tooltip instanceof vscode.MarkdownString,
                    `${item.label} tooltip should be a MarkdownString`
                );
            }
        });
    });

    // ── End-to-end: getWorkDetails for a task discovered through the pipeline ──

    suite('work details for pipeline-discovered tasks', () => {
        test('getWorkDetails returns task and member for log-derived task', async () => {
            const details = await dataProvider.getWorkDetails('12');

            assert.ok(details, 'Should return details for task #12');
            assert.strictEqual(details!.task.id, '12');
            assert.strictEqual(details!.task.assignee, 'Carol');
            assert.strictEqual(details!.member.name, 'Carol');
            assert.strictEqual(details!.member.role, 'Tester');
        });

        test('work details include related log entries', async () => {
            const details = await dataProvider.getWorkDetails('12');

            assert.ok(details, 'Should return details');
            assert.ok(details!.logEntries, 'Should have log entries');
            assert.ok(details!.logEntries!.length > 0, 'Should have at least one log entry');
            assert.ok(
                details!.logEntries![0].participants.includes('Carol'),
                'Related log should mention Carol'
            );
        });

        test('getWorkDetails returns undefined for non-existent task', async () => {
            const details = await dataProvider.getWorkDetails('999');
            assert.strictEqual(details, undefined);
        });
    });

    // ── Refresh cycle: cache invalidation propagates through the pipeline ──

    suite('refresh propagates through pipeline', () => {
        test('refresh re-reads data from fixtures', async () => {
            const members1 = await dataProvider.getSquadMembers();
            dataProvider.refresh();
            const members2 = await dataProvider.getSquadMembers();

            assert.notStrictEqual(members1, members2, 'Should return new array after refresh');
            assert.strictEqual(members2.length, 3, 'Should still have 3 members');
        });

        test('tree provider refresh fires change event', () => {
            let eventFired = false;
            treeProvider.onDidChangeTreeData(() => { eventFired = true; });

            treeProvider.refresh();

            assert.ok(eventFired, 'onDidChangeTreeData should fire');
        });
    });
});
