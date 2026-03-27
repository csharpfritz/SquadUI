# Member Drill-down: Inline Expansion Pattern

**Author:** Rusty
**Date:** 2026-03-27
**Issue:** #76

## Decision

Member drill-down uses an inline card expansion pattern (toggle open/close within the existing grid) rather than a separate panel or navigation. Data is pre-computed and embedded in the team data JSON payload — no message-passing round-trips needed.

## Rationale

- Keeps the member card context visible while showing details
- Avoids async complexity of on-demand data fetching in the webview
- The expanded card spans the full grid width for a clean 2×2 detail layout
- Consistent with VS Code's preference for inline disclosure over modal patterns

## Impact

- `TeamMemberOverview` now has an optional `drilldown` field — backward compatible
- Topic frequency from log entries serves as a proxy for skill usage per member
- Blocker detection uses label matching (blocked, blocker, waiting, needs-review)
