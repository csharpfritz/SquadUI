# Decision: Conditional Upgrade Button via Version Check

**Author:** Rusty (Extension Dev)
**Date:** 2026-02-17
**Issue:** #42

## Context

The upgrade button in the Team panel toolbar was always visible when `squadui.hasTeam` was true, regardless of whether an upgrade was actually available. Jeff wanted it to only appear when there's a newer version.

## Decision

1. **New context key `squadui.upgradeAvailable`** — set to `true` only when `SquadVersionService` confirms a newer release exists on GitHub.
2. **Upgrade button `when` clause** changed from `view == squadTeam && squadui.hasTeam` to `view == squadTeam && squadui.hasTeam && squadui.upgradeAvailable`.
3. **Version check is non-blocking** — runs asynchronously on activation via `.then()`, does not delay extension startup.
4. **Caching** — version check runs once per session. Manual re-check available via `squadui.checkForUpdates` command.
5. **No external dependencies** — uses Node.js `https` and `child_process` only.

## Impact

- Upgrade button no longer clutters the toolbar when the user is on the latest version.
- `squadui.checkForUpdates` command available in command palette for manual checks.
- Post-upgrade callback resets the context key and re-checks, so button disappears after upgrading.
