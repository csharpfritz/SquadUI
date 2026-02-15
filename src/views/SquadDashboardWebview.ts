/**
 * Webview panel for the Squad Dashboard.
 * Hosts three tabs: Velocity, Activity Timeline, and Decision Browser.
 */

import * as vscode from 'vscode';
import { DashboardData } from '../models';
import { DashboardDataBuilder } from './dashboard/DashboardDataBuilder';
import { getDashboardHtml } from './dashboard/htmlTemplate';
import { SquadDataProvider } from '../services';

export class SquadDashboardWebview {
    public static readonly viewType = 'squadui.dashboard';

    private panel: vscode.WebviewPanel | undefined;
    private readonly extensionUri: vscode.Uri;
    private readonly dataProvider: SquadDataProvider;
    private readonly dataBuilder: DashboardDataBuilder;

    constructor(extensionUri: vscode.Uri, dataProvider: SquadDataProvider) {
        this.extensionUri = extensionUri;
        this.dataProvider = dataProvider;
        this.dataBuilder = new DashboardDataBuilder();
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

            // Build dashboard data
            const dashboardData: DashboardData = this.dataBuilder.buildDashboardData(
                logEntries,
                members,
                tasks,
                decisions
            );

            // Render HTML
            this.panel.webview.html = getDashboardHtml(dashboardData);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.panel.webview.html = this.getErrorHtml(errorMessage);
        }
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
