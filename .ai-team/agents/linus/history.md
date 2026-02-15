# Project Context

- **Owner:** Jeffrey T. Fritz (csharpfritz@users.noreply.github.com)
- **Project:** VS Code extension for visualizing Squad team members and their tasks
- **Stack:** TypeScript, VS Code Extension API, potentially GitHub Copilot integration
- **Created:** 2026-02-13

## Learnings Summary

### v0.1v0.2: Core Data Pipeline Foundation
- OrchestrationLogService, TeamMdService, SquadDataProvider, FileWatcherService, GitHubIssuesService with test fixtures
- Two-tier member resolution: team.md + log overlay
- Dual-directory log discovery (orchestration-log/ + log/)
- Multi-format participant extraction (inline, table, agent-routed fields)
- Prose + issue-based task extraction with deterministic task IDs ({date}-{agent-slug})
- Flexible GitHub issue matching: labels, assignees, any-label strategies

### GitHubIssuesService Architecture
- IGitHubIssuesService interface enables graceful degradation and late binding
- Issues use $(issues) codicon with theme color tinting (green open, purple closed)
- Squad labels filtered from display to avoid redundancy
- Default matching strategy: ['labels', 'assignees'] when no config present
- Member Aliases table parsed from team.md Issue Source section
- Separate closedCache for closed issues; fetch max 50, sorted by updated_at descending

### SkillCatalogService & Log Parsing
- Fetches from awesome-copilot + skills.sh using Node's https module
- All methods swallow network errors and return empty arrays (graceful degradation)
- Deduplicates toward awesome-copilot version
- No npm dependencies

### Log Summary Extraction Priority Chain
1. ## Summary section
2. | **Outcome** | value | table field
3. Heading title after em dash
4. First prose paragraph (prevents table markdown leakage)

### OrchestrationLogService Features
- Filename regex handles both YYYY-MM-DD-topic.md and YYYY-MM-DDThhmm-topic.md formats
- Agent Routed table field fallback: | **Agent routed** | Fury (Lead) |  extracts agent name, strips role suffix and pipes
- Who Worked table format parsing: xtractTableFirstColumn() helper
- Prose task extraction: "What Was Done" section highest priority, synthetic fallback per entry

### 2026-02-15 Team Updates
 Issues Service Interface Contract  IGitHubIssuesService decouples tree view from implementation  decided by Rusty
 Issue Icons & Display Filtering  uses codicon with theme tinting, Squad labels filtered  decided by Rusty
 Release Pipeline Workflow  tag-based trigger, version verification gate, VSCE_PAT secret  decided by Livingston
 Closed Issues Architecture  separate closedCache, max 50, sorted by updated_at descending  decided by Linus
 SkillCatalogService Graceful Degradation  swallow network errors, return empty arrays  decided by Linus
 Table-Format Log Summary Extraction  priority chain to prevent markdown leakage  decided by Linus
 Default Issue Matching & Member Aliases  defaults to labels+assignees, aliases in team.md  decided by Linus
 E2E Validation Test Strategy  TestableWebviewRenderer pattern, acceptance criteria traceability  decided by Basher

### H1 Decision Format Support
- Added support for `# Decision: {title}` (H1) format in `parseDecisionsMd()` — some projects (e.g. aspire-minecraft) use this instead of H2/H3
- H1 decisions use `**Date:**`, `**Author:**`, `**Issue:**` metadata lines below the heading
- Section boundary: an H1 decision runs until the next H1 heading (or EOF)
- Inner `## Context`, `## Decision`, `## Rationale` subsections are NOT treated as separate decisions — they're consumed as content of the parent H1 block
- The parser skips `i` forward to `sectionEnd` after consuming an H1 decision to prevent subsection re-parsing
- Non-decision H1 headings (e.g. `# Decisions`, `# Team Log`) are skipped — only `# Decision: ` with the prefix triggers parsing
- Existing H2/H3 parsing is completely untouched — the H1 block uses `continue` before reaching H2/H3 logic