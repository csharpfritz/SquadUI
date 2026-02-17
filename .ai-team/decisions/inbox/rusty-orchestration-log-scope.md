# Orchestration Log vs Session Log Scope

**Date:** 2026-02-17  
**Author:** Rusty  
**Status:** Proposed

## Context

The `OrchestrationLogService` previously read from BOTH `orchestration-log/` and `log/` directories. The sidebar was falsely reporting agents as "working" on completed issues because session logs in `log/` contain narrative references to issues (e.g., "Assigned to issue #22", "PR #28 opened"), and these were being parsed as active tasks.

## Decision

**Task status and member working state derivation must ONLY use `orchestration-log/` files. Session logs in `log/` are historical records and should never affect active status.**

## Implementation

- Added `discoverOrchestrationLogFiles()` and `parseOrchestrationLogs()` methods to `OrchestrationLogService` that only read from `orchestration-log/`.
- `SquadDataProvider` uses these methods internally for `getSquadMembers()` and `getTasks()`.
- The existing `discoverLogFiles()` and `parseAllLogs()` methods remain for display purposes (e.g., Recent Activity panel, log entry cards).

## Rationale

The `log/` directory contains **session logs** — Scribe's narrative records of past work sessions. These logs reference issues in historical context for documentation purposes, but they are NOT orchestration status data. Treating them as such creates false positives.

The `orchestration-log/` directory contains **orchestration entries** — structured status records that drive the sidebar's task and member state display.

## Alternatives Considered

**Option A (rejected):** Remove `'log'` from `LOG_DIRECTORIES` entirely. This would break display features that legitimately need to show session logs.

**Option B (chosen):** Create separate discovery/parsing methods for orchestration-only data. This preserves display functionality while fixing the false-positive bug.

## Consequences

- Task status is now accurate — no false "working" indicators from old session logs.
- Session logs remain visible in Recent Activity and other display contexts.
- Future services that need orchestration data should use `parseOrchestrationLogs()`, not `parseAllLogs()`.
