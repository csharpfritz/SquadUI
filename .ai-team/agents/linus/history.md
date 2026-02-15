# Project Context

- **Owner:** Jeffrey T. Fritz (csharpfritz@users.noreply.github.com)
- **Project:** VS Code extension for visualizing Squad team members and their tasks
- **Stack:** TypeScript, VS Code Extension API, potentially GitHub Copilot integration
- **Created:** 2026-02-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### v0.1-v0.2 Summary: Core Data Pipeline Foundation

Linus built the foundational data services (OrchestrationLogService, TeamMdService, SquadDataProvider, FileWatcherService, GitHubIssuesService) with test fixtures, two-tier member resolution (team.md + log overlay), dual-directory log discovery, multi-format participant extraction (inline, table, agent-routed fields), prose + issue-based task extraction, and flexible GitHub issue matching strategies (labels, assignees, any-label). See detailed decisions in `.ai-team/decisions.md` for architecture rationale.

### 2026-02-13: Team Update — Issues Service Interface Contract

📌 **Team decision merged (2026-02-13):** `IGitHubIssuesService` interface decouples tree view from issues service implementation, enabling graceful degradation and late binding. — decided by Rusty

### 2026-02-13: Team Update — Issue Icons & Display Filtering

📌 **Team decision merged (2026-02-13):** Issues use `$(issues)` codicon with theme color tinting (green for open, purple for closed). Squad labels are filtered from display to avoid redundancy since they're structural metadata. — decided by Rusty

### 2026-02-13: Team Update — Release Pipeline Workflow

📌 **Team decision merged (2026-02-13):** Release pipeline (`release.yml`) is self-contained with its own CI steps, tag-based trigger, version verification gate, and marketplace publish via VSCE_PAT secret. — decided by Livingston
### 2026-02-14: Flexible Issue Matching Strategies

Extended `GitHubIssuesService` with multi-strategy issue-to-member matching:
- **squad:{member} labels** (existing) — still the primary strategy
- **Assignee matching** — maps GitHub assignee usernames to squad member names via `memberAliases` config
- **Any-label matching** — matches any label name (case-insensitive) against member names

Key design decisions:
- `resolveStrategies()` defaults to `['labels', 'assignees']` when no config present — preserves backward compatibility while adding assignee matching as fallback
- Results from all active strategies are unioned and deduplicated by issue number per member via `addIssueToBucket()` helper
- Reverse alias map (GitHub username → squad member name) is built once per call, not per-issue
- Both `getIssuesByMember` and `getClosedIssuesByMember` use the same strategy resolution

Extended `TeamMdService` to parse:
- `Matching` field from Issue Source table → `string[]` of strategy names
- `### Member Aliases` table → `Map<string, string>` (squad name → GitHub username)
- Both fields are optional; service returns `undefined` when not present

Extended `IssueSourceConfig` model with:
- `matching?: string[]` — which strategies to use
- `memberAliases?: Map<string, string>` — squad name → GitHub username mapping

Extended `ExtendedTeamRoster` with:
- `issueMatching?: string[]` — parsed from team.md Issue Source
- `memberAliases?: Map<string, string>` — parsed from team.md Member Aliases table
### 2026-02-14: Team Update — Closed Issues Architecture Decision (Decision Merged)

📌 **Team decision captured:** Closed issues use a separate `closedCache` field independent from open issues. Fetch at most 50 (single page, no pagination) sorted by updated_at descending. Use case-insensitive member matching via `squad:{name}` labels. — decided by Linus

### 2026-02-13: OrchestrationLogService — Multi-Directory Discovery and Format Tolerance

`discoverLogFiles()` now returns the union of files from ALL configured log directories (`orchestration-log/` and `log/`), not just the first one that has files. Real-world repos like MyFirstTextGame use both directories — `orchestration-log/` contains routing metadata with `**Agent routed**` fields, while `log/` contains session logs with `**Participants:**` and issue references.

The filename regex in `parseLogFile()` now handles both `YYYY-MM-DD-topic.md` and `YYYY-MM-DDThhmm-topic.md` formats via the optional group `(?:T\d{4})?`. The orchestration-log directory uses the `T`-separated timestamp format.

`extractParticipants()` now has a fallback for the `**Agent routed**` table field format used in orchestration-log entries (e.g., `| **Agent routed** | Fury (Lead) |`). The regex matches the markdown table pipe delimiter and strips the `(Role)` suffix to extract just the agent name.

### 2026-02-13: Prose-Based Task Extraction in getActiveTasks()

`getActiveTasks()` now extracts tasks from two sources: `#NNN` issue references (original behavior, untouched) and prose work descriptions (new).

The prose extraction runs in a second pass, only for log entries that (a) produced no `#NNN` tasks and (b) have participants. Two paths within the prose pass:

1. **"What Was Done" section** (highest priority): Parses `- **AgentName:** description` bullets. Each becomes a task with the agent as assignee, a truncated title from the description, and `completed` status (past-tense prose = done work). Parsed via `extractWhatWasDone()`.

2. **Synthetic fallback**: If no "What Was Done" section exists, creates a single task per entry using the first participant as assignee and the summary as title. Status is determined by `isCompletionSignal()` checking for "Completed", "Done", "✅", "pass", "succeeds" in outcomes/summary text.

Task IDs are deterministic: `{date}-{agent-slug}` (e.g., `2026-02-10-banner`). The "What Was Done" path runs before the synthetic fallback to prevent ID collisions — richer per-agent data wins over single-participant synthetic tasks.

### 2026-02-13: Who Worked Table Parsing

`extractParticipants()` gained a table-format fallback for the `## Who Worked` section. Real-world session logs (e.g., MyFirstTextGame) use a markdown table (`| Agent | Role |`) instead of bullet lists or inline `**Participants:**` lines. The `extractTableFirstColumn()` helper parses table rows, skips header/separator rows, and returns agent names from the first column.

### 2026-02-14: Team Update — SkillCatalogService Uses Graceful Degradation (Decision Merged)

📌 **Team decision captured:** `SkillCatalogService` fetches from awesome-copilot + skills.sh using Node's `https` module. All methods swallow network errors and return empty arrays. Deduplicates toward awesome-copilot version. No npm dependencies. — decided by Linus

### 2026-02-14: Team Update — Table-Format Log Summary Extraction (Decision Merged)

📌 **Team decision captured:** Summary field extraction priority chain: (1) ## Summary section, (2) | **Outcome** | value | table field, (3) Heading title after em dash, (4) First prose paragraph. Prevents table markdown leakage into tree view. — decided by Linus

### 2026-02-14: Team Update — Default Issue Matching & Member Aliases (Decision Merged)

📌 **Team decision captured:** GitHubIssuesService defaults to `['labels', 'assignees']` when no Matching config. Member Aliases table parsed from team.md Issue Source section. — decided by Linus

### 2026-02-14: Team Update — E2E Validation Test Strategy (Decision Merged)

📌 **Team decision captured:** E2E tests use TestableWebviewRenderer pattern for HTML validation without live webview panels. Tests organized by acceptance criteria (AC-1 through AC-6) for direct traceability. Manual test plan covers visual/interactive behavior. — decided by Basher

### 2026-02-13: Agent Routed Pipe Cleanup

The `**Agent routed**` participant extraction regex now strips trailing pipe characters (`|`) in addition to `(Role)` suffixes. The orchestration-log table format includes trailing pipes that were leaking into participant names.

### 2026-02-13: OrchestrationLogEntry.whatWasDone Field

Added optional `whatWasDone` field to `OrchestrationLogEntry` in `src/models/index.ts`. Contains `{ agent: string; description: string }[]` parsed from the `## What Was Done` section. Populated during `parseLogFile()`, consumed by `getActiveTasks()`. No impact on existing code — the field is optional.

### 2026-02-13: Table-Format Log Entry Extraction

Orchestration log entries that use a metadata table format (no `## Summary` or `## What Was Done` sections) were producing tasks with raw markdown table text as the title. Fixed with a four-part priority chain for summary extraction:

1. `## Summary` section (existing, for session logs)
2. `**Outcome**` table field via `extractOutcomeFromTable()` — new method that matches `| **Outcome** | {value} |` rows and strips markdown formatting
3. Heading title after em dash via `extractHeadingTitle()` — new method that matches `### timestamp — title` and returns the text after the em dash
4. First paragraph fallback via `extractSummaryFallback()` — now skips lines starting with `|` (table rows)

Both new methods are public for testability. Added 14 tests in `orchestrationLogService.test.ts` covering extraction, edge cases, and integration with `parseLogFile()`.

### 2026-02-14: SkillCatalogService — External Skill Browsing and Import

Created `src/services/SkillCatalogService.ts` (issue #38) — a unified service for browsing and downloading skills from two external catalogs:

**Architecture decisions:**
- Used raw HTTPS (`https.get`) with redirect-following, matching the `GitHubIssuesService` pattern — no external dependencies, no `vscode` imports
- awesome-copilot source fetches raw README from `raw.githubusercontent.com` and parses `- [Name](URL) - Description` list items (high confidence)
- skills.sh source parses HTML with regex-based extraction (anchor links + nearby text + JSON-LD structured data), confidence varies by extraction quality
- Network errors are swallowed in public methods — return empty arrays, never throw
- Deduplication by name (case-insensitive), preferring awesome-copilot version when duplicates exist

**Key files:**
- `src/services/SkillCatalogService.ts` — the service (no VS Code dependency)
- `src/models/index.ts` — `Skill` interface added above the GitHub Issues section
- `src/services/index.ts` — barrel export added
- Skills install to `.ai-team/skills/{slug}/SKILL.md`

**Patterns established:**
- `parseAwesomeReadme()` and `parseSkillsShHtml()` are public for testability, following the existing convention for `extractOutcomeFromTable()` etc.
- `httpsGet()` follows redirects (up to 5) and times out at 15s
- `getInstalledSkills()` is synchronous (fs reads), while `fetchCatalog()` and `searchSkills()` are async (network)
- Slug generation strips non-alphanumeric chars and joins with hyphens

### 2026-02-14: Team Update — Sidebar Reorganization

📌 **Team update (2026-02-14):** Sidebar reorganized into Team/Skills/Decisions views — decided by Rusty
### 2026-02-14 — Visibility Features Proposals Finalized

📌 Team update (2026-02-14): 10 PM visibility and UI feature proposals generated (Velocity Dashboard, Team Health Heatmap, Decision Browser, Ceremony Timeline, Blocker Visualizer, Activity Timeline, Status Bar Integration, Badge Decorations, Performance Dashboard, Skill Matrix). Proposals prioritized into Quick Wins (Status Bar, Badges) and High Impact (Timeline, Performance Dashboard). Ready for prioritization and implementation assignment. — decided by Danny, Rusty
