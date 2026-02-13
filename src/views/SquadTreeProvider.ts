/**
 * Tree data provider for displaying squad members and their tasks.
 */

import * as vscode from 'vscode';
import { SquadMember, Task } from '../models';
import { SquadDataProvider } from '../services/SquadDataProvider';

/**
 * Represents an item in the squad tree view.
 * Can be either a squad member (parent) or a task (child).
 */
export class SquadTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'member' | 'task',
        public readonly memberId?: string,
        public readonly taskId?: string
    ) {
        super(label, collapsibleState);
        this.contextValue = itemType;
    }
}

/**
 * Provides tree data for the squad members view.
 * Top-level items are squad members, children are their assigned tasks.
 */
export class SquadTreeProvider implements vscode.TreeDataProvider<SquadTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<SquadTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private dataProvider: SquadDataProvider) {}

    /**
     * Fires the tree data change event to refresh the view.
     */
    refresh(): void {
        this.dataProvider.refresh();
        this._onDidChangeTreeData.fire();
    }

    /**
     * Returns the tree item for display.
     */
    getTreeItem(element: SquadTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Returns children for the given element.
     * If no element, returns squad members (root level).
     * If element is a member, returns their tasks.
     */
    async getChildren(element?: SquadTreeItem): Promise<SquadTreeItem[]> {
        if (!element) {
            // Root level: return squad members
            return this.getSquadMemberItems();
        }

        if (element.itemType === 'member' && element.memberId) {
            // Member level: return tasks for this member
            return this.getTaskItems(element.memberId);
        }

        return [];
    }

    private async getSquadMemberItems(): Promise<SquadTreeItem[]> {
        const members = await this.dataProvider.getSquadMembers();
        
        return members.map(member => {
            const item = new SquadTreeItem(
                member.name,
                vscode.TreeItemCollapsibleState.Collapsed,
                'member',
                member.name
            );

            // Set icon based on status
            item.iconPath = new vscode.ThemeIcon(
                member.status === 'working' ? 'sync~spin' : 'person'
            );
            
            // Show role and status in description
            item.description = `${member.role} • ${member.status}`;
            item.tooltip = this.getMemberTooltip(member);

            return item;
        });
    }

    private async getTaskItems(memberId: string): Promise<SquadTreeItem[]> {
        const tasks = await this.dataProvider.getTasksForMember(memberId);

        return tasks.map(task => {
            const item = new SquadTreeItem(
                task.title,
                vscode.TreeItemCollapsibleState.None,
                'task',
                memberId,
                task.id
            );

            item.iconPath = new vscode.ThemeIcon('tasklist');
            item.description = task.status;
            item.tooltip = this.getTaskTooltip(task);
            
            // Wire click to show work details
            item.command = {
                command: 'squadui.showWorkDetails',
                title: 'Show Work Details',
                arguments: [task.id]
            };

            return item;
        });
    }

    private getMemberTooltip(member: SquadMember): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**${member.name}**\n\n`);
        md.appendMarkdown(`Role: ${member.role}\n\n`);
        md.appendMarkdown(`Status: ${member.status}`);
        if (member.currentTask) {
            md.appendMarkdown(`\n\nCurrent Task: ${member.currentTask.title}`);
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
}
