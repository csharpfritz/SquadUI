# Decision: Init wizard auto-executes squad init in terminal

**Date:** 2025-07-18
**Author:** Jeffrey T. Fritz (directive)
**Implemented by:** Rusty

## Context

After the init wizard collects the universe and mission from the user, the `squad init` command should execute automatically in the VS Code terminal so the team gets populated all at once — no extra user interaction needed.

## Decision

- The init wizard sends the `squad init` command to a terminal via `terminal.sendText()` immediately after the user provides universe and mission.
- A `FileSystemWatcher` on `.ai-team/team.md` triggers an automatic tree view refresh as soon as the file is created, so the Team panel populates without the user needing to close the terminal.
- Terminal close remains as a fallback refresh trigger.
- A boolean flag prevents double-refresh.

## Status

Implemented in commit `7c68208`.
