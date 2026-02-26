# Linus  Search Service & Health Check

**Role:** Infrastructure & Observability  
**Current Focus:** v1.0 features  Decision Search (#69), Health Check (#70)

## v1.0 Batch 1 (2026-02-23)

**#69 Decision Search Service**
- Full-text search with relevance ranking and date/author filtering
- 37 new tests added
- PR #79 merged to squad/v1.0-features
- Status: Complete

**v1.0 Roadmap Assignments**
- P1: Decision Search & Filter (#69) 
- P1: Health Check (#70) — in progress (Batch 2)
- P1: Milestone Burndown Template (#75)
- P2: Skill Usage Metrics (#74)

**#70 Health Check Diagnostic Command**
- `HealthCheckService` — pure TypeScript, no VS Code dependency, 4 checks: team.md, agent charters, log parse health, GitHub token
- Each check returns `HealthCheckResult { name, status: 'pass'|'fail'|'warn', message, fix? }`
- `runAll()` parallel execution, `formatResults()` human-readable output with icons
- `squadui.healthCheck` command wired to VS Code output channel (minimal extension.ts touch)
- Squad folder passed as parameter everywhere — never hardcoded
- 17 tests in `healthCheckService.test.ts`
- PR #81 → closes #70
- Status: Complete

## Historical Summaries

**Earlier work (v0.1v0.2, 2026-02-13 to 2026-02-18)** archived to history-archive-v1.md.

### 2026-02-15 Team Updates
 Issues Service Interface Contract  IGitHubIssuesService decouples tree view from implementation  decided by Rusty
 Issue Icons & Display Filtering  uses codicon with theme tinting, Squad labels filtered  decided by Rusty
 Release Pipeline Workflow  tag-based trigger, version verification gate, VSCE_PAT secret  decided by Livingston
 Closed Issues Architecture  separate closedCache, max 50, sorted by updated_at descending  decided by Linus
 SkillCatalogService Graceful Degradation  swallow network errors, return empty arrays  decided by Linus
 Table-Format Log Summary Extraction  priority chain to prevent markdown leakage  decided by Linus
 Default Issue Matching & Member Aliases  defaults to labels+assignees, aliases in team.md  decided by Linus
 E2E Validation Test Strategy  TestableWebviewRenderer pattern, acceptance criteria traceability  decided by Basher

### H1 Decision Format Support
- Added support for `# Decision: {title}` (H1) format in `parseDecisionsMd()` — some projects (e.g. aspire-minecraft) use this instead of H2/H3
- H1 decisions use `**Date:**`, `**Author:**`, `**Issue:**` metadata lines below the heading
- Section boundary: an H1 decision runs until the next H1 heading (or EOF)
- Inner `## Context`, `## Decision`, `## Rationale` subsections are NOT treated as separate decisions — they're consumed as content of the parent H1 block
- The parser skips `i` forward to `sectionEnd` after consuming an H1 decision to prevent subsection re-parsing
- Non-decision H1 headings (e.g. `# Decisions`, `# Team Log`) are skipped — only `# Decision: ` with the prefix triggers parsing
- Existing H2/H3 parsing is completely untouched — the H1 block uses `continue` before reaching H2/H3 logic

📌 Team update (2026-02-16): Test hardening conventions established — command registration tests use triple-guard pattern (extension/isActive/workspace); tree provider tests must await getChildren(); temp directories use test-fixtures/temp-{name}-${Date.now()} with teardown; private methods accessed via (instance as any).method.bind(instance) — decided by Basher

📌 Team update (2026-02-17): Orchestration Log vs Session Log Scope — OrchestrationLogService now uses separate discoverOrchestrationLogFiles() and parseOrchestrationLogs() methods for task status derivation; session logs in log/ remain for display only (Recent Activity, log cards). Prevents false "working" indicators from old session logs. — decided by Rusty

### Agents Folder Scanning Fallback
- Added `discoverMembersFromAgentsFolder()` to SquadDataProvider as a second-level fallback in the member detection chain
- Detection order is now: team.md Members/Roster table → agents folder scan → orchestration log participants
- Scans `.ai-team/agents/` subdirectories, skipping `_alumni` and `scribe`
- Reads `charter.md` from each agent folder to extract role via `- **Role:** {role}` regex
- Falls back to "Squad Member" default role if no charter or no Role line found
- Folder names are capitalized for display (e.g., `danny` → `Danny`)
- Method is self-contained and handles missing/unreadable agents directory gracefully (returns empty array)
- Pre-existing test suite at `agentsFolderDiscovery.test.ts` validates all edge cases
📌 Team update (2026-02-17): Always use normalizeEol() for markdown parsing to ensure cross-platform compatibility — decided by Copilot (Jeffrey T. Fritz)

### Coding Agent Section Parsing (2026-02-18)
- Extended `TeamMdService.parseMembers()` to parse the `## Coding Agent` section in addition to `## Members`/`## Roster`
- Bug fix: @copilot was missing from member list because it lives in its own table under `## Coding Agent`
- The `extractSection()` and `parseMarkdownTable()` methods already handle this format — just needed to add the second extraction pass
- Both sections now contribute to the unified member array returned by `parseMembers()`
- No changes needed to `parseTableRow()` — it already handles the Name/Role/Charter/Status columns correctly regardless of which section they come from

### Active-Work Marker Detection (2026-02-18)
- Implemented `detectActiveMarkers()` in SquadDataProvider — scans `{squadFolder}/active-work/` for `.md` marker files
- Detection is mtime-based with `STALENESS_THRESHOLD_MS = 300_000` (5 minutes); stale markers are ignored
- Integrated into `getSquadMembers()` after existing status resolution (roster + log + task demotion) but before caching
- Slug matching uses `member.name.toLowerCase()` since agent folder names are already lowercase
- Handles missing directory gracefully via try/catch (returns empty set)
- SquadUI is read-only — it never creates or deletes marker files, only reads presence + mtime
- No model changes needed — `MemberStatus` already includes `'working'`
- No watcher changes needed — existing `**/{.squad,.ai-team}/**/*.md` glob covers `active-work/*.md`

### Velocity Chart: All Closed Issues (2026-02-18)
- `buildVelocityTimeline()` previously only counted closed issues from `MemberIssueMap` (member-matched subset)
- Issues without `squad:*` labels or matching assignee aliases were silently dropped from velocity
- Fix: added `allClosedIssues?: GitHubIssue[]` parameter to both `buildDashboardData()` and `buildVelocityTimeline()`
- `allClosedIssues` is the unfiltered array from `getClosedIssues()` — every closed issue in the repo
- Deduplication via `Set<number>` on issue number prevents double-counting
- Fallback: if `allClosedIssues` not provided, falls back to iterating `closedIssues` MemberIssueMap (backward compat)
- `closedIssues` MemberIssueMap still used for Team Overview per-member breakdown — that data is correct per-member
- `IGitHubIssuesService` interface extended with `getClosedIssues()` — already existed on GitHubIssuesService, just not in the contract
- Key files: `DashboardDataBuilder.ts` (velocity logic), `SquadDashboardWebview.ts` (data fetch), `models/index.ts` (interface)
 Team update (2026-02-18): Active-work marker protocol for detecting agent status during subagent turns  decided by Danny

### Velocity Chart: Session Log Inclusion (2026-02-18)
- Velocity chart was undercounting — only orchestration-log tasks and closed GitHub issues were counted
- Session logs in `log/` contain real completed work (issue refs, outcomes, participants) but were excluded by `getTasks()` which deliberately uses orchestration-only entries
- Added `getVelocityTasks()` to `SquadDataProvider` — uses `getLogEntries()` (all logs) instead of `getOrchestrationLogEntries()`
- `getTasks()` unchanged — orchestration-only for member status isolation and tree view correctness
- `DashboardDataBuilder.buildDashboardData()` now accepts optional 9th param `velocityTasks?: Task[]`; velocity timeline uses `velocityTasks ?? tasks`
- Activity swimlanes still use orchestration-only `tasks` — only velocity benefits from session logs
- Architectural principle: velocity = all work signals; status = orchestration-only (prevents false "working" indicators from old session logs)

### Dashboard & Decisions Pipeline Deep Dive (2026-02-18)
- **Bug: Hardcoded `.ai-team` in `SquadDataProvider.discoverMembersFromAgentsFolder()`** — line 271 used `'.ai-team'` literal instead of `this.squadFolder`. Agent folder fallback broken for `.squad` users. Fixed.
- **Bug: Hardcoded `.ai-team` in `SquadDashboardWebview.handleOpenLogEntry()`** — line 167 used `'.ai-team'` literal. Clicking "Recent Sessions" log cards failed for `.squad` users. Fixed by adding `getSquadFolder()` to `SquadDataProvider`.
- **Bug: `DecisionsTreeProvider` created `DecisionService()` without `squadFolder`** — line 434 used default `.ai-team`. Decisions tree was empty for `.squad` workspaces. Fixed: constructor now accepts and passes `squadFolder`.
- **Bug: `TeamTreeProvider` created `OrchestrationLogService()` without `squadFolder`** — line 42. Member log entries in tree view broken for `.squad` users. Fixed: constructor now accepts and passes `squadFolder`.
- Key files: `src/services/SquadDataProvider.ts` (data aggregation, caching, member resolution chain), `src/views/SquadDashboardWebview.ts` (webview panel, data fetch orchestration), `src/views/dashboard/DashboardDataBuilder.ts` (data transformation for charts), `src/views/dashboard/htmlTemplate.ts` (HTML + JS rendering, ~1226 lines)
- HTML template has good null guards: all `render*()` functions check for empty/undefined arrays before iterating. Canvas charts check `offsetWidth === 0` to skip hidden tabs. Empty states shown for missing data.
- `DashboardDataBuilder.buildDashboardData()` always returns fully-populated `DashboardData` — no null fields in the structure.
- `DecisionService` handles missing file (returns early), empty file (no headings found), and inbox subdirectories (recursive `scanDirectory`). Graceful: never throws.


### Team Update: 2026-02-23 - Fork-Aware Issue Fetching
 **Team update (2026-02-23):** Fork-aware issue fetching shipped: when repo is a fork, SquadUI auto-detects upstream via GitHub API (GET /repos/{owner}/{repo}  parent), with manual override via team.md **Upstream** | owner/repo. All issue queries (open, closed, milestones) use upstream. Fallback to configured repo if not a fork. No breaking changes  repos without forks behave identically.  decided by @copilot

### Feature Roadmap & Assignments (2026-02-24)
📌 Team update (2026-02-23): Feature roadmap defined — 10 features across v1.0/v1.1/v1.2. See decisions.md.
   - P1 features assigned: Decision Search & Filter (#69), Health Check (#70), Milestone Burndown Template (#75)
   - P2 features assigned: Skill Usage Metrics (#74)
   - v1.0 ship target with focus on decision search service, diagnostic tooling
   - v1.1 enables observability (skills usage, burndown metrics)
   - Key implementation: DecisionService.search() and HealthCheck diagnostic command
   - Roadmap session logged to .ai-team/log/2026-02-23-feature-roadmap.md

### DecisionSearchService (#69) (2026-02-24)
- Created DecisionSearchService in src/services/DecisionSearchService.ts - pure service, no file I/O, no VS Code deps
- Methods: search(), filterByDate(), filterByAuthor(), filter() (combined criteria)
- Search ranking: title match (weight 10) > author match (weight 5) > content match (weight 3)
- Multi-word queries split on whitespace; each term scored independently and summed
- filterByDate() uses string comparison on YYYY-MM-DD keys (avoids timezone issues)
- filterByAuthor() is case-insensitive substring match
- filter() chains: search first (preserves ranking order) then date range then author
- Open-ended date ranges: omit startDate or endDate in DecisionSearchCriteria
- Decisions without date excluded from date filters; decisions without author excluded from author filters
- Exported DecisionSearchCriteria and ScoredDecision interfaces for consumer use
- 37 tests in decisionSearchService.test.ts covering all methods and edge cases
- Service is decoupled from DecisionService - operates on DecisionEntry[], not files
- UI integration (tree view search box, filter controls) is Rusty's follow-up
Key milestones:
- Core data pipeline: OrchestrationLogService, TeamMdService, SquadDataProvider
- GitHub issues integration with graceful degradation
- H1 decision format support
- Test hardening patterns
- Dashboard bugfixes (squad folder awareness, velocity chart, session log inclusion)
- Fork-aware issue fetching (2026-02-23)
