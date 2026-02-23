# Project Context

- **Owner:** Jeffrey T. Fritz (csharpfritz@users.noreply.github.com)
- **Project:** VS Code extension for visualizing Squad team members and their tasks
- **Stack:** TypeScript, VS Code Extension API, potentially GitHub Copilot integration
- **Created:** 2026-02-13

## Core Context (Summarized)

**Early Foundation (2026-02-13 through 2026-02-17):**
The SquadUI extension emerged from initial scaffolding through a rapid sequence of feature buildouts. Key architectural decisions include: (1) Dashboard with null-safety guards, recent activity panels, burndown & velocity charts. (2) Orchestration vs Session Log distinction  task status derives ONLY from orchestration-log/; session logs are historical records. (3) Init wizard as native VS Code experience (QuickPick  InputBox  Terminal) with FileSystemWatcher auto-refresh, spinner indicators, and contextual setup flow. (4) SquadVersionService for checking upgrade availability non-blockingly. (5) Team Display Resilience with retry logic for race conditions during init. (6) Command registration patterns (triple-guard: extension/isActive/workspace) and test hardening conventions. Details preserved in 'history-archive.md' for reference.

## Learnings Summary

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

### Standup Report Enhancements (2026-02-23)
- **Issue number linkification in AI summaries:** Added `linkifyIssueNumbers()` and `deriveRepoBaseUrl()` methods to `StandupReportWebview`. AI-generated executive summary and decisions summary now convert `#N` patterns into clickable links that open the GitHub issue. Repo base URL is derived from the first issue's `htmlUrl` in the report, with fallback to `https://github.com/csharpfritz/SquadUI`.
- **Velocity chart legend moved to HTML:** Removed in-canvas legend drawing from `getVelocityChartScript()`. Added `<div class="chart-legend">` below the velocity canvas in `renderMilestoneSection()` with `.chart-legend` CSS (flex row, centered, color swatches).
- **Key pattern:** `escapeAndParagraph()` now accepts optional `repoBaseUrl` param — escape HTML first, then linkify issue numbers, then split into `<p>` tags. This ordering prevents HTML injection while allowing generated links.
- **Key file:** `src/views/StandupReportWebview.ts` — all standup report rendering
📌 Team update (2026-02-23): Issue number linkification in AI summaries — `#N` patterns in executive summary and decisions summary are now clickable links. Velocity chart legend moved from canvas overlay to centered HTML row below chart. — decided by Rusty


### Team Update: 2026-02-23 - Standup Report Enhancements & Fork-Aware Issues
 **Team update (2026-02-23):** Two decisions merged: (1) Standup report issue linkification (#N in AI summaries become clickable GitHub links) with escape-then-linkify pipeline to prevent injection; (2) Velocity chart legend repositioning below canvas for better viewport + accessibility. Fork-aware issue fetching auto-detects upstream repos via GitHub API, with manual override via team.md.  decided by @copilot + Rusty

