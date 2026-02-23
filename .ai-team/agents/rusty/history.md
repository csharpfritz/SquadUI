# Project Context

- **Owner:** Jeffrey T. Fritz (csharpfritz@users.noreply.github.com)
- **Project:** VS Code extension for visualizing Squad team members and their tasks
- **Stack:** TypeScript, VS Code Extension API, potentially GitHub Copilot integration
- **Created:** 2026-02-13

## Learnings Summary

### Dashboard Enhancements (2026-02-15)
- **Decisions null-safety fix:** Added null-coalescing (d.content || '').toLowerCase() and (d.author || '').toLowerCase() to prevent TypeError crashes
- **Recent Activity in sidebar:** Collapsible section showing 10 most recent orchestration log entries; topic truncated to 60 chars, date as description, notebook icon; command squadui.openLogEntry hidden from palette
- **Recent Sessions in Activity tab:** Panel below swimlanes, last 10 log entries as clickable cards; DashboardData.activity extended with ecentLogs field
- **Activity card click handler:** Searches both .ai-team/log/ and .ai-team/orchestration-log/ directories for matching file

### Add Skill Feature QA & Re-enable (2026-02-15)
- **Error handling improved:** Changed service layer to throw exceptions on network failures instead of silent empty arrays
- **Feature re-enabled:** Removed when: false from commandPalette, added Add Skill button to Skills panel toolbar
- **Implementation quality:** Multi-step QuickPick flow solid, cancellation handling works at every step, loading indicators use withProgress, deduplication logic works

### Skill Catalog Bug Fixes (2026-02-15)
1. **awesome-copilot URL 404:** Repo moved from radygaster/awesome-copilot to github/awesome-copilot; updated in etchAwesomeCopilot()
2. **skills.sh parser garbage:** Rewrote parseSkillsShHtml() to match actual leaderboard pattern (<a href="/{owner}/{repo}/{skill}"> with <h3> and <p>) to prevent nav/logo/tab label noise
3. **Search crash on empty descriptions:** Added null-coalescing in searchSkills() filter

### Sidebar Label Fixes (2026-02-15)
- **Skill prefix stripping:** parseInstalledSkill() strips "Skill: " prefix (case-insensitive) from heading names
- **Skill click error fix:** Changed SkillsTreeProvider.getSkillItems() arguments from [skill.name]  [skill.slug] to pass directory name instead of display name

### Init Redesign (2026-02-15)
 Init redesign now absorbs issue #26 (universe selector) into native VS Code init flow. Universe selection becomes step 1 of init wizard instead of standalone command  decided by Danny

### 2026-02-15 Team Updates
 User directive  releases require explicit human approval before tagging/publishing  decided by Jeffrey T. Fritz
 Dashboard Chart & Decisions Rendering Fixes (canvas colors, axis labels, empty state)  decided by Rusty
 Dashboard decisions sort order  decisions list on dashboard should be sorted most-recent first  decided by Jeffrey T. Fritz
 Add Skill Error Handling  network failures now throw exceptions for better UX instead of silent empty arrays  decided by Rusty
 Backlog Audit and Issue Cleanup  issues #27, #37, #38 closed; backlog triaged for v0.6.0 sprint  decided by Danny
 Markdown link handling utility  separates display text extraction (for tree view) from HTML rendering (for dashboard webviews)  decided by Rusty

### File Watcher Broadening & Agent Mode Chat (2026-02-15)
- **FileWatcherService WATCH_PATTERN:** Changed from `**/.ai-team/orchestration-log/**/*.md` to `**/.ai-team/**/*.md` — covers team.md, charters, decisions, skills, and orchestration logs. Debounce already in place prevents thrashing.
- **addMemberCommand chat API:** `workbench.action.chat.open` accepts `agentId` and `agentMode` fields in addition to `query` and `isPartialQuery`. Using `@squad` prefix in query text provides belt-and-suspenders targeting of the Squad chat participant.
- **Key paths:** `src/services/FileWatcherService.ts` (line 34 WATCH_PATTERN), `src/commands/addMemberCommand.ts` (lines 49–56 chat open call)

### Init & Upgrade Features (2026-02-16)
- **Upgrade command:** Created `src/commands/upgradeSquadCommand.ts` following exact same factory pattern as `initSquadCommand.ts` — exports `registerUpgradeSquadCommand(context, onUpgradeComplete)`, opens terminal named "Squad Upgrade", runs `npx github:bradygaster/squad upgrade`
- **viewsWelcome contribution:** Added `viewsWelcome` section to `package.json` for `squadTeam` view — shows Initialize and Upgrade buttons when `!squadui.hasTeam` context key is false. VS Code renders these as clickable command links in the empty tree view.
- **Context key `squadui.hasTeam`:** Set on activation by checking `fs.existsSync(.ai-team/team.md)`. Updated to `true` in both init and upgrade `onComplete` callbacks. FileWatcher `onFileChange` handler also re-checks existence so context stays in sync with filesystem.
- **Package.json updates:** Added `squadui.upgradeSquad` command (title: "Upgrade Team", category: "Squad", icon: `$(arrow-up)`), upgrade button in Team view title bar (gated on `squadui.hasTeam`), no commandPalette restriction so it's always accessible.
- **Key pattern:** VS Code `viewsWelcome` uses `\n` for line breaks in the contents string, `[Button Text](command:id)` for command links. The `when` clause uses context keys set via `setContext` command.

### Dashboard Canvas Chart Rendering Fix (2026-02-16)
- **Hidden tab canvas bug:** Canvas elements inside `display: none` tabs return `offsetWidth === 0`. Setting `canvas.width = canvas.offsetWidth` on hidden tabs produces a zero-width canvas — nothing renders. Charts must only be drawn when their tab is visible.
- **Fix pattern:** Removed `renderBurndownChart()` and `renderVelocityChart()` from initial page load. Both are now rendered on-demand when the user clicks their tab. Added `offsetWidth === 0` guard in both chart functions as belt-and-suspenders.
- **Duplicate listener bug:** `renderBurndownChart()` was adding a new `change` listener to the milestone `<select>` on every call. Fixed by tracking rendered tabs in a `Set` and only attaching the listener once.
- **Key files:** `src/views/dashboard/htmlTemplate.ts` — all three fixes are in the `<script>` block of the dashboard HTML template.

📌 Team update (2026-02-16): Test hardening conventions established — command registration tests use triple-guard pattern (extension/isActive/workspace); tree provider tests must await getChildren(); temp directories use test-fixtures/temp-{name}-${Date.now()} with teardown; private methods accessed via (instance as any).method.bind(instance) — decided by Basher

### Closed-Milestone Burndown Fix (2026-02-16)
- **Bug:** Burndown chart for completed milestones appeared empty because `endDateObj` always extended to today. For a milestone completed weeks ago, the actual burndown curve was compressed into a tiny sliver with a long flat zero line.
- **Fix:** In `DashboardDataBuilder.buildMilestoneBurndown()` (line ~300), added check: if all issues have `closedAt`, end date = latest close date (or `dueDate` if later). Open milestones retain original behavior (end at today). Surgical change — only the end-date computation was modified.
- **Key insight:** Always consider whether a milestone is open vs closed when computing chart boundaries. Chart time axes should reflect the meaningful work period, not extend to the present for historical data.

### Native Init Wizard (2026-02-16)
- **Issue #41:** Replaced terminal-only `squad init` with native VS Code wizard: QuickPick (universe) → InputBox (mission) → Terminal with `--universe` and `--mission` flags.
- **UniverseOption interface:** Extended `vscode.QuickPickItem` with `universe` and `capacity` fields. 15 universes from the Squad casting system, each with "14 characters available" description.
- **viewsWelcome expansion:** Welcome view now covers all three panels (squadTeam, squadSkills, squadDecisions) with consistent "Form your Squad" CTA. Removed "Upgrade Existing Team" button — upgrade is for existing teams only, accessible via toolbar.
- **Cancellation handling:** Both QuickPick and InputBox abort cleanly on Escape — no terminal spawned, no side effects.
- **Key pattern:** `vscode.window.showQuickPick` with typed items lets you attach metadata (universe name, capacity) to each option without string parsing. Much better than raw label matching.
- **extension.ts unchanged:** The `onInitComplete` callback already refreshed all three providers and set `squadui.hasTeam` — no modifications needed.

### Upgrade Availability Detection (Issue #42)
- **SquadVersionService:** New service at `src/services/SquadVersionService.ts` — compares installed Squad CLI version vs latest GitHub release to determine if upgrade is available.
- **GitHub API call:** Uses Node.js `https` module (not fetch) to hit `api.github.com/repos/bradygaster/squad/releases/latest`, parses `tag_name`. Handles redirects, timeouts, errors gracefully — never throws.
- **Installed version detection:** Runs `npx github:bradygaster/squad --version` via `execSync` with 15s timeout. Regex extracts semver pattern from output.
- **Semver comparison:** Simple numeric comparison of major.minor.patch parts — no external dependency.
- **Caching:** `checkForUpgrade()` returns cached result after first call. `forceCheck()` bypasses cache. `resetCache()` clears stored result.
- **Context key `squadui.upgradeAvailable`:** Set via `setContext` when version check completes. Upgrade button in Team toolbar now gated on `squadui.hasTeam && squadui.upgradeAvailable` — only visible when an upgrade is actually available.
- **Manual check command:** `squadui.checkForUpdates` (category: "Squad") — force-checks version and shows notification with result. "Upgrade Now" button triggers `squadui.upgradeSquad`.
- **Post-upgrade flow:** Upgrade callback resets `upgradeAvailable` to false immediately, then force re-checks. This ensures the button disappears right away and only reappears if another update is released.
- **Key pattern:** Non-blocking version check on activation — uses `.then()` instead of `await` to avoid slowing down extension startup.

### Team Display Resilience (2026-02-16)
- **Race condition fix:** `SquadDataProvider.getSquadMembers()` now retries once (after configurable delay, default 1.5s) when team.md exists on disk but `parseTeamMd()` returns a roster with 0 members. Handles the race where `squad init` sets `hasTeam=true` before the Members table is fully written. Fresh `TeamMdService` instance used for retry to avoid stale state.
- **Delayed re-refresh on init:** `extension.ts` init callback now schedules a second refresh pass 2s after init completes, catching files that arrive after the init terminal command started but before the file watcher picks them up.
- **Tree view loading message:** When `hasTeam` is true but members array is empty, `teamView.message` is set to `'Loading team...'` for user feedback. Cleared automatically when members load successfully. Applied in init callback, file watcher handler, and manual refresh command.
- **Retry delay testability:** `retryDelayMs` is a constructor parameter on `SquadDataProvider` (default 1500ms), allowing tests to use a short delay.
- **Key insight:** When squad init creates `.ai-team/team.md`, the file may exist before the Members table rows are written. A single delayed retry is sufficient — no polling loop needed.

📌 Team update (2026-02-16): Native Init Wizard — `squad init` replaced with native VS Code wizard: QuickPick (15 universes) → InputBox (mission description) → Terminal with --universe and --mission flags. viewsWelcome now covers all three panels (squadTeam, squadSkills, squadDecisions). Upgrade button only in Team toolbar. API signatures unchanged — existing tests pass. — decided by Rusty
📌 Team update (2026-02-16): Conditional Upgrade Button via Version Check — new context key `squadui.upgradeAvailable` set when SquadVersionService confirms newer release. Upgrade button gated on `squadui.hasTeam && squadui.upgradeAvailable`. Manual re-check available via `squadui.checkForUpdates` command. Post-upgrade flow resets context and re-checks. — decided by Rusty
📌 Team update (2026-02-16): Team Display Resilience — Race Condition Handling — SquadDataProvider.getSquadMembers() retries once (after configurable delay) when team.md exists but roster is empty. Delayed re-refresh 2s after init. Tree view shows "Loading team..." when hasTeam is true but members empty. Retry delay is constructor-configurable for testability. — decided by Rusty

### Init Auto-Refresh via FileSystemWatcher (2026-02-16)
- **Problem:** Team panel only refreshed when user manually closed the Squad Init terminal. Bad UX — user picks universe, types mission, then has to close a terminal to see results.
- **Fix:** Added `vscode.workspace.createFileSystemWatcher` targeting `.ai-team/team.md` (via `RelativePattern`) in `initSquadCommand.ts`. When the file is created or changed, `onInitComplete()` fires immediately — no terminal close needed.
- **Double-refresh guard:** Boolean flag `initCompleted` ensures `onInitComplete()` runs exactly once, whether triggered by the file watcher or terminal close fallback.
- **Cleanup:** Watcher is disposed after firing. Terminal close listener remains as fallback and also disposes the watcher if it hasn't fired yet. Both are pushed to `context.subscriptions`.
- **Key pattern:** `vscode.RelativePattern(workspaceFolder, '.ai-team/team.md')` scopes the watcher to a single file in the workspace — no glob needed, no noise from other file changes.
📌 Team update (2026-02-16): Init Auto-Refresh — FileSystemWatcher on `.ai-team/team.md` triggers tree refresh immediately when file appears, instead of waiting for terminal close. Terminal close kept as fallback. Double-refresh prevented via boolean guard. — decided by Rusty

### Two-Command Init: Squad Init + Agent Charter Setup (2026-02-16)
- **Change:** `terminal.sendText()` in `initSquadCommand.ts` now chains two commands with `&&`: (1) `npx github:bradygaster/squad init --universe "..." --mission "..."` scaffolds the `.ai-team/` directory, then (2) `gh copilot -- --agent squad --allow-all-tools -i 'Set up the team...'` invokes the Squad Copilot agent to populate charters.
- **Chaining strategy:** Single `sendText()` call with `&&` — second command only runs if init exits successfully. Cleaner than detecting terminal command completion programmatically.
- **Quote handling:** First command uses double quotes around universe/mission values (template literal interpolation). Second command uses single quotes around the `-i` prompt to avoid conflicts. Works in both cmd.exe and PowerShell.
- **No other changes:** FileSystemWatcher, terminal close fallback, `initCompleted` guard, and all existing behavior remain untouched.
📌 Team update (2026-02-16): Two-Command Init — `terminal.sendText()` now chains `squad init` + `gh copilot -- --agent squad` with `&&` so charters are populated automatically after scaffolding. Single sendText call, single quotes for the Copilot prompt. — decided by Rusty

### Chat Panel Handoff for Init (2026-02-16)
- **Change:** Removed CLI-based Copilot agent invocation from `terminal.sendText()`. Terminal now only runs `npx github:bradygaster/squad init --universe "..." --mission "..."`.
- **New flow:** After `.ai-team/team.md` appears (FileSystemWatcher) or terminal closes (fallback), `completeInit()` calls `onInitComplete()` then opens the Copilot Chat panel via `vscode.commands.executeCommand('workbench.action.chat.open', chatPrompt)` with `@squad` agent pre-selected and prompt pre-filled.
- **Removed:** `copilotPrompt`, `copilotFlags`, `copilotCmd` variables and the `&&` chaining logic. `process.platform` check for win32/unix null redirect no longer needed.
- **Info message updated:** Now reads "Squad installed! Opening Copilot Chat to set up your team..." to reflect the chat panel flow.
- **Everything else unchanged:** FileSystemWatcher, terminal close fallback, `initCompleted` guard, `context.subscriptions.push(watcher, listener)`.
📌 Team update (2026-02-16): Chat Panel Handoff — Init wizard no longer invokes Copilot agent via CLI in terminal. After `squad init` completes and team.md appears, opens VS Code Copilot Chat panel with `@squad` agent selected and setup prompt pre-filled. User sees Squad working in chat panel while sidebar populates. — decided by Rusty

### Terminal CLI Handoff & Spinner Indicator (2026-02-16)
- **Chat panel replaced with terminal CLI:** `workbench.action.chat.open` removed from `completeInit()`. Now chains `copilot -a squad "prompt"` after `squad init` via `&&` in a single `terminal.sendText()` call. Uses `copilot` CLI (not `gh copilot`), `-a squad` flag for agent selection.
- **Spinner codicon:** `$(loading~spin)` in `teamView.message` renders an animated spinner in VS Code tree view messages. Set to `'$(loading~spin) Allocating team members...'` when init completes. Cleared to `undefined` when `getSquadMembers()` returns non-empty array.
- **Polling fallback:** 3-second `setInterval` in the init callback checks for members and clears spinner. Belt-and-suspenders alongside the FileWatcherService `onFileChange` handler, which also clears the spinner when members appear.
- **Key insight:** `$(loading~spin)` only works in `TreeView.message`, not in tree item labels. It's a codicon animation reference, not a ThemeIcon.
📌 Team update (2026-02-16): Terminal CLI Handoff & Spinner — Replaced chat panel handoff with `copilot -a squad` CLI command chained via `&&` in terminal. Added `$(loading~spin)` spinner codicon in team panel message during allocation. 3-second polling fallback clears spinner when members load. — decided by Rusty

 Team update (2026-02-16): Agents folder scanning added as fallback for team detection  decided by Linus

### VSCE Version Alignment (2026-02-17)
- **engines.vscode / @types/vscode alignment:** VSCE enforces that `@types/vscode` version must not exceed `engines.vscode`. If `@types/vscode` is `^1.109.0`, then `engines.vscode` must be `>=^1.109.0`. This is checked at `vsce package` time — CI will fail if they're mismatched.
- **Fix applied:** Updated `engines.vscode` from `^1.85.0` to `^1.109.0` to match `@types/vscode`. Deleted and re-created `v0.7.2` tag at new HEAD. Release CI should now pass.
📌 Team update (2026-02-17): VSCE Version Alignment — engines.vscode must always be >= @types/vscode. VSCE enforces this at package time. Updated from ^1.85.0 to ^1.109.0 to fix failed v0.7.2 release. — decided by Rusty

### Orchestration Log vs Session Log Scope (2026-02-17)
- **Bug:** Sidebar falsely showed agents as "working" on completed issues. Session logs in `log/` (historical narrative records from Scribe) were being read alongside `orchestration-log/` and treated as active orchestration data. Old `#NNN` references in session logs defaulted to `in_progress` status, polluting the active task list.
- **Fix:** Added `discoverOrchestrationLogFiles()` and `parseOrchestrationLogs()` methods to `OrchestrationLogService` that only read from `orchestration-log/`. Created private `getOrchestrationLogEntries()` method in `SquadDataProvider` for use in `getSquadMembers()` and `getTasks()`. Session logs remain readable via `parseAllLogs()` for display purposes (e.g., Recent Activity, log entry cards).
- **Key insight:** The `log/` directory contains session logs — Scribe's narrative records of past work. These reference issues in historical context ("Assigned to issue #22", "PR #28 opened"), but they are NOT orchestration entries. Task status and member working state must ONLY derive from `orchestration-log/` files.
- **Files changed:** `src/services/OrchestrationLogService.ts` (new methods), `src/services/SquadDataProvider.ts` (internal log-reading call)
📌 Team update (2026-02-17): Orchestration Log Scope — Task status and member working state now derive ONLY from orchestration-log/ files. Session logs (log/) are historical records and should never affect active status. — decided by Rusty

📌 Team update (2026-02-17): Always use normalizeEol() for markdown parsing to ensure cross-platform compatibility — decided by Copilot (Jeffrey T. Fritz)

 Team update (2026-02-18): Active-work marker protocol adopted; tree view reacts to marker files via cache invalidation  decided by Danny

📌 Team update (2026-02-18): Velocity chart uses all logs; status stays orchestration-only — DashboardDataBuilder now accepts optional `velocityTasks` parameter (9th arg). Velocity timeline uses `velocityTasks ?? tasks` (all logs or fallback). Activity swimlanes still use orchestration-only `tasks`. Architectural principle: velocity = all work signals; status = orchestration-only to prevent false "working" indicators from old session logs. — decided by Linus

### Status Indicators Parked (2026-02-23)
- **Directive:** Jeffrey T. Fritz asked to park the idle/active status feature — remove all visible status indicators from the UI.
- **Tree view:** Removed `sync~spin` icon for working members (all members now use `person` icon). Removed ⚡/💤 status badges from member descriptions. Removed status line from member tooltips.
- **Dashboard:** Removed "Working" summary card (activeMembers count). Removed status-based member avatar icon (⚡ vs 👤). Removed "⚡ Working" / "💤 Idle" status badge from member cards.
- **Status bar:** Changed from `N/M Active 🟢` to simple `N members` display. Removed health icons (🟢🟡🟠⚪) and active/idle breakdown from tooltip.
- **Work details webview:** Removed member status badge (`badge-working`/`badge-idle`) from the "Assigned To" section.
- **Infrastructure preserved:** `MemberStatus` type, `OrchestrationLogService`, `SquadDataProvider` status computation, `TeamMemberOverview.status`, `TeamSummary.activeMembers` — all kept intact. Only UI rendering was changed.
- **Tests updated:** 8 test files updated to match new behavior. All 1039 tests passing.
- **Key pattern:** When parking a feature, strip the UI layer only — leave the data pipeline intact so re-enabling is a clean diff.
📌 Team update (2026-02-23): Status indicators parked — all visible active/idle/working indicators removed from tree view, dashboard, status bar, and work details webview. Data infrastructure (MemberStatus, OrchestrationLogService, SquadDataProvider status computation) preserved for future re-enablement. — decided by Jeffrey T. Fritz



### 2026-02-23: Team Updates
 Park Status Indicators feature  removed all active/idle status UI indicators from tree view, dashboard, status bar, and work details webview. Infrastructure preserved for future re-enablement. Test files updated (8 total). Decided by Rusty

