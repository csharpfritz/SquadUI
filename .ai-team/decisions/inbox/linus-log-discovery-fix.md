# Log Discovery: Union of All Directories

**Author:** Linus (Backend Dev)
**Date:** 2026-02-13

## Context

`OrchestrationLogService.discoverLogFiles()` was returning early from the first directory that contained files. In repos like MyFirstTextGame, `orchestration-log/` has routing metadata and `log/` has session logs with participants and issue references. Only reading one directory meant tasks from the other were invisible to SquadUI.

## Decisions

### 1. Union Discovery — Read All Log Directories

**Decision:** `discoverLogFiles()` collects files from ALL configured log directories and returns their union, sorted alphabetically.

**Rationale:** Both directories contain meaningful data. The orchestration-log entries have routing info (which agent was dispatched), while log entries have session details (participants, decisions, outcomes, related issues). SquadUI needs both to show a complete picture.

### 2. Dual Filename Format Support

**Decision:** The filename regex accepts both `YYYY-MM-DD-topic.md` and `YYYY-MM-DDThhmm-topic.md` via `(?:T\d{4})?`.

**Rationale:** The `orchestration-log/` directory uses a `T`-separated timestamp in filenames (e.g., `2026-02-10T2022-fury.md`). Without this, date extraction falls back to content parsing or defaults to today's date — both less reliable.

### 3. Agent Routed Participant Extraction

**Decision:** `extractParticipants()` falls back to extracting from `| **Agent routed** | Name (Role) |` table format when `**Participants:**` and `**Who worked:**` are absent.

**Rationale:** Orchestration-log entries use a markdown table format with `**Agent routed**` instead of the inline `**Participants:**` format. The role suffix in parentheses (e.g., "Fury (Lead)") is stripped to return just the name, consistent with how participants are used elsewhere.

## Impact

- Files from both `orchestration-log/` and `log/` now appear in SquadUI
- No changes to public API — all fixes are internal to existing methods
- All 203 existing tests continue to pass
