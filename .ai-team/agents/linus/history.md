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
