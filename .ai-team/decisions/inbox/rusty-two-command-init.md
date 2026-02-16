# Two-Command Init: Squad Init + Agent Charter Setup

**Decided by:** Rusty
**Date:** 2026-02-16

## Decision

The init wizard's `terminal.sendText()` now sends two chained commands via `&&`:

1. `npx github:bradygaster/squad init --universe "..." --mission "..."` — scaffolds `.ai-team/`
2. `gh copilot -- --agent squad --allow-all-tools -i 'Set up the team for this project...'` — populates team with characters and charters

## Rationale

- Single `sendText()` with `&&` is cleaner than trying to detect when the first command finishes
- Second command only runs if init exits successfully
- Single quotes around the `-i` prompt avoid conflicts with double quotes in the first command
- Works in both cmd.exe and PowerShell

## Impact

- `src/commands/initSquadCommand.ts` — one line changed (the `sendText()` call)
- No API changes, no new dependencies, all existing tests pass
