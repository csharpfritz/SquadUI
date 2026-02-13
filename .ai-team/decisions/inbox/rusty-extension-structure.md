# Decision: Extension Structure and Naming

**Date:** 2026-02-13  
**Author:** Rusty (Extension Dev)  
**Status:** Proposed

## Context

Scaffolding the VS Code extension requires establishing the foundational naming conventions and activation strategy.

## Decision

1. **Extension ID:** `squadui` (package name)
2. **Display Name:** `SquadUI`
3. **Publisher:** `csharpfritz`
4. **Activation Strategy:** Lazy activation on `onView:squadMembers` — extension only loads when user opens the tree view
5. **Tree View Container ID:** `squadui` (in activity bar)
6. **Primary View ID:** `squadMembers`

## Rationale

- Lazy activation keeps VS Code fast for users who don't use Squad
- Single activity bar container allows adding more views later (tasks, history, etc.)
- View ID `squadMembers` is descriptive and leaves room for sibling views

## Impact

All future tree views and commands should register under the `squadui` container. View IDs should follow the pattern `squad{Feature}` (e.g., `squadTasks`, `squadHistory`).
