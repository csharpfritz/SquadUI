# Velocity Session Logs Fix

**Date:** 2026-02-18  
**Requested by:** Jeff (csharpfritz)  
**Participants:** Linus, Basher, Rusty

## What Happened

Linus added `getVelocityTasks()` to `SquadDataProvider` to extract tasks from ALL logs (both `orchestration-log/` and `log/`) for velocity chart rendering. The existing `getTasks()` method remains orchestration-only for member status isolation.

Basher wrote 5 comprehensive tests covering velocityTasks parameter, fallback behavior, session-log IDs, swimlane isolation, and integration with session-log-issues fixture.

`DashboardDataBuilder` now accepts `velocityTasks` as optional 9th parameter; velocity timeline uses it when provided.

`SquadDashboardWebview` fetches velocityTasks alongside tasks.

## Outcome

- 941 tests passing (was 936)
- Build clean
- Velocity chart now counts all completed work, not just orchestration-log tasks
