/**
 * Tree data provider for displaying squad members, their tasks, and GitHub issues.
 */

import * as vscode from 'vscode';
import { SquadMember, Task, GitHubIssue, IGitHubIssuesService } from '../models';
import { SquadDataProvider } from '../services/SquadDataProvider';

/**
 * Represents an item in the squad tree view.
 * Can be a squad member (parent), a task (child), or a GitHub issue (child).
 */
export class SquadTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'member' | 'task' | 'issue',
        public readonly memberId?: string,
        public readonly taskId?: string
    ) {
        super(label, collapsibleState);
        this.contextValue = itemType;
    }
}

/**
 * Provides tree data for the squad members view.
 * Top-level items are squad members, children are their assigned tasks and GitHub issues.
 */
export class SquadTreeProvider implements vscode.TreeDataProvider<SquadTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<SquadTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private issuesService: IGitHubIssuesService | undefined;

    constructor(private dataProvider: SquadDataProvider) {}

    /**
     * Sets the GitHub issues service. Called when the service becomes available.
     */
    setIssuesService(service: IGitHubIssuesService): void {
        this.issuesService = service;
    }

    /**
     * Fires the tree data change event to refresh the view.
     */
    refresh(): void {
        this.dataProvider.refresh();
        this._onDidChangeTreeData.fire();
    }

    /**
     * Returns the tree item for display.
     */
    getTreeItem(element: SquadTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Returns children for the given element.
     * If no element, returns squad members (root level).
     * If element is a member, returns their tasks and issues.
     */
    async getChildren(element?: SquadTreeItem): Promise<SquadTreeItem[]> {
        if (!element) {
            return this.getSquadMemberItems();
        }

        if (element.itemType === 'member' && element.memberId) {
            const tasks = await this.getTaskItems(element.memberId);
            const issues = await this.getIssueItems(element.memberId);
            return [...tasks, ...issues];
        }

        return [];
    }

    private async getSquadMemberItems(): Promise<SquadTreeItem[]> {
        const members = await this.dataProvider.getSquadMembers();
        
        return members.map(member => {
            const item = new SquadTreeItem(
                member.name,
                vscode.TreeItemCollapsibleState.Collapsed,
                'member',
                member.name
            );

            item.iconPath = new vscode.ThemeIcon(
                member.status === 'working' ? 'sync~spin' : 'person'
            );
            
            item.description = `${member.role} • ${member.status}`;
            item.tooltip = this.getMemberTooltip(member);

            return item;
        });
    }

    private async getTaskItems(memberId: string): Promise<SquadTreeItem[]> {
        const tasks = await this.dataProvider.getTasksForMember(memberId);

        return tasks.map(task => {
            const item = new SquadTreeItem(
                task.title,
                vscode.TreeItemCollapsibleState.None,
                'task',
                memberId,
                task.id
            );

            item.iconPath = new vscode.ThemeIcon('tasklist');
            item.description = task.status;
            item.tooltip = this.getTaskTooltip(task);
            
            item.command = {
                command: 'squadui.showWorkDetails',
                title: 'Show Work Details',
                arguments: [task.id]
            };

            return item;
        });
    }

    private async getIssueItems(memberId: string): Promise<SquadTreeItem[]> {
        if (!this.issuesService) {
            return [];
        }

        try {
            const workspaceRoot = this.dataProvider.getWorkspaceRoot();
            const issueMap = await this.issuesService.getIssuesByMember(workspaceRoot);
            const issues = issueMap.get(memberId.toLowerCase()) ?? [];

            return issues.map(issue => {
                const labelText = issue.labels
                    .filter(l => !l.name.startsWith('squad:'))
                    .map(l => l.name)
                    .join(', ');

                const item = new SquadTreeItem(
                    `#${issue.number} ${issue.title}`,
                    vscode.TreeItemCollapsibleState.None,
                    'issue',
                    memberId,
                    String(issue.number)
                );

                item.iconPath = new vscode.ThemeIcon(
                    'issues',
                    new vscode.ThemeColor(issue.state === 'open' ? 'charts.green' : 'charts.purple')
                );
                item.description = labelText || undefined;
                item.tooltip = this.getIssueTooltip(issue);

                item.command = {
                    command: 'squadui.openIssue',
                    title: 'Open Issue in Browser',
                    arguments: [issue.htmlUrl]
                };

                return item;
            });
        } catch (error) {
            console.warn('SquadUI: Failed to fetch GitHub issues for member', memberId, error);
            return [];
        }
    }

    private getMemberTooltip(member: SquadMember): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**${member.name}**\n\n`);
        md.appendMarkdown(`Role: ${member.role}\n\n`);
        md.appendMarkdown(`Status: ${member.status}`);
        if (member.currentTask) {
            md.appendMarkdown(`\n\nCurrent Task: ${member.currentTask.title}`);
        }
        return md;
    }

    private getTaskTooltip(task: Task): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**${task.title}**\n\n`);
        md.appendMarkdown(`Status: ${task.status}\n\n`);
        if (task.description) {
            md.appendMarkdown(`${task.description}`);
        }
        return md;
    }

    private getIssueTooltip(issue: GitHubIssue): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**#${issue.number}: ${issue.title}**\n\n`);
        md.appendMarkdown(`State: ${issue.state}\n\n`);
        if (issue.labels.length > 0) {
            md.appendMarkdown(`Labels: ${issue.labels.map(l => l.name).join(', ')}\n\n`);
        }
        if (issue.assignee) {
            md.appendMarkdown(`Assignee: ${issue.assignee}\n\n`);
        }
        md.appendMarkdown(`[Open on GitHub](${issue.htmlUrl})`);
        return md;
    }
}
