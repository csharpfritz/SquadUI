/**
 * Webview panel for displaying standup reports.
 * Shows a summary of closed issues, new issues, blockers, and suggested next steps.
 * Includes: milestone burndown, AI-generated executive summary, and decisions summary.
 */

import * as vscode from 'vscode';
import { StandupReport, StandupPeriod, StandupReportService } from '../services/StandupReportService';
import { SquadDataProvider, GitHubIssuesService } from '../services';
import { DashboardDataBuilder } from './dashboard/DashboardDataBuilder';
import { MilestoneBurndown, DecisionEntry } from '../models';

export class StandupReportWebview {
    public static readonly viewType = 'squadui.standupReport';

    private panel: vscode.WebviewPanel | undefined;
    private readonly extensionUri: vscode.Uri;
    private readonly dataProvider: SquadDataProvider;
    private readonly standupService: StandupReportService;
    private readonly dataBuilder: DashboardDataBuilder;
    private issuesService: GitHubIssuesService | undefined;

    constructor(extensionUri: vscode.Uri, dataProvider: SquadDataProvider) {
        this.extensionUri = extensionUri;
        this.dataProvider = dataProvider;
        this.standupService = new StandupReportService();
        this.dataBuilder = new DashboardDataBuilder();
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
                case 'openDecision':
                    await vscode.commands.executeCommand('squadui.openDecision', message.filePath, message.lineNumber ?? 0);
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

            // Build milestone burndown for current milestone
            const burndown = await this.buildCurrentMilestoneBurndown(workspaceRoot);

            // Generate AI summaries (non-blocking)
            const [executiveSummary, decisionsSummary] = await Promise.all([
                this.generateExecutiveSummary(report),
                this.generateDecisionsSummary(report.recentDecisions),
            ]);

            if (!this.panel) { return; }
            this.panel.webview.html = this.getHtml(report, burndown, executiveSummary, decisionsSummary);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            if (this.panel) {
                this.panel.webview.html = this.getErrorHtml(errorMessage);
            }
        }
    }

    /**
     * Builds burndown data for the first open milestone.
     */
    private async buildCurrentMilestoneBurndown(workspaceRoot: string): Promise<MilestoneBurndown | undefined> {
        if (!this.issuesService) { return undefined; }
        try {
            const milestones = await this.issuesService.getMilestones(workspaceRoot);
            const openMilestone = milestones.find(ms => ms.state === 'open');
            if (!openMilestone) { return undefined; }
            const issues = await this.issuesService.getMilestoneIssues(workspaceRoot, openMilestone.number);
            if (issues.length === 0) { return undefined; }
            return this.dataBuilder.buildMilestoneBurndown(
                openMilestone.title, openMilestone.number, issues, openMilestone.dueOn
            );
        } catch {
            return undefined;
        }
    }

    /**
     * Generates an AI executive summary using the VS Code Language Model API.
     * Falls back to a static summary if the API is unavailable.
     */
    private async generateExecutiveSummary(report: StandupReport): Promise<string> {
        const periodLabel = report.period === 'day' ? 'daily' : 'weekly';
        const fallback = this.buildStaticExecutiveSummary(report);

        try {
            const models = await vscode.lm.selectChatModels({ family: 'gpt-4o' });
            if (models.length === 0) { return fallback; }
            const model = models[0];

            const prompt = `You are a project manager generating a brief executive summary for a ${periodLabel} standup report.
Here are the facts:
- ${report.summary.closedCount} issues were closed
- ${report.summary.newCount} new issues were opened
- ${report.summary.blockingCount} blockers exist
- Closed issues: ${report.closedIssues.map(i => `#${i.number} ${i.title}`).join('; ') || 'none'}
- New issues: ${report.newIssues.map(i => `#${i.number} ${i.title}`).join('; ') || 'none'}
- Blocking issues: ${report.blockingIssues.map(i => `#${i.number} ${i.title}`).join('; ') || 'none'}
- Top suggested next steps: ${report.suggestedNextSteps.map(i => `#${i.number} ${i.title}`).join('; ') || 'none'}

Write 2-3 concise paragraphs:
1. A summary of what was accomplished and what's new
2. Any concerns or blockers to highlight
3. Suggested next steps and priorities

Keep it concise, professional, and actionable. Do not use markdown headers.`;

            const messages = [vscode.LanguageModelChatMessage.User(prompt)];
            const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

            let result = '';
            for await (const chunk of response.text) {
                result += chunk;
            }
            return result.trim() || fallback;
        } catch {
            return fallback;
        }
    }

    /**
     * Generates a static executive summary as fallback when AI is unavailable.
     */
    private buildStaticExecutiveSummary(report: StandupReport): string {
        const periodLabel = report.period === 'day' ? 'past 24 hours' : 'past week';
        const parts: string[] = [];

        if (report.summary.closedCount > 0 || report.summary.newCount > 0) {
            parts.push(`Over the ${periodLabel}, the team closed ${report.summary.closedCount} issue${report.summary.closedCount !== 1 ? 's' : ''} and ${report.summary.newCount} new issue${report.summary.newCount !== 1 ? 's were' : ' was'} opened.`);
        } else {
            parts.push(`No issue activity was recorded over the ${periodLabel}.`);
        }

        if (report.summary.blockingCount > 0) {
            parts.push(`There ${report.summary.blockingCount === 1 ? 'is' : 'are'} ${report.summary.blockingCount} active blocker${report.summary.blockingCount !== 1 ? 's' : ''} that may need attention.`);
        }

        if (report.suggestedNextSteps.length > 0) {
            const topIssues = report.suggestedNextSteps.slice(0, 3).map(i => `#${i.number}`).join(', ');
            parts.push(`Suggested next priorities: ${topIssues}.`);
        }

        return parts.join(' ');
    }

    /**
     * Generates an AI summary of recent decisions using the VS Code Language Model API.
     * Falls back to a static summary if the API is unavailable.
     */
    private async generateDecisionsSummary(decisions: DecisionEntry[]): Promise<string> {
        if (decisions.length === 0) { return ''; }
        const fallback = this.buildStaticDecisionsSummary(decisions);

        try {
            const models = await vscode.lm.selectChatModels({ family: 'gpt-4o' });
            if (models.length === 0) { return fallback; }
            const model = models[0];

            const decisionList = decisions.map(d => {
                const author = d.author ? ` (by ${d.author})` : '';
                const preview = d.content ? d.content.substring(0, 200) : '';
                return `- "${d.title}"${author}: ${preview}`;
            }).join('\n');

            const prompt = `Summarize the following recent team decisions in 1-2 concise paragraphs. Focus on the themes, impact, and how they relate to each other. Do not use markdown headers.

${decisionList}`;

            const messages = [vscode.LanguageModelChatMessage.User(prompt)];
            const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

            let result = '';
            for await (const chunk of response.text) {
                result += chunk;
            }
            return result.trim() || fallback;
        } catch {
            return fallback;
        }
    }

    /**
     * Generates a static decisions summary as fallback.
     */
    private buildStaticDecisionsSummary(decisions: DecisionEntry[]): string {
        if (decisions.length === 0) { return ''; }
        const titles = decisions.map(d => `"${d.title}"`).join(', ');
        return `${decisions.length} decision${decisions.length !== 1 ? 's were' : ' was'} made recently: ${titles}.`;
    }

    private getHtml(report: StandupReport, burndown?: MilestoneBurndown, executiveSummary?: string, decisionsSummary?: string): string {
        const periodLabel = report.period === 'day' ? 'Daily' : 'Weekly';
        const altPeriod = report.period === 'day' ? 'week' : 'day';
        const altLabel = report.period === 'day' ? 'Weekly' : 'Daily';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
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
        .executive-summary {
            background-color: var(--vscode-sideBar-background);
            border: 1px solid var(--vscode-border);
            border-left: 4px solid var(--vscode-textLink-foreground);
            border-radius: 4px;
            padding: 16px 20px;
            margin-bottom: 24px;
            line-height: 1.7;
        }
        .executive-summary p {
            margin: 0 0 10px 0;
        }
        .executive-summary p:last-child {
            margin-bottom: 0;
        }
        .milestone-section {
            background-color: var(--vscode-sideBar-background);
            border: 1px solid var(--vscode-border);
            border-radius: 4px;
            padding: 16px;
            margin-bottom: 24px;
        }
        .milestone-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        .milestone-title {
            font-size: 1.1em;
            font-weight: 600;
        }
        .milestone-stats {
            display: flex;
            gap: 16px;
            font-size: 0.9em;
            color: var(--vscode-descriptionForeground);
        }
        .milestone-progress {
            height: 8px;
            background-color: var(--vscode-input-background);
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 16px;
        }
        .milestone-progress-fill {
            height: 100%;
            background-color: var(--vscode-success);
            border-radius: 4px;
            transition: width 0.3s;
        }
        .charts-container {
            display: flex;
            gap: 16px;
        }
        .charts-container > div {
            flex: 1;
            min-width: 0;
        }
        .chart-label {
            font-size: 0.85em;
            color: var(--vscode-descriptionForeground);
            text-align: center;
            margin-bottom: 4px;
            font-weight: 600;
        }
        canvas {
            width: 100%;
            height: 200px;
        }
        .decisions-summary {
            background-color: var(--vscode-sideBar-background);
            border: 1px solid var(--vscode-border);
            border-radius: 4px;
            padding: 16px 20px;
            margin-bottom: 16px;
            line-height: 1.7;
        }
        .decisions-summary p {
            margin: 0 0 10px 0;
        }
        .decisions-summary p:last-child {
            margin-bottom: 0;
        }
        .decision-link {
            color: var(--vscode-link);
            cursor: pointer;
            text-decoration: underline;
        }
        .decision-link:hover {
            opacity: 0.8;
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

    ${this.renderMilestoneSection(burndown, report)}

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

    ${this.renderExecutiveSummary(executiveSummary)}

    ${this.renderClosedIssues(report)}
    ${this.renderNewIssues(report)}
    ${this.renderBlockers(report)}
    ${this.renderNextSteps(report)}
    ${this.renderDecisions(report, decisionsSummary)}

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

        function openDecision(filePath, lineNumber) {
            vscode.postMessage({ command: 'openDecision', filePath, lineNumber });
        }

        ${this.getBurndownChartScript(burndown)}
        ${this.getVelocityChartScript(report)}
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
                <span class="issue-number" onclick="openIssue('${this.escapeHtml(issue.htmlUrl)}')">#${issue.number}</span>
                ${this.escapeHtml(issue.title)}
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
                <span class="issue-number" onclick="openIssue('${this.escapeHtml(issue.htmlUrl)}')">#${issue.number}</span>
                ${this.escapeHtml(issue.title)}
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
            const labels = issue.labels.map(l => this.escapeHtml(l.name)).join(', ');
            return `
                <li>
                    <span class="issue-number" onclick="openIssue('${this.escapeHtml(issue.htmlUrl)}')">#${issue.number}</span>
                    ${this.escapeHtml(issue.title)}
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
            const assignee = issue.assignee ? `<span class="issue-assignee">@${this.escapeHtml(issue.assignee)}</span>` : '';
            return `
                <li>
                    <span class="issue-number" onclick="openIssue('${this.escapeHtml(issue.htmlUrl)}')">#${issue.number}</span>
                    ${this.escapeHtml(issue.title)}
                    ${assignee}
                </li>
            `;
        }).join('');
        return `
            <h2>🎯 Suggested Next Steps</h2>
            <ul class="issue-list">${items}</ul>
        `;
    }

    private renderDecisions(report: StandupReport, decisionsSummary?: string): string {
        if (report.recentDecisions.length === 0) {
            return '';
        }
        const summaryHtml = decisionsSummary
            ? `<div class="decisions-summary">${this.escapeAndParagraph(decisionsSummary)}</div>`
            : '';
        const items = report.recentDecisions.map(decision => {
            const author = decision.author ? ` (${decision.author})` : '';
            const filePath = this.escapeHtml(decision.filePath || '');
            const lineNumber = decision.lineNumber || 0;
            return `<li><span class="decision-link" onclick="openDecision('${filePath}', ${lineNumber})">${this.escapeHtml(decision.title)}</span>${this.escapeHtml(author)}</li>`;
        }).join('');
        return `
            <h2>📌 Recent Decisions</h2>
            ${summaryHtml}
            <ul class="decision-list">${items}</ul>
        `;
    }

    private renderMilestoneSection(burndown: MilestoneBurndown | undefined, report: StandupReport): string {
        const hasVelocity = report.closedIssues.length > 0 || report.newIssues.length > 0;
        if ((!burndown || burndown.totalIssues === 0) && !hasVelocity) { return ''; }

        let burndownHtml = '';
        if (burndown && burndown.totalIssues > 0) {
            const closedCount = burndown.totalIssues - (burndown.dataPoints.length > 0 ? burndown.dataPoints[burndown.dataPoints.length - 1].remaining : 0);
            const pct = Math.round((closedCount / burndown.totalIssues) * 100);
            const dueText = burndown.dueDate ? `Due: ${burndown.dueDate}` : '';
            burndownHtml = `
                <div class="milestone-header">
                    <div class="milestone-title">🎯 ${this.escapeHtml(burndown.title)}</div>
                    <div class="milestone-stats">
                        <span>${closedCount} of ${burndown.totalIssues} closed (${pct}%)</span>
                        ${dueText ? `<span>${dueText}</span>` : ''}
                    </div>
                </div>
                <div class="milestone-progress">
                    <div class="milestone-progress-fill" style="width: ${pct}%"></div>
                </div>`;
        }

        const velocityHtml = hasVelocity ? `
                <div>
                    <div class="chart-label">Issue Velocity</div>
                    <canvas id="velocity-chart"></canvas>
                </div>` : '';

        const burndownChartHtml = burndown && burndown.totalIssues > 0 ? `
                <div>
                    <div class="chart-label">Milestone Burndown</div>
                    <canvas id="burndown-chart"></canvas>
                </div>` : '';

        const chartsHtml = (burndownChartHtml || velocityHtml) ? `
                <div class="charts-container">
                    ${burndownChartHtml}
                    ${velocityHtml}
                </div>` : '';

        return `
            <div class="milestone-section">
                ${burndownHtml}
                ${chartsHtml}
            </div>
        `;
    }

    private renderExecutiveSummary(summary?: string): string {
        if (!summary) { return ''; }
        return `
            <h2>📝 Executive Summary</h2>
            <div class="executive-summary">${this.escapeAndParagraph(summary)}</div>
        `;
    }

    /**
     * Escapes HTML and converts newline-separated text into <p> tags.
     */
    private escapeAndParagraph(text: string): string {
        const escaped = this.escapeHtml(text);
        return escaped.split(/\n\n+/).map(p => `<p>${p.trim()}</p>`).join('');
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Generates the burndown chart JavaScript for the standup canvas.
     */
    private getBurndownChartScript(burndown?: MilestoneBurndown): string {
        if (!burndown || burndown.dataPoints.length === 0) { return ''; }

        const dataJson = JSON.stringify(burndown.dataPoints).replace(/</g, '\\u003c');
        const memberNamesJson = JSON.stringify(burndown.memberNames).replace(/</g, '\\u003c');
        const memberColorsJson = JSON.stringify(burndown.memberColors).replace(/</g, '\\u003c');

        return `
        (function() {
            const canvas = document.getElementById('burndown-chart');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;

            const dataPoints = ${dataJson};
            const memberNames = ${memberNamesJson};
            const memberColors = ${memberColorsJson};

            function resolveColor(varName, fallback) {
                const resolved = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
                return resolved || fallback;
            }

            function draw() {
                const rect = canvas.getBoundingClientRect();
                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
                ctx.scale(dpr, dpr);
                ctx.clearRect(0, 0, rect.width, rect.height);

                if (dataPoints.length < 2) return;

                const fg = resolveColor('--vscode-foreground', '#ccc');
                const border = resolveColor('--vscode-panel-border', '#444');
                const pad = { top: 10, right: 16, bottom: 30, left: 40 };
                const w = rect.width - pad.left - pad.right;
                const h = rect.height - pad.top - pad.bottom;
                const maxVal = Math.max(...dataPoints.map(d => d.remaining), 1);

                const xStep = w / (dataPoints.length - 1);
                const yScale = h / maxVal;

                // Grid lines
                ctx.strokeStyle = border;
                ctx.lineWidth = 0.5;
                for (let i = 0; i <= 4; i++) {
                    const y = pad.top + (h / 4) * i;
                    ctx.beginPath();
                    ctx.moveTo(pad.left, y);
                    ctx.lineTo(pad.left + w, y);
                    ctx.stroke();
                }

                // Stacked area (bottom-up)
                for (let mi = memberNames.length - 1; mi >= 0; mi--) {
                    ctx.beginPath();
                    ctx.moveTo(pad.left, pad.top + h);
                    for (let i = 0; i < dataPoints.length; i++) {
                        let stack = 0;
                        for (let j = 0; j <= mi; j++) {
                            stack += (dataPoints[i].byMember[memberNames[j]] || 0);
                        }
                        const x = pad.left + i * xStep;
                        const y = pad.top + h - stack * yScale;
                        ctx.lineTo(x, y);
                    }
                    ctx.lineTo(pad.left + (dataPoints.length - 1) * xStep, pad.top + h);
                    ctx.closePath();
                    ctx.fillStyle = memberColors[mi] + '60';
                    ctx.fill();
                    ctx.strokeStyle = memberColors[mi];
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }

                // Total line
                ctx.beginPath();
                ctx.strokeStyle = fg;
                ctx.lineWidth = 2;
                for (let i = 0; i < dataPoints.length; i++) {
                    const x = pad.left + i * xStep;
                    const y = pad.top + h - dataPoints[i].remaining * yScale;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();

                // Axes labels
                ctx.fillStyle = fg;
                ctx.font = '10px var(--vscode-font-family, sans-serif)';
                ctx.textAlign = 'center';
                const labelCount = Math.min(dataPoints.length, 6);
                const step = Math.max(1, Math.floor(dataPoints.length / labelCount));
                for (let i = 0; i < dataPoints.length; i += step) {
                    const x = pad.left + i * xStep;
                    ctx.fillText(dataPoints[i].date.substring(5), x, pad.top + h + 18);
                }

                ctx.textAlign = 'right';
                for (let i = 0; i <= 4; i++) {
                    const y = pad.top + (h / 4) * i;
                    const val = Math.round(maxVal * (1 - i / 4));
                    ctx.fillText(String(val), pad.left - 6, y + 4);
                }
            }

            draw();
            window.addEventListener('resize', draw);
        })();
        `;
    }

    /**
     * Generates the velocity chart JavaScript showing opened vs closed issues per day.
     */
    private getVelocityChartScript(report: StandupReport): string {
        if (report.closedIssues.length === 0 && report.newIssues.length === 0) { return ''; }

        // Group issues by date
        const dateMap: Record<string, { opened: number; closed: number }> = {};

        for (const issue of report.newIssues) {
            const key = issue.createdAt.substring(0, 10);
            if (!dateMap[key]) { dateMap[key] = { opened: 0, closed: 0 }; }
            dateMap[key].opened++;
        }
        for (const issue of report.closedIssues) {
            const key = issue.closedAt ? issue.closedAt.substring(0, 10) : issue.updatedAt.substring(0, 10);
            if (!dateMap[key]) { dateMap[key] = { opened: 0, closed: 0 }; }
            dateMap[key].closed++;
        }

        const sortedDates = Object.keys(dateMap).sort();
        const velocityData = sortedDates.map(date => ({ date, ...dateMap[date] }));
        const velocityJson = JSON.stringify(velocityData).replace(/</g, '\\u003c');

        return `
        (function() {
            const canvas = document.getElementById('velocity-chart');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;
            const data = ${velocityJson};

            function resolveColor(varName, fallback) {
                const resolved = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
                return resolved || fallback;
            }

            function draw() {
                const rect = canvas.getBoundingClientRect();
                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
                ctx.scale(dpr, dpr);
                ctx.clearRect(0, 0, rect.width, rect.height);

                if (data.length === 0) return;

                const fg = resolveColor('--vscode-foreground', '#ccc');
                const border = resolveColor('--vscode-panel-border', '#444');
                const successColor = resolveColor('--vscode-testing-iconPassed', '#4ec9b0');
                const warningColor = resolveColor('--vscode-editorWarning-foreground', '#d18616');
                const pad = { top: 10, right: 16, bottom: 30, left: 40 };
                const w = rect.width - pad.left - pad.right;
                const h = rect.height - pad.top - pad.bottom;
                const maxVal = Math.max(...data.map(d => Math.max(d.opened, d.closed)), 1);

                const barGroupWidth = w / data.length;
                const barWidth = Math.max(4, barGroupWidth * 0.35);
                const yScale = h / maxVal;

                // Grid lines
                ctx.strokeStyle = border;
                ctx.lineWidth = 0.5;
                for (let i = 0; i <= 4; i++) {
                    const y = pad.top + (h / 4) * i;
                    ctx.beginPath();
                    ctx.moveTo(pad.left, y);
                    ctx.lineTo(pad.left + w, y);
                    ctx.stroke();
                }

                // Bars
                for (let i = 0; i < data.length; i++) {
                    const cx = pad.left + barGroupWidth * i + barGroupWidth / 2;

                    // Closed bar (green, left)
                    const closedH = data[i].closed * yScale;
                    ctx.fillStyle = successColor;
                    ctx.fillRect(cx - barWidth - 1, pad.top + h - closedH, barWidth, closedH);

                    // Opened bar (orange, right)
                    const openedH = data[i].opened * yScale;
                    ctx.fillStyle = warningColor;
                    ctx.fillRect(cx + 1, pad.top + h - openedH, barWidth, openedH);
                }

                // X-axis labels
                ctx.fillStyle = fg;
                ctx.font = '10px var(--vscode-font-family, sans-serif)';
                ctx.textAlign = 'center';
                const labelCount = Math.min(data.length, 6);
                const step = Math.max(1, Math.floor(data.length / labelCount));
                for (let i = 0; i < data.length; i += step) {
                    const cx = pad.left + barGroupWidth * i + barGroupWidth / 2;
                    ctx.fillText(data[i].date.substring(5), cx, pad.top + h + 18);
                }

                // Y-axis labels
                ctx.textAlign = 'right';
                for (let i = 0; i <= 4; i++) {
                    const y = pad.top + (h / 4) * i;
                    const val = Math.round(maxVal * (1 - i / 4));
                    ctx.fillText(String(val), pad.left - 6, y + 4);
                }

                // Legend
                const legendY = pad.top + 2;
                const legendX = pad.left + w - 120;
                ctx.font = '10px var(--vscode-font-family, sans-serif)';
                ctx.textAlign = 'left';
                ctx.fillStyle = successColor;
                ctx.fillRect(legendX, legendY, 10, 10);
                ctx.fillStyle = fg;
                ctx.fillText('Closed', legendX + 14, legendY + 9);
                ctx.fillStyle = warningColor;
                ctx.fillRect(legendX + 60, legendY, 10, 10);
                ctx.fillStyle = fg;
                ctx.fillText('Opened', legendX + 74, legendY + 9);
            }

            draw();
            window.addEventListener('resize', draw);
        })();
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
