# Project Context

- **Owner:** Jeffrey T. Fritz (csharpfritz@users.noreply.github.com)
- **Project:** VS Code extension for visualizing Squad team members and their tasks
- **Stack:** TypeScript, VS Code Extension API, potentially GitHub Copilot integration
- **Created:** 2026-02-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-02-13: Data Layer Integration Tests (Issue #12)

Created comprehensive integration tests for the data layer services:

**Test file:** `src/test/suite/services.test.ts`

**OrchestrationLogService tests:**
- `discoverLogFiles()`: finds .md files, sorts chronologically, handles missing directories
- `parseLogFile()`: extracts date, topic, participants, timestamp, decisions, outcomes, related issues
- `parseAllLogs()`: parses all files, sorts by date (newest first), skips malformed files gracefully
- `getMemberStates()`: returns working/idle states based on most recent entry
- `getActiveTasks()`: extracts tasks from related issues, assigns members, deduplicates

**SquadDataProvider tests:**
- `getSquadMembers()`: returns members with name, status, role, caching
- `getTasksForMember()`: filters tasks by assignee
- `getWorkDetails()`: returns task + member + related log entries
- `refresh()`: invalidates all caches

**FileWatcherService tests:**
- Module import validation
- Constructor with custom debounce (limited testing due to VS Code API dependency)

**Edge case tests:**
- Empty log files
- Missing directories
- Files without date prefix
- Special characters in participant names
- Whitespace-only files

**Test fixtures:** Updated `test-fixtures/.ai-team/orchestration-log/` with proper format matching service's expected structure (`**Participants:**` format, `## Decisions`, `## Outcomes` sections).

**Key insight:** The OrchestrationLogService expects specific markdown formats (`**Participants:** Name1, Name2` or `## Who worked` section with bullet list). Test fixtures must match these patterns.

### 2026-02-13: Test Infrastructure Setup

- Added test framework: @vscode/test-electron, mocha, @types/mocha, glob
- Created `src/test/` directory structure with suite runner
- Test command: `npm test` (compiles then runs via VS Code test runner)

### Test Coverage Created

1. **treeProvider.test.ts** - SquadTreeProvider tests:
   - `getChildren()` returns members at root level
   - `getChildren(member)` returns member's tasks
   - Icons: `sync~spin` for working members, `person` for idle
   - Tasks get `tasklist` icon
   - `refresh()` triggers `onDidChangeTreeData` event
   - Tooltips are MarkdownStrings

2. **webview.test.ts** - WorkDetailsWebview tests:
   - Status badge generation (pending/in_progress/completed)
   - Member status badges (working/idle)
   - `getInitials()` extracts name initials correctly
   - `escapeHtml()` prevents XSS
   - HTML generation includes all required sections
   - Handles missing description/dates gracefully

3. **extension.test.ts** - Extension activation tests:
   - Commands `squadui.showWorkDetails` and `squadui.refreshTree` registered
   - View contributions present

### Mock Infrastructure

- `mocks/vscode.ts` - VS Code API mocks (EventEmitter, TreeItem, etc.)
- `mocks/squadDataProvider.ts` - Mock data provider with test fixtures

### 2026-02-13: Empty Tree View Root Cause Analysis (Issue #19)

**Problem:** Tree view shows no content when `.ai-team/orchestration-log/` folder is empty.

**Root Cause:** `SquadDataProvider.getSquadMembers()` builds the member list exclusively from orchestration log participants. No logs = no participants = empty tree.

**Data Flow Traced:**
1. `extension.ts` → creates `SquadDataProvider(workspaceRoot)`
2. `SquadTreeProvider.getSquadMemberItems()` → calls `dataProvider.getSquadMembers()`
3. `getSquadMembers()` → calls `orchestrationService.parseAllLogs()`
4. `parseAllLogs()` → calls `discoverLogFiles()` → returns `[]` (empty folder)
5. Member list built from empty entries → returns `[]`
6. Tree renders nothing

**Design Gap:** The canonical team roster lives in `.ai-team/team.md`, not orchestration logs. Logs track activity, not membership.

**Recommendation:** Create `TeamMdService` to parse team.md as primary member source. Overlay activity status from logs.

**Diagnosis written to:** `.ai-team/decisions/inbox/basher-empty-tree-diagnosis.md`

### 2026-02-14: Team Update — SquadDataProvider team.md Fallback Pattern (Decision Merged)

📌 **Team decision accepted:** SquadDataProvider now reads team.md as authoritative member roster, falling back to log participants if team.md is missing. This implements the recommendation from the empty tree view diagnosis. — decided by Linus

### 2026-02-14: v0.2.0 Service Tests (Issue #23)

**New test files created:**

1. **`src/test/suite/teamMdService.test.ts`** (30 tests):
   - Tests `parseTeamMd()` and `parseContent()` across multiple formats
   - Covers all status badge emoji variants (✅, 📋, 🔄, 🤖, 🔨)
   - Tests @copilot capability extraction (auto-assign, inline, detailed formats)
   - Edge cases: special characters, empty content, large rosters, coordinator filtering

2. **`src/test/suite/squadDataProviderFallback.test.ts`** (13 tests):
   - Primary path: team.md as authoritative roster with log status overlay
   - Fallback path: log-participant discovery when team.md missing
   - Integration tests: full team.md-only data flow through SquadDataProvider
   - Validates refresh() re-reads updated team.md

3. **`src/test/suite/gitHubIssuesService.test.ts`** (17 tests):
   - `getIssueSource()`: parses owner/repo and github.com/owner/repo formats
   - Squad label filtering: case-insensitive matching via `squad:{name}` labels
   - Cache management: invalidation, TTL expiry, token rotation
   - Constructor options: custom TTL, API URL, token

**Key testing patterns established:**
- GitHubIssuesService tests inject data into private `cache` property via type casting to avoid real API calls
- Temp directories created per-test in `test-fixtures/temp-*` with teardown cleanup
- Tests create their own team.md content inline rather than relying on shared fixtures when testing specific formats

**Fixture note:** The test-fixtures/team.md has `**Owner:** TestOwner` where the `extractOwner()` regex captures content after `**Owner:**` to `(` or end of match group — on Windows with CRLF line endings this includes trailing content. Tests use `.startsWith()` for robustness.

### 2026-02-13: Acceptance Test — Full Data Pipeline (Orchestration Logs → Tree View)

**Test file:** `src/test/suite/acceptance.test.ts` (25 tests)

**What it validates:** The complete integration from fixture files through OrchestrationLogService → SquadDataProvider → SquadTreeProvider. No service mocks — only VS Code APIs come from the test electron host.

**Dedicated fixtures:** `test-fixtures/acceptance-scenario/` with its own team.md (3 members: Alice/Lead, Bob/Backend Dev, Carol/Tester) and two orchestration log files creating a known state where Carol is "working" (most recent log) and Alice/Bob are "idle".

**Task assignment model:** `getActiveTasks()` assigns tasks to the first participant listed in a log entry. If Alice and Bob are both participants but Alice is listed first, only Alice gets the tasks. Bob shows up in the tree with zero task children. This is intentional current behavior, not a bug.

**Tree item contract verified:**
- Root nodes = all team.md members, with `itemType: 'member'`, collapsible
- Task children have `itemType: 'task'`, `ThemeIcon('tasklist')`, `squadui.showWorkDetails` command with task ID arg
- Working members get `sync~spin` icon, idle get `person`
- Member descriptions follow `{role} • {status}` format
- All tooltips are `MarkdownString` instances

**Pattern:** Acceptance fixtures are isolated in their own directory to avoid interference with other tests that use `test-fixtures/` root fixtures.
