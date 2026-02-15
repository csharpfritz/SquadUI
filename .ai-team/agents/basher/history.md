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

### DashboardDataBuilder Tests (2026-02-15)

Wrote comprehensive test suite for DashboardDataBuilder — the pure-logic engine behind all dashboard panels. This class had ZERO test coverage despite driving every dashboard visualization.

**Why DashboardDataBuilder matters:**
- Transforms raw squad data into velocity charts, activity heatmaps, and swimlanes
- Pure logic with no VS Code dependencies — ideal for fast unit testing
- All private methods tested through the public `buildDashboardData()` entry point

**Test suite created:** `src/test/suite/dashboardDataBuilder.test.ts`

**Velocity Timeline tests (11 tests):**
- Empty tasks → 31 data points all zero
- Timeline spans exactly 31 days (today + 30 previous)
- All dates in YYYY-MM-DD format and chronological order
- Tasks completed today counted correctly
- Tasks over multiple days → correct per-day counts
- Tasks >30 days old excluded
- Non-completed status excluded
- Tasks with no completedAt excluded
- Multiple tasks same day aggregated
- Both Date objects and ISO strings handled
- Mix of valid/excluded tasks → only valid counted

**Activity Heatmap tests (9 tests):**
- Empty log entries → all members at 0.0
- Single member with entries → 1.0
- Multiple members → proportional levels (normalized to max)
- Entries >7 days old excluded
- Member with no participation → 0.0
- Case-sensitive member name matching
- No members → empty heatmap
- Activity levels bounded 0.0–1.0
- Same participant in multiple entries counted each time

**Activity Swimlanes tests (11 tests):**
- Empty tasks → swimlanes with empty task arrays
- Tasks appear in correct member's swimlane
- Tasks sorted by startDate within swimlane
- No startedAt → defaults to today
- completedAt → endDate populated; no completedAt → null
- Members with no tasks → empty swimlane present
- Timeline task preserves id, title, status
- Unassigned tasks not in any swimlane
- No members → no swimlanes
- Date formats are YYYY-MM-DD
- Multiple tasks with mixed statuses

**Full Pipeline tests (5 tests):**
- Empty everything → valid DashboardData structure
- Decisions passed through unchanged (same reference)
- All sub-builders compose correctly
- Result conforms to DashboardData shape
- Large dataset (100 tasks, 10 members, 50 entries) doesn't crash

**Total: 36 test cases**

**Key patterns in DashboardDataBuilder worth remembering:**
1. **Date windowing:** Velocity uses 30-day window, heatmap uses 7-day window
2. **Normalization:** Heatmap normalizes participation to 0.0–1.0 against max participant
3. **Member matching:** Exact case-sensitive string match on member names
4. **Date handling:** Accepts both Date objects and ISO strings for startedAt/completedAt
5. **Default dates:** Tasks without startedAt default to today's date
6. **Private methods:** All tested through public buildDashboardData() — no (service as any) needed

Tests compiled successfully with `npx tsc --noEmit`.

### Dashboard HTML Template Regression Tests (2026-02-15)

Wrote comprehensive regression test suite for htmlTemplate.ts — the dashboard HTML generation code that had a P0 bug where it crashed on optional DecisionEntry fields.

**Context — P0 Bug:**
- `renderDecisions()` in htmlTemplate.ts crashed when `DecisionEntry.content` or `DecisionEntry.author` were `undefined`
- The code did `d.content.toLowerCase()` which throws TypeError on undefined
- Both `content` and `author` are optional fields per DecisionEntry interface
- Rusty is fixing this bug right now

**Test suite created:** `src/test/suite/htmlTemplate.test.ts`

**Regression tests for optional fields (9 tests):**
- getDashboardHtml doesn't crash when content is undefined
- getDashboardHtml doesn't crash when author is undefined
- getDashboardHtml doesn't crash when both content and author are undefined
- getDashboardHtml doesn't crash when date is undefined
- Mixed decisions with varying optional fields all handled gracefully

**HTML output validation tests (10 tests):**
- HTML contains decision cards with titles, dates, authors
- HTML contains fallback "—" when date/author missing
- HTML escapes special characters in titles (<script> tags, etc.)
- HTML contains multiple decision cards when multiple decisions provided
- HTML contains empty state message when no decisions
- HTML includes decision-card class for styling
- HTML contains data attributes for opening decisions (data-action, data-file-path, data-line-number)

**Client-side JavaScript safety tests (3 tests):**
- Rendered JS filter uses `(d.content || '').toLowerCase()` to handle undefined content
- Rendered JS filter uses `(d.author || '').toLowerCase()` to handle undefined author
- HTML contains escapeHtml helper function with proper XSS protection
- Decision data is JSON-serialized correctly in script tag

**Activity tab: Swimlanes rendering tests (3 tests):**
- HTML contains renderActivitySwimlanes function
- HTML contains empty-swimlane class and "No tasks" message
- HTML contains task-list and task-item classes for rendering

**Activity tab: Recent Sessions log entries tests (10 tests):**
- HTML includes recentLogs in activityData JSON
- HTML handles empty recentLogs array
- HTML handles fully populated log entries with all optional fields
- HTML handles log entries with optional fields undefined
- HTML handles multiple log entries (3+)
- HTML escapes special characters in log summaries (XSS protection)
- HTML handles very long summaries (1000+ chars)
- HTML handles unicode in log data (日本語, 🚀)
- activityData JSON is valid when recent logs present

**HTML structure validation tests (7 tests):**
- DOCTYPE declaration present
- html, head, body tags present
- CSP meta tag for security
- All three tab buttons (Velocity, Activity, Decisions)
- All three tab content sections (velocity-tab, activity-tab, decisions-tab)
- Search input for decisions filter
- VS Code API acquisition (acquireVsCodeApi)
- Event delegation for clickable items

**Edge cases tested (6 tests):**
- Very long decision titles (500 chars)
- Unicode in decision titles (日本語, emoji)
- Empty decision title
- Whitespace-only content
- Large dataset (100 decisions)
- Special characters in author (O'Reilly & Associates)

**Total: 48 test cases**

**Tree provider tests added (10 tests):**
- Added placeholder tests for upcoming "Recent Activity" section in TeamTreeProvider
- Tests document expected behavior: section node at root, collapsible, returns log items with date:topic labels
- All tests use `this.skip()` until Rusty implements the feature
- Tests ready to be enabled when feature ships

**Key patterns established:**
1. **Optional field safety:** Always use `|| ''` or `|| '—'` fallbacks when accessing optional fields in templates
2. **XSS protection:** All user-generated content must be escaped via escapeHtml or JSON.stringify
3. **Client-side JS safety:** Filter functions must handle undefined values with `|| ''` fallbacks
4. **JSON serialization:** Dashboard data is JSON-serialized into script tags — ensure valid JSON
5. **Empty states:** Always test both populated and empty data scenarios
6. **Edge cases matter:** Test unicode, very long strings, special characters, large datasets

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

📌 Team update (2026-02-15): Add Skill now fetches actual content from GitHub repos (copilot-instructions.md → SKILL.md → README.md fallback) and prompts on duplicate installs instead of silently overwriting — decided by Rusty
