# Skill UI Patterns

**Date:** 2026-02-14  
**Author:** Rusty (Extension Dev)  
**Status:** Proposed  

## Context

Skills (#37, #40) introduce a new entity type in the tree view and a multi-step QuickPick command for importing skills from external catalogs.

## Decisions

1. **SkillCatalogService in tree provider:** Instantiated directly inside `SquadTreeProvider` (not late-bound via setter) because the service has no VS Code dependencies — it only uses Node.js `fs` and `https`. This keeps wiring simple.

2. **Skills section placement:** "Skills" is a top-level collapsible node below team members. The `itemType: 'skill'` is reused for both the section header and individual skill items; the section header has no `memberId`, while individual skills use `memberId` to carry the skill name for command arguments.

3. **Source badges:** Skills show their catalog source as a description badge (📦 awesome-copilot, 🏆 skills.sh, 🎯 local) — same emoji scheme used in the QuickPick flow for consistency.

4. **Skill context commands:** `squadui.viewSkill` and `squadui.removeSkill` are registered inline in `extension.ts` (same pattern as `viewCharter`) since they're lightweight. Hidden from command palette.

## Impact

- Tree view `getChildren()` now returns skills section at root level
- `SquadTreeItem.itemType` union expanded to `'member' | 'task' | 'issue' | 'skill'`
- Three new commands in package.json: `addSkill`, `viewSkill`, `removeSkill`
