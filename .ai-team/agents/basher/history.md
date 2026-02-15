# Project Context

- **Owner:** Jeffrey T. Fritz (csharpfritz@users.noreply.github.com)
- **Project:** VS Code extension for visualizing Squad team members and their tasks
- **Stack:** TypeScript, VS Code Extension API, potentially GitHub Copilot integration
- **Created:** 2026-02-13

## Learnings Summary

### Test Infrastructure & Patterns (v0.1v0.2)
- Mocha TDD style with temp directory cleanup in 	est-fixtures/temp-*
- VS Code API stubs use s any casts; private method tests access via (service as any).methodName()
- Acceptance criteria traceability (AC-1 through AC-6) for E2E validation
- TestableWebviewRenderer pattern for HTML validation without live webview panels

### Skill Import Tests (2026-02-15)
- Comprehensive test suite for skill import: 55+ test cases
- parseInstalledSkill()  20+ tests (YAML frontmatter, heading extraction, fallbacks)
- getInstalledSkills()  15+ tests (directory reading, malformed handling, skipping)
- Deduplication logic  6 tests (awesome-copilot preferred, case-insensitive matching)
- Edge cases: CRLF line endings, unicode characters, empty SKILL.md files

### DecisionService Tests (2026-02-15)
- Complex parsing with mixed heading levels (## vs ###), dual date extraction
- 35+ tests for parseDecisionsMd() covering:
  - ## headings as always-potential decisions
  - ### headings with date prefixes (YYYY-MM-DD:)
  - Date range extraction, subsection filtering
  - Multiple date formats and fallback logic

### Key File Locations
- Test suites: src/test/suite/skillImport.test.ts, src/test/suite/decisionService.test.ts
- Skills service: src/services/SkillCatalogService.ts
- Tree providers: src/views/SquadTreeProvider.ts

### 2026-02-15 Team Updates
 User directive  releases require explicit human approval before tagging/publishing  decided by Jeffrey T. Fritz
 v0.6.0 Sprint Plan (QA skill flow, enable Add Skill button, dashboard polish, backlog audit)  decided by Danny
 Dashboard decisions sort order  decisions list on dashboard should be sorted most-recent first  decided by Jeffrey T. Fritz
 Add Skill Error Handling  network failures now throw exceptions for better UX instead of silent empty arrays  decided by Rusty
 Backlog Audit and Issue Cleanup  issues #27, #37, #38 closed; backlog triaged for v0.6.0 sprint  decided by Danny

### H1 Decision Format Tests (2026-02-16)
- Added 7 tests for new `# Decision: Title` (H1) format in `parseDecisionsMd()`:
  1. Basic H1 decision parsing — title, date, author extraction
  2. Multiple H1 decisions in one file
  3. H1 with `## Context`/`## Decision`/`## Rationale` subsections — only parent H1 counts
  4. Mixed H1 + H2 decisions — both formats parsed correctly
  5. Plain H1 without "Decision:" prefix — must NOT be treated as a decision (avoids false positives)
  6. `**Issue:** #78` metadata — silently ignored, no crash or pollution
  7. Content capture — `content` field includes full section with subsections
- Tests are written test-first for Linus's upcoming parser change; they will FAIL until the H1 handling is added to `parseDecisionsMd()`

### upgradeSquadCommand & hasTeam Context Key Tests (2026-02-16)
- New test file: `src/test/suite/upgradeSquadCommand.test.ts` — 5 tests total
- **Registration tests (2):**
  1. `registerUpgradeSquadCommand` returns a `Disposable` — mock context `{ subscriptions: [] }` pattern from addMemberCommand tests
  2. `upgradeSquad` command is registered — `this.skip()` guard pattern (extension/isActive/workspace check) from viewCharterCommand tests
- **hasTeam context key detection (3):**
  3. `hasTeam` true when `.ai-team/team.md` exists — temp dir with file, verifies `fs.existsSync` logic
  4. `hasTeam` false when `.ai-team/` absent — empty temp dir
  5. `hasTeam` false when `.ai-team/` exists but `team.md` missing — edge case, directory without file
- Uses `setup()`/`teardown()` with `test-fixtures/temp-upgrade-squad` cleanup
- Rusty's `upgradeSquadCommand.ts` was already in place — tests compile clean