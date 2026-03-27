# Decision: SDK Adapter Phase 2 — Wrapper Adapter Pattern

**Date:** 2026-03-27
**Author:** Linus
**Issue:** SDK Migration Phase 2

## Context

Phase 2 wraps HealthCheckService, SquadVersionService, and squadFolderDetection (WorkspaceScanner equivalent) with SDK functionality. The key tension is adding SDK value without breaking existing callers or test contracts.

## Decision

1. **Additive public methods over modified signatures.** New SDK-powered functionality is exposed as new methods (`checkSquadConfig()`, `getSdkVersion()`, `scanWorkspaces()`) rather than changing existing method signatures. Existing `runAll()` still returns exactly 4 checks.

2. **Internal SDK enhancement with graceful degradation.** Existing methods like `checkTeamMd()` use SDK parsing internally as a supplementary validation layer. If SDK fails, the result is unchanged — no catch block alters the primary health check outcome.

3. **Optional fields for backward compatibility.** `UpgradeCheckResult.sdkVersion` is an optional field. Existing callers that destructure `{ available, currentVersion, latestVersion }` are unaffected.

4. **Adapter owns all SDK module caches.** `src/sdk-adapter/index.ts` now caches three SDK module references: `_parsers`, `_resolution`, and `_sdkMain`. All other files import only from the adapter — never from `@bradygaster/squad-sdk` directly.

5. **`scanWorkspaces()` replaces manual multi-root detection.** The new function in `squadFolderDetection.ts` uses the SDK's `resolveSquad()` walk-up algorithm for each workspace root, which handles worktrees and nested projects better than `fs.existsSync` checks.

## Rationale

- Zero-breakage constraint: 1172 tests must pass with no changes to test files
- SDK functions are async (due to ESM dynamic import) — can't replace sync functions, only supplement them
- The SDK's `loadConfig()` is valuable but most projects don't have config files yet — opt-in via `checkSquadConfig()`
- The SDK's `VERSION` constant is trivially useful and reliable

## Impact

- Extension code can now call `service.getSdkVersion()` to display SDK version in UI
- `checkSquadConfig()` is available for future integration into diagnostic commands
- `scanWorkspaces()` is ready for multi-root workspace support in extension.ts
- Phase 3 can now focus on higher-risk service replacements knowing the adapter pattern is proven
