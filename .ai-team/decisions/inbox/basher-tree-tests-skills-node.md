# Existing Tree Tests Must Account for Skills Section Node

**Author:** Basher (Tester / QA)  
**Date:** 2026-02-14  
**Issue:** #39 — Skill Import Feature

## Context

The `SquadTreeProvider.getChildren()` now returns members **plus** a Skills section node at the root level. This broke 9 existing tests across `treeProvider.test.ts`, `acceptance.test.ts`, and `e2e-validation.test.ts` that assumed root items were exclusively members.

## Decision

Root-level tree tests must filter by `itemType === 'member'` when asserting member-specific properties (count, labels, icons, tooltips). Tests that check "all root items" must be aware that the Skills section node is included.

The pattern is:
```typescript
const roots = await treeProvider.getChildren();
const members = roots.filter(r => r.itemType === 'member');
// Assert on members, not roots
```

## Impact

Any future tree node sections (e.g., "Issues", "History") will add more root-level nodes. Tests should always filter by item type rather than assuming a fixed root count.
