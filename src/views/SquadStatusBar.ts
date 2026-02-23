/**
 * Status bar item for displaying squad health and activity.
 * Shows active member count and overall status at a glance.
 */

import * as vscode from 'vscode';
import { SquadDataProvider } from '../services/SquadDataProvider';
import { isActiveStatus } from '../models';

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
            const workingCount = members.filter(m => isActiveStatus(m.status)).length;
            
            // Show working/total member count with contextual status
            if (workingCount > 0) {
                this.statusBarItem.text = `$(organization) Squad: ${workingCount}/${totalCount} working`;
            } else {
                this.statusBarItem.text = `$(organization) Squad: ${totalCount} member${totalCount !== 1 ? 's' : ''}`;
            }
            
            // Build tooltip with member list and status
            const tooltip = new vscode.MarkdownString();
            tooltip.appendMarkdown(`**Squad**\n\n`);
            tooltip.appendMarkdown(`Members: ${totalCount} · Working: ${workingCount}\n\n`);
            
            for (const member of members) {
                const statusIndicator = member.activityContext
                    ? member.activityContext.shortLabel
                    : '—';
                tooltip.appendMarkdown(`- ${member.name} — ${member.role} · ${statusIndicator}\n`);
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
