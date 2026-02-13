# Add Member Command UX Pattern

**Date:** 2026-02-14  
**Author:** Rusty (Extension Dev)  
**Status:** Proposed

## Context

The team needs a way to add new members from within the VS Code extension UI, rather than manually editing `.ai-team/` files.

## Decision

1. **Command ID:** `squadui.addMember`
2. **UX Flow:** QuickPick (role) → InputBox (name) → file creation + roster update → tree refresh
3. **Standard Roles:** Lead, Frontend Dev, Backend Dev, Full-Stack Dev, Tester/QA, Designer, DevOps/Infrastructure, Technical Writer, plus "Other..." for freeform entry
4. **File Generation:** Creates `charter.md` and `history.md` in `.ai-team/agents/{slug}/` using templates that match existing charter structure
5. **Roster Update:** Appends a new row to the `## Members` table in `team.md`
6. **Panel Button:** `$(add)` icon in `view/title` navigation group, scoped to `view == squadMembers`
7. **Registration Pattern:** Same factory function pattern as `registerInitSquadCommand` — returns `vscode.Disposable`, accepts callback for post-action refresh

## Rationale

- QuickPick before InputBox reduces friction — users pick from known roles before typing a name
- "Other..." escape hatch ensures the role list doesn't limit users
- Slug-based directory naming (lowercase, hyphenated) avoids filesystem issues across platforms
- Duplicate guard prevents accidental overwrites of existing agent directories
- Tree refresh after creation gives immediate visual feedback
