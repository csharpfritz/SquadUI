### 2026-02-14: Remove Member command pattern and palette consistency

**By:** Rusty
**What:** Implemented `squadui.removeMember` command with alumni archival flow, and unified all command categories to `"Squad"` for clean palette display. Added context menus for member/task/issue tree items and hid context-dependent commands (`showWorkDetails`, `openIssue`) from the command palette.
**Why:** Remove-member completes the member lifecycle (add + remove). The palette category was inconsistent (`"SquadUI"` vs `"Squad"`) — standardizing on `"Squad"` gives a cleaner, shorter prefix in the command palette. Context menus make the tree view actionable without the palette. Hiding context-dependent commands avoids user confusion when invoked without arguments.
