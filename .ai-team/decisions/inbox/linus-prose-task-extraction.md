# Prose-Based Task Extraction in OrchestrationLogService

**Author:** Linus (Backend Dev)
**Date:** 2026-02-13

## Context

`getActiveTasks()` only created tasks from `#NNN` issue references. Real-world repos like MyFirstTextGame have no issue references — they describe work as prose in session log sections ("What Was Done", "Who Worked", "Outcomes") and orchestration log fields ("Agent routed", "Outcome").

## Decisions

### 1. Two-Pass Extraction: Issues First, Then Prose

**Decision:** The `#NNN` extraction runs as a first pass over all entries. The prose extraction runs as a second pass, only for entries that produced zero issue-based tasks and have participants.

**Rationale:** Preserves existing behavior for repos that use GitHub issues. Prose extraction is additive — it fills the gap for repos that don't use issue numbers. No existing tests or behavior change.

### 2. "What Was Done" Items Have Highest Prose Priority

**Decision:** Within the prose pass, entries with a `## What Was Done` section are processed before entries that fall to the synthetic fallback path.

**Rationale:** "What Was Done" bullets contain per-agent attributed work items (`- **Banner:** Built full engine...`). These are richer than a synthetic task generated from the first participant + summary. Processing them first prevents ID collisions where a less-specific synthetic task would claim the `{date}-{agent}` ID before the more descriptive one.

### 3. Deterministic Task IDs: `{date}-{agent-slug}`

**Decision:** Prose-derived tasks use `{date}-{agent-slug}` as their ID (e.g., `2026-02-10-banner`).

**Rationale:** Stable across re-parses (deterministic). Avoids collisions between different agents on the same date. Avoids collisions with numeric `#NNN` issue IDs. Human-readable in debug output.

### 4. "What Was Done" Items Are Always Status: completed

**Decision:** Tasks parsed from `## What Was Done` bullets are always marked `completed` with `completedAt` set to the entry date.

**Rationale:** These bullets are past-tense descriptions of done work ("Built full engine", "Wrote 131 tests"). The section name itself — "What Was Done" — implies completion.

### 5. Completion Signal Detection for Synthetic Tasks

**Decision:** Synthetic fallback tasks check for completion keywords ("Completed", "Done", "✅", "pass", "succeeds") in the combined summary + outcomes text.

**Rationale:** Orchestration log outcomes like "Completed — Full engine with 13 models, 9 services" clearly signal done work. Matching these keywords gives reasonable status inference without requiring structured status fields.

### 6. whatWasDone Field Added to OrchestrationLogEntry

**Decision:** Added optional `whatWasDone: { agent: string; description: string }[]` field to the `OrchestrationLogEntry` interface.

**Rationale:** The Task interface was intentionally not changed (existing fields are sufficient). The log entry interface needed a place to store parsed "What Was Done" data between `parseLogFile()` and `getActiveTasks()`. The field is optional, so all existing code that constructs or reads log entries is unaffected.

## Impact

- `OrchestrationLogEntry` has a new optional field — no breaking change
- `Task` interface unchanged
- All 203 existing tests pass without modification
- Repos with `#NNN` references see zero behavior change
- Repos with only prose descriptions now produce meaningful tasks
