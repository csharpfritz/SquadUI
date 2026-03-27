# SDK Adapter

> Single integration point between `@bradygaster/squad-sdk` and SquadUI.

## Architecture

All SquadUI code accesses the Squad SDK through this module. **No other file should import directly from `@bradygaster/squad-sdk`.**

```
┌─────────────────────────┐     ┌──────────────────────┐
│   SquadUI Services      │     │  @bradygaster/       │
│   (TeamMdService,       │────▶│  squad-sdk            │
│    DecisionService,     │     │  (ESM-only)          │
│    HealthCheckService,  │     └──────────────────────┘
│    SquadVersionService) │              ▲
└────────┬────────────────┘              │
         │ import                        │ dynamic import()
         ▼                               │
┌─────────────────────────────────────────┐
│         src/sdk-adapter/index.ts        │
│                                         │
│  • Type mirrors (ParsedAgent, etc.)     │
│  • Parser wrappers (async)              │
│  • Mapping functions (sync)             │
│  • Bulk helpers                         │
│  • getSquadMetadata() (high-level)      │
└─────────────────────────────────────────┘
```

### Why a Single Adapter Module

1. **ESM/CJS Isolation** — The SDK is ESM-only while SquadUI compiles to CommonJS. The dynamic import workaround is encapsulated here.
2. **Type Safety** — SDK type mirrors are defined locally, avoiding compile-time ESM resolution issues.
3. **Gap-Filling** — The SDK doesn't extract all metadata SquadUI needs (e.g., `**Date:**` lines). The adapter fills gaps.
4. **Migration Path** — Both old (sync, built-in parser) and new (async, SDK-powered) paths coexist. Services can adopt the SDK incrementally.

## ESM/CJS Interop

TypeScript's `module: "commonjs"` transforms `import()` → `require()`, which can't load ESM. We bypass this:

```typescript
const dynamicImport = new Function('specifier', 'return import(specifier)');
```

This uses Node.js's native ESM dynamic import from CJS (supported since Node 12). SDK modules are lazy-loaded and cached:
- `_parsers` — `@bradygaster/squad-sdk/parsers`
- `_resolution` — `@bradygaster/squad-sdk/resolution`
- `_sdkMain` — `@bradygaster/squad-sdk` (VERSION, loadConfig)

## Type Mapping

### ParsedAgent → SquadMember

| SDK Field (`ParsedAgent`) | SquadUI Field (`SquadMember`) | Mapping |
|--------------------------|-------------------------------|---------|
| `name` (string) | `name` (string) | Capitalized: "danny" → "Danny". `@`-prefixed names kept as-is. |
| `role` (string) | `role` (string) | Direct pass-through |
| `status?` (string) | `status` (MemberStatus) | Derived: contains "working" or "🔨" → `'working'`, else `'idle'` |
| `skills` (string[]) | — | **Lossy**: not in SquadMember model |
| `model?` (string) | — | **Lossy**: not in SquadMember model |
| `aliases?` (string[]) | — | **Lossy**: handled at IssueSourceConfig level |
| `autoAssign?` (boolean) | — | **Lossy**: SDK-specific routing config |
| — | `activityContext?` | **Defaulted**: undefined (runtime-only, from orchestration logs) |
| — | `currentTask?` | **Defaulted**: undefined (runtime-only, from active-work markers) |

### ParsedDecision → DecisionEntry

| SDK Field (`ParsedDecision`) | SquadUI Field (`DecisionEntry`) | Mapping |
|-----------------------------|--------------------------------|---------|
| `title` (string) | `title` (string) | Direct pass-through |
| `body` (string) | `content?` (string) | Renamed: `body` → `content` |
| `date?` (string) | `date?` (string) | Direct if present; else extracted from `**Date:** YYYY-MM-DD` in body |
| `author?` (string) | `author?` (string) | Direct if present; else extracted from `**Author:**` or `**By:**` in body |
| `configRelevant` (boolean) | — | **Lossy**: not in DecisionEntry |
| `headingLevel?` (number) | — | **Lossy**: not in DecisionEntry |
| — | `filePath` (string) | **Caller-supplied**: SDK doesn't track file origins |
| — | `lineNumber?` (number) | **Caller-supplied**: optional line offset |

## Usage Patterns

### Individual Mapping

```typescript
import { adaptParsedAgentToSquadMember, adaptParsedDecisionToDecisionEntry } from '../sdk-adapter';

const member = adaptParsedAgentToSquadMember(sdkAgent);
const entry = adaptParsedDecisionToDecisionEntry(sdkDecision, filePath, lineNumber);
```

### Bulk Mapping

```typescript
import { adaptAgentsToMembers, adaptDecisionsToEntries } from '../sdk-adapter';

const members = adaptAgentsToMembers(sdkResult.agents);
const entries = adaptDecisionsToEntries(sdkResult.decisions, filePath);
```

### High-Level Integration

```typescript
import { getSquadMetadata } from '../sdk-adapter';

const metadata = await getSquadMetadata(workspaceRoot);
// metadata.members — SquadMember[]
// metadata.decisions — DecisionEntry[]
// metadata.config — SDK config status or null
// metadata.sdkVersion — "0.9.1" or null
// metadata.squadFolder — ".squad" | ".ai-team" | null
// metadata.warnings — string[]
```

### Mapping with Options

```typescript
// Override default status for all agents
const members = adaptAgentsToMembers(agents, { defaultStatus: 'reviewing-pr' });

// Apply line offset for decisions parsed from a subset of a file
const entries = adaptDecisionsToEntries(decisions, filePath, { lineNumberOffset: 50 });
```

## What the SDK Provides vs What SquadUI Implements Natively

| Capability | SDK | SquadUI Native | Notes |
|-----------|-----|----------------|-------|
| team.md parsing | ✅ `parseTeamMarkdown()` | ✅ `TeamMdService.parseMembers()` | Both active; SDK used in `parseTeamMd()` with fallback |
| decisions.md parsing | ✅ `parseDecisionsMarkdown()` | ✅ `DecisionService.parseDecisionsMd()` | SDK used in `getDecisionsWithSdk()` with fallback |
| Squad folder detection | ✅ `resolveSquad()` | ✅ `detectSquadFolder()` | SDK walk-up is strictly better for nested projects |
| Config validation | ✅ `loadConfig()` | ❌ | SDK-only; opt-in via `checkSquadConfig()` |
| Version reporting | ✅ `VERSION` constant | ❌ | SDK-only; used by `SquadVersionService` |
| Orchestration logs | ❌ | ✅ `OrchestrationLogService` | SquadUI-specific |
| GitHub issues | ❌ | ✅ `GitHubIssuesService` | SquadUI-specific |
| Dashboard/Webview | ❌ | ✅ `SquadDashboardWebview` | SquadUI-specific |
| Active-work markers | ❌ | ✅ `SquadDataProvider` | SquadUI-specific |

## Testing

Integration tests are in `src/test/suite/sdkModelHarmonization.test.ts`:
- Bulk mapping correctness and ordering
- Round-trip consistency (SDK data → adapt → validate)
- Edge cases: empty arrays, null fields, long strings, special characters, Unicode
- `getSquadMetadata()` with real fixtures and missing workspaces

Pre-existing tests in `src/test/suite/sdkAdapter.test.ts` cover individual mapping functions.
