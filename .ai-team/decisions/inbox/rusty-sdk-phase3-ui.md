# SDK Phase 3 — UI Layer Compatibility & SDK Visibility

**Author:** Rusty (Extension Dev)
**Date:** 2026-03-27
**Context:** SDK Migration Phase 3

## Decisions

### 1. All UI components are compatible with SDK-adapted data — no changes needed

**Decision:** After auditing all 8 UI components (3 tree providers, 4 webviews, 1 status bar), confirmed that every consumer accesses team/decision data through typed interfaces (`SquadMember`, `DecisionEntry`, etc.) via `SquadDataProvider`. No `instanceof` checks on model objects, no hard-coded field accesses, no serialization issues. The SDK adapter's output is fully compatible.

**Rationale:** The adapter maps SDK types (`ParsedAgent`, `ParsedDecision`) to the same SquadUI interfaces the UI already consumes. The data flow is: SDK → adapter → service → typed interface → UI component. Since the adapter output matches the existing interfaces exactly, no UI changes were required for compatibility.

### 2. SDK version displayed in status bar tooltip

**Decision:** Show SDK version in the status bar tooltip footer (e.g., `SDK v0.3.0`) when the Squad SDK is installed. Uses `getSquadSdkVersion()` from the adapter, with graceful fallback when unavailable.

**Rationale:** Gives users and developers a quick way to verify which SDK version is active without opening a terminal. Non-intrusive (tooltip only, not main status bar text). Follows the existing pattern where status bar tooltip shows richer detail.

### 3. SDK version included in health check diagnostics

**Decision:** Added `checkSdkVersion()` to `HealthCheckService.runAll()`. Reports `pass` with version when SDK is found, `warn` when missing or version can't be determined.

**Rationale:** Health check is the natural place for "is my environment set up correctly?" diagnostics. SDK availability is now surfaced alongside team.md, agent charters, logs, and GitHub config checks.

## Impact

- Status bar tooltip now shows SDK version when available
- Health check `runAll()` returns 5 results (was 4) — tests updated
- No breaking changes to existing UI behavior
