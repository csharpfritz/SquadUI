---
name: "vscode-status-bar-coordination"
description: "Pattern for coordinating VS Code status bar updates with tree view and data provider refresh cycles"
domain: "vscode-extensions"
confidence: "low"
source: "earned"
---

## Context
VS Code extensions with tree views often need a companion status bar item to provide at-a-glance information. The status bar should stay synchronized with tree data and update whenever the underlying data changes (file watcher events, user commands, data provider refreshes).

## Patterns

### Shared Data Provider Architecture
Both the tree provider and status bar should consume the same data provider instance. This ensures consistency and avoids duplicate data fetching.

```typescript
const dataProvider = new SquadDataProvider(workspaceRoot);
const treeProvider = new SquadTreeProvider(dataProvider);
const statusBar = new SquadStatusBar(dataProvider);
```

### Status Bar Update on All Refresh Paths
Every code path that triggers a tree refresh should also update the status bar. This includes:
- User commands (refresh, add/remove items, init)
- File watcher events
- Manual data provider refreshes

```typescript
// File watcher coordination
fileWatcher.onFileChange(() => {
    treeProvider.refresh();
    statusBar?.update();
});

// Command coordination
vscode.commands.registerCommand('myext.refresh', () => {
    dataProvider.refresh();
    treeProvider.refresh();
    statusBar?.update();
});
```

### Lifecycle Management
Status bar items must be disposed when the extension deactivates. Track the instance and include it in the deactivate cleanup.

```typescript
let statusBar: MyStatusBar | undefined;

export function activate(context: vscode.ExtensionContext) {
    statusBar = new MyStatusBar(dataProvider);
    context.subscriptions.push(statusBar);
}

export function deactivate() {
    statusBar?.dispose();
}
```

### Rich Tooltips with Markdown
Use `vscode.MarkdownString` for status bar tooltips to provide structured, multi-line details that complement the compact status bar text.

```typescript
const tooltip = new vscode.MarkdownString();
tooltip.appendMarkdown(`**Status Summary**\n\n`);
tooltip.appendMarkdown(`Active: ${count}\n\n`);
this.statusBarItem.tooltip = tooltip;
```

### Visual Health Indicators
Use emoji or themed icons in status bar text for immediate visual feedback. Emoji work across all themes without custom icon management.

```typescript
// Health indicator example
private getHealthIcon(activeCount: number, total: number): string {
    const ratio = activeCount / total;
    if (ratio >= 0.7) return '🟢';
    if (ratio >= 0.3) return '🟡';
    return '🟠';
}

this.statusBarItem.text = `$(icon) Status: ${count} ${this.getHealthIcon(count, total)}`;
```

## Anti-Patterns
- Don't update status bar without updating tree view — creates inconsistent state
- Don't forget to wire command callbacks — status bar will show stale data after user actions
- Don't make status bar updates sync in activation — use async update() and let it resolve later
- Don't hardcode status bar alignment priority — use reasonable values (e.g., 100) to avoid conflicts

## When to Use
- Extension has a tree view showing detailed data but needs summary-level visibility
- Users need at-a-glance health/status without expanding the tree
- Multiple data sources need coordinated refresh (logs, APIs, file system)
- Status changes frequently and users benefit from ambient awareness
