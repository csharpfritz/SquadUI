/**
 * Webview panel for displaying standup reports.
 * Shows a summary of closed issues, new issues, blockers, and suggested next steps.
 */

import * as vscode from 'vscode';
import { StandupReport, StandupPeriod, StandupReportService } from '../services/StandupReportService';
import { SquadDataProvider, GitHubIssuesService } from '../services';

export class StandupReportWebview {
    public static readonly viewType = 'squadui.standupReport';

    private panel: vscode.WebviewPanel | undefined;
    private readonly extensionUri: vscode.Uri;
    private readonly dataProvider: SquadDataProvider;
    private readonly standupService: StandupReportService;
    private issuesService: GitHubIssuesService | undefined;

    constructor(extensionUri: vscode.Uri, dataProvider: SquadDataProvider) {
        this.extensionUri = extensionUri;
        this.dataProvider = dataProvider;
        this.standupService = new StandupReportService();
    }

    setIssuesService(service: GitHubIssuesService): void {
        this.issuesService = service;
    }

    /**
     * Shows the standup report for the given period.
     */
    public async show(period: StandupPeriod = 'day'): Promise<void> {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
        } else {
            this.createPanel();
        }
        await this.updateContent(period);
    }

    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
        }
    }

    private createPanel(): void {
        this.panel = vscode.window.createWebviewPanel(
            StandupReportWebview.viewType,
            'Standup Report',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [this.extensionUri],
            }
        );

        this.panel.iconPath = {
            light: vscode.Uri.joinPath(this.extensionUri, 'images', 'icon.png'),
            dark: vscode.Uri.joinPath(this.extensionUri, 'images', 'icon.png'),
        };

        this.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'switchPeriod':
                    await this.updateContent(message.period as StandupPeriod);
                    break;
                case 'openIssue':
                    if (message.url) {
                        vscode.env.openExternal(vscode.Uri.parse(message.url));
                    }
                    break;
                case 'refresh':
                    await this.updateContent(message.period as StandupPeriod);
                    break;
            }
        }, undefined, []);

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    private async updateContent(period: StandupPeriod): Promise<void> {
        if (!this.panel) { return; }

        try {
            const workspaceRoot = this.dataProvider.getWorkspaceRoot();
            
            // Fetch data
            const decisions = await this.dataProvider.getDecisions();
            const logEntries = await this.dataProvider.getLogEntries();
            
            let openIssues: import('../models').GitHubIssue[] = [];
            let closedIssues: import('../models').GitHubIssue[] = [];
            
            if (this.issuesService) {
                try {
                    openIssues = await this.issuesService.getIssues(workspaceRoot);
                    closedIssues = await this.issuesService.getClosedIssues(workspaceRoot);
                } catch {
                    // Issues service unavailable
                }
            }

            // Generate report
            const report = this.standupService.generateReport(
                openIssues,
                closedIssues,
                decisions,
                logEntries,
                period
            );

            if (!this.panel) { return; }
            this.panel.webview.html = this.getHtml(report);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            if (this.panel) {
                this.panel.webview.html = this.getErrorHtml(errorMessage);
            }
        }
    }

    private getHtml(report: StandupReport): string {
        const periodLabel = report.period === 'day' ? 'Daily' : 'Weekly';
        const altPeriod = report.period === 'day' ? 'week' : 'day';
        const altLabel = report.period === 'day' ? 'Weekly' : 'Daily';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Standup Report</title>
    <style>
        :root {
            --vscode-background: var(--vscode-editor-background);
            --vscode-foreground: var(--vscode-editor-foreground);
            --vscode-border: var(--vscode-panel-border);
            --vscode-link: var(--vscode-textLink-foreground);
            --vscode-button-bg: var(--vscode-button-background);
            --vscode-button-fg: var(--vscode-button-foreground);
            --vscode-success: #4ec9b0;
            --vscode-warning: #d18616;
            --vscode-error: #f44747;
        }
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-background);
            line-height: 1.6;
        }
        h1 {
            border-bottom: 1px solid var(--vscode-border);
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        h2 {
            margin-top: 24px;
            margin-bottom: 12px;
        }
        .header-actions {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        button {
            background-color: var(--vscode-button-bg);
            color: var(--vscode-button-fg);
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 2px;
        }
        button:hover {
            opacity: 0.9;
        }
        .period-info {
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
            margin-bottom: 20px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            margin-bottom: 24px;
        }
        .summary-card {
            background-color: var(--vscode-sideBar-background);
            border: 1px solid var(--vscode-border);
            border-radius: 4px;
            padding: 16px;
            text-align: center;
        }
        .summary-card .value {
            font-size: 2em;
            font-weight: bold;
        }
        .summary-card .label {
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
        }
        .summary-card.success .value { color: var(--vscode-success); }
        .summary-card.warning .value { color: var(--vscode-warning); }
        .summary-card.error .value { color: var(--vscode-error); }
        .issue-list {
            list-style: none;
            padding: 0;
        }
        .issue-list li {
            padding: 8px 0;
            border-bottom: 1px solid var(--vscode-border);
        }
        .issue-list li:last-child {
            border-bottom: none;
        }
        .issue-number {
            color: var(--vscode-link);
            cursor: pointer;
            font-weight: bold;
        }
        .issue-number:hover {
            text-decoration: underline;
        }
        .issue-assignee {
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
        }
        .decision-list li {
            padding: 4px 0;
        }
        .empty-state {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
    </style>
</head>
<body>
    <h1>📊 ${periodLabel} Standup Report</h1>
    
    <div class="header-actions">
        <button onclick="switchPeriod('${altPeriod}')">Switch to ${altLabel}</button>
        <button onclick="refresh()">🔄 Refresh</button>
    </div>
    
    <div class="period-info">
        ${this.formatDate(report.summary.periodStart)} – ${this.formatDate(report.summary.periodEnd)}
    </div>

    <div class="summary-grid">
        <div class="summary-card success">
            <div class="value">${report.summary.closedCount}</div>
            <div class="label">✅ Issues Closed</div>
        </div>
        <div class="summary-card warning">
            <div class="value">${report.summary.newCount}</div>
            <div class="label">📋 New Issues</div>
        </div>
        <div class="summary-card ${report.summary.blockingCount > 0 ? 'error' : ''}">
            <div class="value">${report.summary.blockingCount}</div>
            <div class="label">🚫 Blockers</div>
        </div>
    </div>

    ${this.renderClosedIssues(report)}
    ${this.renderNewIssues(report)}
    ${this.renderBlockers(report)}
    ${this.renderNextSteps(report)}
    ${this.renderDecisions(report)}

    <script>
        const vscode = acquireVsCodeApi();
        const currentPeriod = '${report.period}';
        
        function switchPeriod(period) {
            vscode.postMessage({ command: 'switchPeriod', period });
        }
        
        function refresh() {
            vscode.postMessage({ command: 'refresh', period: currentPeriod });
        }
        
        function openIssue(url) {
            vscode.postMessage({ command: 'openIssue', url });
        }
    </script>
</body>
</html>`;
    }

    private renderClosedIssues(report: StandupReport): string {
        if (report.closedIssues.length === 0) {
            return `
                <h2>✅ Closed Issues</h2>
                <p class="empty-state">No issues closed in this period.</p>
            `;
        }
        const items = report.closedIssues.map(issue => `
            <li>
                <span class="issue-number" onclick="openIssue('${issue.htmlUrl}')">#${issue.number}</span>
                ${issue.title}
            </li>
        `).join('');
        return `
            <h2>✅ Closed Issues</h2>
            <ul class="issue-list">${items}</ul>
        `;
    }

    private renderNewIssues(report: StandupReport): string {
        if (report.newIssues.length === 0) {
            return `
                <h2>📋 New Issues</h2>
                <p class="empty-state">No new issues in this period.</p>
            `;
        }
        const items = report.newIssues.map(issue => `
            <li>
                <span class="issue-number" onclick="openIssue('${issue.htmlUrl}')">#${issue.number}</span>
                ${issue.title}
            </li>
        `).join('');
        return `
            <h2>📋 New Issues</h2>
            <ul class="issue-list">${items}</ul>
        `;
    }

    private renderBlockers(report: StandupReport): string {
        if (report.blockingIssues.length === 0) {
            return '';
        }
        const items = report.blockingIssues.map(issue => {
            const labels = issue.labels.map(l => l.name).join(', ');
            return `
                <li>
                    <span class="issue-number" onclick="openIssue('${issue.htmlUrl}')">#${issue.number}</span>
                    ${issue.title}
                    <span class="issue-assignee">(${labels})</span>
                </li>
            `;
        }).join('');
        return `
            <h2>🚫 Blockers</h2>
            <ul class="issue-list">${items}</ul>
        `;
    }

    private renderNextSteps(report: StandupReport): string {
        if (report.suggestedNextSteps.length === 0) {
            return `
                <h2>🎯 Suggested Next Steps</h2>
                <p class="empty-state">No open issues to suggest.</p>
            `;
        }
        const items = report.suggestedNextSteps.map(issue => {
            const assignee = issue.assignee ? `<span class="issue-assignee">@${issue.assignee}</span>` : '';
            return `
                <li>
                    <span class="issue-number" onclick="openIssue('${issue.htmlUrl}')">#${issue.number}</span>
                    ${issue.title}
                    ${assignee}
                </li>
            `;
        }).join('');
        return `
            <h2>🎯 Suggested Next Steps</h2>
            <ul class="issue-list">${items}</ul>
        `;
    }

    private renderDecisions(report: StandupReport): string {
        if (report.recentDecisions.length === 0) {
            return '';
        }
        const items = report.recentDecisions.map(decision => {
            const author = decision.author ? ` (${decision.author})` : '';
            return `<li><strong>${decision.title}</strong>${author}</li>`;
        }).join('');
        return `
            <h2>📌 Recent Decisions</h2>
            <ul class="decision-list">${items}</ul>
        `;
    }

    private formatDate(date: Date): string {
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });
    }

    private getErrorHtml(message: string): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Error</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-errorForeground);
        }
    </style>
</head>
<body>
    <h1>Error Loading Standup Report</h1>
    <p>${message}</p>
</body>
</html>`;
    }
}
