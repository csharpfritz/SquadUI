# Orchestration: Rusty — Issue Backlog View

**Date:** 2026-03-27T15:42:00Z  
**Agent:** Rusty (Extension Dev)  
**Issue:** #71  
**Priority:** P1

## Status: SUCCESS

PR #85 opened. Backlog tree view fully implemented with 20 new tests.

## Work Completed

- New `SquadBacklogTreeProvider` renders GitHub issues as a tree view
- Issues grouped by member and priority (p0, p1, p2, unprioritized)
- Peer view alongside Team, Skills, and Decisions in sidebar
- Priority detection via label matching: `p0`, `P1`, `priority:p2`, `priority: p3` formats
- Per-render caching; cache cleared on explicit refresh only
- `BacklogTreeItem` class decouples backlog structure from `SquadTreeItem`
- Reuses existing `GitHubIssuesService` with no data duplication
- Rate limit handling pattern: warn + fallback

## Key Decisions

1. **Reuse GitHubIssuesService:** `getIssuesByMember()` already handles pagination, caching, rate limiting
2. **Priority label detection:** Pattern matches multiple formats including `priority:` prefix
3. **Per-render caching:** Cache cleared on explicit refresh, not on file watcher events
4. **Separate BacklogTreeItem class:** Avoids coupling backlog tree structure to team tree

## Test Results

20 new tests added. All tests passing.

## Impact

- Backlog management now accessible within SquadUI
- Future enhancements (drag-to-reprioritize, inline triage) can build on this tree structure
- Rate limit handling pattern reusable for future GitHub-dependent views
