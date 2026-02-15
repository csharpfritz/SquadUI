# Session: 2026-02-15 Sidebar Label Fixes

**Requested by:** Jeffrey T. Fritz

## What Happened

Rusty fixed three issues with sidebar tree labels:

1. Stripped "Skill: " prefix from skill names (case-insensitive in `parseInstalledSkill()`)
2. Fixed `viewSkill` command to pass directory slug instead of display name (prevents click errors)
3. Filtered subsection headings from decisions panel — only actual decision titles show, subsection names (Context, Decision, Rationale, etc.) hidden

## Outcome

- 323 tests pass
- 3 pre-existing failures unrelated to changes
- All fixes implemented and verified
