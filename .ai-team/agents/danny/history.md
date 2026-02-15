# Project Context

- **Owner:** Jeffrey T. Fritz (csharpfritz@users.noreply.github.com)
- **Project:** VS Code extension for visualizing Squad team members and their tasks
- **Stack:** TypeScript, VS Code Extension API, potentially GitHub Copilot integration
- **Created:** 2026-02-13

## Learnings

### Architecture Patterns

- Status bar items should be created with `vscode.window.createStatusBarItem()` and managed with lifecycle (dispose).
- Status bar updates should be coordinated with tree view refreshes via shared data provider.
- Tree item badges can be implemented using `description` field with emoji/icon + text patterns.
- File watcher events should trigger both tree refresh and status bar updates for consistency.

### Key File Locations

- `src/views/SquadStatusBar.ts` - Status bar component showing squad health (active/total counts, status icons)
- `src/views/SquadTreeProvider.ts` - Tree view provider with badge support (status icons, issue counts)
- `src/extension.ts` - Entry point that wires up status bar and coordinates refresh callbacks
- `src/services/SquadDataProvider.ts` - Central data provider used by both tree and status bar
- `src/services/OrchestrationLogService.ts` - Parses log files to derive member states and tasks

### UI Patterns Established

- Status bar shows: `$(organization) Squad: X/Y Active [health-icon]` where health icons are 🟢/🟡/🟠/⚪ based on activity ratio
- Tree member badges show: `[status-emoji] [role] • [N issues]` where status emoji is ⚡ (working) or 💤 (idle)
- All refresh operations (init, add/remove member, file watcher) update both tree and status bar

### Dashboard Architecture

- `SquadDashboardWebview` hosts three tabs: Velocity, Activity Timeline, Decision Browser
- Uses HTML5 Canvas for velocity line charts (no external chart libraries)
- CSS Grid for activity swimlanes and heatmap layout
- Status bar click opens dashboard (`squadui.openDashboard` command)
- Dashboard data flows: `OrchestrationLogService` + `SquadDataProvider` → `DashboardDataBuilder` → HTML template
- Webview uses `enableScripts: true` and `retainContextWhenHidden: true` for tab navigation
- File structure: `src/views/dashboard/` contains `DashboardDataBuilder.ts` and `htmlTemplate.ts`
- Dashboard data models: `DashboardData`, `VelocityDataPoint`, `ActivityHeatmapPoint`, `ActivitySwimlane`, `TimelineTask` in `models/index.ts`

📌 Team update (2026-02-14): Real-Time Squad Visibility Features — status bar and tree view badges for squad health monitoring — decided by Danny

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-02-14: Team Update — Sidebar Reorganization

📌 **Team update (2026-02-14):** Sidebar reorganized into Team/Skills/Decisions views — decided by Rusty

### 2026-02-15: v0.6.0 Sprint Planning

📌 Team update (2026-02-15): User directive — releases require explicit human approval before tagging/publishing — decided by Jeffrey T. Fritz

📌 Team update (2026-02-15): Dashboard Chart & Decisions Rendering Fixes (canvas colors, axis labels, empty state) — decided by Rusty

**Context:** Jeff requested planning for next milestone after v0.5.1 shipped. v0.5.0/v0.5.1 polished sidebar heavily (icons, labels, ordering, cross-project compat).

**Key findings:**
- **Skills infrastructure is COMPLETE** — SkillCatalogService (#38) exists, Add Skill command (#40) fully implemented, Skills tree view (#37) shipped in v0.5.0
- **Add Skill is DISABLED** — button hidden in package.json `commandPalette when:false`, removed from Skills panel toolbar. Jeff disabled pending QA.
- **The gap:** No end-to-end QA validation. Once tested, re-enabling is a one-line change.
- **Open issues audit needed** — #25 (member management), #26 (universe selector), #27 (command palette) need review for staleness/completion

**Sprint scope decision:**
- **Focus:** Ship Add Skill feature by QA'ing + re-enabling. Close skills management loop.
- **Secondary:** Dashboard polish (2-3 quick visual wins), backlog issue audit, @copilot integration QA
- **Deferred:** Member management clarification, universe selector (low priority), test harness (v0.7.0), BlazorLora fixes (depends on QA findings)

**Sprint composition:** 6 work items (4 small, 2 extra-small) — achievable in one focused session.

**Planning principles applied:**
1. **Ship what's nearly done** — Don't start new features when existing ones are 95% complete
2. **QA gates quality** — Never ship user-facing features without validation
3. **Polish compounds** — Small visual improvements across dashboard add up to professional feel
4. **Backlog hygiene matters** — Stale issues create confusion; audit regularly

**Risks flagged for Jeff:**
- Add Skill QA may find bugs (fix vs defer decision needed)
- Dashboard polish scope undefined (needs Jeff input on priorities)
- BlazorLora "copilot completed tasks" issue not well-specified
- Issue #27 appears complete (command palette already has "Squad" category)

### 2026-02-15: Backlog Audit Results

**Issues closed (shipped in v0.5.0/v0.5.1):**
- **#27** — Command palette integration with Squad category prefix ✅
- **#37** — Skills tree view with source badges and confidence levels ✅
- **#38** — SkillCatalogService (awesome-copilot + skills.sh integration) ✅

**Issues audited (open):**
- **#25** — Team member management (addMember, removeMember) — Both commands fully implemented and functional. Ready to close or integrate further.
- **#26** — Universe selector for casting — Deferred to future milestone (P2)
- **#39** — Skill import tests — In progress (Basher writing tests for v0.6.0)
- **#40** — Add Skill import command — In progress (Rusty QA'ing end-to-end flow, currently disabled pending validation)

**Key insight:** Backlog is clean. Three completed issues shipped in v0.5.0. Four open issues properly triaged with clear status. #25 is a candidate for closure in next pass once decision made on scope. #39/#40 will unblock v0.6.0 release once QA passes.

📌 Team update (2026-02-15): Dashboard decisions sort order — decisions list on dashboard should be sorted most-recent first — decided by Jeffrey T. Fritz

📌 Team update (2026-02-15): Add Skill Error Handling — network failures now throw exceptions for better UX instead of silent empty arrays — decided by Rusty

### 2026-02-15: Test Coverage & Dashboard Assessment

**Requested by:** Jeff — "What tests are we missing? What are we missing from the dashboard?"

**Test Coverage Gaps Identified:**

Files with NO test coverage:
- `src/views/dashboard/DashboardDataBuilder.ts` — Zero tests. Contains `buildVelocityTimeline()`, `buildActivityHeatmap()`, `buildActivitySwimlanes()`, `taskToTimelineTask()`. All are pure logic, very testable.
- `src/views/dashboard/htmlTemplate.ts` — Zero tests for `getDashboardHtml()`. Template rendering, decision sorting, click handler wiring.
- `src/views/SquadDashboardWebview.ts` — Zero tests. `show()`, `dispose()`, `createPanel()`, `updateContent()`, message handling.
- `src/views/IssueDetailWebview.ts` — Zero tests. HTML generation, `getContrastColor()`, `formatDateString()`, `escapeHtml()`.
- `src/views/SquadStatusBar.ts` — Zero tests. `update()`, `getHealthIcon()`, `startPolling()`, `stopPolling()`, `dispose()`.
- `src/commands/initSquadCommand.ts` — Zero tests. Terminal creation, `onDidCloseTerminal` listener.
- `src/commands/removeMemberCommand.ts` — Zero tests. `parseMemberRows()`, file operations, alumni move logic.
- `src/services/FileWatcherService.ts` — Only 2 smoke tests (import + constructor). No coverage of `start()`, `stop()`, `onFileChange()`, `queueEvent()`, debounce logic, `registerCacheInvalidator()`.

Recently changed files WITHOUT corresponding test updates:
- `f1a8279 feat(dashboard): add sidebar button and clickable entries` — No tests for click handlers (`openDecision`, `openTask`, `openMember`)
- `7da4364 fix(dashboard): sort decisions most-recent first` — No test verifying sort order in template
- `b39e3f8 feat: broader task extraction for cross-project session logs` — OrchestrationLogService changed, no new tests

**Dashboard Assessment:**
- Three tabs: Velocity, Activity, Decisions — all rendering correctly
- Decision sort (most-recent first) is implemented in both DecisionService and htmlTemplate.ts ✅
- Clickable entries implemented: decision cards, task items, member names ✅
- Empty states exist for all three tabs ✅
- Canvas color fix shipped (resolveColor helper) ✅
- Axis labels on velocity chart shipped ✅
- Missing: No "Team Overview" or summary stats panel. No member count, sprint burndown, or at-a-glance health summary on the dashboard itself.
- Missing: No loading state — if data takes time, user sees nothing until render completes.
- Visual gap: Heatmap cells show activity bars but no numeric labels (e.g., "5 sessions").

**Key finding:** DashboardDataBuilder is the #1 testing priority — it's pure logic with zero VS Code dependencies, highly testable, and drives all three dashboard tabs.

### 2026-02-15: Team Update — User Testing Directive & Assessment Findings

📌 **Team decision merged (2026-02-15):** User testing directive from Jeff: always write tests alongside new features. Write regression tests for every bug so we know it's fixed when test passes. — decided by Jeff

📌 **Team assessment completed (2026-02-15):** Test coverage audit identified 8 files with zero/near-zero coverage. DashboardDataBuilder, removeMemberCommand, SquadStatusBar, IssueDetailWebview flagged as Priority 1 (pure logic, easy wins). FileWatcherService, SquadDashboardWebview, initSquadCommand flagged as Priority 2 (require mocking). Dashboard completeness: 3 tabs working, missing summary panel, loading state, heatmap numeric labels, tab persistence, refresh button. — decided by Danny

### 2026-02-15: v0.6.0 Release Preparation

**Task:** Prepare CHANGELOG.md and version bump for v0.6.0 release.

**Completed:**
- CHANGELOG.md updated with v0.6.0 entry (2026-02-15)
- Added: Dashboard decisions/sessions panels, sidebar button, clickable entries, per-member activity logs, re-enabled Add Skill with error handling, skill install enhancements (actual SKILL.md fetching), 90+ new tests
- Fixed: awesome-copilot catalog URL + parser rewrite, extractGitHubSubpath() for subdirectories, skills.sh parser rewrite, null-safety fixes (skill search, decisions rendering), decision date extraction parser rewrite, sort order, subsection filters
- Changed: Activity moved from root to per-member, decision heading parser (H2/H3 support)
- Removed: Root "Recent Activity" node
- package.json version bumped 0.5.1 → 0.6.0
- TypeScript compilation verified (npx tsc --noEmit — exit code 0) ✅

**Release notes summary:** v0.6.0 is a significant feature release adding dashboard interactivity (decisions rendering, recent sessions, sidebar access), activity telemetry improvements (per-member logs), skill management completion (re-enabled UI with duplicate protection, actual content fetching), and comprehensive test coverage (+90 tests across P1 gaps).

**Notes for Jeff:** Ready for review. Version bump and changelog finalized. No commits/tags created per instructions. Compilation clean.

