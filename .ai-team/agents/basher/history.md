# Project Context

- **Owner:** Jeffrey T. Fritz (csharpfritz@users.noreply.github.com)
- **Project:** VS Code extension for visualizing Squad team members and their tasks
- **Stack:** TypeScript, VS Code Extension API, potentially GitHub Copilot integration
- **Created:** 2026-02-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

📌 Team update (2026-02-15): User directive — releases require explicit human approval before tagging/publishing — decided by Jeffrey T. Fritz

📌 Team update (2026-02-15): v0.6.0 Sprint Plan (QA skill import flow, copilot issues integration, backlog audit) — decided by Danny

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