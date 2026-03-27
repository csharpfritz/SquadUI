/**
 * Tree data provider for displaying Squad routing rules.
 * Shows which agent handles which types of work, parsed from routing.md via the SDK.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { RoutingRule } from '../models';
import { parseRoutingRules, adaptRoutingRules } from '../sdk-adapter';

/**
 * Represents an item in the routing rules tree view.
 */
export class RoutingRuleItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'rule' | 'agent' | 'example' | 'empty',
    ) {
        super(label, collapsibleState);
        this.contextValue = itemType;
    }
}

/**
 * Provides tree data for routing rules display.
 * Reads routing.md from the squad folder and uses the SDK to parse it.
 */
export class RoutingRulesTreeProvider implements vscode.TreeDataProvider<RoutingRuleItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<RoutingRuleItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private rules: RoutingRule[] = [];
    private loaded = false;

    constructor(
        private workspaceRoot: string,
        private squadFolder: '.squad' | '.ai-team',
    ) {}

    refresh(): void {
        this.loaded = false;
        this.rules = [];
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: RoutingRuleItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: RoutingRuleItem): Promise<RoutingRuleItem[]> {
        if (!element) {
            return this.getRootItems();
        }
        return this.getChildItems(element);
    }

    private async getRootItems(): Promise<RoutingRuleItem[]> {
        if (!this.loaded) {
            await this.loadRules();
        }

        if (this.rules.length === 0) {
            const empty = new RoutingRuleItem(
                'No routing rules found',
                vscode.TreeItemCollapsibleState.None,
                'empty',
            );
            empty.description = 'Add routing.md to define rules';
            return [empty];
        }

        return this.rules.map(rule => {
            const item = new RoutingRuleItem(
                rule.workType,
                vscode.TreeItemCollapsibleState.Collapsed,
                'rule',
            );
            item.description = `→ ${rule.agents.join(', ')}`;
            item.iconPath = new vscode.ThemeIcon('arrow-swap');
            item.tooltip = new vscode.MarkdownString(
                `**${rule.workType}**\n\nRoutes to: ${rule.agents.join(', ')}` +
                (rule.examples.length > 0 ? `\n\nExamples:\n${rule.examples.map(e => `- ${e}`).join('\n')}` : ''),
            );
            return item;
        });
    }

    private getChildItems(parent: RoutingRuleItem): RoutingRuleItem[] {
        if (parent.itemType !== 'rule') {
            return [];
        }

        const rule = this.rules.find(r => r.workType === parent.label);
        if (!rule) {
            return [];
        }

        const children: RoutingRuleItem[] = [];

        // Agent entries
        for (const agent of rule.agents) {
            const agentItem = new RoutingRuleItem(
                agent,
                vscode.TreeItemCollapsibleState.None,
                'agent',
            );
            agentItem.iconPath = new vscode.ThemeIcon('person');
            agentItem.description = 'Agent';
            children.push(agentItem);
        }

        // Example entries
        for (const example of rule.examples) {
            const exampleItem = new RoutingRuleItem(
                example,
                vscode.TreeItemCollapsibleState.None,
                'example',
            );
            exampleItem.iconPath = new vscode.ThemeIcon('info');
            exampleItem.description = 'Example';
            children.push(exampleItem);
        }

        return children;
    }

    private async loadRules(): Promise<void> {
        this.loaded = true;
        this.rules = [];

        const routingPath = path.join(this.workspaceRoot, this.squadFolder, 'routing.md');
        if (!fs.existsSync(routingPath)) {
            return;
        }

        try {
            const content = fs.readFileSync(routingPath, 'utf-8');
            const result = await parseRoutingRules(content);
            this.rules = adaptRoutingRules(result.rules);
        } catch {
            // SDK parse failure — rules remain empty
        }
    }

    /** Returns the currently loaded routing rules (for testing/external access). */
    getRules(): RoutingRule[] {
        return this.rules;
    }

    /** Returns the routing.md path for this workspace. */
    getRoutingPath(): string {
        return path.join(this.workspaceRoot, this.squadFolder, 'routing.md');
    }
}
