# Test Strategy for Status Override Logic

**Date:** 2026-02-22
**Author:** Basher
**Issue:** #63

## Decision

For testing status override logic and completion signal detection, use synthetic `OrchestrationLogEntry` objects instead of temp files on disk.

## Context

Issue #63 involved two behavior changes:
1. SquadDataProvider working-to-idle override now distinguishes between "no tasks at all" (Copilot Chat, stay working) vs "tasks but none active" (show idle)
2. OrchestrationLogService now checks outcomes for completion signals when extracting tasks from relatedIssues

Both behaviors required comprehensive test coverage.

## Rationale

- **Synthetic entries are faster** — No disk I/O, temp directory cleanup, or async file operations
- **Synthetic entries are clearer** — Test data is inline with assertions, easier to read and maintain
- **Follows existing patterns** — `orchestrationTaskPipeline.test.ts` already uses synthetic entries for unit testing getActiveTasks()
- **Integration tests still use disk** — Where file parsing is the behavior under test (e.g., parseLogFile), we still use temp fixtures

## Implementation

- Import `OrchestrationLogEntry` type from `../../models`
- Construct minimal entry objects with required fields: `timestamp`, `date`, `topic`, `participants`, `summary`
- Add optional fields as needed: `relatedIssues`, `outcomes`
- SquadDataProvider tests still use temp directories because they test the full member resolution flow including team.md parsing

## When to Use Each Approach

- **Synthetic entries:** Unit testing task extraction, member states, completion signals
- **Temp files:** Integration testing file parsing, directory scanning, multi-file workflows
