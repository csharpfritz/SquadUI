/**
 * Tree data providers for displaying squad team, skills, and decisions.
 * Supports multi-workspace scenarios where items are grouped by workspace.
 */

import * as vscode from 'vscode';
import { SquadMember, Task, GitHubIssue, Skill, DecisionEntry, IGitHubIssuesService, isActiveStatus } from '../models';
import { SquadDataProvider } from '../services/SquadDataProvider';
import { SkillCatalogService } from '../services/SkillCatalogService';
import { DecisionService } from '../services/DecisionService';
import { OrchestrationLogService } from '../services/OrchestrationLogService';
import { WorkspaceInfo } from '../services/WorkspaceScanner';
import { stripMarkdownLinks } from '../utils/markdownUtils';

/**
 * Represents an item in the squad tree view.
 * Shared across all three tree providers.
 */
export class SquadTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'section' | 'member' | 'task' | 'issue' | 'skill' | 'decision' | 'log-entry' | 'workspace',
        public readonly memberId?: string,
        public readonly taskId?: string,
        public readonly logFilePath?: string,
        public readonly workspaceRootPath?: string
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
 * In multi-workspace mode, groups members under workspace nodes.
 */
export class TeamTreeProvider implements vscode.TreeDataProvider<SquadTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<SquadTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private issuesService: IGitHubIssuesService | undefined;
    private orchestrationLogService: OrchestrationLogService;
    private additionalProviders: Map<string, { provider: SquadDataProvider; squadFolder: '.squad' | '.ai-team' }> = new Map();
    private workspaces: WorkspaceInfo[] = [];

    constructor(private dataProvider: SquadDataProvider, squadFolder: '.squad' | '.ai-team' = '.ai-team') {
        this.orchestrationLogService = new OrchestrationLogService(squadFolder);
    }

    setIssuesService(service: IGitHubIssuesService): void {
        this.issuesService = service;
    }

    /**
     * Configures multi-workspace support.
     * When multiple workspaces are provided, the tree groups members under workspace nodes.
     */
    setWorkspaces(workspaces: WorkspaceInfo[], providers: Map<string, SquadDataProvider>): void {
        this.workspaces = workspaces;
        this.additionalProviders.clear();
        for (const ws of workspaces) {
            const provider = providers.get(ws.rootPath);
            if (provider && ws.rootPath !== this.dataProvider.getWorkspaceRoot()) {
                this.additionalProviders.set(ws.rootPath, { provider, squadFolder: ws.squadFolder });
            }
        }
    }

    refresh(): void {
        this.dataProvider.refresh();
        for (const { provider } of this.additionalProviders.values()) {
            provider.refresh();
        }
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SquadTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: SquadTreeItem): Promise<SquadTreeItem[]> {
        if (!element) {
            // Multi-workspace: show workspace grouping nodes
            if (this.workspaces.length > 1) {
                return this.getWorkspaceNodes();
            }
            return this.getSquadMemberItems(this.dataProvider);
        }

        // Workspace grouping node → show members from that workspace
        if (element.itemType === 'workspace' && element.workspaceRootPath) {
            const provider = this.getProviderForWorkspace(element.workspaceRootPath);
            if (provider) {
                return this.getSquadMemberItems(provider);
            }
            return [];
        }

        if (element.itemType === 'member' && element.memberId) {
            const provider = element.workspaceRootPath
                ? this.getProviderForWorkspace(element.workspaceRootPath)
                : this.dataProvider;
            if (!provider) { return []; }
            const tasks = await this.getTaskItems(element.memberId, provider);
            // Collect issue numbers already shown as tasks to avoid duplicates
            const taskIssueIds = new Set(
                tasks.map(t => t.taskId).filter((id): id is string => Boolean(id))
            );
            const issues = await this.getIssueItems(element.memberId, taskIssueIds, provider);
            const closedIssues = await this.getClosedIssueItems(element.memberId, taskIssueIds, provider);
            const logEntries = await this.getMemberLogEntries(element.memberId, provider);
            return [...tasks, ...issues, ...closedIssues, ...logEntries];
        }

        return [];
    }

    /**
     * Returns the data provider for a given workspace root path.
     */
    private getProviderForWorkspace(rootPath: string): SquadDataProvider | undefined {
        if (rootPath === this.dataProvider.getWorkspaceRoot()) {
            return this.dataProvider;
        }
        return this.additionalProviders.get(rootPath)?.provider;
    }

    /**
     * Creates workspace grouping nodes for multi-workspace mode.
     */
    private getWorkspaceNodes(): SquadTreeItem[] {
        return this.workspaces
            .filter(ws => ws.hasTeam)
            .map(ws => {
                const item = new SquadTreeItem(
                    ws.name,
                    vscode.TreeItemCollapsibleState.Expanded,
                    'workspace',
                    undefined,
                    undefined,
                    undefined,
                    ws.rootPath
                );
                item.iconPath = new vscode.ThemeIcon('folder');
                item.description = ws.squadFolder;
                item.tooltip = `Workspace: ${ws.name}\nPath: ${ws.rootPath}\nConfig: ${ws.squadFolder}`;
                item.contextValue = 'workspace';
                return item;
            });
    }

    private async getSquadMemberItems(provider?: SquadDataProvider): Promise<SquadTreeItem[]> {
        const dp = provider ?? this.dataProvider;
        // Feed GitHub issues into data provider for status computation
        if (this.issuesService) {
            try {
                const workspaceRoot = dp.getWorkspaceRoot();
                const openIssues = await this.issuesService.getIssuesByMember(workspaceRoot);
                dp.setOpenIssues(openIssues);
            } catch {
                // Issues service unavailable — proceed without GitHub-aware status
            }
        }

        const members = await dp.getSquadMembers();
        const workspaceRootPath = this.workspaces.length > 1 ? dp.getWorkspaceRoot() : undefined;
        
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
                member.name,
                undefined,
                undefined,
                workspaceRootPath
            );

            const specialIcon = lowerName === 'scribe' ? 'edit'
                : lowerName === 'ralph' ? 'eye'
                : isCopilot ? 'robot'
                : undefined;

            // Active members get a spinning icon, idle get person (unless special)
            const memberActive = isActiveStatus(member.status);
            if (!specialIcon) {
                item.iconPath = memberActive
                    ? new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.green'))
                    : new vscode.ThemeIcon('person');
            } else {
                item.iconPath = new vscode.ThemeIcon(specialIcon);
            }
            
            // Build description with role, status context, and issue count
            const issueCount = await this.getIssueCount(member.name, dp);
            const issueText = issueCount > 0 ? ` • ${issueCount} issue${issueCount > 1 ? 's' : ''}` : '';
            const statusText = member.activityContext ? ` • ${member.activityContext.shortLabel}` : '';
            
            item.description = `${member.role}${statusText}${issueText}`;
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

    private async getTaskItems(memberId: string, provider?: SquadDataProvider): Promise<SquadTreeItem[]> {
        const dp = provider ?? this.dataProvider;
        const tasks = await dp.getTasksForMember(memberId);

        return tasks.map(task => {
            const item = new SquadTreeItem(
                task.title,
                vscode.TreeItemCollapsibleState.None,
                'task',
                memberId,
                task.id
            );

            const taskIconId = task.status === 'completed' ? 'pass-filled'
                : task.status === 'in_progress' ? 'sync~spin'
                : 'circle-outline';
            const taskIconColor = task.status === 'completed' ? new vscode.ThemeColor('charts.green')
                : task.status === 'in_progress' ? new vscode.ThemeColor('charts.orange')
                : undefined;
            item.iconPath = new vscode.ThemeIcon(taskIconId, taskIconColor);
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

    private async getIssueItems(memberId: string, excludeIssueIds?: Set<string>, provider?: SquadDataProvider): Promise<SquadTreeItem[]> {
        if (!this.issuesService) {
            return [];
        }

        try {
            const dp = provider ?? this.dataProvider;
            const workspaceRoot = dp.getWorkspaceRoot();
            const issueMap = await this.issuesService.getIssuesByMember(workspaceRoot);
            const allIssues = issueMap.get(memberId.toLowerCase()) ?? [];
            const issues = excludeIssueIds?.size
                ? allIssues.filter(issue => !excludeIssueIds.has(String(issue.number)))
                : allIssues;

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

    private async getClosedIssueItems(memberId: string, excludeIssueIds?: Set<string>, provider?: SquadDataProvider): Promise<SquadTreeItem[]> {
        if (!this.issuesService) {
            return [];
        }

        try {
            const dp = provider ?? this.dataProvider;
            const workspaceRoot = dp.getWorkspaceRoot();
            const issueMap = await this.issuesService.getClosedIssuesByMember(workspaceRoot);
            const allIssues = issueMap.get(memberId.toLowerCase()) ?? [];
            const issues = excludeIssueIds?.size
                ? allIssues.filter(issue => !excludeIssueIds.has(String(issue.number)))
                : allIssues;

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
        if (member.activityContext) {
            md.appendMarkdown(`Status: ${member.activityContext.shortLabel}\n\n`);
            md.appendMarkdown(`${member.activityContext.description}`);
        } else {
            md.appendMarkdown(`Status: —`);
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
    private async getIssueCount(memberId: string, provider?: SquadDataProvider): Promise<number> {
        if (!this.issuesService) {
            return 0;
        }

        try {
            const dp = provider ?? this.dataProvider;
            const workspaceRoot = dp.getWorkspaceRoot();
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
    private async getMemberLogEntries(memberId: string, provider?: SquadDataProvider): Promise<SquadTreeItem[]> {
        const dp = provider ?? this.dataProvider;
        const workspaceRoot = dp.getWorkspaceRoot();
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
                item.iconPath = new vscode.ThemeIcon('history');
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
    private squadFolder: '.squad' | '.ai-team';

    constructor(private dataProvider: SquadDataProvider, squadFolder: '.squad' | '.ai-team' = '.ai-team') {
        this.squadFolder = squadFolder;
    }

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
        const skills = this.skillCatalogService.getInstalledSkills(workspaceRoot, this.squadFolder);

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
 * In multi-workspace mode, groups decisions under workspace nodes.
 */
export class DecisionsTreeProvider implements vscode.TreeDataProvider<SquadTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<SquadTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private decisionService: DecisionService;
    private additionalServices: Map<string, { service: DecisionService; provider: SquadDataProvider }> = new Map();
    private workspaces: WorkspaceInfo[] = [];

    constructor(private dataProvider: SquadDataProvider, squadFolder: '.squad' | '.ai-team' = '.ai-team') {
        this.decisionService = new DecisionService(squadFolder);
    }

    /**
     * Configures multi-workspace support for the decisions view.
     */
    setWorkspaces(workspaces: WorkspaceInfo[], providers: Map<string, SquadDataProvider>): void {
        this.workspaces = workspaces;
        this.additionalServices.clear();
        for (const ws of workspaces) {
            const provider = providers.get(ws.rootPath);
            if (provider && ws.rootPath !== this.dataProvider.getWorkspaceRoot()) {
                this.additionalServices.set(ws.rootPath, {
                    service: new DecisionService(ws.squadFolder),
                    provider,
                });
            }
        }
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SquadTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: SquadTreeItem): Promise<SquadTreeItem[]> {
        if (!element) {
            if (this.workspaces.length > 1) {
                return this.getWorkspaceNodes();
            }
            return this.getDecisionItems(this.dataProvider, this.decisionService);
        }
        if (element.itemType === 'workspace' && element.workspaceRootPath) {
            const entry = this.additionalServices.get(element.workspaceRootPath);
            if (entry) {
                return this.getDecisionItems(entry.provider, entry.service);
            }
            if (element.workspaceRootPath === this.dataProvider.getWorkspaceRoot()) {
                return this.getDecisionItems(this.dataProvider, this.decisionService);
            }
        }
        return [];
    }

    private getWorkspaceNodes(): SquadTreeItem[] {
        return this.workspaces
            .filter(ws => ws.hasTeam)
            .map(ws => {
                const item = new SquadTreeItem(
                    ws.name,
                    vscode.TreeItemCollapsibleState.Expanded,
                    'workspace',
                    undefined,
                    undefined,
                    undefined,
                    ws.rootPath
                );
                item.iconPath = new vscode.ThemeIcon('folder');
                item.description = ws.squadFolder;
                item.contextValue = 'workspace';
                return item;
            });
    }

    private getDecisionItems(provider: SquadDataProvider, service: DecisionService): SquadTreeItem[] {
        const workspaceRoot = provider.getWorkspaceRoot();
        let decisions: DecisionEntry[];
        try {
            decisions = service.getDecisions(workspaceRoot);
        } catch {
            return [];
        }

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
