# SDK Adapter Test Strategy

**Author:** Basher
**Date:** 2026-07-05

## Decision

63 tests added across two files to validate the SDK adapter layer:

1. **sdkAdapter.test.ts** (36 tests) — validates `adaptParsedAgentToSquadMember()` and `adaptParsedDecisionToDecisionEntry()` mapping functions, including name capitalization, status mapping, body metadata extraction, and edge cases.

2. **sdkMigration.test.ts** (27 tests) — regression tests ensuring TeamMdService, DecisionService, and squadFolderDetection preserve their data contracts post-migration.

## Key Findings for the Team

- The SDK adapter capitalizes agent names (`danny` → `Danny`). Tests that compare member names after `parseTeamMd()` need to use case-insensitive comparison or expect the capitalized form.
- The adapter enriches decisions by scanning the body for `**Date:**` and `**Author:**` metadata lines that the SDK doesn't extract. SDK-provided values take precedence.
- DecisionService.ts has a broken import referencing `parseDecisionsMdWithSdk` which doesn't exist yet — Linus's WIP.
- All 63 new tests pass. The 4 pre-existing SkillUsageService failures are unrelated.
