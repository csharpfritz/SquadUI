# Session: Bugfix Release (v0.6.1)

**Date:** 2026-02-15
**Requested by:** Jeffrey T. Fritz
**Worker:** Rusty

## Work Completed

### Issue #47: Decisions open in markdown preview mode
- Changed decision click handling from `vscode.open` to `markdown.showPreview`
- Ensures decisions.md opens in preview mode instead of raw text editor

### Issue #48: Member names with markdown links
- Created `src/utils/markdownUtils.ts` utility module
- Two functions: `stripMarkdownLinks()` for plain text, `renderMarkdownLinks()` for HTML
- Sidebar displays member names as plain text
- Dashboard displays member names as proper hyperlinks

## Outcomes

- Version bumped to v0.6.1
- Release tagged and pushed to GitHub
- Issues #47 and #48 closed
