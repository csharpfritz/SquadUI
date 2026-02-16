# Native Init Wizard — Init Command Redesign

**By:** Rusty
**Date:** 2026-02-16
**Issue:** #41

## Decision

Replaced the terminal-only `squad init` command with a native VS Code wizard flow:

1. **QuickPick** — user selects from 15 Squad casting universes
2. **InputBox** — user describes their team's mission (validated non-empty)
3. **Terminal** — runs `npx github:bradygaster/squad init --universe "..." --mission "..."`

This absorbs issue #26 (universe selector) into the init flow per Danny's earlier decision.

## viewsWelcome Changes

- Welcome view now appears in **all three panels** (Team, Skills, Decisions) with a single "Form your Squad" button
- Removed "Upgrade Existing Team" from welcome view — upgrade is only relevant for existing teams and stays in the toolbar

## What Didn't Change

- `extension.ts` callback was already correct — refreshes all providers + sets `squadui.hasTeam`
- Upgrade command untouched
- Command ID `squadui.initSquad` unchanged
- Function signature `registerInitSquadCommand(context, onInitComplete)` unchanged — existing tests pass as-is

## Impact

- Any code that calls `registerInitSquadCommand` is unaffected (same API)
- Users now get a guided experience instead of a raw terminal prompt
- Universe and mission are passed as CLI flags — the Squad CLI must support `--universe` and `--mission` flags on `init`
