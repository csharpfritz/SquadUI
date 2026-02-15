# Add Skill: Content Fetching + Duplicate Protection

**Date:** 2026-02-15
**Author:** Rusty
**Status:** Implemented

## Context

The Add Skill workflow had two critical bugs:
1. Skills installed as empty metadata stubs — the actual skill instructions were never fetched from source URLs.
2. Installing a skill that already existed silently overwrote it with no user warning.

## Decisions

### Content Fetching Strategy

- For GitHub repo URLs (`github.com/{owner}/{repo}`), we try fetching raw content from `main` branch in this priority order:
  1. `.github/copilot-instructions.md`
  2. `SKILL.md`
  3. `README.md`
- For non-GitHub URLs, fetch the URL directly as a raw file.
- If all fetch attempts fail, fall back to the existing metadata stub (with a note that content couldn't be fetched).
- The `fetchSkillContent()` method is public so it can be reused by future features (e.g., preview before install).

### Duplicate Protection

- `downloadSkill()` now throws if the target skill directory already exists (unless `force: true`).
- The command layer catches this error and shows a Yes/No QuickPick prompting the user to overwrite.
- This prevents accidental data loss while still allowing intentional reinstalls.

## Impact

- **SkillCatalogService.ts**: New methods `fetchSkillContent()`, `parseGitHubRepoUrl()`. Modified `downloadSkill()` signature (added `force` param).
- **addSkillCommand.ts**: Duplicate error handling with overwrite prompt.
- No changes to models or other files.
