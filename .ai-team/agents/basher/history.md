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
