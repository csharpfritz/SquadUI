### 2026-02-15: Broaden FileWatcherService to all .ai-team markdown files
**By:** Rusty
**What:** Changed `FileWatcherService.WATCH_PATTERN` from `**/.ai-team/orchestration-log/**/*.md` to `**/.ai-team/**/*.md`, covering team roster, agent charters, decisions, skills, and orchestration logs.
**Why:** The old pattern only watched orchestration logs, so adding a member (which creates `charter.md` and updates `team.md`) never triggered a tree refresh. The broader pattern catches all team-relevant file changes. The existing 300ms debounce prevents event thrashing from bulk writes.
