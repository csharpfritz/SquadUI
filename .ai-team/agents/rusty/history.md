# Project Context

- **Owner:** Jeffrey T. Fritz (csharpfritz@users.noreply.github.com)
- **Project:** VS Code extension for visualizing Squad team members and their tasks
- **Stack:** TypeScript, VS Code Extension API, potentially GitHub Copilot integration
- **Created:** 2026-02-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

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

