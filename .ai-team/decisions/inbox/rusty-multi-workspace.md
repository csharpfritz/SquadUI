# Multi-Workspace: Selector-First Architecture

**Date:** 2026-03-27  
**Author:** Rusty  
**Issue:** #78

## Decision

Multi-workspace support uses a **workspace selector pattern** (not full aggregation). Each workspace keeps its own `SquadDataProvider` instance. The dashboard and tree views switch context when the user selects a different workspace — no cross-workspace data merging.

## Rationale

- Keeps the architecture simple and predictable — each workspace's data is fully isolated
- Avoids complex merge logic for conflicting member names across workspaces
- Follows the issue guidance: "Consider starting with a workspace selector dropdown before building full aggregation"
- Per-workspace providers can be independently refreshed without invalidating other caches
- Easy to extend to full aggregation later by composing providers

## Impact

- `WorkspaceScanner` scans `vscode.workspace.workspaceFolders` on activation and on folder changes
- Dashboard webview accepts optional `WorkspaceContext` for rendering the selector
- Tree providers accept `WorkspaceInfo[]` + provider Map for workspace grouping
- Single-workspace behavior is completely unchanged (backward compatible)
