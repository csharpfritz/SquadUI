# Decision: TeamMdService Design

**Author:** Linus  
**Date:** 2026-02-14  
**Issue:** #21 — Implement team.md parser service

## Context

The SquadUI extension needs to read and parse `.ai-team/team.md` files to display squad members and their roles in the VS Code sidebar. This requires a dedicated service that can handle the markdown table format and extract structured data.

## Decisions Made

### 1. Status Badge Interpretation

**Decision:** Map all team.md status badges (✅ Active, 📋 Silent, 🔄 Monitor, 🤖 Coding Agent) to `'idle'` MemberStatus.

**Rationale:** The badges in team.md represent *configuration* status (whether a member is available, monitoring, etc.), not *runtime* status (whether they're currently working). Runtime status is determined by the `OrchestrationLogService` based on recent log entries.

### 2. Extended Roster Interface

**Decision:** Create `ExtendedTeamRoster` that extends `TeamRoster` to add `copilotCapabilities` property rather than modifying the base interface.

**Rationale:** Preserves backward compatibility with code using the base `TeamRoster` interface while allowing callers who need @copilot capabilities to use the extended type.

### 3. Copilot Auto-Assign Detection

**Decision:** Parse `<!-- copilot-auto-assign: true|false -->` HTML comments to determine auto-assign setting.

**Rationale:** HTML comments are invisible in rendered markdown but allow configuration without adding visible clutter to team.md.

### 4. Dual Capability Format Support

**Decision:** Support both detailed (bulleted list) and inline (comma-separated) capability formats.

**Rationale:** Different team.md files use different formats. The SquadUI team.md uses detailed lists while BlazorLoRA uses inline format. Supporting both ensures compatibility.

### 5. Coordinator Filtering

**Decision:** Skip entries with role "Coordinator" when parsing the Members table.

**Rationale:** Coordinators have their own section in team.md and aren't squad members in the traditional sense. They route work but don't execute tasks.

## Implementation

- File: `src/services/TeamMdService.ts`
- Exports: `TeamMdService`, `CopilotCapabilities`, `ExtendedTeamRoster`
- Method: `parseTeamMd(workspaceRoot: string): Promise<ExtendedTeamRoster | null>`

## Open Questions

None at this time.
