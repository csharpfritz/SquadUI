## Team Display Resilience — Race Condition Handling

**Author:** Rusty (Extension Dev)
**Date:** 2026-02-16

### Context

Users reported that sometimes squad team members don't appear in the Team panel even though Skills and Decisions panels show data. Root cause: race condition during `squad init` where `hasTeam` context key is set before the Members table in `team.md` is fully written.

### Decision

1. **Single delayed retry in `SquadDataProvider.getSquadMembers()`:** When team.md file exists on disk but parsed roster returns 0 members, wait `retryDelayMs` (default 1500ms) and retry parse once. No infinite retry loop.
2. **Delayed re-refresh in init callback:** `extension.ts` init callback schedules a second full refresh 2 seconds after init completes, catching files written after the init terminal command started.
3. **Tree view loading message:** `teamView.message = 'Loading team...'` shown when `hasTeam` is true but members array is empty. Cleared when members load successfully.
4. **Retry delay is constructor-configurable** for testability (`new SquadDataProvider(root, retryDelayMs)`).

### Impact

- `SquadDataProvider` constructor signature now accepts optional second parameter `retryDelayMs`.
- No changes to `TeamMdService`, `FileWatcherService`, or `TeamTreeProvider` APIs.
- Existing tests unaffected (833 passing).
