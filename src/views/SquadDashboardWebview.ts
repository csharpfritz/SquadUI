/**
 * Webview panel for the Squad Dashboard.
 * Hosts three tabs: Velocity, Activity Timeline, and Decision Browser.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DashboardData, IGitHubIssuesService, MilestoneBurndown } from '../models';
import { DashboardDataBuilder } from './dashboard/DashboardDataBuilder';
import { getDashboardHtml } from './dashboard/htmlTemplate';
import { SquadDataProvider } from '../services';

export class SquadDashboardWebview {
    public static readonly viewType = 'squadui.dashboard';

    private panel: vscode.WebviewPanel | undefined;
    private readonly extensionUri: vscode.Uri;
    private readonly dataProvider: SquadDataProvider;
    private readonly dataBuilder: DashboardDataBuilder;
    private issuesService: IGitHubIssuesService | undefined;

    constructor(extensionUri: vscode.Uri, dataProvider: SquadDataProvider) {
        this.extensionUri = extensionUri;
        this.dataProvider = dataProvider;
        this.dataBuilder = new DashboardDataBuilder();
    }

    setIssuesService(service: IGitHubIssuesService): void {
        this.issuesService = service;
    }

    /**
     * Shows the dashboard panel. Creates the panel if it doesn't exist,
     * or reveals and updates it if it does.
     */
    public async show(): Promise<void> {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
            await this.updateContent();
        } else {
            this.createPanel();
            await this.updateContent();
        }
    }

    /**
     * Disposes of the webview panel if it exists.
     */
    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
        }
    }

    private createPanel(): void {
        this.panel = vscode.window.createWebviewPanel(
            SquadDashboardWebview.viewType,
            'Squad Dashboard',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [this.extensionUri],
                retainContextWhenHidden: true, // Keep state when hidden
            }
        );

        this.panel.iconPath = {
            light: vscode.Uri.joinPath(this.extensionUri, 'images', 'icon.png'),
            dark: vscode.Uri.joinPath(this.extensionUri, 'images', 'icon.png')
        };

        this.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'openDecision':
                    await vscode.commands.executeCommand('squadui.openDecision', message.filePath, message.lineNumber ?? 0);
                    break;
                case 'openTask':
                    await vscode.commands.executeCommand('squadui.showWorkDetails', message.taskId);
                    break;
                case 'openMember':
                    await vscode.commands.executeCommand('squadui.viewCharter', message.memberName);
                    break;
                case 'openLogEntry':
                    await this.handleOpenLogEntry(message.date, message.topic);
                    break;
            }
        }, undefined, []);

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    private async updateContent(): Promise<void> {
        if (!this.panel) {
            return;
        }

        try {
            // Fetch data from services
            const members = await this.dataProvider.getSquadMembers();
            const tasks = await this.dataProvider.getTasks();
            const logEntries = await this.dataProvider.getLogEntries();
            const decisions = await this.dataProvider.getDecisions();

            // Fetch GitHub issues if service is available
            const workspaceRoot = this.dataProvider.getWorkspaceRoot();
            let openIssues, closedIssues, allClosedIssues;
            if (this.issuesService) {
                try {
                    openIssues = await this.issuesService.getIssuesByMember(workspaceRoot);
                    closedIssues = await this.issuesService.getClosedIssuesByMember(workspaceRoot);
                    allClosedIssues = await this.issuesService.getClosedIssues(workspaceRoot);
                } catch { /* issues optional */ }
            }

            // Build milestone burndown data
            const milestoneBurndowns = await this.buildBurndowns(workspaceRoot);

            // Build dashboard data
            const dashboardData: DashboardData = this.dataBuilder.buildDashboardData(
                logEntries,
                members,
                tasks,
                decisions,
                openIssues,
                closedIssues,
                milestoneBurndowns,
                allClosedIssues
            );

            // Render HTML
            this.panel.webview.html = getDashboardHtml(dashboardData);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.panel.webview.html = this.getErrorHtml(errorMessage);
        }
    }

    /**
     * Fetches milestone data and builds burndown charts.
     */
    private async buildBurndowns(workspaceRoot: string): Promise<MilestoneBurndown[]> {
        if (!this.issuesService) { return []; }
        try {
            const milestones = await this.issuesService.getMilestones(workspaceRoot);
            const burndowns: MilestoneBurndown[] = [];
            for (const ms of milestones) {
                const issues = await this.issuesService.getMilestoneIssues(workspaceRoot, ms.number);
                if (issues.length === 0) { continue; }
                burndowns.push(this.dataBuilder.buildMilestoneBurndown(
                    ms.title, ms.number, issues, ms.dueOn
                ));
            }
            return burndowns;
        } catch {
            return [];
        }
    }

    private async handleOpenLogEntry(date: string, topic: string): Promise<void> {
        const workspaceRoot = this.dataProvider.getWorkspaceRoot();
        const aiTeamDir = path.join(workspaceRoot, '.ai-team');
        
        // Try both log directory patterns
        const logDirs = ['orchestration-log', 'log'];
        const possibleFilenames = [
            `${date}-${topic}.md`,
            `${date}T0000-${topic}.md`
        ];

        for (const dir of logDirs) {
            for (const filename of possibleFilenames) {
                const filePath = path.join(aiTeamDir, dir, filename);
                if (fs.existsSync(filePath)) {
                    await vscode.commands.executeCommand('squadui.openLogEntry', filePath);
                    return;
                }
            }
        }

        // If not found, search all files in both directories
        for (const dir of logDirs) {
            const logDir = path.join(aiTeamDir, dir);
            if (fs.existsSync(logDir)) {
                const files = fs.readdirSync(logDir);
                const match = files.find(f => f.includes(date) && f.includes(topic));
                if (match) {
                    const filePath = path.join(logDir, match);
                    await vscode.commands.executeCommand('squadui.openLogEntry', filePath);
                    return;
                }
            }
        }

        vscode.window.showWarningMessage(`Log file not found for ${date} - ${topic}`);
    }

    private getErrorHtml(message: string): string {
        return /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard Error</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .error {
            color: var(--vscode-errorForeground);
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            padding: 12px;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <h1>Unable to Load Dashboard</h1>
    <div class="error">${message}</div>
</body>
</html>
        `.trim();
    }
}
