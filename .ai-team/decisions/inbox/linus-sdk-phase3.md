# Decision: SDK Data Model Harmonization (Phase 3)

**Date:** 2026-03-27
**Author:** Linus
**Issue:** SDK Migration Phase 3

## Context

Phases 1–2 established the SDK adapter with individual mapping functions and service integrations. Phase 3 formalizes the type mapping contract and adds the infrastructure for future SDK-first development.

## Decision

1. **All adapter mapping functions have comprehensive JSDoc** documenting the field-by-field mapping contract, lossy conversions (SDK fields SquadUI ignores like `skills`, `model`, `aliases`, `autoAssign`, `configRelevant`, `headingLevel`), and SquadUI fields not in SDK (`activityContext`, `currentTask`, `filePath`, `lineNumber`).

2. **Mapping options via `AdaptAgentOptions` and `AdaptDecisionOptions`** allow callers to customize behavior (e.g., `defaultStatus` for agents, `lineNumberOffset` for decisions) without changing the core mapping logic.

3. **Bulk mapping functions** (`adaptAgentsToMembers()`, `adaptDecisionsToEntries()`) are the recommended way to map arrays. `adaptDecisionsToEntries` assigns sequential `lineNumber` from array index.

4. **`getSquadMetadata(workspaceRoot)`** is the new high-level integration point returning `SquadMetadata` — a single async call that returns adapted members, decisions, config status, SDK version, detected squad folder, and accumulated warnings. All operations are parallel with individual fault tolerance.

5. **No routing adapter** was created because SquadUI has no routing display concept and the SDK doesn't export routing rules. This can be added in a future phase if either side introduces routing.

6. **`src/sdk-adapter/README.md`** is the authoritative reference for type mapping, architecture, and usage patterns.

## Rationale

- Comprehensive JSDoc prevents future developers from guessing how SDK ↔ SquadUI mapping works
- `getSquadMetadata()` eliminates the need for services to independently coordinate SDK calls
- Bulk helpers reduce boilerplate in callers and ensure consistent options application
- 37 integration tests with edge cases (Unicode, 50K strings, 100-agent arrays, null-like values) provide confidence in the mapping layer

## Impact

- All SDK imports remain in `src/sdk-adapter/` — no exceptions
- Existing service APIs unchanged — additive only
- 1209 tests pass (37 new), 0 regressions
- Future SDK work should reference `src/sdk-adapter/README.md` for the type mapping contract
