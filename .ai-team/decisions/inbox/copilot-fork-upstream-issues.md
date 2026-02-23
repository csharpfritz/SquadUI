# Fork-Aware Issue Fetching

**Date:** 2026-02-23
**Author:** @copilot (Coordinator)
**Status:** Implemented

## Decision

When a Squad workspace repo is a fork, SquadUI now automatically resolves the upstream (parent) repository for issue fetching. All issue-related API calls (open issues, closed issues, milestones) use the upstream repo.

## Resolution Order

1. **Manual override:** `**Upstream** | owner/repo` in team.md's Issue Source table
2. **Auto-detect:** GitHub API `GET /repos/{owner}/{repo}` → `parent` field
3. **Fallback:** Use the configured repository as-is

## Usage

Add to team.md Issue Source table:

```markdown
| **Upstream** | csharpfritz/SquadUI |
```

Or leave it out — SquadUI will auto-detect if the repo is a fork.

## Impact

- GitHubIssuesService, TeamMdService, IssueSourceConfig model
- All existing matching strategies (labels, assignees) work against upstream issues
- No breaking changes — repos without forks behave identically
