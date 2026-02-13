# Team Decisions

> Shared brain for the Squad. All agents read this. Append-only.

<!-- Decisions below are recorded by Scribe from the inbox. -->

## Extension Structure and Naming

**Date:** 2026-02-13  
**Author:** Rusty (Extension Dev)  
**Status:** Proposed

### Context

Scaffolding the VS Code extension requires establishing the foundational naming conventions and activation strategy.

### Decision

1. **Extension ID:** `squadui` (package name)
2. **Display Name:** `SquadUI`
3. **Publisher:** `csharpfritz`
4. **Activation Strategy:** Lazy activation on `onView:squadMembers` — extension only loads when user opens the tree view
5. **Tree View Container ID:** `squadui` (in activity bar)
6. **Primary View ID:** `squadMembers`

### Rationale

- Lazy activation keeps VS Code fast for users who don't use Squad
- Single activity bar container allows adding more views later (tasks, history, etc.)
- View ID `squadMembers` is descriptive and leaves room for sibling views

### Impact

All future tree views and commands should register under the `squadui` container. View IDs should follow the pattern `squad{Feature}` (e.g., `squadTasks`, `squadHistory`).

---

## CI Pipeline Configuration

**Author:** Livingston (DevOps/CI)
**Date:** 2025-07-19
**Issue:** #22

### Decision

The CI pipeline uses Node.js 18.x with the following stages:
1. `npm ci` — clean install dependencies
2. `npm run lint` — ESLint with TypeScript
3. `npm run compile` — TypeScript compilation
4. `npm test` — VS Code extension tests

Additionally, `.github/workflows/ci.yml` includes `concurrency` group with `cancel-in-progress: true` so duplicate CI runs on the same branch cancel each other.

### Rationale

- Node 18 is stable LTS and widely supported
- `npm ci` ensures reproducible builds from lockfile
- Pipeline fails fast on lint errors before spending time on compilation
- Test artifacts uploaded for debugging failed runs
- Concurrency control prevents wasted CI minutes when multiple pushes happen in quick succession on the same branch or PR

### Location

`.github/workflows/ci.yml`

---

## TeamMdService Design

**Author:** Linus  
**Date:** 2026-02-14  
**Issue:** #21 — Implement team.md parser service

### Context

The SquadUI extension needs to read and parse `.ai-team/team.md` files to display squad members and their roles in the VS Code sidebar. This requires a dedicated service that can handle the markdown table format and extract structured data.

### Decisions Made

#### 1. Status Badge Interpretation

**Decision:** Map all team.md status badges (✅ Active, 📋 Silent, 🔄 Monitor, 🤖 Coding Agent) to `'idle'` MemberStatus.

**Rationale:** The badges in team.md represent *configuration* status (whether a member is available, monitoring, etc.), not *runtime* status (whether they're currently working). Runtime status is determined by the `OrchestrationLogService` based on recent log entries.

#### 2. Extended Roster Interface

**Decision:** Create `ExtendedTeamRoster` that extends `TeamRoster` to add `copilotCapabilities` property rather than modifying the base interface.

**Rationale:** Preserves backward compatibility with code using the base `TeamRoster` interface while allowing callers who need @copilot capabilities to use the extended type.

#### 3. Copilot Auto-Assign Detection

**Decision:** Parse `<!-- copilot-auto-assign: true|false -->` HTML comments to determine auto-assign setting.

**Rationale:** HTML comments are invisible in rendered markdown but allow configuration without adding visible clutter to team.md.

#### 4. Dual Capability Format Support

**Decision:** Support both detailed (bulleted list) and inline (comma-separated) capability formats.

**Rationale:** Different team.md files use different formats. The SquadUI team.md uses detailed lists while BlazorLoRA uses inline format. Supporting both ensures compatibility.

#### 5. Coordinator Filtering

**Decision:** Skip entries with role "Coordinator" when parsing the Members table.

**Rationale:** Coordinators have their own section in team.md and aren't squad members in the traditional sense. They route work but don't execute tasks.

### Implementation

- File: `src/services/TeamMdService.ts`
- Exports: `TeamMdService`, `CopilotCapabilities`, `ExtendedTeamRoster`
- Method: `parseTeamMd(workspaceRoot: string): Promise<ExtendedTeamRoster | null>`

### Open Questions

None at this time.

---

## Data Model Interfaces

**Date:** 2026-02-13  
**Author:** Linus

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

---

## v0.3.0 Squad Management Features — Architecture Plan

**Author:** Danny (Lead)  
**Date:** 2026-02-13  
**Status:** Accepted for implementation

### Vision

Enable SquadUI to act as a control plane for squad initialization and team member lifecycle management. Users can initialize squads, add/remove members with roles, and specify character universes for AI-powered name casting—all without leaving VS Code.

### Core Features

#### 1. Squad Initialization

**Command:** `squadui.initSquad` → "Squad: Initialize"

**Flow:**
- User runs command from palette
- Show spinner/progress notification
- Spawn child process: `npx github:bradygaster/squad init`
- Capture stdout/stderr, stream to VS Code terminal or notification
- After completion, reload team.md data and refresh tree view
- Display success/error message

**Implementation:**
```typescript
// src/commands/initSquadCommand.ts
import { spawn } from 'child_process';
import * as vscode from 'vscode';

export async function initSquad(context: vscode.ExtensionContext) {
  const terminal = vscode.window.createTerminal('Squad Init');
  terminal.show();
  terminal.sendText('npx github:bradygaster/squad init');
  // Re-read team.md and trigger tree refresh after process exits
}
```

**Why This Approach:**
- Terminal gives users full visibility into squad init process
- Non-blocking: users can continue working while init runs
- Error messages from squad CLI naturally appear in terminal
- Reuses existing Node.js `child_process` API (no new dependencies)

#### 2. Team Member Management

**Commands:**
- `squadui.addMember` → "Squad: Add Member"
- `squadui.removeMember` → "Squad: Remove Member"

**Add Member Flow:**
1. InputBox: "Enter member name" (free-form, e.g., "Alice Smith")
2. QuickPick: Select role (Engineer, Design, QA, PM, etc. — from config)
3. Show universe selector if configured
4. Insert new row into team.md Members table
5. Refresh tree view

**Remove Member Flow:**
1. QuickPick: Select member from active roster (exclude alumni)
2. Confirmation dialog: "Move [Name] to alumni?"
3. Move row from Members table to Alumni section in team.md
4. Refresh tree view

**Implementation:**
```typescript
// src/commands/memberManagementCommands.ts
import * as vscode from 'vscode';
import { TeamMdService } from '../services/TeamMdService';

export async function addMember() {
  const name = await vscode.window.showInputBox({ 
    prompt: 'Enter member name' 
  });
  if (!name) return;

  const roles = ['Engineer', 'Design', 'QA', 'PM'];
  const role = await vscode.window.showQuickPick(roles, {
    placeHolder: 'Select role'
  });
  if (!role) return;

  await TeamMdService.addMember({ name, role });
  vscode.commands.executeCommand('squadui.refreshTree');
}

export async function removeMember() {
  const members = await TeamMdService.getActiveMembers();
  const selected = await vscode.window.showQuickPick(
    members.map(m => m.name),
    { placeHolder: 'Select member to remove' }
  );
  if (!selected) return;

  const confirmed = await vscode.window.showWarningMessage(
    `Move ${selected} to alumni?`,
    'Yes', 'Cancel'
  );
  if (confirmed === 'Yes') {
    await TeamMdService.moveToAlumni(selected);
    vscode.commands.executeCommand('squadui.refreshTree');
  }
}
```

**Why This Approach:**
- QuickPick provides familiar, native VS Code UX
- InputBox for free-form input (names vary widely)
- Members stay in team.md (both active and alumni) — true audit trail
- No external CLI needed; direct team.md manipulation

#### 3. Universe Selector

**Command:** `squadui.selectUniverse` → "Squad: Select Universe for Casting"

**Flow:**
1. QuickPick: Show available universes (Marvel, DC, Star Wars, etc.)
2. Store selection in team.md `@copilot` capability profile
3. Pass `--universe` flag to squad init/add-member commands
4. Optionally show current universe in status bar or tree view header

**Implementation:**
```typescript
// src/commands/universeSelectCommand.ts
export async function selectUniverse() {
  const universes = [
    'Marvel', 
    'DC Comics', 
    'Star Wars', 
    'Lord of the Rings'
  ];
  
  const selected = await vscode.window.showQuickPick(universes, {
    placeHolder: 'Choose universe for member casting'
  });
  
  if (selected) {
    await TeamMdService.setUniverse(selected);
    vscode.window.showInformationMessage(
      `Squad universe set to ${selected}`
    );
  }
}
```

**Why This Approach:**
- Simple, discoverable command
- Universe setting persists in team.md (portable across workspaces)
- Can be invoked standalone or called by other commands

#### 4. Command Palette Integration

**Manifest Changes** (in `package.json`):
```json
{
  "commands": [
    {
      "command": "squadui.initSquad",
      "title": "Initialize",
      "category": "Squad"
    },
    {
      "command": "squadui.addMember",
      "title": "Add Member",
      "category": "Squad"
    },
    {
      "command": "squadui.removeMember",
      "title": "Remove Member",
      "category": "Squad"
    },
    {
      "command": "squadui.selectUniverse",
      "title": "Select Universe",
      "category": "Squad"
    }
  ]
}
```

**Context Menus** (optional but recommended):
```json
{
  "menus": {
    "view/item/context": [
      {
        "command": "squadui.removeMember",
        "when": "view == squadMembers && viewItem == member",
        "group": "inline"
      }
    ]
  }
}
```

### Data Persistence: team.md Structure

All changes flow through **TeamMdService**, which reads/writes team.md:

```markdown
# team.md

## Members

| Name | Role | Status |
|------|------|--------|
| Alice Smith | Engineer | active |
| Bob Jones | Design | active |

## Alumni

| Name | Role | End Date |
|------|------|----------|
| Charlie Davis | PM | 2025-12-01 |

## @copilot

- **Universe:** Marvel
- **Base URL:** https://api.github.com
```

**Why This Approach:**
- All squad state is human-readable, version-controllable YAML/Markdown
- No separate database or config files
- Works with existing .ai-team/ infrastructure
- Changes trigger file watcher → tree refresh

### Integration Points

#### With Existing Services

- **TeamMdService** (new): Parses/updates team.md, returns SquadMember[]
- **SquadDataProvider**: Already reads team.md, will auto-refresh on file changes
- **SquadTreeProvider**: Already renders tree from SquadDataProvider, will show changes
- **FileWatcherService** (existing): Detects team.md changes, invalidates cache

#### With External CLI

- **squad init**: Respects `--universe` flag, creates initial team.md
- **squad add-member**: Takes name, role, universe; updates team.md directly

### File Structure (v0.3.0 additions)

```
src/
  commands/
    initSquadCommand.ts          [NEW]
    memberManagementCommands.ts  [NEW]
    universeSelectCommand.ts     [NEW]
  services/
    TeamMdService.ts             [UPDATED] Add write methods
```

### Acceptance Criteria

#### ✅ Core Features
- [ ] Squad init command spawns `npx squad init` and shows output
- [ ] Add member: InputBox + QuickPick, updates team.md
- [ ] Remove member: QuickPick, moves to Alumni, confirms first
- [ ] Universe selector: QuickPick, persists in team.md @copilot
- [ ] All commands registered in package.json with "Squad:" prefix

#### ✅ UX/Workflow
- [ ] Commands appear in command palette as "Squad: ..."
- [ ] Progress/success messages shown to user
- [ ] Tree view refreshes after member changes
- [ ] Confirmation dialogs for destructive ops (remove)
- [ ] Error handling for malformed team.md

#### ✅ Testing
- [ ] Unit tests for TeamMdService.addMember, removeToAlumni
- [ ] Integration tests: add member → team.md changes → tree refreshes
- [ ] Command tests: all four commands callable without error

### Open Questions / Risks

1. **Squad CLI Compatibility**: Assume `npx github:bradygaster/squad` is installable. If not, need fallback plan.
2. **team.md Format Stability**: If squad evolves team.md schema, we need parsing resilience.
3. **Universe Enum**: Should universes be hardcoded or loaded from squad CLI config?
4. **Tree View Context Menus**: Are tree item context menus necessary MVP, or nice-to-have for v0.3.1?

### Related Issues

- #24: Add squad init command
- #25: Add team member management commands
- #26: Add universe selector for casting
- #27: Create command palette integration

### Success Metrics

- All 4 commands are functional and accessible from command palette
- team.md can be modified entirely within VS Code
- Tree view reflects member additions/removals without manual refresh
- No crashes or unhandled errors in command execution

---

## MVP scope and phasing

**Date:** 2026-02-13
**Author:** Danny
**Status:** Accepted

### Scope Decision

- **v0 (MVP):** Tree view + webview UI, orchestration logs as data source, working/idle indicators
- **v1:** Add GitHub issues integration as second data source
- Tree structure: Squad members → Tasks → Work details
- Both data sources will eventually be unified under a common task model

### Rationale

Phasing reduces initial complexity. Orchestration logs are immediate; GitHub issues can be layered on once the UI is validated.

---

## User directive — GitHub project management

**Date:** 2026-02-13
**Author:** Jeffrey T. Fritz (via Copilot)

### Directive

Use GitHub issues and milestones for this project. Create color-coded labels for each team member assigned to tasks.

### Rationale

User request — captured for team memory

---

## Diagnosis: Empty Tree View Issue (#19)

**Author:** Basher (Tester)  
**Date:** 2026-02-13  
**Issue:** #19 — Debug empty tree view issue

### Problem Statement

The tree view shows no content when pointing the extension at `D:\blazorlora`, which has a `.ai-team/` folder with an EMPTY `.ai-team/orchestration-log/` folder.

### Data Flow Analysis

Complete data flow from extension activation to tree rendering:

```
extension.ts
    └── SquadDataProvider(workspaceRoot)
            └── getSquadMembers()
                    └── getLogEntries()
                            └── OrchestrationLogService.parseAllLogs()
                                    └── discoverLogFiles() → returns []
                    └── getMemberStates() → returns empty Map
                    └── getActiveTasks() → returns []
            └── returns [] (empty member list)
    └── SquadTreeProvider.getSquadMemberItems()
            └── dataProvider.getSquadMembers() → []
            └── returns [] (empty tree)
```

### Root Cause

**The extension derives ALL squad members from orchestration log participants only.**

#### Evidence from Code

**SquadDataProvider.getSquadMembers()** (lines 40-48):
```typescript
// Build member list from all participants across log entries
const members: SquadMember[] = [];
const memberNames = new Set<string>();

for (const entry of entries) {
    for (const participant of entry.participants) {
        memberNames.add(participant);
    }
}
```

When `entries` is empty (no orchestration logs exist), `memberNames` is empty, and the tree shows nothing.

**OrchestrationLogService.discoverLogFiles()** (lines 25-55):
- Only searches `.ai-team/orchestration-log/` and `.ai-team/log/`
- Returns `[]` if directories are empty or missing
- This is correct behavior for the service's scope

**OrchestrationLogService.getMemberStates()** (lines 139-165):
- Returns empty Map when no entries exist
- This is expected — no activity means no member states

### The Design Gap

The extension assumes orchestration logs are the primary source of truth for team membership. However:

1. **team.md** contains the canonical team roster with roles and status
2. **orchestration-log/** only records activity (who worked, when, on what)
3. A new project with a team.md but no logs shows NOTHING in the tree

### What SHOULD Happen

The tree view should show all members from `team.md`, even if they have no logged activity. Members with activity would show as "working" with tasks; members without activity would show as "idle" with no tasks.

### Recommended Fix

**Create a `TeamMdService` to read the team roster from `.ai-team/team.md`.**

#### Implementation Approach

1. **New Service:** `src/services/TeamMdService.ts`
   - Parse the Members table from team.md
   - Extract: name, role, charter path, status (Active/Silent/Monitor)
   - Return structured `TeamMember[]` data

2. **Update SquadDataProvider.getSquadMembers():**
   - Get members from `TeamMdService` as primary source
   - Overlay activity status from `OrchestrationLogService.getMemberStates()`
   - Members in recent logs → status: "working"
   - Members not in recent logs → status: "idle"

3. **Fallback Behavior:**
   - If team.md missing: fall back to current log-participant behavior
   - If both missing: show helpful empty state message

#### team.md Table Format (for parser)

```markdown
## Members

| Name | Role | Charter | Status |
|------|------|---------|--------|
| Danny | Lead | `.ai-team/agents/danny/charter.md` | ✅ Active |
```

Parser needs to:
- Find `## Members` section
- Parse markdown table rows
- Extract Name, Role columns
- Filter by Status (Active = show in tree)

### Test Cases to Add

1. **Empty orchestration-log with team.md** → shows team.md members as idle
2. **team.md missing, logs present** → falls back to log participants
3. **Both missing** → shows empty state message
4. **Mixed** → team.md members + activity status from logs

### Files to Modify

- `src/services/TeamMdService.ts` (new)
- `src/services/SquadDataProvider.ts` (integrate TeamMdService)
- `src/services/index.ts` (export new service)
- `test-fixtures/` (add team.md fixtures)
- `src/test/suite/services.test.ts` (add TeamMdService tests)

### For Linus

This diagnosis identifies the exact code paths. The fix requires creating `TeamMdService` and integrating it as the primary member source in `SquadDataProvider`.

---

## 2026-02-14: SquadDataProvider uses team.md as authoritative roster

**By:** Linus
**What:** `SquadDataProvider.getSquadMembers()` now reads team.md first via `TeamMdService`, then overlays orchestration log status on top. If team.md is missing, it falls back to the original log-participant discovery behavior.
**Why:** Without this, projects with a team.md but no orchestration logs showed an empty tree view (#19). The roster should always come from team.md — it's the canonical source of who's on the team. Orchestration logs only tell us *what they're doing*, not *who they are*. This separation of concerns makes the data layer more resilient and the UI more useful on first load.
