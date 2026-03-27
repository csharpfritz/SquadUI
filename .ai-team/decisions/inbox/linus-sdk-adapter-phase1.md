# Decision: Squad SDK Adapter Pattern (Phase 1)

**Date:** 2026-03-27
**By:** Linus

## Context

SquadUI needs to migrate from custom file parsers to the Squad SDK (`@bradygaster/squad-sdk@0.9.1`). The SDK is ESM-only; SquadUI compiles to CommonJS. This decision covers the interop strategy and adapter pattern.

## Decision

1. **Single adapter module** at `src/sdk-adapter/index.ts` — all SDK imports go through here. No other SquadUI file may import from `@bradygaster/squad-sdk`.
2. **ESM/CJS interop** via `new Function('specifier', 'return import(specifier)')` — bypasses TypeScript's `import()` → `require()` transform in CJS mode.
3. **Lazy loading with caching** — SDK modules loaded on first call, cached for subsequent calls.
4. **Dual-path migration** — existing sync methods preserved (`parseContent()`, `getDecisions()`, `detectSquadFolder()`). New async SDK-powered variants added alongside (`parseContentWithSdk()`, `getDecisionsWithSdk()`, `detectSquadFolderWithSdk()`). `parseTeamMd()` uses SDK by default with fallback to built-in.
5. **Adapter compensates for SDK limitations:**
   - Agent name capitalization (SDK lowercases to kebab-case)
   - Decision metadata extraction from body (`**Date:**`, `**Author:**`) when SDK doesn't provide it

## Rationale

- Adapter pattern isolates SDK dependency — if the SDK changes or is removed, only one file needs updating.
- Dynamic import workaround is a well-known pattern in the Node.js ecosystem for ESM/CJS interop.
- Dual-path approach ensures zero breakage during migration; callers can gradually shift to SDK-powered methods.
- Name capitalization and metadata extraction in the adapter keep downstream code clean.
