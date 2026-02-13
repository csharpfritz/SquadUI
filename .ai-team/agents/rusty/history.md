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
### 2026-02-14: Team Update — CI Pipeline Enhanced (Decision Merged)

📌 **Team decision merged:** CI pipeline now uses Node 18.x with concurrency control to prevent duplicate runs on the same branch. — decided by Livingston

### 2026-02-14: Team Update — SquadDataProvider team.md Fallback (Decision Merged)

📌 **Team decision accepted:** SquadDataProvider now reads team.md as authoritative member roster, falling back to log participants if team.md is missing. This ensures the tree view shows members even on first load with no orchestration logs. — decided by Linus

### 2026-02-14: Completed Issues Section & Issue Detail Webview
- Added `getClosedIssuesByMember` to `IGitHubIssuesService` interface in `src/models/index.ts`
- Extended `SquadTreeProvider` with `getClosedIssueItems()` — completed issues shown per member with `$(pass)` icon and `descriptionForeground` muted color
- Created `src/views/IssueDetailWebview.ts` — webview panel showing issue title, state badge, labels as colored badges, body text, assignee, and "Open in GitHub →" button
- IssueDetailWebview uses `enableScripts: true` with `postMessage` pattern for the GitHub link (standard VS Code webview approach)
- Updated `squadui.openIssue` command to accept optional `GitHubIssue` object; shows webview when present, falls back to `openExternal` for URL-only calls
- Tree items now pass full `GitHubIssue` as second argument to the command
- CSP: `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';`
- Label badges use GitHub label colors with contrast-aware text color
- Exported `IssueDetailWebview` from `src/views/index.ts`

### 2026-02-13: Team Update — Interface Contract for Issues Service

📌 **Team decision merged (2026-02-13):** `IGitHubIssuesService` interface decouples tree view from issues service implementation, enabling graceful degradation and late binding. — decided by Rusty

### 2026-02-13: Team Update — Issue Icons & Filtering

📌 **Team decision merged (2026-02-13):** Issues use `$(issues)` codicon with theme color tinting (green for open, purple for closed). Squad labels are filtered from issue display to avoid redundancy. — decided by Rusty

### 2026-02-13: Team Update — Release Pipeline Workflow

📌 **Team decision merged (2026-02-13):** Release pipeline (`release.yml`) is self-contained with its own CI steps, tag-based trigger, version verification gate, and marketplace publish via VSCE_PAT secret. — decided by Livingston

### 2026-02-13: Team Update — GitHub Issues Service uses https & squad: labels

📌 **Team decision merged (2026-02-13):** GitHubIssuesService uses Node.js `https` module with optional auth token and 5-minute cache TTL. Squad labels use `squad:{member}` convention for issue-to-member mapping. — decided by Linus

### 2026-02-13: Team Update — Closed Issues Fetching Strategy

📌 **Team decision merged (2026-02-13):** Closed issues use separate cache, 50-issue limit (no pagination), and case-insensitive member matching. `getClosedIssuesByMember` added to service interface. — decided by Linus
### 2026-02-14: Team Update — GitHub Issues & Webview Architecture Decisions (Decision Merged)

📌 **Team decisions captured:** 
- (1) IGitHubIssuesService interface contract for tree view decoupling from concrete implementation 
- (2) Issue icons use $(issues) codicon with ThemeColor (charts.green open, charts.purple closed) 
- (3) Squad labels (squad:*) filtered from issue description display since they're structural, not informational 
- (4) Issue detail webview uses postMessage pattern for external links; command accepts optional full issue object for backward compatibility 
- decided by Rusty
