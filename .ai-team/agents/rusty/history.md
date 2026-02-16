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