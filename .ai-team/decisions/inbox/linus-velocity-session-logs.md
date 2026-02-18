# Decision: Velocity chart uses all logs; status stays orchestration-only

**Date:** 2026-02-18
**Author:** Linus
**Issue:** Velocity chart undercounting — session logs excluded

## Context
The velocity/activity chart only counted tasks from `orchestration-log/` and closed GitHub issues. Session logs in `log/` represent real completed work but were never reflected in velocity.

## Decision
- Added `getVelocityTasks()` to `SquadDataProvider` — extracts tasks from ALL logs (both `orchestration-log/` and `log/`).
- `getTasks()` remains orchestration-only to preserve member status isolation and tree view behavior.
- `DashboardDataBuilder.buildDashboardData()` accepts an optional `velocityTasks` parameter; when provided, velocity timeline uses it instead of `tasks`.
- Activity swimlanes still use orchestration-only `tasks` — only velocity benefits from session logs.

## Rationale
Session logs contain issue references, outcomes, and participants that represent real work. Excluding them from velocity makes the chart misleading (e.g., zero activity for days that had 8+ session logs). The separation keeps member status correct (no false "working" indicators from old session logs) while giving velocity the full picture.
