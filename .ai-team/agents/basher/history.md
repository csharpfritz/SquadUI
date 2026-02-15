# Project Context

- **Owner:** Jeffrey T. Fritz (csharpfritz@users.noreply.github.com)
- **Project:** VS Code extension for visualizing Squad team members and their tasks
- **Stack:** TypeScript, VS Code Extension API, potentially GitHub Copilot integration
- **Created:** 2026-02-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

📌 Team update (2026-02-15): User directive — releases require explicit human approval before tagging/publishing — decided by Jeffrey T. Fritz

📌 Team update (2026-02-15): v0.6.0 Sprint Plan (QA skill import flow, copilot issues integration, backlog audit) — decided by Danny

### Skill Import Tests (2026-02-15)

Completed comprehensive test suite for skill import feature (GitHub issue #39) in `src/test/suite/skillImport.test.ts`:

**Tests written:**
- **parseInstalledSkill()** — 20+ tests covering:
  - Name extraction from H1 headings
  - Description parsing from first paragraph
  - YAML frontmatter parsing (name, description, confidence)
  - "Skill: " prefix stripping (case-insensitive)
  - Fallbacks when headings/descriptions missing
  - Edge cases: malformed YAML, empty content, unicode, CRLF line endings
  
- **getInstalledSkills()** — 15+ tests covering:
  - Reading from `.ai-team/skills/` directory
  - Returning empty array when directory doesn't exist
  - Skipping directories without SKILL.md
  - Skipping files (only processing directories)
  - Handling malformed/empty SKILL.md files
  - Verifying all skills have source='local' and include raw content
  
- **Deduplication logic** — 6 tests covering:
  - awesome-copilot preferred over skills.sh for same name
  - Case-insensitive name matching
  - Edge cases: empty array, single skill, same source duplicates
  
- **Error handling** — 4 tests covering:
  - Nonexistent workspace root
  - Read errors
  - Null characters in content
  - Very long content
  
- **Command registration** — 2 tests covering:
  - `squadui.addSkill` command registered (with `this.skip()` guard)
  - Command declared in package.json
  
- **Skill tree nodes** — 8 tests covering:
  - Skills render at root level with correct labels
  - Skills are not collapsible
  - Skills have descriptions and icons
  - Skills have contextValue for command binding
  - Skills have no children

**Patterns followed:**
- Mocha TDD style with `suite()` and `test()` (not `describe()`)
- Temp directories in `test-fixtures/temp-*` with proper cleanup in `teardown()`
- Command tests use `this.skip()` guard checking extension activation
- VS Code API stubs use `as any` casts
- Private method tests access via `(service as any).methodName()`
- Tests compiled successfully with `npx tsc --noEmit`

**Edge cases discovered and tested:**
- YAML frontmatter with malformed syntax falls back to markdown parsing
- Empty SKILL.md files use directory name as fallback
- Content with only whitespace handled gracefully
- Unicode characters in skill names work correctly
- Windows CRLF line endings parsed correctly
- Multiple H1 headings (first one wins)
- Frontmatter overrides markdown heading when present

Total: 55+ test cases covering all aspects of skill import functionality.

📌 Team update (2026-02-15): Dashboard decisions sort order — decisions list on dashboard should be sorted most-recent first — decided by Jeffrey T. Fritz

📌 Team update (2026-02-15): Add Skill Error Handling — network failures now throw exceptions for better UX instead of silent empty arrays — decided by Rusty

📌 Team update (2026-02-15): Backlog Audit and Issue Cleanup — issues #27, #37, #38 closed; backlog triaged for v0.6.0 sprint — decided by Danny

### DecisionService Tests (2026-02-15)

Wrote comprehensive test suite for DecisionService — the most fragile code in the extension. This service has been rewritten twice to fix date extraction bugs, and had ZERO test coverage.

**Why DecisionService is fragile:**
- Complex parsing logic with mixed heading levels (## vs ###)
- Dual date extraction: from heading prefixes AND **Date:** metadata
- Subsection filtering based on known names (Context, Decision, Vision, etc.)
- Date-prefixed headings (### YYYY-MM-DD: Title) vs plain subsections
- Date range extraction (2026-02-14/15 → extract first date)
- Multiple date formats in **Date:** metadata (2026-02-14, refined 2026-02-15 → first wins)

**Test suite created:** `src/test/suite/decisionService.test.ts`

**parseDecisionsMd() tests (35+ tests):**
- ## headings are always potential decisions
- ### headings with date prefix (YYYY-MM-DD:) are decisions
- ### headings without date prefix are subsections (filtered out)
- Known subsection names filtered even at ## level (Context, Vision, Core Features, etc.)
- Date extraction from **Date:** metadata
- Date extraction from heading prefixes (### 2026-02-14: Title)
- Date range extraction (### 2026-02-14/15: Title → 2026-02-14)
- ISO date from **Date:** with multiple dates (2026-02-14, refined 2026-02-15 → 2026-02-14)
- Heading date takes precedence over **Date:** metadata
- Strips "Decision: " and "User directive — " prefixes
- Extracts author from **Author:** or **By:** metadata
- Includes full content, filePath, lineNumber in results
- Handles malformed headings like "## # Title"
- Handles empty files and files with only comments
- Realistic decisions.md with mixed patterns (4 decisions from 9 headings)

**parseDecisionFile() tests (15+ tests):**
- Extracts title from first # heading (falls back to ## or ###)
- Extracts date from **Date:** metadata
- Extracts first date from **Date:** with multiple dates
- Extracts date from heading prefix (# 2026-02-14: Title)
- Extracts first date from date range (# 2026-02-14/15: Title)
- Strips "User directive — " and "Design Decision:" prefixes
- Extracts author from **Author:** or **By:** metadata
- Falls back to file creation date when no date metadata
- Handles empty files, no heading, nonexistent files

**getDecisions() tests (8+ tests):**
- Returns empty array when no decisions exist
- Parses decisions.md when present
- Parses individual .md files in decisions/ directory
- Combines decisions from both sources
- Sorts by date descending (newest first)
- Decisions without dates sort to end
- Scans subdirectories in decisions/
- Ignores non-.md files

**Edge cases tested:**
- Windows CRLF line endings
- Mixed ## and ### headings in same file
- Decision with no body content
- Very long decision titles (300+ chars)
- Unicode in titles and dates (日本語 🚀)
- Multiple decisions with same title
- Date prefix with/without colon (2026-02-01: vs 2026-02-01)
- **Date:** with extra whitespace
- Case variations (**Date:** vs **date:** vs **DATE:**) — documents current behavior

**Total: 60+ test cases**

**Key patterns in DecisionService worth remembering:**
1. **Heading level logic is nuanced:**
   - ## = always a decision candidate
   - ### = decision only if date-prefixed (YYYY-MM-DD:)
   - Plain ### headings (Context, Decision) are subsections
2. **Date extraction has precedence:**
   - Heading prefix date wins over **Date:** metadata
   - First date in multi-date strings always wins
3. **Subsection filtering is critical:**
   - Hardcoded list of known subsection names (context, decision, vision, etc.)
   - Case-insensitive matching
   - Filters at both ## and ### levels
4. **Date sorting:**
   - Descending by date (newest first)
   - undefined dates sort to end (empty string localeCompare)

Tests compiled successfully with `npx tsc --noEmit`.

## Archive (2026-02-13 to 2026-02-14)

Basher completed comprehensive test coverage during the initial two days of development:
- Integration tests for OrchestrationLogService, SquadDataProvider, and FileWatcherService
- Test infrastructure setup with @vscode/test-electron and mocha
- Test coverage for tree provider, webview, and extension activation
- Mock infrastructure and test fixtures
- Empty tree view diagnosis (root cause: team.md integration needed)
- Service-level tests for TeamMdService, GitHubIssuesService, SquadDataProvider fallback
- E2E MVP validation (46 tests covering 6 acceptance criteria)
- Proactive tests for addMemberCommand and related features
- Manual test plan documentation

All test code and infrastructure are in place in src/test/suite/ and work as of the last test run. See .ai-team/decisions.md and commit history for detailed patterns established.