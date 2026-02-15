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
