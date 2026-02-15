# Session: 2026-02-15 — Add Member command Agent Mode

**Requested by:** Jeffrey T. Fritz  
**Completed by:** Rusty

## Summary

Fixed issue #51: Add Member command now opens chat in agent mode with Squad agent pre-selected, and FileWatcherService broadened to watch all `.ai-team/**/*.md` files for automatic tree refresh.

## Changes

- **Add Member Command:** Integrated agent mode support — chat window spawns with Squad agent pre-selected
- **FileWatcherService:** Expanded watch pattern from `**/.ai-team/orchestration-log/**/*.md` to `**/.ai-team/**/*.md` to catch team roster, agent charter, and decision file changes for automatic UI tree refresh

## Key Outcomes

- Members can be added without manual tree refresh
- Team metadata changes are instantly reflected in UI
