# Basher's Agent History

**Role:** Tester (QA, Test Coverage, Release Validation)
**Expertise:** Test infrastructure, integration testing, release validation
**Style:** Systematic, quality-focused

---

## Recent Work (2026-02-23 onwards)

StandupReportService review: 25 new tests added, XSS concern identified in HTML rendering.

Test Strategy: Use synthetic objects for unit tests, disk I/O for integration tests.

 Team update (2026-02-23): Feature roadmap defined - 10 features across v1.0/v1.1/v1.2.

## Learnings

### SDK Adapter Test Patterns (squad/sdk-migration)

- **Test framework:** Mocha TDD-style (`suite`, `test`, `setup`, `teardown`) with Node.js `assert` (not chai). Pattern: `import * as assert from 'assert'`.
- **Fixture root:** `const TEST_FIXTURES_ROOT = path.resolve(__dirname, '../../../test-fixtures')` — the standard fixture has 5 members (Danny, Rusty, Linus, Basher, Livingston).
- **Adapter behavior discovered:** `adaptParsedAgentToSquadMember` capitalizes kebab-case names (SDK returns `danny` → adapter outputs `Danny`), preserves `@copilot` as-is. Status maps to `'working'` only if text includes "working" or 🔨.
- **Decision adapter enrichment:** `adaptParsedDecisionToDecisionEntry` scans the body for `**Date:**` and `**Author:**` metadata when the SDK doesn't extract them — SDK-provided values take precedence.
- **Graceful skip pattern:** Use `if (!adapterAvailable) { this.skip(); return; }` for tests that depend on modules still being built — prevents entire suite crash.
- **Pre-existing failures:** 4 SkillUsageService tests fail in the suite baseline (not related to SDK migration).
- **SDK casing impact:** Linus's migration changed `parseTeamMd()` to use SDK path, which returns lowercase names. Tests must compare case-insensitively or use the adapter's capitalized form.

