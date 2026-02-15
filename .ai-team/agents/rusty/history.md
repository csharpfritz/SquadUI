# Project Context

- **Owner:** Jeffrey T. Fritz (csharpfritz@users.noreply.github.com)
- **Project:** VS Code extension for visualizing Squad team members and their tasks
- **Stack:** TypeScript, VS Code Extension API, potentially GitHub Copilot integration
- **Created:** 2026-02-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-02-15: Dashboard Decisions Null-Safety & Activity Enhancements

#### Dashboard Decisions Crash Fix
- **Problem:** `renderDecisions()` in htmlTemplate.ts crashed when DecisionEntry had optional `content` or `author` fields undefined — calling `.toLowerCase()` on undefined threw TypeError
- **Fix:** Added null-coalescing for optional fields in filter function: `(d.content || '').toLowerCase()` and `(d.author || '').toLowerCase()`
- **Also fixed:** Card template now shows "—" for missing date/author instead of undefined

#### Recent Activity Section in Team Sidebar
- **Feature:** Added collapsible "Recent Activity" section to Team tree view showing 10 most recent orchestration log entries
- **Implementation:** Extended `TeamTreeProvider.getChildren()` to append section header at root level, loads log files via `OrchestrationLogService.discoverLogFiles()`
- **Tree items:** Each log entry shows topic (truncated to 60 chars), date as description, notebook icon, click opens log file
- **Command:** Registered `squadui.openLogEntry` command in extension.ts and package.json (hidden from palette)
- **Tree item type:** Added 'log-entry' to SquadTreeItem itemType union, added optional `logFilePath` parameter to constructor

#### Recent Sessions in Dashboard Activity Tab
- **Feature:** Added "Recent Sessions" panel below swimlanes in Activity tab, displays last 10 orchestration log entries as clickable cards
- **Model changes:** Extended `DashboardData.activity` interface to include `recentLogs: OrchestrationLogEntry[]`
- **Data builder:** Updated `DashboardDataBuilder.buildDashboardData()` to pass `logEntries.slice(0, 10)` into activity.recentLogs
- **HTML template:** Added `renderRecentSessions()` function, renders log cards with topic, date, participants, decision/outcome counts
- **Click handler:** Log cards post `openLogEntry` message with date+topic, `SquadDashboardWebview.handleOpenLogEntry()` searches both `.ai-team/log/` and `.ai-team/orchestration-log/` directories for matching file

#### File Paths and Patterns
- `src/views/dashboard/htmlTemplate.ts` — Dashboard HTML template and inline JavaScript rendering functions
- `src/views/SquadTreeProvider.ts` — Sidebar tree providers (Team, Skills, Decisions)
- `src/views/SquadDashboardWebview.ts` — Dashboard webview panel, message handlers
- `src/views/dashboard/DashboardDataBuilder.ts` — Data transformation for dashboard tabs
- `src/models/index.ts` — Data models (DashboardData, OrchestrationLogEntry, DecisionEntry, etc.)
- `src/extension.ts` — Extension activation, command registration
- `src/services/OrchestrationLogService.ts` — Log file discovery and parsing (`discoverLogFiles()`, `parseLogFile()`)

### 2026-02-15: Add Skill Workflow — Deep Investigation

#### Architecture
- **Command:** `squadui.addSkill` registered in `src/commands/addSkillCommand.ts:38`, wired in `src/extension.ts:162-166`
- **Trigger points:** Command Palette (no `when: false` gate) + `$(add)` button in Skills panel toolbar (`package.json:132-135`)
- **No keybinding** assigned for addSkill
- **Flow:** 3-step QuickPick → Source selection → Search/Browse → Confirm & Install
- **Service layer:** `SkillCatalogService` handles fetch, search, download, dedup, parsing
- **Sources:** awesome-copilot (GitHub README parsing) and skills.sh (HTML scraping)
- **Install target:** `.ai-team/skills/{slug}/SKILL.md`
- **Tree refresh:** `onSkillAdded` callback fires `skillsProvider.refresh()` after install

#### UX Findings
1. **No duplicate check:** `downloadSkill()` (`SkillCatalogService.ts:88-98`) silently overwrites existing skills — no warning to user
2. **No content download:** Skills from catalogs have no `content` field populated — only metadata stubs get written (name, description, source link). The skill's actual instructions are never fetched from the source URL.
3. **skills.sh parsing fragile:** HTML scraping (`parseSkillsShHtml`) relies on generic anchor+description regex patterns that may produce low-confidence junk entries
4. **Search is client-side only:** `searchSkills()` fetches entire catalog then filters locally — no server-side search
5. **Confirmation step uses QuickPick** instead of a modal — easy to accidentally dismiss
6. **No skill detail preview** before install — user only sees name + one-line description in QuickPick

#### Missing Features
- **No duplicate/overwrite guard** — should warn if skill slug already exists on disk
- **No actual content fetching** — should follow `skill.url` to download real skill instructions
- **No "preview" step** — no way to read skill details before committing to install
- **No catalog browsing with pagination** — all results dumped into one QuickPick
- **No remove-from-QuickPick** for already-installed skills
- **No offline/cache mode** — every browse re-fetches from network

### 2026-02-15: Add Skill Feature QA & Re-enabled
- **QA completed:** Reviewed Add Skill command (#40) and SkillCatalogService end-to-end
- **Error handling improved:** Changed service layer to throw exceptions on network failures instead of returning empty arrays, allowing command layer to show appropriate error messages to users
- **Feature re-enabled:** Removed `when: false` from commandPalette entry for `squadui.addSkill` and added Add Skill button to Skills panel toolbar with `$(add)` icon
- **Implementation quality:** Multi-step QuickPick flow is solid, cancellation handling works correctly at every step, loading indicators use withProgress, deduplication logic works, SKILL.md format is correct

### 2026-02-15: Sidebar Tree View Label Fixes (3 issues)
- **Skill prefix stripping:** SkillCatalogService.parseInstalledSkill() now strips leading "Skill: " prefix (case-insensitive) from extracted heading names, so "Skill: VS Code Terminal Command Pattern" becomes "VS Code Terminal Command Pattern" in the tree
- **Skill click error:** SkillsTreeProvider.getSkillItems() in SquadTreeProvider.ts changed rguments: [skill.name] → rguments: [skill.slug] to pass directory name (not display name) to iewSkill command, preventing file-not-found errors

📌 Team update (2026-02-15): User directive — releases require explicit human approval before tagging/publishing — decided by Jeffrey T. Fritz

📌 Team update (2026-02-15): v0.6.0 Sprint Plan (QA skill flow, enable Add Skill button, dashboard polish, backlog audit) — decided by Danny

📌 Team update (2026-02-15): Dashboard Chart & Decisions Rendering Fixes (canvas color resolution, axis labels, empty state guidance) — decided by Rusty

📌 Team update (2026-02-15): Dashboard decisions sort order — decisions list on dashboard should be sorted most-recent first — decided by Jeffrey T. Fritz

📌 Team update (2026-02-15): Backlog Audit and Issue Cleanup — issues #27, #37, #38 closed; backlog triaged for v0.6.0 sprint — decided by Danny

### 2026-02-15: Skill Catalog Bug Fixes (awesome-copilot 404, skills.sh parser garbage, search null-safety)

#### Three Bugs Fixed
1. **awesome-copilot URL 404:** Repo moved from `bradygaster/awesome-copilot` to `github/awesome-copilot` — updated URL in `fetchAwesomeCopilot()`
2. **skills.sh parser returning garbage:** Old regex picked up nav links, agent logos, tab labels. Rewrote `parseSkillsShHtml()` to match actual leaderboard pattern: `<a href="/{owner}/{repo}/{skill}">` with `<h3>` name and `<p>` owner/repo. Now builds GitHub URLs (`https://github.com/{owner}/{repo}`) instead of skills.sh URLs so content can be fetched. Removed dead JSON-LD strategy.
3. **Search crash on empty descriptions:** Added null-coalescing `(skill.description || '')` in `searchSkills()` filter to prevent `.toLowerCase()` on undefined

#### Pattern: skills.sh HTML Structure
Real skill entries in skills.sh leaderboard:
```html
<a class="group grid..." href="/vercel-labs/skills/find-skills">
  <div><span class="...font-mono">1</span></div>
  <div>
    <h3 class="font-semibold text-foreground truncate">find-skills</h3>
    <p class="...font-mono...">vercel-labs/skills</p>
  </div>
  <div><span class="font-mono text-sm">233.2K</span></div>
</a>
```
Parser now extracts: skill name from `<h3>`, owner/repo from `<p>`, optional install count from `<span>`, filters by 3-segment path pattern.

#### Updated Boilerplate Filter
`isBoilerplateLink()` now only accepts URLs with exactly 3 path segments (`/{owner}/{repo}/{skill}`) to filter out `/trending`, `/hot`, `/docs`, etc.

## Archive (2026-02-13 to 2026-02-14)

The following entries document foundational work, integrations, and architectural decisions from the first two days of development. Key patterns established:
- Extension lifecycle, tree providers, webview patterns
- Data models and service interfaces
- GitHub issues integration, issue detail webviews
- Commands (add/remove member, add skill, view charter)
- Team.md parsing and roster management
- Dashboard architecture (velocity, activity, decisions)
- Skill management (catalog service, tree view, YAML parsing)
- Sidebar reorganization into three views (Team, Skills, Decisions)

All foundational code and team decisions from this period are implemented in the codebase and referenced in .ai-team/decisions.md. See commit history for technical details.
### 2026-02-15: Team Update — Add Skill Workflow Findings & User Directive

📌 **Team decision merged (2026-02-15):** User testing directive: always write tests alongside new features. Write regression tests for every bug so we know it's fixed when test passes. — decided by Jeff

📌 **Team investigation completed (2026-02-15):** Add Skill workflow has two critical gaps: (1) No duplicate/overwrite protection — skills silently overwrite existing ones, (2) No preview before install — users only see name + one-line description. Action: Add duplicate detection to addSkillCommand with user warning, add preview webview/markdown preview step. — decided by Rusty

### 2026-02-15: Fix Add Skill Content Fetching + Duplicate Protection

#### Problem
Two critical issues in the Add Skill workflow:
1. **Empty stubs:** Neither `fetchAwesomeCopilot()` nor `fetchSkillsSh()` populates the `content` field. Every installed skill was just a metadata stub (name, description, URL) with no actual skill instructions.
2. **No duplicate protection:** `downloadSkill()` silently overwrote existing skill directories with no warning.

#### Solution
- **Content fetching:** Added `fetchSkillContent(skill)` method that resolves real skill content from source URLs. For GitHub repo URLs, it tries `copilot-instructions.md` → `SKILL.md` → `README.md` in order. For non-GitHub URLs, fetches directly. Falls back to stub if all attempts fail (with a note that content couldn't be fetched).
- **GitHub URL parsing:** Added `parseGitHubRepoUrl()` helper to extract owner/repo from GitHub URLs and construct raw.githubusercontent.com URLs.
- **Duplicate protection:** `downloadSkill()` now checks if the skill directory exists before writing. Throws an error with "already installed" message. Added `force` parameter (default false) for intentional overwrites.
- **User-facing overwrite prompt:** `addSkillCommand.ts` catches the duplicate error and shows a Yes/No QuickPick asking if the user wants to overwrite. If yes, calls `downloadSkill` with `force: true`.

#### Files Modified
- `src/services/SkillCatalogService.ts` — `downloadSkill()`, `fetchSkillContent()`, `parseGitHubRepoUrl()`, `buildSkillStub()`
- `src/commands/addSkillCommand.ts` — duplicate error handling with overwrite prompt


### 2026-02-15: Dashboard and Sidebar Activity Enhancements

📌 **Team decisions merged (2026-02-15):** 
1. Fixed Dashboard Decisions tab null-safety — prevented TypeError crashes on undefined content/author fields in renderDecisions()
2. Added "Recent Activity" section to Team sidebar with 10 most recent orchestration log entries, clickable to open logs
3. Added "Recent Sessions" panel to Dashboard Activity tab with rich session context (topic, date, participants, decision counts)
— decided by Rusty

