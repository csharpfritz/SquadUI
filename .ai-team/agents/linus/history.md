# Project Context

- **Owner:** Jeffrey T. Fritz (csharpfritz@users.noreply.github.com)
- **Project:** VS Code extension for visualizing Squad team members and their tasks
- **Stack:** TypeScript, VS Code Extension API, potentially GitHub Copilot integration
- **Created:** 2026-02-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-02-13: Orchestration Log Structure

The Scribe creates session logs in `.ai-team/log/{YYYY-MM-DD}-{topic}.md`. Based on analysis of the Scribe charter, each log entry captures:
- **Who worked**: List of squad members who participated
- **What was done**: Summary of work accomplished
- **Decisions made**: Any decisions recorded during the session
- **Key outcomes**: Artifacts or results produced

The `OrchestrationLogEntry` interface models this structure with fields for timestamp, date, topic, participants, summary, decisions, outcomes, and related issues.

### 2026-02-13: Team Member Model

Squad members are defined in `.ai-team/team.md` with roles like Lead, Extension Dev, Backend Dev. For the SquadUI extension, member status is simplified to 'working' | 'idle' rather than the broader status markers in team.md (Active, Silent, Monitor) since those are configuration-time statuses, not runtime statuses.

### 2026-02-13: Orchestration Log Test Fixtures

Created test fixtures in `test-fixtures/orchestration-logs/` for development and testing. Fixtures cover:
- Active member (working status)
- Completed session (idle status)
- Multi-participant session
- Edge cases: empty log, minimal log

README documents the log format, section requirements, and usage patterns for tests and local development.

### 2026-02-13: OrchestrationLogService Implementation

Implemented `OrchestrationLogService` in `src/services/OrchestrationLogService.ts` with:
- `discoverLogFiles()`: Searches both `.ai-team/orchestration-log/` and `.ai-team/log/` directories
- `parseLogFile()`: Parses markdown log files, extracting date/topic from filename, participants, summary, decisions, outcomes, and related issues
- `parseAllLogs()`: Batch parsing with graceful error handling for malformed files
- `getMemberStates()`: Derives member working/idle status from most recent log entry
- `getActiveTasks()`: Extracts tasks from related issues and outcomes, detecting completion status

Parser handles multiple markdown formats (bold headers, sections, bullet lists) and falls back gracefully when sections are missing.

### 2026-02-14: FileWatcherService Implementation

Implemented `FileWatcherService` in `src/services/FileWatcherService.ts` for Issue #4:
- Watches `.ai-team/orchestration-log/**/*.md` using VS Code's `createFileSystemWatcher()` API
- Emits events (created/changed/deleted) via callback registration with `onFileChange()`
- Debounces rapid changes with configurable delay (default 300ms) to prevent thrashing
- Supports `CacheInvalidator` interface for SquadDataProvider integration
- Implements `vscode.Disposable` for proper cleanup on extension deactivation
- Coalesces multiple events for same file during debounce window

Key design decisions:
- Separate `start()`/`stop()` methods allow controlled lifecycle
- Event callbacks receive `FileWatcherEvent` with type, URI, and timestamp
- Cache invalidators are notified before event callbacks for proper ordering
- All callbacks wrapped in try/catch to prevent one failing callback from blocking others

### 2026-02-13: SquadDataProvider Implementation

Implemented `SquadDataProvider` in `src/services/SquadDataProvider.ts` with:
- `getSquadMembers()`: Returns all squad members with status derived from log entries
- `getTasksForMember(memberId)`: Returns tasks assigned to a specific member
- `getWorkDetails(taskId)`: Returns full task details including member and related log entries
- `refresh()`: Invalidates all cached data for FileWatcherService integration

Service aggregates data from OrchestrationLogService with internal caching. Cache is populated on first access and invalidated only when `refresh()` is called. Keeps UI layer decoupled from file parsing logic.

### 2026-02-14: TeamMdService Implementation

Implemented `TeamMdService` in `src/services/TeamMdService.ts` for Issue #21:
- `parseTeamMd(workspaceRoot)`: Reads and parses `.ai-team/team.md` files
- Returns `ExtendedTeamRoster` with members array, repository, owner, and copilotCapabilities
- Parses Members markdown table: extracts name, role, charter path, and status badge
- Extracts @copilot capability profile including auto-assign flag from HTML comment
- Handles both detailed (bulleted list) and inline (comma-separated) capability formats
- Returns null if file doesn't exist (graceful handling)

Key parsing decisions:
- Status badges (✅ Active, 📋 Silent, etc.) map to 'idle' since they're configuration status, not runtime status
- Runtime status is determined by OrchestrationLogService
- Coordinator entries in the table are skipped (separate section)
- CopilotCapabilities extracts 🟢 good fit, 🟡 needs review, 🔴 not suitable lists

### 2026-02-14: SquadDataProvider team.md Fallback Pattern

`SquadDataProvider.getSquadMembers()` uses a two-tier member resolution strategy:
1. **Primary:** `TeamMdService.parseTeamMd()` provides the authoritative roster with real roles from team.md
2. **Overlay:** `OrchestrationLogService.getMemberStates()` overlays working/idle status from logs
3. **Fallback:** If team.md is missing or has no members, derives members from log participants with generic 'Squad Member' role

Key design choices:
- team.md members always appear even with zero log activity (status defaults to 'idle')
- Roles from team.md are preserved (not overwritten with generic text)
- The fallback path preserves backward compatibility with projects that have logs but no team.md
- Both services are instantiated in the constructor; team.md is read fresh on each cache-miss call to `getSquadMembers()`

### 2026-02-13: GitHubIssuesService Implementation

Implemented `GitHubIssuesService` in `src/services/GitHubIssuesService.ts` for Issue #18:
- `getIssueSource(workspaceRoot)`: Reads Issue Source section from team.md via TeamMdService
- `getIssues(workspaceRoot, forceRefresh?)`: Fetches open issues from GitHub REST API with automatic pagination
- `getIssuesForMember(workspaceRoot, memberName)`: Filters issues by `squad:{name}` label (case-insensitive)
- `getIssuesByMember(workspaceRoot)`: Returns Map<string, GitHubIssue[]> grouping all issues by member
- `invalidateCache()` / `invalidateAll()`: Cache control, `invalidateAll` also clears Issue Source config
- `setToken(token)`: Allows runtime auth token updates without recreating the service

Key design decisions:
- Uses Node.js `https` module (no fetch polyfill, no dependencies)
- Auth token is optional: works unauthenticated (60 req/hr) or with token (5000 req/hr)
- 5-minute default cache TTL, configurable via `GitHubIssuesServiceOptions.cacheTtlMs`
- GitHub `/issues` endpoint returns PRs too — service filters them out via `pull_request` field
- Graceful degradation: if API fails mid-pagination, returns partial results instead of throwing
- Issue Source parsing handles both `owner/repo` and `github.com/owner/repo` URL formats

Models added to `src/models/index.ts`:
- `GitHubIssue`: number, title, body, state, labels, assignee, htmlUrl, createdAt, updatedAt
- `GitHubLabel`: name, color
- `IssueSourceConfig`: repository, owner, repo, filters

### 2026-02-14: GitHubIssuesService — Closed Issues Support

Extended `GitHubIssuesService` with closed issue fetching for completed work history:
- `getClosedIssues(workspaceRoot, forceRefresh?)`: Fetches `state=closed` issues from GitHub API, limited to 50 most recently updated (single page, no pagination)
- `getClosedIssuesByMember(workspaceRoot)`: Groups closed issues by squad member using `squad:{name}` label convention with case-insensitive matching
- Separate `closedCache` keeps closed issue data independent from the open issues cache
- `invalidateCache()` and `invalidateAll()` clear both open and closed caches
- Added `getClosedIssuesByMember` to `IGitHubIssuesService` interface in `src/models/index.ts`

Key design decisions:
- 50-issue limit on closed issues keeps API calls fast and avoids excessive data for history display
- Single-page fetch (no pagination loop) — 50 is enough for recent history and avoids extra API calls
- Separate cache allows open and closed issues to have independent lifecycles
- Existing open issue methods left completely untouched

### 2026-02-14: Team Update — Closed Issues Architecture Decision (Decision Merged)

📌 **Team decision captured:** Closed issues use a separate `closedCache` field independent from open issues. Fetch at most 50 (single page, no pagination) sorted by updated_at descending. Use case-insensitive member matching via `squad:{name}` labels. — decided by Linus

### 2026-02-13: OrchestrationLogService — Multi-Directory Discovery and Format Tolerance

`discoverLogFiles()` now returns the union of files from ALL configured log directories (`orchestration-log/` and `log/`), not just the first one that has files. Real-world repos like MyFirstTextGame use both directories — `orchestration-log/` contains routing metadata with `**Agent routed**` fields, while `log/` contains session logs with `**Participants:**` and issue references.

The filename regex in `parseLogFile()` now handles both `YYYY-MM-DD-topic.md` and `YYYY-MM-DDThhmm-topic.md` formats via the optional group `(?:T\d{4})?`. The orchestration-log directory uses the `T`-separated timestamp format.

`extractParticipants()` now has a fallback for the `**Agent routed**` table field format used in orchestration-log entries (e.g., `| **Agent routed** | Fury (Lead) |`). The regex matches the markdown table pipe delimiter and strips the `(Role)` suffix to extract just the agent name.
