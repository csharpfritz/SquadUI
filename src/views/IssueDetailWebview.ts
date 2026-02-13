/**
 * Webview panel for displaying GitHub issue details.
 * Manages panel lifecycle and renders issue content with an "Open in GitHub" action.
 */

import * as vscode from 'vscode';
import { GitHubIssue } from '../models';

export class IssueDetailWebview {
    public static readonly viewType = 'squadui.issueDetail';

    private panel: vscode.WebviewPanel | undefined;
    private readonly extensionUri: vscode.Uri;
    private currentIssue: GitHubIssue | undefined;

    constructor(extensionUri: vscode.Uri) {
        this.extensionUri = extensionUri;
    }

    /**
     * Shows the webview panel with the given issue details.
     * Creates the panel if it doesn't exist, or reveals and updates it if it does.
     */
    public show(issue: GitHubIssue): void {
        this.currentIssue = issue;

        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Two);
            this.updateContent();
        } else {
            this.createPanel();
            this.updateContent();
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
            IssueDetailWebview.viewType,
            'Issue Details',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                localResourceRoots: [this.extensionUri],
            }
        );

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });

        this.panel.webview.onDidReceiveMessage(message => {
            if (message.command === 'openExternal' && message.url) {
                vscode.env.openExternal(vscode.Uri.parse(message.url));
            }
        });
    }

    private updateContent(): void {
        if (!this.panel || !this.currentIssue) {
            return;
        }

        this.panel.title = `#${this.currentIssue.number} ${this.currentIssue.title}`;
        this.panel.webview.html = this.getHtmlContent(this.currentIssue);
    }

    private getHtmlContent(issue: GitHubIssue): string {
        const stateBadge = issue.state === 'open'
            ? { label: 'Open', class: 'badge-open' }
            : { label: 'Closed', class: 'badge-closed' };

        const labelsHtml = issue.labels.length > 0
            ? issue.labels.map(l => {
                const bg = l.color ? `#${l.color}` : 'var(--vscode-badge-background)';
                const fg = l.color ? this.getContrastColor(l.color) : 'var(--vscode-badge-foreground)';
                return `<span class="label-badge" style="background-color:${bg};color:${fg};">${this.escapeHtml(l.name)}</span>`;
            }).join(' ')
            : '';

        const bodyHtml = issue.body
            ? `<div class="body-text">${this.escapeHtml(issue.body)}</div>`
            : `<div class="no-content">No description provided</div>`;

        const assigneeHtml = issue.assignee
            ? `<span class="info-value">${this.escapeHtml(issue.assignee)}</span>`
            : `<span class="no-content">Unassigned</span>`;

        return /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
    <title>Issue #${issue.number}</title>
    <style>
        :root {
            --vscode-font: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
        }
        body {
            font-family: var(--vscode-font);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            line-height: 1.6;
        }
        h1 {
            font-size: 1.5em;
            margin: 0 0 8px 0;
            color: var(--vscode-foreground);
        }
        .open-link {
            display: inline-block;
            margin-bottom: 16px;
            padding: 6px 12px;
            background-color: var(--vscode-button-background, #0e639c);
            color: var(--vscode-button-foreground, #fff);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9em;
            text-decoration: none;
        }
        .open-link:hover {
            background-color: var(--vscode-button-hoverBackground, #1177bb);
        }
        .section {
            margin-bottom: 24px;
        }
        .section-title {
            font-size: 0.85em;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
            border-bottom: 1px solid var(--vscode-widget-border, #444);
            padding-bottom: 4px;
        }
        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: 500;
            margin-left: 8px;
            vertical-align: middle;
        }
        .badge-open {
            background-color: var(--vscode-testing-iconPassed, #1e4620);
            color: #89d185;
        }
        .badge-closed {
            background-color: #5a3271;
            color: #c9a0dc;
        }
        .label-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.8em;
            font-weight: 500;
            margin-right: 4px;
            margin-bottom: 4px;
        }
        .body-text {
            color: var(--vscode-foreground);
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .no-content {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
        .info-grid {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 4px 16px;
        }
        .info-label {
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
        }
        .info-value {
            color: var(--vscode-foreground);
        }
        .issue-number {
            color: var(--vscode-descriptionForeground);
            font-weight: normal;
        }
    </style>
</head>
<body>
    <div class="section">
        <button class="open-link" id="openInGithub">Open in GitHub →</button>
    </div>

    <div class="section">
        <h1><span class="issue-number">#${issue.number}</span> ${this.escapeHtml(issue.title)} <span class="badge ${stateBadge.class}">${stateBadge.label}</span></h1>
    </div>

    ${labelsHtml ? `<div class="section">${labelsHtml}</div>` : ''}

    <div class="section">
        <div class="section-title">Details</div>
        <div class="info-grid">
            <span class="info-label">Assignee:</span>
            ${assigneeHtml}
            <span class="info-label">Created:</span>
            <span class="info-value">${this.formatDateString(issue.createdAt)}</span>
            <span class="info-label">Updated:</span>
            <span class="info-value">${this.formatDateString(issue.updatedAt)}</span>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Description</div>
        ${bodyHtml}
    </div>

    <script>
        (function() {
            const vscode = acquireVsCodeApi();
            document.getElementById('openInGithub').addEventListener('click', function() {
                vscode.postMessage({ command: 'openExternal', url: '${this.escapeHtml(issue.htmlUrl)}' });
            });
        })();
    </script>
</body>
</html>`;
    }

    private formatDateString(isoDate: string): string {
        try {
            return new Date(isoDate).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
            });
        } catch {
            return isoDate;
        }
    }

    /**
     * Returns black or white text depending on background luminance.
     */
    private getContrastColor(hexColor: string): string {
        const r = parseInt(hexColor.substring(0, 2), 16);
        const g = parseInt(hexColor.substring(2, 4), 16);
        const b = parseInt(hexColor.substring(4, 6), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    private escapeHtml(text: string): string {
        const map: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        };
        return text.replace(/[&<>"']/g, char => map[char]);
    }
}
