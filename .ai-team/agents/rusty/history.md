# Project Context

- **Owner:** Jeffrey T. Fritz (csharpfritz@users.noreply.github.com)
- **Project:** VS Code extension for visualizing Squad team members and their tasks
- **Stack:** TypeScript, VS Code Extension API, potentially GitHub Copilot integration
- **Created:** 2026-02-13

## Learnings Summary

### Dashboard Enhancements (2026-02-15)
- **Decisions null-safety fix:** Added null-coalescing (d.content || '').toLowerCase() and (d.author || '').toLowerCase() to prevent TypeError crashes
- **Recent Activity in sidebar:** Collapsible section showing 10 most recent orchestration log entries; topic truncated to 60 chars, date as description, notebook icon; command squadui.openLogEntry hidden from palette
- **Recent Sessions in Activity tab:** Panel below swimlanes, last 10 log entries as clickable cards; DashboardData.activity extended with ecentLogs field
- **Activity card click handler:** Searches both .ai-team/log/ and .ai-team/orchestration-log/ directories for matching file

### Add Skill Feature QA & Re-enable (2026-02-15)
- **Error handling improved:** Changed service layer to throw exceptions on network failures instead of silent empty arrays
- **Feature re-enabled:** Removed when: false from commandPalette, added Add Skill button to Skills panel toolbar
- **Implementation quality:** Multi-step QuickPick flow solid, cancellation handling works at every step, loading indicators use withProgress, deduplication logic works

### Skill Catalog Bug Fixes (2026-02-15)
1. **awesome-copilot URL 404:** Repo moved from radygaster/awesome-copilot to github/awesome-copilot; updated in etchAwesomeCopilot()
2. **skills.sh parser garbage:** Rewrote parseSkillsShHtml() to match actual leaderboard pattern (<a href="/{owner}/{repo}/{skill}"> with <h3> and <p>) to prevent nav/logo/tab label noise
3. **Search crash on empty descriptions:** Added null-coalescing in searchSkills() filter

### Sidebar Label Fixes (2026-02-15)
- **Skill prefix stripping:** parseInstalledSkill() strips "Skill: " prefix (case-insensitive) from heading names
- **Skill click error fix:** Changed SkillsTreeProvider.getSkillItems() arguments from [skill.name]  [skill.slug] to pass directory name instead of display name

### Init Redesign (2026-02-15)
 Init redesign now absorbs issue #26 (universe selector) into native VS Code init flow. Universe selection becomes step 1 of init wizard instead of standalone command  decided by Danny

### 2026-02-15 Team Updates
 User directive  releases require explicit human approval before tagging/publishing  decided by Jeffrey T. Fritz
 Dashboard Chart & Decisions Rendering Fixes (canvas colors, axis labels, empty state)  decided by Rusty
 Dashboard decisions sort order  decisions list on dashboard should be sorted most-recent first  decided by Jeffrey T. Fritz
 Add Skill Error Handling  network failures now throw exceptions for better UX instead of silent empty arrays  decided by Rusty
 Backlog Audit and Issue Cleanup  issues #27, #37, #38 closed; backlog triaged for v0.6.0 sprint  decided by Danny
 Markdown link handling utility  separates display text extraction (for tree view) from HTML rendering (for dashboard webviews)  decided by Rusty

### File Watcher Broadening & Agent Mode Chat (2026-02-15)
- **FileWatcherService WATCH_PATTERN:** Changed from `**/.ai-team/orchestration-log/**/*.md` to `**/.ai-team/**/*.md` — covers team.md, charters, decisions, skills, and orchestration logs. Debounce already in place prevents thrashing.
- **addMemberCommand chat API:** `workbench.action.chat.open` accepts `agentId` and `agentMode` fields in addition to `query` and `isPartialQuery`. Using `@squad` prefix in query text provides belt-and-suspenders targeting of the Squad chat participant.
- **Key paths:** `src/services/FileWatcherService.ts` (line 34 WATCH_PATTERN), `src/commands/addMemberCommand.ts` (lines 49–56 chat open call)