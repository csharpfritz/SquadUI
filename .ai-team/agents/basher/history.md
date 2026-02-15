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