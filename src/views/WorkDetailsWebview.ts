/**
 * Webview panel for displaying work/task details.
 * Manages panel lifecycle and renders task + member information.
 */

import * as vscode from 'vscode';
import { WorkDetails, TaskStatus, MemberStatus } from '../models';

export class WorkDetailsWebview {
    public static readonly viewType = 'squadui.workDetails';

    private panel: vscode.WebviewPanel | undefined;
    private readonly extensionUri: vscode.Uri;
    private currentWorkDetails: WorkDetails | undefined;

    constructor(extensionUri: vscode.Uri) {
        this.extensionUri = extensionUri;
    }

    /**
     * Shows the webview panel with the given work details.
     * Creates the panel if it doesn't exist, or reveals and updates it if it does.
     */
    public show(workDetails: WorkDetails): void {
        this.currentWorkDetails = workDetails;

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
            WorkDetailsWebview.viewType,
            'Work Details',
            vscode.ViewColumn.Two,
            {
                enableScripts: false,
                localResourceRoots: [this.extensionUri],
            }
        );

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    private updateContent(): void {
        if (!this.panel || !this.currentWorkDetails) {
            return;
        }

        this.panel.title = this.currentWorkDetails.task.title;
        this.panel.webview.html = this.getHtmlContent(this.currentWorkDetails);
    }

    private getHtmlContent(workDetails: WorkDetails): string {
        const { task, member } = workDetails;

        const statusBadge = this.getStatusBadge(task.status);
        const memberStatusBadge = this.getMemberStatusBadge(member.status);
        const startedAt = task.startedAt ? this.formatDate(task.startedAt) : 'Not started';
        const completedAt = task.completedAt ? this.formatDate(task.completedAt) : '—';

        return /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
    <title>Work Details</title>
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
        }
        .badge-pending {
            background-color: var(--vscode-inputValidation-warningBackground, #5a4a00);
            color: var(--vscode-inputValidation-warningForeground, #cca700);
        }
        .badge-in-progress {
            background-color: var(--vscode-inputValidation-infoBackground, #063b49);
            color: var(--vscode-inputValidation-infoForeground, #3794ff);
        }
        .badge-completed {
            background-color: var(--vscode-testing-iconPassed, #1e4620);
            color: #89d185;
        }
        .badge-working {
            background-color: var(--vscode-inputValidation-infoBackground, #063b49);
            color: var(--vscode-inputValidation-infoForeground, #3794ff);
        }
        .badge-idle {
            background-color: var(--vscode-badge-background, #4d4d4d);
            color: var(--vscode-badge-foreground, #fff);
        }
        .description {
            color: var(--vscode-foreground);
            white-space: pre-wrap;
        }
        .md-table {
            width: 100%;
            border-collapse: collapse;
            margin: 8px 0;
            font-size: 13px;
        }
        .md-table th, .md-table td {
            border: 1px solid var(--vscode-panel-border, #333);
            padding: 6px 10px;
            text-align: left;
        }
        .md-table th {
            background: var(--vscode-editor-background, #1e1e1e);
            font-weight: 600;
        }
        .md-table td {
            background: var(--vscode-sideBar-background, #252526);
        }
        .no-description {
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
        .member-card {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background-color: var(--vscode-editor-inactiveSelectionBackground, #3a3d41);
            border-radius: 6px;
        }
        .member-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background-color: var(--vscode-button-background, #0e639c);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2em;
            font-weight: 600;
            color: var(--vscode-button-foreground, #fff);
        }
        .member-info {
            flex: 1;
        }
        .member-name {
            font-weight: 600;
            margin-bottom: 2px;
        }
        .member-role {
            font-size: 0.85em;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="section">
        <h1>${this.escapeHtml(task.title)}</h1>
        <span class="badge ${statusBadge.class}">${statusBadge.label}</span>
    </div>

    <div class="section">
        <div class="section-title">Description</div>
        ${task.description 
            ? `<div class="description">${this.renderMarkdown(task.description)}</div>`
            : `<div class="no-description">No description provided</div>`
        }
    </div>

    <div class="section">
        <div class="section-title">Timestamps</div>
        <div class="info-grid">
            <span class="info-label">Started:</span>
            <span class="info-value">${startedAt}</span>
            <span class="info-label">Completed:</span>
            <span class="info-value">${completedAt}</span>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Assigned To</div>
        <div class="member-card">
            <div class="member-avatar">${this.getInitials(member.name)}</div>
            <div class="member-info">
                <div class="member-name">${this.escapeHtml(member.name)}</div>
                <div class="member-role">${this.escapeHtml(member.role)}</div>
            </div>
            <span class="badge ${memberStatusBadge.class}">${memberStatusBadge.label}</span>
        </div>
    </div>
</body>
</html>`;
    }

    private getStatusBadge(status: TaskStatus): { label: string; class: string } {
        switch (status) {
            case 'pending':
                return { label: 'Pending', class: 'badge-pending' };
            case 'in_progress':
                return { label: 'In Progress', class: 'badge-in-progress' };
            case 'completed':
                return { label: 'Completed', class: 'badge-completed' };
        }
    }

    private getMemberStatusBadge(status: MemberStatus): { label: string; class: string } {
        switch (status) {
            case 'working':
                return { label: 'Working', class: 'badge-working' };
            case 'idle':
                return { label: 'Idle', class: 'badge-idle' };
        }
    }

    private formatDate(date: Date): string {
        return date.toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
        });
    }

    private getInitials(name: string): string {
        return name
            .split(' ')
            .map(part => part.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('');
    }

    /**
     * Lightweight markdown-to-HTML converter for task descriptions.
     * Handles tables, bold, inline code, and line breaks.
     */
    private renderMarkdown(text: string): string {
        const lines = text.split('\n');
        const result: string[] = [];
        let i = 0;

        while (i < lines.length) {
            // Detect markdown table block (lines starting with |)
            if (lines[i].trim().startsWith('|')) {
                const tableLines: string[] = [];
                while (i < lines.length && lines[i].trim().startsWith('|')) {
                    tableLines.push(lines[i]);
                    i++;
                }
                result.push(this.renderTable(tableLines));
            } else {
                result.push(this.renderInline(this.escapeHtml(lines[i])));
                i++;
            }
        }

        return result.join('<br>');
    }

    private renderTable(lines: string[]): string {
        if (lines.length === 0) { return ''; }

        const parseCells = (line: string): string[] => {
            return line.trim()
                .replace(/^\|/, '').replace(/\|$/, '')
                .split('|')
                .map(cell => cell.trim());
        };

        const isSeparator = (line: string): boolean => {
            const trimmed = line.trim();
            return /^\|[\s\-:|]+\|$/.test(trimmed) && /-/.test(trimmed);
        };

        // Check if second line is a separator row
        const hasSeparator = lines.length >= 2 && isSeparator(lines[1]);
        const headerCells = parseCells(lines[0]);

        let html = '<table class="md-table">';

        if (hasSeparator) {
            html += '<thead><tr>';
            for (const cell of headerCells) {
                html += `<th>${this.renderInline(this.escapeHtml(cell))}</th>`;
            }
            html += '</tr></thead><tbody>';

            for (let j = 2; j < lines.length; j++) {
                if (isSeparator(lines[j])) { continue; }
                const cells = parseCells(lines[j]);
                html += '<tr>';
                for (let k = 0; k < headerCells.length; k++) {
                    html += `<td>${this.renderInline(this.escapeHtml(cells[k] ?? ''))}</td>`;
                }
                html += '</tr>';
            }
            html += '</tbody>';
        } else {
            // No separator — treat all rows as body
            html += '<tbody>';
            for (const line of lines) {
                const cells = parseCells(line);
                html += '<tr>';
                for (const cell of cells) {
                    html += `<td>${this.renderInline(this.escapeHtml(cell))}</td>`;
                }
                html += '</tr>';
            }
            html += '</tbody>';
        }

        html += '</table>';
        return html;
    }

    private renderInline(escaped: string): string {
        // Bold: **text** (already HTML-escaped, so no < > inside)
        escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Inline code: `text`
        escaped = escaped.replace(/`(.+?)`/g, '<code>$1</code>');
        return escaped;
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
