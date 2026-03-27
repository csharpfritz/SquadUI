/**
 * Tests for SquadBacklogTreeProvider.
 * Verifies tree structure: member grouping, priority sub-grouping, and issue rendering.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { SquadBacklogTreeProvider } from '../../views/SquadBacklogTreeProvider';
import { GitHubIssue, GitHubMilestone, IGitHubIssuesService, MemberIssueMap } from '../../models';

function createIssue(overrides: Partial<GitHubIssue> & { number: number; title: string }): GitHubIssue {
    return {
        state: 'open',
        labels: [],
        htmlUrl: `https://github.com/test/repo/issues/${overrides.number}`,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        ...overrides,
    };
}

class MockIssuesService implements IGitHubIssuesService {
    constructor(private issueMap: MemberIssueMap) {}
    async getIssuesByMember(): Promise<MemberIssueMap> { return this.issueMap; }
    async getClosedIssuesByMember(): Promise<MemberIssueMap> { return new Map(); }
    async getClosedIssues(): Promise<GitHubIssue[]> { return []; }
    async getMilestoneIssues(): Promise<GitHubIssue[]> { return []; }
    async getMilestones(): Promise<GitHubMilestone[]> { return []; }
}

suite('SquadBacklogTreeProvider Test Suite', () => {
    let provider: SquadBacklogTreeProvider;

    suite('with no issues service', () => {
        setup(() => {
            provider = new SquadBacklogTreeProvider('/test/workspace');
        });

        test('returns empty children when no issues service is set', async () => {
            const children = await provider.getChildren();
            assert.strictEqual(children.length, 0);
        });
    });

    suite('with empty issue map', () => {
        setup(() => {
            provider = new SquadBacklogTreeProvider('/test/workspace');
            provider.setIssuesService(new MockIssuesService(new Map()));
        });

        test('returns empty children when no issues exist', async () => {
            const children = await provider.getChildren();
            assert.strictEqual(children.length, 0);
        });
    });

    suite('with issues', () => {
        let issueMap: MemberIssueMap;

        setup(() => {
            issueMap = new Map<string, GitHubIssue[]>();
            issueMap.set('rusty', [
                createIssue({
                    number: 71,
                    title: 'Issue Backlog View',
                    labels: [{ name: 'squad:rusty' }, { name: 'p1' }],
                }),
                createIssue({
                    number: 73,
                    title: 'Active Status Redesign',
                    labels: [{ name: 'squad:rusty' }, { name: 'p0' }],
                }),
                createIssue({
                    number: 80,
                    title: 'Some other issue',
                    labels: [{ name: 'squad:rusty' }],
                }),
            ]);
            issueMap.set('linus', [
                createIssue({
                    number: 76,
                    title: 'Member Drill-down',
                    labels: [{ name: 'squad:linus' }, { name: 'p1' }],
                    assignee: 'linusdev',
                }),
            ]);

            provider = new SquadBacklogTreeProvider('/test/workspace');
            provider.setIssuesService(new MockIssuesService(issueMap));
        });

        test('root level shows member nodes sorted alphabetically', async () => {
            const children = await provider.getChildren();
            assert.strictEqual(children.length, 2);
            assert.strictEqual(children[0].kind, 'member');
            assert.strictEqual(children[0].label, 'Linus');
            assert.strictEqual(children[1].label, 'Rusty');
        });

        test('member node shows issue count in description', async () => {
            const children = await provider.getChildren();
            const rusty = children.find(c => c.label === 'Rusty');
            assert.ok(rusty);
            assert.strictEqual(rusty.description, '3 issues');
        });

        test('member node with single issue shows singular description', async () => {
            const children = await provider.getChildren();
            const linus = children.find(c => c.label === 'Linus');
            assert.ok(linus);
            assert.strictEqual(linus.description, '1 issue');
        });

        test('member nodes are collapsible', async () => {
            const children = await provider.getChildren();
            children.forEach(child => {
                assert.strictEqual(child.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
            });
        });

        test('member children show priority groups', async () => {
            const children = await provider.getChildren();
            const rusty = children.find(c => c.label === 'Rusty')!;
            const priorities = await provider.getChildren(rusty);
            assert.strictEqual(priorities.length, 3);
            assert.ok(priorities[0].label!.toString().includes('P0'));
            assert.strictEqual(priorities[0].kind, 'priority');
            assert.ok(priorities[1].label!.toString().includes('P1'));
            assert.ok(priorities[2].label!.toString().includes('Unprioritized'));
        });

        test('priority groups are expanded by default', async () => {
            const children = await provider.getChildren();
            const rusty = children.find(c => c.label === 'Rusty')!;
            const priorities = await provider.getChildren(rusty);
            priorities.forEach(p => {
                assert.strictEqual(p.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
            });
        });

        test('issue nodes show number and title', async () => {
            const children = await provider.getChildren();
            const rusty = children.find(c => c.label === 'Rusty')!;
            const priorities = await provider.getChildren(rusty);
            const p0Group = priorities.find(p => p.label!.toString().includes('P0'))!;
            const issues = await provider.getChildren(p0Group);
            assert.strictEqual(issues.length, 1);
            assert.strictEqual(issues[0].label, '#73 Active Status Redesign');
            assert.strictEqual(issues[0].kind, 'issue');
        });

        test('issue nodes are not collapsible', async () => {
            const children = await provider.getChildren();
            const rusty = children.find(c => c.label === 'Rusty')!;
            const priorities = await provider.getChildren(rusty);
            const p0Group = priorities.find(p => p.label!.toString().includes('P0'))!;
            const issues = await provider.getChildren(p0Group);
            issues.forEach(i => {
                assert.strictEqual(i.collapsibleState, vscode.TreeItemCollapsibleState.None);
            });
        });

        test('issue node has click command to open issue', async () => {
            const children = await provider.getChildren();
            const linus = children.find(c => c.label === 'Linus')!;
            const priorities = await provider.getChildren(linus);
            const p1Group = priorities.find(p => p.label!.toString().includes('P1'))!;
            const issues = await provider.getChildren(p1Group);
            assert.strictEqual(issues.length, 1);
            assert.ok(issues[0].command);
            assert.strictEqual(issues[0].command!.command, 'squadui.openIssue');
        });

        test('issue node shows assignee in description', async () => {
            const children = await provider.getChildren();
            const linus = children.find(c => c.label === 'Linus')!;
            const priorities = await provider.getChildren(linus);
            const p1Group = priorities.find(p => p.label!.toString().includes('P1'))!;
            const issues = await provider.getChildren(p1Group);
            assert.strictEqual(issues[0].description, '@linusdev');
        });

        test('issue node without assignee has empty description', async () => {
            const children = await provider.getChildren();
            const rusty = children.find(c => c.label === 'Rusty')!;
            const priorities = await provider.getChildren(rusty);
            const p0Group = priorities.find(p => p.label!.toString().includes('P0'))!;
            const issues = await provider.getChildren(p0Group);
            assert.strictEqual(issues[0].description, '');
        });

        test('unprioritized bucket contains issues without priority labels', async () => {
            const children = await provider.getChildren();
            const rusty = children.find(c => c.label === 'Rusty')!;
            const priorities = await provider.getChildren(rusty);
            const otherGroup = priorities.find(p => p.label!.toString().includes('Unprioritized'))!;
            const issues = await provider.getChildren(otherGroup);
            assert.strictEqual(issues.length, 1);
            assert.strictEqual(issues[0].label, '#80 Some other issue');
        });

        test('contextValue is set correctly for each node type', async () => {
            const children = await provider.getChildren();
            assert.strictEqual(children[0].contextValue, 'backlog-member');
            const priorities = await provider.getChildren(children[0]);
            assert.strictEqual(priorities[0].contextValue, 'backlog-priority');
            const issues = await provider.getChildren(priorities[0]);
            assert.strictEqual(issues[0].contextValue, 'backlog-issue');
        });
    });

    suite('refresh', () => {
        test('refresh fires onDidChangeTreeData event', async () => {
            provider = new SquadBacklogTreeProvider('/test/workspace');
            let fired = false;
            provider.onDidChangeTreeData(() => { fired = true; });
            provider.refresh();
            assert.strictEqual(fired, true);
        });

        test('refresh clears cached data', async () => {
            const issueMap = new Map<string, GitHubIssue[]>();
            issueMap.set('rusty', [
                createIssue({ number: 1, title: 'First', labels: [{ name: 'squad:rusty' }] }),
            ]);

            let callCount = 0;
            const service: IGitHubIssuesService = {
                async getIssuesByMember(): Promise<MemberIssueMap> { callCount++; return issueMap; },
                async getClosedIssuesByMember(): Promise<MemberIssueMap> { return new Map(); },
                async getClosedIssues(): Promise<GitHubIssue[]> { return []; },
                async getMilestoneIssues(): Promise<GitHubIssue[]> { return []; },
                async getMilestones(): Promise<GitHubMilestone[]> { return []; },
            };

            provider = new SquadBacklogTreeProvider('/test/workspace');
            provider.setIssuesService(service);

            await provider.getChildren();
            assert.strictEqual(callCount, 1);

            await provider.getChildren();
            assert.strictEqual(callCount, 1);

            provider.refresh();
            await provider.getChildren();
            assert.strictEqual(callCount, 2);
        });
    });

    suite('priority detection', () => {
        test('detects priority: prefix labels', async () => {
            const issueMap = new Map<string, GitHubIssue[]>();
            issueMap.set('rusty', [
                createIssue({
                    number: 1,
                    title: 'Priority prefix test',
                    labels: [{ name: 'squad:rusty' }, { name: 'priority:p2' }],
                }),
            ]);

            provider = new SquadBacklogTreeProvider('/test/workspace');
            provider.setIssuesService(new MockIssuesService(issueMap));

            const children = await provider.getChildren();
            const rusty = children.find(c => c.label === 'Rusty')!;
            const priorities = await provider.getChildren(rusty);
            assert.strictEqual(priorities.length, 1);
            assert.ok(priorities[0].label!.toString().includes('P2'));
        });

        test('detects uppercase P0/P1/P2 labels', async () => {
            const issueMap = new Map<string, GitHubIssue[]>();
            issueMap.set('rusty', [
                createIssue({
                    number: 1,
                    title: 'Uppercase test',
                    labels: [{ name: 'squad:rusty' }, { name: 'P1' }],
                }),
            ]);

            provider = new SquadBacklogTreeProvider('/test/workspace');
            provider.setIssuesService(new MockIssuesService(issueMap));

            const children = await provider.getChildren();
            const rusty = children.find(c => c.label === 'Rusty')!;
            const priorities = await provider.getChildren(rusty);
            assert.strictEqual(priorities.length, 1);
            assert.ok(priorities[0].label!.toString().includes('P1'));
        });
    });

    suite('setWorkspaceRoot', () => {
        test('updates workspace root without throwing', async () => {
            provider = new SquadBacklogTreeProvider('/old/root');
            provider.setWorkspaceRoot('/new/root');
            assert.ok(true);
        });
    });
});
