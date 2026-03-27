# Orchestration Log Entry

> One file per agent spawn. Saved to `.ai-team/orchestration-log/{timestamp}-{agent-name}.md`

---

### 2026-03-27 — Fix 11 failing tests in task extraction from orchestration logs

| Field | Value |
|-------|-------|
| **Agent routed** | Linus (Backend Dev) |
| **Why chosen** | Test failures in `OrchestrationLogService` — data service layer work matches Linus's expertise in parsing, data models, and TypeScript services |
| **Mode** | `background` |
| **Why this mode** | No hard dependencies on user decisions; service-layer fix can be validated autonomously with test suite |
| **Files authorized to read** | `src/services/OrchestrationLogService.ts`, `src/test/suite/orchestrationTaskPipeline.test.ts`, `src/models/index.ts`, `package.json` |
| **File(s) agent must produce** | `src/services/OrchestrationLogService.ts` (staleness filter fix), test setup updates in `orchestrationTaskPipeline.test.ts` |
| **Outcome** | **Completed successfully** — All 1112 tests passing. Root cause: staleness filter time-bomb using `Date.now()` against historical dataset entries. Fixed by making staleness relative to newest entry in the batch instead of wall clock. |

---

## Summary

**Root Cause:** `getActiveTasks()` in `OrchestrationLogService.ts` was filtering tasks based on wall-clock `Date.now()` as staleness reference. Test fixtures with hardcoded Feb 2026 dates became stale once those dates aged past the 30-day threshold, causing 11 tests to fail intermittently.

**Fix Applied:**
1. Changed staleness calculation to use `Math.max(...taskDates)` (newest entry in batch) as the reference point
2. Tasks are now stale only if >30 days older than the newest entry, not the wall clock
3. Updated test in `orchestrationTaskPipeline.test.ts` to include both old and recent entries for proper relative reference

**Key Architectural Principle:** Never use `Date.now()` for staleness in methods operating on dataset batches with potentially historical dates. Use the dataset's own temporal context instead.

**Impact:** 0 regressions, all 1112 tests pass.
