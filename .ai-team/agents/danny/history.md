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
