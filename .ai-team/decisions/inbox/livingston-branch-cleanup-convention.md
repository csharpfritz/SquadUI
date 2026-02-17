# Branch Cleanup Convention

**Decided by:** Livingston  
**Date:** 2026-02-17  
**Context:** Release v0.7.2 branch cleanup

## Decision

After a release, stale remote branches should be cleaned up using these rules:

1. **Delete** branches whose PRs have been merged or closed
2. **Delete** branches that point to the same commit as `main` HEAD (already merged without PR)
3. **Keep** branches with open PRs or no PR yet (active work)
4. Use `git push origin --delete {branch}` for batch deletion

## Rationale

Stale branches clutter the remote, make branch pickers noisy, and can confuse contributors about what's actively being worked on. Cleaning up after each release keeps the repository tidy.
