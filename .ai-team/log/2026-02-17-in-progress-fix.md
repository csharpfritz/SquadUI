# Session: 2026-02-17 In-Progress Fix

**Requested by:** Jeffrey T. Fritz  
**Completed by:** Rusty  
**Date:** 2026-02-17

## Summary

Fixed false in-progress detection in the SquadUI sidebar. The OrchestrationLogService was incorrectly reading session logs from the `log/` directory as if they were orchestration status data, causing agents to show as "working" on issues that were completed weeks ago.

## Changes Made

### OrchestrationLogService Fix
- Added `discoverOrchestrationLogFiles()` method that only reads from `orchestration-log/` directory
- Added `parseOrchestrationLogs()` method that parses only orchestration status data
- Updated `SquadDataProvider` to use these new methods for task and member status derivation
- Preserved existing `discoverLogFiles()` and `parseAllLogs()` methods for display purposes (Recent Activity, log entry cards)

### Dependencies Update
- Bumped `engines.vscode` from `^1.85.0` to `^1.109.0` to match `@types/vscode` version
- Fixed VSCE packaging failure that occurred in release v0.7.2

## Decisions

1. **Orchestration Log Scope** — Only use `orchestration-log/` for task status derivation; `log/` is historical record only
2. **engines.vscode Version Alignment** — engines.vscode must always be >= @types/vscode version to satisfy VSCE packaging requirements

## Outcome

- False "working" indicators from old session logs eliminated
- Sidebar now displays accurate agent status
- VSCE packaging now succeeds
