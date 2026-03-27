# Decision: Milestone selector in standup report uses instance state, not workspace config

**Date:** 2026-03-27
**Author:** Linus
**Issue:** #75

## Context

The standup report needed a milestone selector dropdown. Two approaches considered:
1. Persist the selected milestone in workspace settings (survives panel close)
2. Track selection as instance state on `StandupReportWebview` (resets on panel close)

## Decision

Use instance state (`selectedMilestoneNumber` field). The standup report is a transient view opened fresh each time — persisting milestone selection across sessions adds complexity without real user value. If no selection is stored, it falls back to the first open milestone (backward compatible).

## Rationale

- Standup reports are ephemeral — users open them, read, and close
- Persisting to workspace settings would couple the webview to VS Code configuration APIs
- The fallback behavior (first open milestone) matches user expectations for a default view
- If persistence is needed later, it's a small additive change (add `context.workspaceState`)
