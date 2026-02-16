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

### Test Hardening Sprint (2026-02-16, Issue #54)
- Added **125 new tests** across 11 new test files (658 → 783 passing)
- **New test files created:**
  - `fileWatcherService.test.ts` — 17 tests: constructor, isWatching, onFileChange callbacks, registerCacheInvalidator, start/stop, dispose idempotency, internal queueEvent/flush guards
  - `decisionServiceFiles.test.ts` — 21 tests: parseDecisionFile() with H1/H2/H3 headings, date extraction, title prefix stripping, author metadata, fallback dates; scanDirectory() recursive traversal, non-.md filtering; getDecisions() integration combining decisions.md + decisions/ directory
  - `squadDataProviderExtended.test.ts` — 10 tests: getWorkspaceRoot(), getDecisions() with caching, refresh invalidation, getLogEntries/getTasks caching, placeholder member in getWorkDetails(), working-to-idle override logic
  - `initSquadCommand.test.ts` — 2 tests: Disposable return, command registration with this.skip() guard
  - `addSkillCommand.test.ts` — 2 tests: Disposable return, command registration with this.skip() guard
  - `skillsTreeProvider.test.ts` — 9 tests: getChildren() root/leaf/empty states, skill item rendering (book icon, viewSkill command, contextValue, tooltip), refresh event
  - `decisionsTreeProvider.test.ts` — 10 tests: getChildren() root/leaf/empty, decision item rendering (notebook icon, openDecision command, description with date+author, tooltip), getTreeItem, refresh event
  - `removeMemberEdgeCases.test.ts` — 13 tests: slug generation for simple names, mixed case, spaces, special chars, @prefix, hyphens, underscores, leading/trailing spaces, empty string, numbers
  - `markdownUtilsEdgeCases.test.ts` — 12 tests: adjacent links, empty display text, parentheses in text/URL, multiline, image syntax preservation, query parameters, hash fragments
  - `workDetailsEdgeCases.test.ts` — 17 tests: getInitials() with hyphenated/single-char/uppercase/lowercase names, renderInline() with multiple bold/code/unclosed, renderTable() empty/single-row/sparse/alignment, renderMarkdown() empty/newlines/entities, status badges, dispose idempotency
  - `treeProviderSpecialMembers.test.ts` — 12 tests: sort order (regular→@copilot→scribe/ralph), special icons (edit/eye/robot), collapsibility (infra=None, @copilot=Collapsed), viewCharter command exclusion for @copilot, status badges (⚡/💤), markdown link stripping in names
- **Patterns established:**
  - Command registration tests use `this.skip()` guard with `extension/isActive/workspace` triple-check (from viewCharterCommand pattern)
  - DecisionsTreeProvider.getChildren() is async — must be awaited (unlike the sync getDecisionItems() it calls internally)
  - Private method tests use `(service as any).methodName.bind(service)` pattern
  - Temp directories use `test-fixtures/temp-{name}-${Date.now()}` with teardown cleanup

### Init Wizard Tests (2026-02-16)
- New test file: `src/test/suite/initSquadWizard.test.ts` — 7 test cases
- Written test-first for Rusty's upcoming native wizard rewrite of initSquadCommand
- **Test cases:**
  1. Welcome view configuration — verifies viewsWelcome entries for all three panels (squadTeam, squadSkills, squadDecisions) with "Form your Squad" button and `!squadui.hasTeam` condition
  2. Command registration (package.json) — verifies `squadui.initSquad` declared with category "Squad"
  3. Command registration (live) — `this.skip()` guard pattern
  4. Universe list completeness — checks for exported `UNIVERSE_OPTIONS`/`universeOptions`/`UNIVERSES` array; graceful no-op if not yet exported
  5. Cancellation at universe step — stubs `showQuickPick` → undefined, asserts no terminal and no InputBox
  6. Cancellation at mission step — stubs `showQuickPick` → selection, `showInputBox` → undefined, asserts no terminal
  7. Empty mission validation — captures `validateInput` function from `showInputBox` options, asserts empty string returns error message
- Tests 3, 5, 6, 7 use `this.skip()` guard (extension/isActive/workspace) — pending until live workspace available
- Tests 1, 2 pass now (package.json already configured); test 4 passes with graceful fallback
- Compilation clean (`npx tsc --noEmit`), full suite 788 passing

### SquadVersionService Tests (2026-02-16)
- New test file: `src/test/suite/squadVersionService.test.ts` — 32 tests total
- **isNewer() semver comparison (11 tests):**
  - Identical versions → false; newer major/minor/patch → true; current ahead → false
  - Different segment counts (1.0 vs 1.0.0), single-segment, four-segment, 0.x versions
- **normalizeVersion() v-prefix stripping (5 tests):**
  - Lowercase/uppercase v stripped; no-op without prefix; middle-of-string v preserved
  - Leading whitespace prevents `^v` match (trim happens after replace)
- **Caching behavior (3 tests):**
  - Second `checkForUpgrade()` returns cached result without re-fetching
  - Caches `available: false` results too
  - `resetCache()` forces next `checkForUpgrade()` to re-fetch
- **forceCheck() bypass (2 tests):**
  - Always re-fetches regardless of cache state
  - Updates cached result for subsequent `checkForUpgrade()` calls
- **Error handling (7 tests):**
  - GitHub API fails → `{ available: false }`; CLI not installed → same
  - Both fail → same; getLatestVersion throws → same; getInstalledVersion throws → same
  - Both throw → same; partial failure includes available version info
- **UpgradeCheckResult shape (2 tests):**
  - Includes currentVersion/latestVersion when upgrade available and when not
- **package.json validation (2 tests):**
  - `squadui.checkForUpdates` command declared with category "Squad"
  - Upgrade button when-clause includes `squadui.upgradeAvailable`
- Test approach: stub private methods via `(service as any).methodName` for network/exec isolation; test pure functions (isNewer, normalizeVersion) directly
- Compilation clean, full suite 820 passing (32 new + 788 existing)

### Team Display Resilience Tests (2026-02-16)
- New test file: `src/test/suite/teamDisplayResilience.test.ts` — 12 tests across 8 suites
- **Scenarios covered:**
  1. Happy path: getSquadMembers() with valid Members table — 3 members, correct roles
  2. Partial write: team.md exists but no Members section — returns empty (race condition during init)
  3. Retry on empty roster: mock TeamMdService returns empty first, populated second — validates retry mechanism Rusty is adding
  4. Log-participant fallback: no team.md, derives members from orchestration log participants with generic "Squad Member" role
  5. No retry when team.md missing: spy confirms parseTeamMd called exactly once when file doesn't exist (null return)
  6. FileWatcherService glob pattern: verifies WATCH_PATTERN includes `.ai-team` and `*.md`
  7. TeamTreeProvider empty members: getChildren() returns empty array without crash when no members
  8. Cache invalidation: refresh() clears all 4 cache fields, re-read from disk returns updated data
- Uses `(provider as any).teamMdService.parseTeamMd` override pattern to simulate race condition without flaky timing
- Retry delay set to 0ms compatibility — tests are deterministic, no timing assertions
- Temp dirs use `test-fixtures/temp-resilience-${Date.now()}` with teardown cleanup
- Compilation clean (`npx tsc --noEmit`); test execution deferred until Rusty's retry changes land
 Team update (2026-02-16): Native Init Wizard  squad init replaced with native VS Code wizard: QuickPick (15 universes)  InputBox (mission description)  Terminal with --universe and --mission flags. viewsWelcome now covers all three panels (squadTeam, squadSkills, squadDecisions). Upgrade button only in Team toolbar. API signatures unchanged  existing tests pass.  decided by Rusty
 Team update (2026-02-16): Conditional Upgrade Button via Version Check  new context key squadui.upgradeAvailable set when SquadVersionService confirms newer release. Upgrade button gated on squadui.hasTeam && squadui.upgradeAvailable. Manual re-check available via squadui.checkForUpdates command. Post-upgrade flow resets context and re-checks.  decided by Rusty
 Team update (2026-02-16): Team Display Resilience  Race Condition Handling  SquadDataProvider.getSquadMembers() retries once (after configurable delay) when team.md exists but roster is empty. Delayed re-refresh 2s after init. Tree view shows "Loading team..." when hasTeam is true but members empty. Retry delay is constructor-configurable for testability.  decided by Rusty
