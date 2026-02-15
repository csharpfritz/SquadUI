/**
 * Tree data providers for displaying squad team, skills, and decisions.
 */

import * as vscode from 'vscode';
import { SquadMember, Task, GitHubIssue, Skill, DecisionEntry, IGitHubIssuesService } from '../models';
import { SquadDataProvider } from '../services/SquadDataProvider';
import { SkillCatalogService } from '../services/SkillCatalogService';
import { DecisionService } from '../services/DecisionService';
import { OrchestrationLogService } from '../services/OrchestrationLogService';
import { stripMarkdownLinks } from '../utils/markdownUtils';

/**
 * Represents an item in the squad tree view.
 * Shared across all three tree providers.
 */
export class SquadTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'section' | 'member' | 'task' | 'issue' | 'skill' | 'decision' | 'log-entry',
        public readonly memberId?: string,
        public readonly taskId?: string,
        public readonly logFilePath?: string
    ) {
        super(label, collapsibleState);
        // contextValue is set by caller or defaults to itemType
        if (!this.contextValue) {
            this.contextValue = itemType;
        }
    }
}

/**
 * Provides tree data for the Team view.
 * Shows squad members with their tasks and GitHub issues as children.
 */
export class TeamTreeProvider implements vscode.TreeDataProvider<SquadTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<SquadTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private issuesService: IGitHubIssuesService | undefined;
    private orchestrationLogService = new OrchestrationLogService();

    constructor(private dataProvider: SquadDataProvider) {}

    setIssuesService(service: IGitHubIssuesService): void {
        this.issuesService = service;
    }

    refresh(): void {
        this.dataProvider.refresh();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SquadTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: SquadTreeItem): Promise<SquadTreeItem[]> {
        if (!element) {
            return this.getSquadMemberItems();
        }

        if (element.itemType === 'member' && element.memberId) {
            const tasks = await this.getTaskItems(element.memberId);
            const issues = await this.getIssueItems(element.memberId);
            const closedIssues = await this.getClosedIssueItems(element.memberId);
            const logEntries = await this.getMemberLogEntries(element.memberId);
            return [...tasks, ...issues, ...closedIssues, ...logEntries];
        }

        return [];
    }

    private async getSquadMemberItems(): Promise<SquadTreeItem[]> {
        const members = await this.dataProvider.getSquadMembers();
        
        // Sort: regular members first, then @copilot, then infra (scribe/ralph)
        const sortOrder = (name: string): number => {
            const l = name.toLowerCase();
            if (l === 'scribe' || l === 'ralph') { return 2; }
            if (l === '@copilot' || l === 'copilot') { return 1; }
            return 0;
        };
        members.sort((a, b) => sortOrder(a.name) - sortOrder(b.name));

        return Promise.all(members.map(async member => {
            const lowerName = member.name.toLowerCase();
            const isInfra = lowerName === 'scribe' || lowerName === 'ralph';
            const isCopilot = lowerName === '@copilot' || lowerName === 'copilot';
            const noChildren = isInfra;

            const displayName = stripMarkdownLinks(member.name);

            const item = new SquadTreeItem(
                displayName,
                noChildren ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed,
                'member',
                member.name
            );

            const specialIcon = lowerName === 'scribe' ? 'edit'
                : lowerName === 'ralph' ? 'eye'
                : isCopilot ? 'robot'
                : undefined;
            item.iconPath = new vscode.ThemeIcon(
                specialIcon ?? (member.status === 'working' ? 'sync~spin' : 'person')
            );
            
            // Build description with status badge and issue count
            const statusBadge = member.status === 'working' ? '⚡' : '💤';
            const issueCount = await this.getIssueCount(member.name);
            const issueText = issueCount > 0 ? ` • ${issueCount} issue${issueCount > 1 ? 's' : ''}` : '';
            
            item.description = `${statusBadge} ${member.role}${issueText}`;
            item.tooltip = this.getMemberTooltip(member);

            if (!isCopilot) {
                item.command = {
                    command: 'squadui.viewCharter',
                    title: 'View Charter',
                    arguments: [member.name]
                };
            }

            return item;
        }));
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
                    title: 'View Issue Details',
                    arguments: [issue.htmlUrl, issue]
                };

                return item;
            });
        } catch (error) {
            console.warn('SquadUI: Failed to fetch GitHub issues for member', memberId, error);
            return [];
        }
    }

    private async getClosedIssueItems(memberId: string): Promise<SquadTreeItem[]> {
        if (!this.issuesService) {
            return [];
        }

        try {
            const workspaceRoot = this.dataProvider.getWorkspaceRoot();
            const issueMap = await this.issuesService.getClosedIssuesByMember(workspaceRoot);
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
                    'pass',
                    new vscode.ThemeColor('descriptionForeground')
                );
                item.description = labelText || undefined;
                item.tooltip = this.getIssueTooltip(issue);

                item.command = {
                    command: 'squadui.openIssue',
                    title: 'View Issue Details',
                    arguments: [issue.htmlUrl, issue]
                };

                return item;
            });
        } catch (error) {
            console.warn('SquadUI: Failed to fetch closed GitHub issues for member', memberId, error);
            return [];
        }
    }


    private getMemberTooltip(member: SquadMember): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**${stripMarkdownLinks(member.name)}**\n\n`);
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

    /**
     * Counts open issues assigned to a member.
     */
    private async getIssueCount(memberId: string): Promise<number> {
        if (!this.issuesService) {
            return 0;
        }

        try {
            const workspaceRoot = this.dataProvider.getWorkspaceRoot();
            const issueMap = await this.issuesService.getIssuesByMember(workspaceRoot);
            const issues = issueMap.get(memberId.toLowerCase()) ?? [];
            return issues.length;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Gets recent log entries where the given member was a participant.
     */
    private async getMemberLogEntries(memberId: string): Promise<SquadTreeItem[]> {
        const workspaceRoot = this.dataProvider.getWorkspaceRoot();
        try {
            const entries = await this.orchestrationLogService.parseAllLogs(workspaceRoot);
            // Filter to entries where this member participated, take most recent 5
            const memberLower = memberId.toLowerCase();
            const memberEntries = entries
                .filter(e => e.participants.some(p => p.toLowerCase() === memberLower))
                .slice(0, 5);

            return memberEntries.map(entry => {
                const topic = entry.topic.replace(/-/g, ' ');
                const item = new SquadTreeItem(
                    topic.length > 60 ? topic.substring(0, 57) + '...' : topic,
                    vscode.TreeItemCollapsibleState.None,
                    'log-entry',
                    memberId,
                    undefined,
                    undefined
                );
                item.iconPath = new vscode.ThemeIcon('notebook');
                item.description = entry.date;
                item.tooltip = `${topic}\n${entry.date}`;
                item.command = {
                    command: 'squadui.openLogEntry',
                    title: 'Open Log Entry',
                    arguments: [entry.date, entry.topic]
                };
                return item;
            });
        } catch (error) {
            console.warn('SquadUI: Failed to load log entries for member', memberId, error);
            return [];
        }
    }
}

/**
 * Provides tree data for the Skills view.
 * Shows installed skills from the skill catalog.
 */
export class SkillsTreeProvider implements vscode.TreeDataProvider<SquadTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<SquadTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private skillCatalogService = new SkillCatalogService();

    constructor(private dataProvider: SquadDataProvider) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SquadTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: SquadTreeItem): Promise<SquadTreeItem[]> {
        if (!element) {
            return this.getSkillItems();
        }
        return [];
    }

    private getSkillItems(): SquadTreeItem[] {
        const workspaceRoot = this.dataProvider.getWorkspaceRoot();
        const skills = this.skillCatalogService.getInstalledSkills(workspaceRoot);

        return skills.map(skill => {
            const item = new SquadTreeItem(
                skill.name,
                vscode.TreeItemCollapsibleState.None,
                'skill',
                skill.name
            );

            const sourceBadge = skill.source === 'awesome-copilot' ? '📦 awesome-copilot'
                : skill.source === 'skills.sh' ? '🏆 skills.sh'
                : undefined;

            item.iconPath = new vscode.ThemeIcon('book');
            if (sourceBadge) { item.description = sourceBadge; }
            item.tooltip = this.getSkillTooltip(skill);
            item.contextValue = 'skill';

            item.command = {
                command: 'squadui.viewSkill',
                title: 'View Skill',
                arguments: [skill.slug]
            };

            return item;
        });
    }

    private getSkillTooltip(skill: Skill): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**${skill.name}**\n\n`);
        md.appendMarkdown(`${skill.description}\n\n`);
        if (skill.confidence) {
            md.appendMarkdown(`Confidence: ${skill.confidence}`);
        }
        return md;
    }
}

/**
 * Provides tree data for the Decisions view.
 * Shows parsed decisions from .ai-team/decisions.md.
 */
export class DecisionsTreeProvider implements vscode.TreeDataProvider<SquadTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<SquadTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private decisionService = new DecisionService();

    constructor(private dataProvider: SquadDataProvider) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SquadTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: SquadTreeItem): Promise<SquadTreeItem[]> {
        if (!element) {
            return this.getDecisionItems();
        }
        return [];
    }

    private getDecisionItems(): SquadTreeItem[] {
        const workspaceRoot = this.dataProvider.getWorkspaceRoot();
        const decisions = this.decisionService.getDecisions(workspaceRoot);

        return decisions.map(decision => {
            const item = new SquadTreeItem(
                decision.title,
                vscode.TreeItemCollapsibleState.None,
                'decision'
            );

            item.iconPath = new vscode.ThemeIcon('notebook');
            item.description = [decision.date, decision.author].filter(Boolean).join(' — ');
            item.tooltip = this.getDecisionTooltip(decision);

            item.command = {
                command: 'squadui.openDecision',
                title: 'Open Decision',
                arguments: [decision.filePath, decision.lineNumber]
            };

            return item;
        });
    }

    private getDecisionTooltip(decision: DecisionEntry): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**${decision.title}**\n\n`);
        if (decision.date) {
            md.appendMarkdown(`Date: ${decision.date}\n\n`);
        }
        if (decision.author) {
            md.appendMarkdown(`Author: ${decision.author}`);
        }
        return md;
    }
}
