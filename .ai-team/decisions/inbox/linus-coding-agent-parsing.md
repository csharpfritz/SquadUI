# Decision: Parse Coding Agent Section for @copilot

**Date:** 2026-02-18  
**Author:** Linus (Backend Dev)  
**Issue:** Member parsing bug — @copilot missing from team member list

## Context

The `team.md` file has TWO member tables:
1. `## Members` (or `## Roster`) — human squad members
2. `## Coding Agent` — the @copilot autonomous coding agent

The `TeamMdService.parseMembers()` method only parsed the first section, causing @copilot to be excluded from the unified member list displayed in the tree view.

## Decision

Extended `TeamMdService.parseMembers()` to parse BOTH sections:
1. First, parse `## Members` / `## Roster` (existing behavior)
2. Then, parse `## Coding Agent` and append those members to the array

Both sections use the same table format (Name | Role | Charter | Status), so the existing `parseMarkdownTable()` and `parseTableRow()` methods handle both without modification.

## Rationale

- **Minimal change:** Leverages existing table parsing infrastructure — just needed a second call to `extractSection()`
- **Unified roster:** All members (human + bot) now appear in the same list for consistent UI rendering
- **Backward compatible:** Repos without a Coding Agent section continue to work (no section = no extra members)
- **Edge case safe:** The `parseTableRow()` method already filters out invalid entries, so malformed tables won't crash the parser
