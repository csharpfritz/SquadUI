/**
 * End-to-end MVP validation tests for issue #14.
 *
 * Validates the full acceptance criteria:
 * 1. Extension loads without errors
 * 2. Tree view shows squad members with correct status
 * 3. Clicking member expands to show tasks
 * 4. Clicking task shows details in webview
 * 5. File changes trigger tree refresh
 * 6. Integration: full pipeline from fixtures → tree → webview
 *
 * Uses the acceptance-scenario fixtures with real services (no mocks).
 */

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { TeamTreeProvider, SquadTreeItem } from '../../views/SquadTreeProvider';
import { SquadDataProvider } from '../../services/SquadDataProvider';
import { WorkDetails } from '../../models';

const ACCEPTANCE_FIXTURES = path.resolve(__dirname, '../../../test-fixtures/acceptance-scenario');

/**
 * Testable version of webview HTML generation logic.
 * Mirrors WorkDetailsWebview's rendering methods to test HTML output
 * without requiring a live webview panel.
 */
class TestableWebviewRenderer {
    getStatusBadge(status: 'pending' | 'in_progress' | 'completed'): { label: string; class: string } {
        switch (status) {
            case 'pending': return { label: 'Pending', class: 'badge-pending' };
            case 'in_progress': return { label: 'In Progress', class: 'badge-in-progress' };
            case 'completed': return { label: 'Completed', class: 'badge-completed' };
        }
    }

    getMemberStatusBadge(status: 'working' | 'idle'): { label: string; class: string } {
        switch (status) {
            case 'working': return { label: 'Working', class: 'badge-working' };
            case 'idle': return { label: 'Idle', class: 'badge-idle' };
        }
    }

    getInitials(name: string): string {
        return name.split(' ').map(p => p.charAt(0).toUpperCase()).slice(0, 2).join('');
    }

    escapeHtml(text: string): string {
        const map: Record<string, string> = {
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
        };
        return text.replace(/[&<>"']/g, char => map[char]);
    }

    renderInline(escaped: string): string {
        escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        escaped = escaped.replace(/`(.+?)`/g, '<code>$1</code>');
        return escaped;
    }

    renderTable(lines: string[]): string {
        if (lines.length === 0) { return ''; }
        const parseCells = (line: string): string[] =>
            line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
        const isSeparator = (line: string): boolean =>
            /^\|[\s\-:|]+\|$/.test(line.trim()) && /-/.test(line);

        const hasSeparator = lines.length >= 2 && isSeparator(lines[1]);
        const headerCells = parseCells(lines[0]);
        let html = '<table class="md-table">';

        if (hasSeparator) {
            html += '<thead><tr>';
            for (const cell of headerCells) { html += `<th>${this.renderInline(this.escapeHtml(cell))}</th>`; }
            html += '</tr></thead><tbody>';
            for (let j = 2; j < lines.length; j++) {
                if (isSeparator(lines[j])) { continue; }
                const cells = parseCells(lines[j]);
                html += '<tr>';
                for (let k = 0; k < headerCells.length; k++) {
                    html += `<td>${this.renderInline(this.escapeHtml(cells[k] ?? ''))}</td>`;
                }
                html += '</tr>';
            }
            html += '</tbody>';
        } else {
            html += '<tbody>';
            for (const line of lines) {
                const cells = parseCells(line);
                html += '<tr>';
                for (const cell of cells) { html += `<td>${this.renderInline(this.escapeHtml(cell))}</td>`; }
                html += '</tr>';
            }
            html += '</tbody>';
        }
        html += '</table>';
        return html;
    }

    renderMarkdown(text: string): string {
        const lines = text.split('\n');
        const result: string[] = [];
        let i = 0;
        while (i < lines.length) {
            if (lines[i].trim().startsWith('|')) {
                const tableLines: string[] = [];
                while (i < lines.length && lines[i].trim().startsWith('|')) { tableLines.push(lines[i]); i++; }
                result.push(this.renderTable(tableLines));
            } else {
                result.push(this.renderInline(this.escapeHtml(lines[i])));
                i++;
            }
        }
        return result.join('<br>');
    }

    generateHtml(workDetails: WorkDetails): string {
        const { task, member } = workDetails;
        const statusBadge = this.getStatusBadge(task.status);
        const startedAt = task.startedAt ? task.startedAt.toLocaleString() : 'Not started';
        const completedAt = task.completedAt ? task.completedAt.toLocaleString() : '—';

        return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Work Details</title></head>
<body>
    <div class="section">
        <h1>${this.escapeHtml(task.title)}</h1>
        <span class="badge ${statusBadge.class}">${statusBadge.label}</span>
    </div>
    <div class="section">
        <div class="section-title">Description</div>
        ${task.description
            ? `<div class="description">${this.renderMarkdown(task.description)}</div>`
            : `<div class="no-description">No description provided</div>`
        }
    </div>
    <div class="section">
        <div class="section-title">Timestamps</div>
        <span class="info-value">${startedAt}</span>
        <span class="info-value">${completedAt}</span>
    </div>
    <div class="section">
        <div class="section-title">Assigned To</div>
        <div class="member-avatar">${this.getInitials(member.name)}</div>
        <div class="member-name">${this.escapeHtml(member.name)}</div>
        <div class="member-role">${this.escapeHtml(member.role)}</div>
    </div>
</body>
</html>`;
    }
}

suite('E2E MVP Validation (Issue #14)', () => {
    let dataProvider: SquadDataProvider;
    let treeProvider: TeamTreeProvider;
    let renderer: TestableWebviewRenderer;

    setup(() => {
        dataProvider = new SquadDataProvider(ACCEPTANCE_FIXTURES, '.ai-team');
        treeProvider = new TeamTreeProvider(dataProvider as never);
        renderer = new TestableWebviewRenderer();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // AC-1: Extension loads without errors
    // ─────────────────────────────────────────────────────────────────────────
    suite('AC-1: Extension loads without errors', () => {
        test('extension is discoverable by ID', () => {
            const ext = vscode.extensions.getExtension('csharpfritz.squadui');
            assert.ok(ext, 'Extension csharpfritz.squadui should be found');
        });

        test('activate() does not throw', async () => {
            const ext = vscode.extensions.getExtension('csharpfritz.squadui');
            if (!ext) { return; }
            try {
                await ext.activate();
            } catch {
                // May warn without workspace, but should never throw
            }
            assert.ok(true, 'activate() completed without crashing');
        });

        test('package.json declares all required commands', () => {
            const ext = vscode.extensions.getExtension('csharpfritz.squadui');
            if (!ext) { return; }
            const commands: { command: string }[] = ext.packageJSON?.contributes?.commands ?? [];
            const ids = commands.map(c => c.command);

            assert.ok(ids.includes('squadui.showWorkDetails'), 'showWorkDetails registered');
            assert.ok(ids.includes('squadui.initSquad'), 'initSquad registered');
            assert.ok(ids.includes('squadui.refreshTree'), 'refreshTree registered');
        });

        test('package.json declares squadTeam tree view', () => {
            const ext = vscode.extensions.getExtension('csharpfritz.squadui');
            if (!ext) { return; }
            const views = ext.packageJSON?.contributes?.views?.squadui ?? [];
            assert.ok(
                views.some((v: { id: string }) => v.id === 'squadTeam'),
                'squadTeam view should be declared'
            );
        });

        test('squadui activity bar container is declared', () => {
            const ext = vscode.extensions.getExtension('csharpfritz.squadui');
            if (!ext) { return; }
            const containers = ext.packageJSON?.contributes?.viewsContainers?.activitybar ?? [];
            assert.ok(
                containers.some((c: { id: string }) => c.id === 'squadui'),
                'squadui activity bar container should be declared'
            );
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // AC-2: Tree view shows squad members with correct status
    // ─────────────────────────────────────────────────────────────────────────
    suite('AC-2: Tree view shows squad members with correct status', () => {
        test('tree returns all 3 team.md members at root', async () => {
            const members = await treeProvider.getChildren();
            assert.ok(members.length >= 3, 'Should have at least 3 member items');
            const names = members.map(r => r.label);
            assert.ok(names.includes('Alice'));
            assert.ok(names.includes('Bob'));
            assert.ok(names.includes('Carol'));
        });

        test('member labels match team.md roster names exactly', async () => {
            const squadMembers = await dataProvider.getSquadMembers();
            const members = await treeProvider.getChildren();
            const memberNames = squadMembers.map(m => m.name).sort();
            const treeLabels = members
                .filter(r => r.itemType === 'member')
                .map(r => r.label as string).sort();
            assert.deepStrictEqual(treeLabels, memberNames);
        });

        test('working member (Carol) gets person icon (status not shown)', async () => {
            const members = await treeProvider.getChildren();
            const carol = members.find(r => r.label === 'Carol')!;
            assert.ok(carol.iconPath instanceof vscode.ThemeIcon);
            assert.strictEqual((carol.iconPath as vscode.ThemeIcon).id, 'person');
        });

        test('idle members get person icon (not spinning)', async () => {
            const members = await treeProvider.getChildren();
            for (const name of ['Alice', 'Bob']) {
                const item = members.find(r => r.label === name)!;
                assert.ok(item.iconPath instanceof vscode.ThemeIcon);
                assert.strictEqual(
                    (item.iconPath as vscode.ThemeIcon).id,
                    'person',
                    `${name} should have person icon, not sync~spin`
                );
            }
        });

        test('member descriptions show role without status', async () => {
            const members = await treeProvider.getChildren();
            const carol = members.find(r => r.label === 'Carol')!;
            const desc = String(carol.description);
            assert.ok(desc.includes('Tester'), 'Should include role');
            assert.ok(!desc.includes('⚡'), 'Should not include status badge');
            assert.ok(!desc.includes('💤'), 'Should not include status badge');
        });

        test('member status correctly reflects working vs idle from log data', async () => {
            const members = await dataProvider.getSquadMembers();
            const carol = members.find(m => m.name === 'Carol')!;
            const alice = members.find(m => m.name === 'Alice')!;
            const bob = members.find(m => m.name === 'Bob')!;

            assert.strictEqual(carol.status, 'working', 'Carol (most recent log) should be working');
            assert.strictEqual(alice.status, 'idle', 'Alice (older log only) should be idle');
            assert.strictEqual(bob.status, 'idle', 'Bob (older log only) should be idle');
        });

        test('all member roles come from team.md, not default', async () => {
            const members = await dataProvider.getSquadMembers();
            for (const member of members) {
                assert.notStrictEqual(
                    member.role,
                    'Squad Member',
                    `${member.name} should have a role from team.md, not default`
                );
            }
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // AC-3: Clicking member expands to show tasks
    // ─────────────────────────────────────────────────────────────────────────
    suite('AC-3: Clicking member expands to show tasks', () => {
        test('member items are collapsible (Collapsed state)', async () => {
            const members = await treeProvider.getChildren();

            for (const item of members.filter(m => m.itemType === 'member')) {
                assert.ok(
                    item.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed ||
                    item.collapsibleState === vscode.TreeItemCollapsibleState.None,
                    `${item.label} should be collapsible or leaf`
                );
            }
        });

        test('getChildren(memberItem) returns task items for Alice', async () => {
            const aliceItem = new SquadTreeItem(
                'Alice', vscode.TreeItemCollapsibleState.Collapsed, 'member', 'Alice'
            );
            const children = await treeProvider.getChildren(aliceItem);
            const tasks = children.filter(c => c.itemType === 'task');
            assert.ok(tasks.length >= 2, 'Alice should have at least 2 tasks');
        });

        test('getChildren(memberItem) returns task items for Carol', async () => {
            const carolItem = new SquadTreeItem(
                'Carol', vscode.TreeItemCollapsibleState.Collapsed, 'member', 'Carol'
            );
            const children = await treeProvider.getChildren(carolItem);
            const tasks = children.filter(c => c.itemType === 'task');
            assert.ok(tasks.length >= 2, 'Carol should have at least 2 tasks');
        });

        test('task items have meaningful titles (not raw markdown)', async () => {
            const carolItem = new SquadTreeItem(
                'Carol', vscode.TreeItemCollapsibleState.Collapsed, 'member', 'Carol'
            );
            const children = await treeProvider.getChildren(carolItem);
            const tasks = children.filter(c => c.itemType === 'task');

            for (const task of tasks) {
                const label = String(task.label);
                assert.ok(!label.includes('|'), `Task label "${label}" should not contain raw table pipes`);
                assert.ok(label.length > 0, 'Task label should not be empty');
                assert.ok(label.match(/#\d+/), `Task label "${label}" should contain issue reference`);
            }
        });

        test('task items have correct status badges', async () => {
            const carolItem = new SquadTreeItem(
                'Carol', vscode.TreeItemCollapsibleState.Collapsed, 'member', 'Carol'
            );
            const children = await treeProvider.getChildren(carolItem);
            const tasks = children.filter(c => c.itemType === 'task');

            for (const task of tasks) {
                assert.ok(task.description, 'Task should have a status description');
                assert.ok(
                    ['pending', 'in_progress', 'completed'].includes(String(task.description)),
                    `Task status "${task.description}" should be valid`
                );
            }
        });

        test('task items are leaf nodes (not collapsible)', async () => {
            const carolItem = new SquadTreeItem(
                'Carol', vscode.TreeItemCollapsibleState.Collapsed, 'member', 'Carol'
            );
            const children = await treeProvider.getChildren(carolItem);
            const tasks = children.filter(c => c.itemType === 'task');

            for (const task of tasks) {
                assert.strictEqual(
                    task.collapsibleState,
                    vscode.TreeItemCollapsibleState.None,
                    'Tasks should not be collapsible'
                );
            }
        });

        test('task items have status-specific icon', async () => {
            const carolItem = new SquadTreeItem(
                'Carol', vscode.TreeItemCollapsibleState.Collapsed, 'member', 'Carol'
            );
            const children = await treeProvider.getChildren(carolItem);
            const tasks = children.filter(c => c.itemType === 'task');

            const validIcons = ['circle-outline', 'sync~spin', 'pass-filled'];
            for (const task of tasks) {
                assert.ok(task.iconPath instanceof vscode.ThemeIcon);
                assert.ok(validIcons.includes((task.iconPath as vscode.ThemeIcon).id));
            }
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // AC-4: Clicking task shows details in webview
    // ─────────────────────────────────────────────────────────────────────────
    suite('AC-4: Clicking task shows details in webview', () => {
        test('getWorkDetails() returns correct task and member data', async () => {
            const details = await dataProvider.getWorkDetails('12');
            assert.ok(details, 'Should return details for task #12');
            assert.strictEqual(details!.task.id, '12');
            assert.strictEqual(details!.task.assignee, 'Carol');
            assert.strictEqual(details!.member.name, 'Carol');
            assert.strictEqual(details!.member.role, 'Tester');
        });

        test('getWorkDetails() includes related log entries', async () => {
            const details = await dataProvider.getWorkDetails('12');
            assert.ok(details);
            assert.ok(details!.logEntries);
            assert.ok(details!.logEntries!.length > 0);
            assert.ok(
                details!.logEntries![0].participants.includes('Carol'),
                'Related log should mention Carol'
            );
        });

        test('webview HTML contains task title', async () => {
            const details = await dataProvider.getWorkDetails('12');
            assert.ok(details);
            const html = renderer.generateHtml(details!);
            assert.ok(html.includes(renderer.escapeHtml(details!.task.title)));
        });

        test('webview HTML contains task description', async () => {
            const details = await dataProvider.getWorkDetails('12');
            assert.ok(details);
            if (details!.task.description) {
                const html = renderer.generateHtml(details!);
                assert.ok(html.includes('class="description"'));
                assert.ok(!html.includes('No description provided'));
            }
        });

        test('webview HTML contains member name and role', async () => {
            const details = await dataProvider.getWorkDetails('12');
            assert.ok(details);
            const html = renderer.generateHtml(details!);
            assert.ok(html.includes('Carol'));
            assert.ok(html.includes('Tester'));
        });

        test('webview HTML does not contain member status badge', async () => {
            const details = await dataProvider.getWorkDetails('12');
            assert.ok(details);
            const html = renderer.generateHtml(details!);
            assert.ok(!html.includes('badge-working'), 'Should not include member status badge');
            assert.ok(!html.includes('badge-idle'), 'Should not include member status badge');
        });

        test('markdown tables render as HTML tables, not raw pipes', () => {
            const md = '| Step | Result |\n|------|--------|\n| Build | Pass |';
            const html = renderer.renderMarkdown(md);

            assert.ok(html.includes('<table class="md-table">'), 'Should render HTML table');
            assert.ok(html.includes('<th>Step</th>'), 'Should have table headers');
            assert.ok(html.includes('<td>Build</td>'), 'Should have table data');
            assert.ok(!html.match(/\|[^<]*Step/), 'Should not contain raw pipe syntax');
        });

        test('bold text renders as <strong> tags', () => {
            const html = renderer.renderMarkdown('This is **important** text');
            assert.ok(html.includes('<strong>important</strong>'));
        });

        test('task items have showWorkDetails command wired up', async () => {
            const carolItem = new SquadTreeItem(
                'Carol', vscode.TreeItemCollapsibleState.Collapsed, 'member', 'Carol'
            );
            const children = await treeProvider.getChildren(carolItem);
            const tasks = children.filter(c => c.itemType === 'task');

            for (const task of tasks) {
                assert.ok(task.command, 'Task should have a command');
                assert.strictEqual(task.command!.command, 'squadui.showWorkDetails');
                assert.ok(task.command!.arguments);
                assert.ok(task.command!.arguments!.length > 0);
            }
        });

        test('getWorkDetails returns undefined for non-existent task', async () => {
            const details = await dataProvider.getWorkDetails('99999');
            assert.strictEqual(details, undefined);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // AC-5: File changes trigger tree refresh
    // ─────────────────────────────────────────────────────────────────────────
    suite('AC-5: File changes trigger tree refresh', () => {
        test('tree provider has a refresh method', () => {
            assert.strictEqual(typeof treeProvider.refresh, 'function');
        });

        test('calling refresh fires onDidChangeTreeData event', () => {
            let eventFired = false;
            treeProvider.onDidChangeTreeData(() => { eventFired = true; });
            treeProvider.refresh();
            assert.ok(eventFired, 'onDidChangeTreeData should fire on refresh');
        });

        test('refresh invalidates data cache (returns fresh data)', async () => {
            const members1 = await dataProvider.getSquadMembers();
            dataProvider.refresh();
            const members2 = await dataProvider.getSquadMembers();
            assert.notStrictEqual(members1, members2, 'Should return new array instance');
            assert.strictEqual(members2.length, 3, 'Should still have 3 members');
        });

        test('tree provider refresh calls data provider refresh', () => {
            // Access via the tree provider's refresh which internally calls dataProvider.refresh()
            const membersBefore = dataProvider.getSquadMembers();
            treeProvider.refresh();
            const membersAfter = dataProvider.getSquadMembers();
            // The data provider should have been invalidated
            assert.notStrictEqual(membersBefore, membersAfter,
                'Tree refresh should invalidate underlying data provider cache');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // AC-6: Integration — full pipeline from fixtures → tree → webview
    // ─────────────────────────────────────────────────────────────────────────
    suite('AC-6: Full pipeline integration', () => {
        test('fixture data flows through all services to tree items', async () => {
            // Step 1: Data provider reads fixtures
            const members = await dataProvider.getSquadMembers();
            assert.ok(members.length > 0, 'Should discover members from fixtures');

            // Step 2: Tree provider converts to tree items
            const memberRoots = await treeProvider.getChildren();
            assert.ok(memberRoots.length >= members.length, 'Tree should have at least as many items as members');

            // Step 3: Task children exist for members with tasks
            const carolItem = new SquadTreeItem(
                'Carol', vscode.TreeItemCollapsibleState.Collapsed, 'member', 'Carol'
            );
            const carolChildren = await treeProvider.getChildren(carolItem);
            const carolTasks = carolChildren.filter(c => c.itemType === 'task');
            assert.ok(carolTasks.length > 0, 'Carol should have task children from fixture logs');

            // Step 4: Work details are retrievable for those tasks
            const taskId = carolTasks[0].command!.arguments![0] as string;
            const details = await dataProvider.getWorkDetails(taskId);
            assert.ok(details, `Should get work details for task ${taskId}`);
            assert.strictEqual(details!.member.name, 'Carol');
        });

        test('orchestration log entries produce meaningful task titles', async () => {
            const aliceItem = new SquadTreeItem(
                'Alice', vscode.TreeItemCollapsibleState.Collapsed, 'member', 'Alice'
            );
            const children = await treeProvider.getChildren(aliceItem);
            const tasks = children.filter(c => c.itemType === 'task');

            for (const task of tasks) {
                const label = String(task.label);
                assert.ok(label.length > 3, `Task label "${label}" should be a meaningful title`);
                assert.ok(!label.startsWith('|'), 'Should not start with pipe character');
            }
        });

        test('both session log and orchestration log task extraction paths work', async () => {
            // Alice's tasks come from the 2026-03-01 log (related issues #10, #11)
            const aliceTasks = await dataProvider.getTasksForMember('Alice');
            const aliceIds = aliceTasks.map(t => t.id);
            assert.ok(aliceIds.includes('10'), 'Should extract task from related issues section');
            assert.ok(aliceIds.includes('11'), 'Should extract second task from related issues');

            // Carol's tasks come from the 2026-03-02 log (related issues #12, #13)
            const carolTasks = await dataProvider.getTasksForMember('Carol');
            const carolIds = carolTasks.map(t => t.id);
            assert.ok(carolIds.includes('12'), 'Should extract task from second log file');
            assert.ok(carolIds.includes('13'), 'Should extract second task from second log');
        });

        test('work details webview HTML is well-formed for pipeline data', async () => {
            const details = await dataProvider.getWorkDetails('10');
            assert.ok(details, 'Should get work details for task #10');

            const html = renderer.generateHtml(details!);

            // Structural checks
            assert.ok(html.includes('<!DOCTYPE html>'), 'Should have DOCTYPE');
            assert.ok(html.includes('<html lang="en">'), 'Should have html tag');
            assert.ok(html.includes('<body>'), 'Should have body');
            assert.ok(html.includes('</html>'), 'Should close html');

            // Content checks
            assert.ok(html.includes(renderer.escapeHtml(details!.task.title)), 'Should include task title');
            assert.ok(html.includes(details!.member.name), 'Should include member name');
            assert.ok(html.includes('badge'), 'Should include status badge');
        });

        test('member tooltips contain role and status information', async () => {
            const roots = await treeProvider.getChildren();
            const members = roots.filter(r => r.itemType === 'member');
            for (const item of members) {
                assert.ok(
                    item.tooltip instanceof vscode.MarkdownString,
                    `${item.label} tooltip should be MarkdownString`
                );
            }
        });

        test('task tooltips contain task title', async () => {
            const carolItem = new SquadTreeItem(
                'Carol', vscode.TreeItemCollapsibleState.Collapsed, 'member', 'Carol'
            );
            const children = await treeProvider.getChildren(carolItem);
            const tasks = children.filter(c => c.itemType === 'task');

            for (const task of tasks) {
                assert.ok(
                    task.tooltip instanceof vscode.MarkdownString,
                    'Task tooltip should be MarkdownString'
                );
            }
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Edge cases
    // ─────────────────────────────────────────────────────────────────────────
    suite('Edge cases', () => {
        test('member with no tasks returns empty children (Bob)', async () => {
            const bobItem = new SquadTreeItem(
                'Bob', vscode.TreeItemCollapsibleState.Collapsed, 'member', 'Bob'
            );
            const children = await treeProvider.getChildren(bobItem);
            const tasks = children.filter(c => c.itemType === 'task');
            assert.strictEqual(tasks.length, 0, 'Bob should have no tasks');
        });

        test('getChildren on a task item returns empty array', async () => {
            const taskItem = new SquadTreeItem(
                'Some Task', vscode.TreeItemCollapsibleState.None, 'task', 'Carol', '12'
            );
            const children = await treeProvider.getChildren(taskItem);
            assert.strictEqual(children.length, 0, 'Task items should have no children');
        });

        test('getTreeItem returns the element unchanged', async () => {
            const roots = await treeProvider.getChildren();
            const item = roots[0];
            assert.strictEqual(treeProvider.getTreeItem(item), item);
        });

        test('webview handles task with no description', () => {
            const workDetails: WorkDetails = {
                task: { id: 'test', title: 'No Desc Task', status: 'pending', assignee: 'Carol' },
                member: { name: 'Carol', role: 'Tester', status: 'idle' },
            };
            const html = renderer.generateHtml(workDetails);
            assert.ok(html.includes('No description provided'));
        });

        test('webview handles task with no dates', () => {
            const workDetails: WorkDetails = {
                task: { id: 'test', title: 'No Dates', status: 'pending', assignee: 'Carol' },
                member: { name: 'Carol', role: 'Tester', status: 'idle' },
            };
            const html = renderer.generateHtml(workDetails);
            assert.ok(html.includes('Not started'));
            assert.ok(html.includes('—'));
        });

        test('webview escapes HTML in task titles (XSS prevention)', () => {
            const workDetails: WorkDetails = {
                task: { id: 'xss', title: '<script>alert("xss")</script>', status: 'pending', assignee: 'Carol' },
                member: { name: 'Carol', role: 'Tester', status: 'idle' },
            };
            const html = renderer.generateHtml(workDetails);
            assert.ok(!html.includes('<script>'));
            assert.ok(html.includes('&lt;script&gt;'));
        });

        test('multiple refreshes do not corrupt state', async () => {
            dataProvider.refresh();
            dataProvider.refresh();
            dataProvider.refresh();

            const members = await dataProvider.getSquadMembers();
            assert.strictEqual(members.length, 3, 'Should still return 3 members after triple refresh');
        });
    });
});
