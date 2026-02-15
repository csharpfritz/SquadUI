# Project Context

- **Owner:** Jeffrey T. Fritz (csharpfritz@users.noreply.github.com)
- **Project:** VS Code extension for visualizing Squad team members and their tasks
- **Stack:** TypeScript, VS Code Extension API, potentially GitHub Copilot integration
- **Created:** 2026-02-13

## Learnings Summary

### Architecture Patterns
- Status bar items managed with lifecycle (dispose); updates coordinated with tree view refreshes
- Tree item badges via description field with emoji/icon + text patterns
- File watcher events trigger both tree and status bar updates
- Status bar shows: $(organization) Squad: X/Y Active [health-icon] (/// based on activity ratio)
- Tree badges: [status-emoji] [role]  [N issues] where  = working,  = idle

### Dashboard Architecture (v0.4v0.5)
- Three tabs: Velocity (canvas line chart), Activity Timeline (swimlanes), Decision Browser
- CSS Grid for activity swimlanes and heatmap layout
- Data flow: OrchestrationLogService + SquadDataProvider  DashboardDataBuilder  HTML template
- Webview uses nableScripts: true and etainContextWhenHidden: true
- Models: DashboardData, VelocityDataPoint, ActivityHeatmapPoint, ActivitySwimlane, TimelineTask in models/index.ts

### v0.6.0 Sprint Planning (2026-02-15)
**Key findings:**
- Skills infrastructure complete (SkillCatalogService, Add Skill command fully implemented)
- Add Skill feature disabled pending QA; re-enabling is one-line change
- No end-to-end QA validation; open issues #25/#26/#27 need review

**Sprint scope:**
- Focus: Ship Add Skill feature by QA'ing + re-enabling
- Secondary: Dashboard polish, backlog audit, @copilot integration QA
- Deferred: Member management, universe selector

**Backlog audit results:**
- Issues #27, #37, #38 closed (shipped in v0.5.0/v0.5.1)
- #25 fully implemented, ready to close; #26 deferred (P2); #39/#40 in progress
- Backlog is clean and properly triaged

### 2026-02-15 Team Updates
 Real-Time Squad Visibility Features  status bar and tree view badges for squad health monitoring  decided by Danny
 Dashboard Chart & Decisions Rendering Fixes (canvas colors, axis labels, empty state)  decided by Rusty
 Dashboard decisions sort order  decisions list on dashboard should be sorted most-recent first  decided by Jeffrey T. Fritz
 Add Skill Error Handling  network failures now throw exceptions for better UX instead of silent empty arrays  decided by Rusty
 📌 Team update (2026-02-15): FileWatcherService watch pattern broadened from `**/.ai-team/orchestration-log/**/*.md` to `**/.ai-team/**/*.md` to catch all team metadata changes for automatic UI tree refresh — decided by Rusty