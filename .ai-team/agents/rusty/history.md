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

### Feature Roadmap & Assignments (2026-02-24)
📌 Team update (2026-02-23): Feature roadmap defined — 10 features across v1.0/v1.1/v1.2. See decisions.md.
   - P0 features assigned: Active Status Redesign (#73)
   - P1 features assigned: Decision Search & Filter (#69), Charter Editor (#72), Issue Backlog View (#71), Member Drill-down (#76), Multi-Workspace Dashboard (#78)
   - v1.0 ship target with focus on real-time status, decision search, charter editor
   - v1.1 enables project management workflow (backlog triage, member analytics)
   - v1.2 scales to multi-workspace orgs
   - Roadmap session logged to .ai-team/log/2026-02-23-feature-roadmap.md


### Team Update: 2026-02-23 - Standup Report Enhancements & Fork-Aware Issues
 **Team update (2026-02-23):** Two decisions merged: (1) Standup report issue linkification (#N in AI summaries become clickable GitHub links) with escape-then-linkify pipeline to prevent injection; (2) Velocity chart legend repositioning below canvas for better viewport + accessibility. Fork-aware issue fetching auto-detects upstream repos via GitHub API, with manual override via team.md.  decided by @copilot + Rusty

### Active Status Redesign (2026-02-24, Issue #73)
- **Rich contextual status:** Replaced binary `'working' | 'idle'` with `MemberStatus` enum: `'working-on-issue' | 'reviewing-pr' | 'waiting-review' | 'working' | 'idle'`. Added `isActiveStatus()` helper and `ActivityContext` interface with `description`, `shortLabel`, `issueNumber?`, `prNumber?`.
- **OrchestrationLogService.getMemberActivity():** New method parses log entries to derive per-member activity context. Detects issue work vs PR review vs waiting status from log content. Falls back to generic `'working'` when no specific context is available. Original `getMemberStates()` preserved for backward compat.
- **SquadDataProvider:** Uses `getMemberActivity()` to populate `activityContext` on each `SquadMember`. GitHub-aware status now sets `'working-on-issue'` (not generic `'working'`).
- **Tree view:** Working members get `sync~spin` icon with green color. Description shows `role • ⚙️ Issue #42` style. Tooltip shows full context description.
- **Dashboard:** Member cards show status badge below name. "Working" summary card restored. Uses `isActiveStatus()` for counting.
- **Status bar:** Shows `Squad: 3/5 working` when members are active, falls back to `Squad: N members` when none are working.
- **Work details webview:** Shows member's activity context shortLabel in assigned-to card.
- **Key files:** `src/models/index.ts` (MemberStatus, ActivityContext, isActiveStatus), `src/services/OrchestrationLogService.ts` (getMemberActivity), `src/views/SquadTreeProvider.ts` (rich status display), `src/views/dashboard/htmlTemplate.ts` (status badges).
- **Tests:** Updated 8 test files to accept rich status values. 1093 tests passing (up from 1056).

