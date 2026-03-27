## SDK Phase 4 — SDK-Enabled Features

**Author:** Rusty (Extension Dev)
**Date:** 2026-03-27

### Context

SDK migration Phases 1-3 established the adapter layer (`src/sdk-adapter/index.ts`) as the single integration point for `@bradygaster/squad-sdk`. Phase 4 adds features that are only possible because we now have the SDK.

### Decision

Implemented two SDK-enabled features:

1. **Routing Rules Viewer** — New `squadRouting` tree view in the Squad sidebar that parses `routing.md` via the SDK's `parseRoutingRulesMarkdown()` and displays work routing rules as a tree. Each rule shows the work type, assigned agents, and examples. Registered `squadui.showRoutingRules` command.

2. **Quick Status Command** — `squadui.quickStatus` uses `getSquadMetadata()` to display a VS Code QuickPick with team members (with status icons), recent decisions, SDK version, and warnings. Provides a fast, keyboard-accessible team overview.

### Rationale

- Routing Rules Viewer was selected because it exposes SDK-parsed data that was previously invisible to the UI, giving users direct visibility into work assignment configuration.
- Quick Status was selected because it provides the fastest path to team awareness — a single keyboard shortcut shows the full picture without opening the dashboard.
- Both features follow the established pattern of all SDK imports going through the adapter layer.

### Impact

- New tree view `squadRouting` added to sidebar — appears when `squadui.hasTeam` is true.
- Two new commands: `squadui.showRoutingRules`, `squadui.quickStatus` — available in command palette.
- SDK migration is now complete across all 4 phases. No further SDK integration work needed.
- 24 new tests added. Total: 1233 passing.
