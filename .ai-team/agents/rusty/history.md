# Project Context

- **Owner:** Jeffrey T. Fritz (csharpfritz@users.noreply.github.com)
- **Project:** VS Code extension for visualizing Squad team members and their tasks
- **Stack:** TypeScript, VS Code Extension API, potentially GitHub Copilot integration
- **Created:** 2026-02-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-02-13: Extension Scaffolded
- Created VS Code extension foundation with TypeScript strict mode
- Extension activates on `squadMembers` tree view
- Tree view container registered in activity bar with `squadui` id
- View registered as `squadMembers` under "Team Members" name
- Uses VS Code 1.85.0+ (for latest extension API features)
- Output compiles to `./out/extension.js`

### 2026-02-13: WorkDetailsWebview Created
- Implemented `WorkDetailsWebview` class in `src/views/WorkDetailsWebview.ts`
- Panel lifecycle: createOrShow pattern, handles disposal and re-creation
- `show(workDetails)` method reveals panel and updates content
- Renders task title, description, status badge, timestamps (started/completed)
- Displays assigned member with avatar, name, role, and status badge
- VS Code themed CSS using CSS variables for dark/light mode compatibility
- HTML escaping for XSS prevention, strict Content-Security-Policy
- Exported from `src/views/index.ts`

### 2026-02-13: SquadTreeProvider Implemented (#11)
- Created `src/views/SquadTreeProvider.ts` implementing `vscode.TreeDataProvider<SquadTreeItem>`
- `SquadTreeItem` extends `vscode.TreeItem` with `member` or `task` item types
- Root level shows squad members with `$(person)` icon, `$(sync~spin)` when working
- Child level shows tasks with `$(tasklist)` icon
- `getTreeItem()`, `getChildren()`, `refresh()` methods implemented
- Uses SquadDataProvider for data access
- Exported from `src/views/index.ts`
- Tree view already registered in package.json as `squadMembers`

### 2026-02-13: Commands and Wiring Complete (#9)
- Registered `squadui.showWorkDetails` command - opens webview with task details
- Registered `squadui.refreshTree` command - manually refreshes tree view
- Commands added to `package.json` contributes.commands
- Refresh button added to view title bar via menus contribution
- Extension activation wires all components:
  - SquadDataProvider → SquadTreeProvider → Tree View
  - FileWatcherService invalidates cache and triggers tree refresh
  - Task tree items have click command to show webview
- Activation event `onView:squadMembers` already configured

### 2026-02-14: GitHub Issues in Tree View (#20)
- Extended `SquadTreeItem.itemType` to `'member' | 'task' | 'issue'`
- `SquadTreeProvider.setIssuesService()` enables late-binding of the issues service
- Issues rendered with `$(issues)` codicon — green for open, purple for closed via `ThemeColor`
- Tasks use `$(tasklist)`, issues use `$(issues)` — visually distinct child types
- `IGitHubIssuesService` interface defined in `src/models/index.ts` as the contract for issue providers
- `MemberIssueMap` type: `Map<string, GitHubIssue[]>` keyed by member name
- `squadui.openIssue` command registered — uses `vscode.env.openExternal(vscode.Uri.parse(url))`
- `SquadDataProvider.getWorkspaceRoot()` added to expose team root path
- Graceful degradation pattern: `getIssueItems()` catches errors and returns `[]` when service unavailable
- Squad labels (`squad:{name}`) filtered out of issue description text to avoid redundancy
