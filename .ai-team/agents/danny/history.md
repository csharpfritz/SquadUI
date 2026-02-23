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

📌 Team update (2026-02-16): Canvas charts must render on-demand when their tab becomes visible, not on page load. Hidden canvases report offsetWidth === 0, producing blank charts. Milestone selector also had duplicate event listeners that accumulated with each tab switch — both fixed in htmlTemplate.ts — decided by Rusty

📌 Team update (2026-02-16): Test hardening conventions established — command registration tests use triple-guard pattern (extension/isActive/workspace); tree provider tests must await getChildren(); temp directories use test-fixtures/temp-{name}-${Date.now()} with teardown; private methods accessed via (instance as any).method.bind(instance) — decided by Basher

📌 Team update (2026-02-17): Branch cleanup convention established — after releases, delete stale remote branches: (1) whose PRs merged/closed, (2) pointing to main HEAD. Use `git push origin --delete {branch}` for batch deletion. Keep branches with open PRs or active work. Reduces remote clutter and avoids contributor confusion — decided by Livingston
📌 Team update (2026-02-17): Always use normalizeEol() for markdown parsing to ensure cross-platform compatibility — decided by Copilot (Jeffrey T. Fritz)

### Active-Work Markers Architecture (2026-02-18, Issue #59)
- Designed active-work marker protocol to fix idle status during VS Code Copilot Chat sessions
- Markers live in `{squadFolder}/active-work/{agent-slug}.md` — `.md` extension means FileWatcherService already covers them with zero changes
- SquadUI is read-only: `SquadDataProvider.detectActiveMarkers()` scans the directory, checks mtime for staleness (5min threshold), overrides member status to 'working'
- Active marker takes highest precedence — overrides log-based status AND the "working but no task → idle" demotion
- No model changes needed (`MemberStatus` already has 'working' | 'idle')
- No view-layer changes needed (tree/status bar already react to cache invalidation)
- Marker creation/deletion is the orchestrator's job — out of scope for SquadUI
- Implementation assignment: Linus (SquadDataProvider changes + tests), Rusty (no changes needed)

### Dashboard & Decisions Loading Review (2026-02-19)
- **Anti-pattern found:** Three files hardcode `.ai-team` instead of using the detected `squadFolder` parameter — SquadTreeProvider.ts:434 (DecisionsTreeProvider), SquadDataProvider.ts:271 (discoverMembersFromAgentsFolder), SquadDashboardWebview.ts:167 (handleOpenLogEntry). This breaks all `.squad/` projects silently.
- **Architecture issue:** DecisionsTreeProvider creates its own DecisionService bypassing SquadDataProvider's cache, causing data inconsistency between tree view and dashboard. Should use `dataProvider.getDecisions()` instead.
- **Race condition:** `updateContent()` does initial panel null check, then 5+ sequential awaits. Panel dispose during loads crashes both the assignment and the error handler. All async webview methods need post-await null guards.
- **HTML injection risk:** `JSON.stringify()` in htmlTemplate.ts doesn't escape `</` — decision content with `</script>` breaks the entire dashboard. Must sanitize interpolated JSON.
- **Convention established:** All new code touching squad folder paths MUST use the injected `squadFolder` parameter, never hardcode `.ai-team` or `.squad` — this is the root cause of most "content not loading" bugs.

### Feature Roadmap Analysis (2026-02-24)
**SquadUI at v0.9.1 — V1.0 Readiness Assessment**

**Current State:**
- Feature-complete for v1.0 MVP: team visualization, activity tracking, GitHub integration, skills, decisions, standup reports, init wizard
- Known gaps: real-time agent status (#67 parked), decision searchability, charter editing, diagnostic tooling
- Architecture is solid: service layer decoupled, file watcher pattern proven, webview lifecycle well-managed

**Roadmap (10 features across 3 milestones):**

| Feature | Size | Priority | Milestone |
|---------|------|----------|-----------|
| Active Status Redesign (replaces #67 badges) | M | P0 | v1.0 |
| Decision Search & Filter | S | P1 | v1.0 |
| Markdown Charter Editor | S | P1 | v1.0 |
| Health Check Command | S | P2 | v1.0 |
| Issue Backlog View | M | P1 | v1.1 |
| Dashboard Member Drill-down | M | P1 | v1.1 |
| **Copilot Chat Integration** | L | P0 | v1.1 |
| Milestone Burndown Template | M | P1 | v1.1 |
| Skill Usage Metrics | M | P2 | v1.2 |
| Multi-Workspace Dashboard | L | P2 | v1.2 |

**Architectural Decisions:**
- **Active Status (#1):** Extend `MemberStatus` enum to rich context (working-on-issue, reviewing-pr, waiting-review). Tree badges truncated; tooltip shows full. Dashboard member card shows expanded context.
- **Decision Search (#2):** Add `DecisionService.search(query)` for full-text search across both decisions.md and individual .md files. Location-agnostic, no data schema changes.
- **Copilot Chat (#6):** Critical P0 feature but faces risk — no public API for message interception. Start with manual trigger (`/ask-squad`); plan for v1.1.1 when GitHub opens plugin API.
- **Issue Backlog (#3):** Extend `GitHubIssuesService` to support backlog queries; paginate + cache (5-min TTL) to handle rate limits on large repos.
- **Multi-Workspace (#10):** Redesign dashboard data flow to accept multiple roots in parallel; defer to v1.2 (low priority, few orgs run multiple squads).

**V1.0 Hard Requirements:**
- [ ] #1 Active Status Redesign (closes #67)
- [ ] #2 Decision Search & Filter (scalability)
- [ ] #4 Markdown Charter Editor (team composition UX)
- [ ] #9 Health Check Command (self-service diagnostics)

**Risks & Mitigations:**
- API change to `MemberStatus` — mitigate with TypeScript compile checks, incremental view updates
- Copilot Chat no public API — start manual; wait for GitHub plugin API
- GitHub API rate limiting — paginate, cache, warn users
- Multi-workspace refactoring — defer to v1.2; not blocking v1.0

**Key Insight:** #67 (idle status false positives) is solved by pivoting from simple emoji badges to rich contextual status strings. Current active/idle binary model insufficient for real-world use; teams need to see *what* agents are working on, not just *whether* they're active.

### Feature Roadmap Analysis (2026-02-24) - Extended
📌 Team update (2026-02-23): Feature roadmap defined — 10 features across v1.0/v1.1/v1.2. See decisions.md.
   - P0 features: Active Status Redesign (#73), Copilot Chat Integration (#77)
   - P1 features assigned to Rusty and Linus; implementation planning underway
   - v1.0 ship target with focus on real-time status, decision search, charter editor, health check
   - Roadmap session logged to .ai-team/log/2026-02-23-feature-roadmap.md
