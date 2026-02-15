# Session: 2026-02-14-fix-decision-skill-clicks

**Requested by:** Jeff

## Work Completed

Rusty fixed two UI bugs:
1. Decision tree items now open actual markdown files instead of the generic dashboard
2. Skill parsing now reads YAML frontmatter for human-readable names and uses slug for file lookup

## Files Changed
- src/models/index.ts
- src/services/DecisionService.ts
- src/services/SkillCatalogService.ts
- src/views/SquadTreeProvider.ts
- src/extension.ts

## Test Status
- 253 tests passing
