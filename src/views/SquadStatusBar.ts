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

            const activeCount = members.filter(m => m.status === 'working').length;
            const totalCount = members.length;

            // Determine overall health status
            const statusIcon = this.getHealthIcon(activeCount, totalCount);
            
            // Format display text
            this.statusBarItem.text = `$(organization) Squad: ${activeCount}/${totalCount} Active ${statusIcon}`;
            
            // Build tooltip with member details
            const tooltip = new vscode.MarkdownString();
            tooltip.appendMarkdown(`**Squad Status**\n\n`);
            tooltip.appendMarkdown(`Active: ${activeCount} / ${totalCount}\n\n`);
            
            if (activeCount > 0) {
                tooltip.appendMarkdown(`**Working:**\n`);
                const workingMembers = members.filter(m => m.status === 'working');
                for (const member of workingMembers) {
                    const taskInfo = member.currentTask ? ` - ${member.currentTask.title}` : '';
                    tooltip.appendMarkdown(`- ${member.name}${taskInfo}\n`);
                }
            }
            
            const idleCount = totalCount - activeCount;
            if (idleCount > 0) {
                tooltip.appendMarkdown(`\n**Idle:** ${idleCount}\n`);
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

    private getHealthIcon(activeCount: number, totalCount: number): string {
        if (activeCount === 0) {
            return '⚪'; // All idle
        }
        
        const ratio = activeCount / totalCount;
        if (ratio >= 0.7) {
            return '🟢'; // High activity
        } else if (ratio >= 0.3) {
            return '🟡'; // Moderate activity
        } else {
            return '🟠'; // Low activity
        }
    }
}
