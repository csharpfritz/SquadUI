/**
 * Tree data provider for the Issue Backlog view.
 * Groups squad-labeled GitHub issues by member, then by priority.
 */

import * as vscode from 'vscode';
import { GitHubIssue, GitHubLabel, IGitHubIssuesService } from '../models';

/** Priority label definitions, ordered from highest to lowest */
const PRIORITY_LEVELS = [
    { prefix: 'p0', label: 'P0 — Critical', icon: 'error', color: 'charts.red' },
    { prefix: 'p1', label: 'P1 — High', icon: 'warning', color: 'charts.orange' },
    { prefix: 'p2', label: 'P2 — Medium', icon: 'info', color: 'charts.yellow' },
    { prefix: 'p3', label: 'P3 — Low', icon: 'circle-outline', color: 'charts.blue' },
] as const;

type NodeKind = 'member' | 'priority' | 'issue';

/**
 * Represents an item in the backlog tree view.
 */
export class BacklogTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly kind: NodeKind,
        public readonly memberName?: string,
        public readonly priorityPrefix?: string,
        public readonly issue?: GitHubIssue,
    ) {
        super(label, collapsibleState);
        this.contextValue = `backlog-${kind}`;
    }
}

/**
 * Provides tree data for the Issue Backlog view.
 * Groups issues by squad member, then by priority label.
 */
export class SquadBacklogTreeProvider implements vscode.TreeDataProvider<BacklogTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<BacklogTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private issuesService: IGitHubIssuesService | undefined;
    private workspaceRoot: string;
    private cachedIssuesByMember: Map<string, GitHubIssue[]> | undefined;
    private lastFetchError: string | undefined;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    setIssuesService(service: IGitHubIssuesService): void {
        this.issuesService = service;
    }

    setWorkspaceRoot(root: string): void {
        this.workspaceRoot = root;
    }

    refresh(): void {
        this.cachedIssuesByMember = undefined;
        this.lastFetchError = undefined;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: BacklogTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: BacklogTreeItem): Promise<BacklogTreeItem[]> {
        if (!this.issuesService) {
            return [];
        }

        if (!element) {
            return this.getMemberNodes();
        }

        if (element.kind === 'member' && element.memberName) {
            return this.getPriorityNodes(element.memberName);
        }

        if (element.kind === 'priority' && element.memberName && element.priorityPrefix !== undefined) {
            return this.getIssueNodes(element.memberName, element.priorityPrefix);
        }

        return [];
    }

    // ─── Private ──────────────────────────────────────────────────────────

    private async fetchIssues(): Promise<Map<string, GitHubIssue[]>> {
        if (this.cachedIssuesByMember) {
            return this.cachedIssuesByMember;
        }

        try {
            const map = await this.issuesService!.getIssuesByMember(this.workspaceRoot);
            this.cachedIssuesByMember = map;
            this.lastFetchError = undefined;
            return map;
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('403') || msg.toLowerCase().includes('rate limit')) {
                this.lastFetchError = 'GitHub API rate limit reached. Try again later.';
                vscode.window.showWarningMessage('Squad Backlog: GitHub API rate limit reached. Cached data may be shown.');
            } else {
                this.lastFetchError = msg;
            }
            return this.cachedIssuesByMember ?? new Map();
        }
    }

    private async getMemberNodes(): Promise<BacklogTreeItem[]> {
        const byMember = await this.fetchIssues();

        if (byMember.size === 0) {
            if (this.lastFetchError) {
                const item = new BacklogTreeItem(
                    `⚠ ${this.lastFetchError}`,
                    vscode.TreeItemCollapsibleState.None,
                    'issue',
                );
                item.iconPath = new vscode.ThemeIcon('warning');
                return [item];
            }
            return [];
        }

        const sortedMembers = [...byMember.keys()].sort((a, b) => a.localeCompare(b));

        return sortedMembers.map(memberName => {
            const issues = byMember.get(memberName) ?? [];
            const count = issues.length;
            const displayName = memberName.charAt(0).toUpperCase() + memberName.slice(1);

            const item = new BacklogTreeItem(
                displayName,
                vscode.TreeItemCollapsibleState.Collapsed,
                'member',
                memberName,
            );
            item.iconPath = new vscode.ThemeIcon('person');
            item.description = `${count} issue${count !== 1 ? 's' : ''}`;
            item.tooltip = `${displayName} — ${count} open issue${count !== 1 ? 's' : ''}`;
            return item;
        });
    }

    private async getPriorityNodes(memberName: string): Promise<BacklogTreeItem[]> {
        const byMember = await this.fetchIssues();
        const issues = byMember.get(memberName) ?? [];

        const buckets = new Map<string, GitHubIssue[]>();
        for (const level of PRIORITY_LEVELS) {
            buckets.set(level.prefix, []);
        }
        buckets.set('other', []);

        for (const issue of issues) {
            const priority = this.detectPriority(issue.labels);
            const bucket = buckets.get(priority) ?? buckets.get('other')!;
            bucket.push(issue);
        }

        const nodes: BacklogTreeItem[] = [];
        for (const level of PRIORITY_LEVELS) {
            const bucket = buckets.get(level.prefix) ?? [];
            if (bucket.length === 0) { continue; }
            const item = new BacklogTreeItem(
                `${level.label} (${bucket.length})`,
                vscode.TreeItemCollapsibleState.Expanded,
                'priority',
                memberName,
                level.prefix,
            );
            item.iconPath = new vscode.ThemeIcon(level.icon, new vscode.ThemeColor(level.color));
            nodes.push(item);
        }

        const otherBucket = buckets.get('other') ?? [];
        if (otherBucket.length > 0) {
            const item = new BacklogTreeItem(
                `Unprioritized (${otherBucket.length})`,
                vscode.TreeItemCollapsibleState.Expanded,
                'priority',
                memberName,
                'other',
            );
            item.iconPath = new vscode.ThemeIcon('circle-outline');
            nodes.push(item);
        }

        return nodes;
    }

    private async getIssueNodes(memberName: string, priorityPrefix: string): Promise<BacklogTreeItem[]> {
        const byMember = await this.fetchIssues();
        const issues = byMember.get(memberName) ?? [];

        const filtered = issues.filter(issue => {
            const detected = this.detectPriority(issue.labels);
            return detected === priorityPrefix;
        });

        filtered.sort((a, b) => a.number - b.number);

        return filtered.map(issue => {
            const stateIcon = issue.state === 'open' ? 'issues' : 'issue-closed';
            const stateColor = issue.state === 'open'
                ? new vscode.ThemeColor('charts.green')
                : new vscode.ThemeColor('charts.purple');

            const item = new BacklogTreeItem(
                `#${issue.number} ${issue.title}`,
                vscode.TreeItemCollapsibleState.None,
                'issue',
                memberName,
                undefined,
                issue,
            );
            item.iconPath = new vscode.ThemeIcon(stateIcon, stateColor);
            item.description = issue.assignee ? `@${issue.assignee}` : '';
            item.tooltip = this.getIssueTooltip(issue);
            item.contextValue = 'backlog-issue';

            item.command = {
                command: 'squadui.openIssue',
                title: 'View Issue Details',
                arguments: [issue.htmlUrl, issue],
            };

            return item;
        });
    }

    /**
     * Detects the priority level of an issue from its labels.
     */
    private detectPriority(labels: GitHubLabel[]): string {
        for (const label of labels) {
            const name = label.name.toLowerCase();
            for (const level of PRIORITY_LEVELS) {
                if (name === level.prefix || name === `priority:${level.prefix}` || name === `priority: ${level.prefix}`) {
                    return level.prefix;
                }
            }
        }
        return 'other';
    }

    private getIssueTooltip(issue: GitHubIssue): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**#${issue.number}** ${issue.title}\n\n`);
        md.appendMarkdown(`**State:** ${issue.state === 'open' ? '🟢 Open' : '🟣 Closed'}\n\n`);
        if (issue.assignee) {
            md.appendMarkdown(`**Assignee:** @${issue.assignee}\n\n`);
        }
        const labelNames = issue.labels.map(l => l.name).join(', ');
        if (labelNames) {
            md.appendMarkdown(`**Labels:** ${labelNames}\n\n`);
        }
        if (issue.milestone) {
            md.appendMarkdown(`**Milestone:** ${issue.milestone.title}\n\n`);
        }
        md.appendMarkdown(`[Open on GitHub](${issue.htmlUrl})`);
        return md;
    }
}
