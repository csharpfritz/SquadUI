/**
 * Status bar item for displaying squad health and activity.
 * Shows active member count and overall status at a glance.
 */

import * as vscode from 'vscode';
import { SquadDataProvider } from '../services/SquadDataProvider';

export class SquadStatusBar {
    private statusBarItem: vscode.StatusBarItem;
    private dataProvider: SquadDataProvider;
    private updateTimer: NodeJS.Timeout | undefined;

    constructor(dataProvider: SquadDataProvider) {
        this.dataProvider = dataProvider;
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.statusBarItem.command = 'squadui.openDashboard';
        this.statusBarItem.show();
        this.update();
    }

    /**
     * Updates the status bar with current squad data.
     * Call this after data changes to refresh the display.
     */
    async update(): Promise<void> {
        try {
            const members = await this.dataProvider.getSquadMembers();
            
            if (members.length === 0) {
                this.statusBarItem.text = '$(organization) Squad: Empty';
                this.statusBarItem.tooltip = 'No squad members found. Run "Squad: Init Team" to get started.';
                this.statusBarItem.backgroundColor = undefined;
                return;
            }

            const totalCount = members.length;
            
            // Simple member count — no active/idle status
            this.statusBarItem.text = `$(organization) Squad: ${totalCount} member${totalCount !== 1 ? 's' : ''}`;
            
            // Build tooltip with member list
            const tooltip = new vscode.MarkdownString();
            tooltip.appendMarkdown(`**Squad**\n\n`);
            tooltip.appendMarkdown(`Members: ${totalCount}\n\n`);
            
            for (const member of members) {
                tooltip.appendMarkdown(`- ${member.name} — ${member.role}\n`);
            }

            this.statusBarItem.tooltip = tooltip;
            this.statusBarItem.backgroundColor = undefined;
        } catch (error) {
            this.statusBarItem.text = '$(organization) Squad: Error';
            this.statusBarItem.tooltip = `Failed to load squad data: ${error}`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        }
    }

    /**
     * Starts periodic updates of the status bar.
     * @param intervalMs - Update interval in milliseconds (default: 5000)
     */
    startPolling(intervalMs: number = 5000): void {
        this.stopPolling();
        this.updateTimer = setInterval(() => this.update(), intervalMs);
    }

    /**
     * Stops periodic updates.
     */
    stopPolling(): void {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = undefined;
        }
    }

    /**
     * Cleans up resources.
     */
    dispose(): void {
        this.stopPolling();
        this.statusBarItem.dispose();
    }

}
