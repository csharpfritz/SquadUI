# Project Context

- **Owner:** Jeffrey T. Fritz (csharpfritz@users.noreply.github.com)
- **Project:** VS Code extension for visualizing Squad team members and their tasks
- **Stack:** TypeScript, VS Code Extension API, potentially GitHub Copilot integration
- **Created:** 2026-02-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

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