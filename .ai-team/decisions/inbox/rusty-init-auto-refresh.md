# Init Auto-Refresh via FileSystemWatcher

**Date:** 2026-02-16
**Author:** Rusty
**Status:** Implemented

## Decision

The init wizard (`initSquadCommand.ts`) now uses a `FileSystemWatcher` on `.ai-team/team.md` to trigger tree refresh as soon as the file is created by `squad init`, rather than waiting for the user to close the terminal.

## Rationale

Previously, the Team panel only populated after the user manually closed the Squad Init terminal. This was a poor experience — users expected the sidebar to update as soon as the init command finished writing files.

## Implementation

- `vscode.workspace.createFileSystemWatcher` with `RelativePattern` targeting `.ai-team/team.md`
- `onDidCreate` and `onDidChange` both trigger `onInitComplete()`
- Boolean flag (`initCompleted`) prevents double-refresh
- Terminal close listener kept as fallback
- Watcher disposed after firing or on terminal close (whichever comes first)

## Impact

- No API signature changes — `registerInitSquadCommand` still takes `(context, onInitComplete)`
- Existing tests unaffected (833 passing)
- UX improvement: pick universe → type mission → team appears in sidebar automatically
