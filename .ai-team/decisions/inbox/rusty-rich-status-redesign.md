# Rich Status Redesign

**Author:** Rusty
**Date:** 2026-02-24
**Issue:** #73 — Active Status Redesign

## Decision

Replaced binary `'working' | 'idle'` MemberStatus with rich contextual statuses:

- `'working-on-issue'` — agent is working on a GitHub issue (shows `⚙️ Issue #N`)
- `'reviewing-pr'` — agent is reviewing a pull request (shows `🔍 PR #N`)
- `'waiting-review'` — agent is waiting for a review (shows `⏳ Awaiting review`)
- `'working'` — generic active state when no specific context available (shows `⚡ Working`)
- `'idle'` — no recent activity (shows `—`)

Added `isActiveStatus()` helper — use this instead of `=== 'working'` to check if a member is active.

Added `ActivityContext` interface: `{ description, shortLabel, issueNumber?, prNumber? }` on `SquadMember` and `TeamMemberOverview`.

New `OrchestrationLogService.getMemberActivity()` method derives rich context from log entries.

## Impact

- **All code checking member status** should use `isActiveStatus(member.status)` instead of `member.status === 'working'`.
- **Tree view** now shows spinning icons for active members and contextual text in descriptions.
- **Dashboard** member cards show status badge. "Working" summary card restored.
- **Status bar** shows working/total count when members are active.
