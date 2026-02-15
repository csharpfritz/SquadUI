# Fix Three Skill Catalog Bugs

**Date:** 2026-02-15  
**Decided by:** Rusty  
**Status:** Implemented

## Context

Three bugs in SkillCatalogService.ts were breaking the skill search/catalog workflow:
1. awesome-copilot URL was 404 (repo moved)
2. skills.sh parser returned garbage entries (nav links, agent names, tab labels)
3. Search could crash on empty descriptions

## Decision

### Bug 1: Update awesome-copilot URL
Changed from `bradygaster/awesome-copilot` to `github/awesome-copilot` (the repo moved).

### Bug 2: Rewrite skills.sh parser
The old parser used generic anchor regex and picked up navigation links. The new implementation:
- Matches the actual leaderboard pattern: `<a href="/{owner}/{repo}/{skill}">` containing `<h3>{skill-name}</h3>` and `<p>{owner/repo}</p>`
- Extracts skill name from `<h3>`, owner/repo from `<p>` tag
- Builds GitHub URL as `https://github.com/{owner}/{repo}` (not skills.sh URL, so we can fetch content)
- Sets description to `{owner}/{repo}` (the meaningful context)
- Removed Strategy 2 (JSON-LD) — skills.sh doesn't use it, was dead code
- Updated `isBoilerplateLink()` to only accept 3-segment paths (/{owner}/{repo}/{skill})

### Bug 3: Null-safety for search
Added `(skill.description || '')` in `searchSkills()` to prevent crashes on empty descriptions.

## Consequences

- awesome-copilot catalog now loads successfully
- skills.sh parser returns real skill entries, not navigation junk
- Search is now crash-safe and works correctly once skills.sh loads real entries
- Client-side filtering in `searchSkills()` already worked, just needed clean data from the parser

## Files Changed

- `src/services/SkillCatalogService.ts` — Fixed URL, rewrote parser, added null-safety
