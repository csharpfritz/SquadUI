# Session Log — 2026-03-27 — Fix Failing Tests

## Summary

Fixed 11 failing tests in `OrchestrationLogService.ts` task extraction pipeline. Root cause: staleness filter time-bomb using `Date.now()` as reference against historical dataset entries.

## Who Worked

- **Linus** (Backend Dev) — service layer fix

## What Was Done

1. Diagnosed root cause in `getActiveTasks()` staleness filter
2. Changed staleness calculation to use newest-entry-relative reference (not wall clock)
3. Updated test setup to include both old and recent entries for proper relative comparison
4. Verified all 1112 tests pass with 0 regressions

## Key Outcome

**Architectural principle discovered:** Never use `Date.now()` for staleness in methods operating on dataset batches with potentially historical dates. Use the dataset's own temporal context instead.

## Files Changed

- `src/services/OrchestrationLogService.ts` — staleness filter (line ~XXX)
- `src/test/suite/orchestrationTaskPipeline.test.ts` — test setup updates

## Status

✅ Complete — All tests passing
