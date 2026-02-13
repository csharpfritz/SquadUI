### Data Model Interfaces (2026-02-13) — Linus

**Decision:** Established TypeScript interfaces for SquadUI data layer.

**Models defined in `src/models/index.ts`:**
- `SquadMember`: name, role, status ('working' | 'idle'), currentTask
- `Task`: id, title, description, status ('pending' | 'in_progress' | 'completed'), assignee, startedAt, completedAt
- `WorkDetails`: Combined view model with task + member + logEntries for webview display
- `OrchestrationLogEntry`: Matches Scribe log format (timestamp, date, topic, participants, summary, decisions, outcomes, relatedIssues)
- `TeamRoster`: Container for parsed team.md data

**Rationale:**
- MemberStatus uses 'working'/'idle' (runtime status) rather than team.md's Active/Silent/Monitor (config-time status)
- Dates are typed as `Date` with optional undefined for in-progress tasks
- JSDoc comments on all interfaces for IDE support
