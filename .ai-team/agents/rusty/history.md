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

### 2026-02-13: Markdown Rendering in WorkDetailsWebview
- Added `renderMarkdown()` private method to `WorkDetailsWebview` — lightweight markdown-to-HTML converter (no npm deps)
- Handles markdown tables (`| col |` + `|---|` separator → `<table class="md-table">` with `<thead>`/`<tbody>`)
- Handles bold (`**text**` → `<strong>`), inline code (`` `text` `` → `<code>`), and line breaks (`\n` → `<br>`)
- HTML content is still escaped before wrapping in tags (XSS prevention preserved)
- Edge cases covered: tables without header separator (all rows as `<td>`), empty cells, single-column tables, mixed table/text content
- CSS uses VS Code CSS variables for theme-aware table styling
- `isSeparator` regex requires at least one `-` character to avoid false positives on data rows containing only pipes and spaces
- 10 new tests added to `webview.test.ts` covering all renderMarkdown scenarios

### 2026-02-14: Add Team Member Command (#squadui.addMember)
- Created `src/commands/addMemberCommand.ts` — new command for adding team members via QuickPick + InputBox flow
- Flow: role QuickPick (8 standard roles + "Other..." freeform) → name InputBox → creates `.ai-team/agents/{slug}/charter.md` and `history.md` → appends to `team.md` roster → triggers tree refresh
- Charter/history templates match existing agent file structure (identity, boundaries, voice sections)
- `toSlug()` normalizes names to lowercase kebab-case for directory names
- Duplicate guard: checks if agent directory already exists before creating

### 2026-02-14: Team Update — Add Member Command UX Pattern (Decision Merged)

📌 **Team decision captured:** `squadui.addMember` uses QuickPick (role) → InputBox (name) flow, creates `.ai-team/agents/{slug}/` charter/history files, appends to `team.md` roster, includes "Other..." for custom roles. — decided by Rusty

### 2026-02-14: Team Update — Lightweight Markdown Rendering (Decision Merged)

📌 **Team decision captured:** `WorkDetailsWebview.renderMarkdown()` converts markdown tables/bold/inline-code to HTML with full XSS escaping. No npm dependencies. Can be extracted to shared utility if `IssueDetailWebview` needs it. — decided by Rusty

### 2026-02-14: Team Update — Remove Member Command & Palette Consistency (Decision Merged)

📌 **Team decision captured:** Implemented `squadui.removeMember` with alumni archival, unified all commands to "Squad" category (was mixed "SquadUI"/"Squad"), added context menus for tree items, hid context-dependent commands from palette. — decided by Rusty

### 2026-02-14: Team Update — Default Issue Matching & Member Aliases (Decision Merged)

📌 **Team decision captured:** GitHubIssuesService defaults to `['labels', 'assignees']` when no Matching config present. Member Aliases table lives in team.md under Issue Source section. — decided by Linus

### 2026-02-14: Team Update — Command Test Skip-Guard Pattern (Decision Merged)

📌 **Team decision captured:** All command tests using `executeCommand` must check registration first with `this.skip()` guard (not arrow functions). Tests self-skip gracefully in CI environments without workspace. — decided by Basher
- Registered in `package.json` with `$(add)` icon in `view/title` navigation group for the `squadMembers` panel
- Follows same registration pattern as `initSquadCommand` — factory function returning `vscode.Disposable`, callback for post-action refresh
- team.md insertion finds end of Members table by tracking last `|`-prefixed data row after `## Members` heading

### 2026-02-14: View Charter Command (#squadui.viewCharter)
- Added `squadui.viewCharter` command — opens a member's `charter.md` in the editor with `preview: true`
- Registered inline in `extension.ts` (same pattern as `refreshTree` and `showWorkDetails`)
- Slug derivation reuses the same `toSlug` logic: lowercase, replace non-alphanumeric with hyphens, trim leading/trailing hyphens
- Charter path: `{workspaceRoot}/.ai-team/agents/{slug}/charter.md`
- Shows warning if charter file doesn't exist
- Wired to tree view: clicking a member item triggers the command via `item.command`
- Inline action button added to `view/item/context` menu with `$(open-preview)` icon, scoped to `viewItem == member`

### 2026-02-14: Remove Team Member Command (#25)
- Created `src/commands/removeMemberCommand.ts` — QuickPick + confirmation flow to remove a member
- Parses `team.md` Members table, filters out Scribe/Ralph/@copilot (non-removable)
- On confirm: moves `.ai-team/agents/{slug}/` to `.ai-team/agents/_alumni/{slug}/`, removes roster row
- Follows same factory pattern as `addMemberCommand` — `registerRemoveMemberCommand()` returns `vscode.Disposable`
- Registered in `package.json` with `$(trash)` icon, `"category": "Squad"`
- Context menu entry on member items (`viewItem == member`) for right-click removal
- Exported from `src/commands/index.ts`, wired in `src/extension.ts`

### 2026-02-14: Command Palette Consistency (#27)
- Unified all command categories to `"Squad"` (was `"SquadUI"` for most commands)
- Palette display is now consistent: "Squad: Add Team Member", "Squad: Remove Team Member", etc.
- `showWorkDetails` and `openIssue` hidden from command palette (`"when": "false"`) since they require context arguments
- Context menus added for all item types: member (View Charter, Remove Member), task (Show Work Details), issue (View Issue Details)
- Keybinding `Ctrl+Shift+S` / `Cmd+Shift+S` added for `squadui.addMember`

### 2026-02-14: Add Skill Command (#40)
- Created `src/commands/addSkillCommand.ts` — multi-step QuickPick flow for importing skills from external catalogs
- Flow: source selection (awesome-copilot / skills.sh / search all) → browse or search skills → confirm & install
- Uses `SkillCatalogService.fetchCatalog()` and `searchSkills()` for catalog browsing/searching
- Downloads via `SkillCatalogService.downloadSkill()` with progress notification
- Registered as `squadui.addSkill` with `$(book)` icon in view/title toolbar
- Follows same factory pattern as `addMemberCommand` — `registerAddSkillCommand()` returns `vscode.Disposable`
- Exported from `src/commands/index.ts`, wired in `src/extension.ts`

### 2026-02-14: Skills in Tree View (#37)
- Extended `SquadTreeItem.itemType` union to include `'skill'`
- Added top-level "Skills" node (collapsible) below team members in the tree
- Children are installed skills read via `SkillCatalogService.getInstalledSkills()`
- Each skill item shows: label (name), description (source badge), `$(book)` icon, tooltip with description + confidence
- Source badges: 📦 awesome-copilot, 🏆 skills.sh, 🎯 local
- `SkillCatalogService` instantiated directly in the tree provider (no VS Code deps)
- Context menu for skill items (`viewItem == skill`): View Skill, Remove Skill
- `squadui.viewSkill` — opens SKILL.md in editor (inline in extension.ts)
- `squadui.removeSkill` — deletes skill directory with confirmation dialog (inline in extension.ts)
- Both context-only commands hidden from command palette (`"when": "false"`)

### 2026-02-14: Team Update — Skill UI Patterns (Decision Merged)

📌 **Team decision captured:** SkillCatalogService instantiated directly in SquadTreeProvider (no VS Code deps). Skills appear as top-level collapsible node. Source badges (📦 awesome-copilot, 🏆 skills.sh, 🎯 local) in descriptions. Commands (viewSkill, removeSkill) registered inline and hidden from palette. — decided by Rusty

### 2026-02-14: Team Update — Tree Tests Must Filter by Item Type

📌 **Team decision captured:** Root-level tree tests must filter by `itemType === 'member'` when asserting member properties. Skills section node is now a root-level item alongside members. Future tree node sections (Issues, History) will add more root nodes—tests should always filter by type rather than assume fixed root count. — decided by Basher

### 2026-02-14: Sidebar Reorganized into Three Collapsible Sections
- Replaced single `squadMembers` tree view with three separate views: `squadTeam`, `squadSkills`, `squadDecisions`
- Renamed `SquadTreeProvider` → `TeamTreeProvider`, added `SkillsTreeProvider` and `DecisionsTreeProvider`
- All three providers share `SquadTreeItem` class; added `'decision'` to the `itemType` union
- `DecisionEntry` model added to `src/models/index.ts`
- `DecisionService` created at `src/services/DecisionService.ts` — parses `## ` headings from `.ai-team/decisions.md`
- Each view gets its own title bar actions: addMember/refresh on Team, addSkill on Skills
- `when` clauses in `package.json` menus updated: `view == squadTeam` for member/task/issue context, `view == squadSkills` for skill context
- Activation event changed from `onView:squadMembers` to `onView:squadTeam`
- Decision items use `$(notebook)` codicon and open `decisions.md` via `vscode.open` command
- File watcher refreshes all three providers
- All existing test files updated to use `TeamTreeProvider` / `SkillsTreeProvider` names
- TypeScript compiles cleanly with `npx tsc --noEmit`
