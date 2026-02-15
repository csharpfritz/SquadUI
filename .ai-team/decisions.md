### Context

Scaffolding the VS Code extension requires establishing the foundational naming conventions and activation strategy.


---


### Decision

1. **Extension ID:** `squadui` (package name)
2. **Display Name:** `SquadUI`
3. **Publisher:** `csharpfritz`
4. **Activation Strategy:** Lazy activation on `onView:squadMembers` — extension only loads when user opens the tree view
5. **Tree View Container ID:** `squadui` (in activity bar)
6. **Primary View ID:** `squadMembers`


---


### Rationale

- Lazy activation keeps VS Code fast for users who don't use Squad
- Single activity bar container allows adding more views later (tasks, history, etc.)
- View ID `squadMembers` is descriptive and leaves room for sibling views


---


### Impact

All future tree views and commands should register under the `squadui` container. View IDs should follow the pattern `squad{Feature}` (e.g., `squadTasks`, `squadHistory`).


---


## CI Pipeline Configuration

**Author:** Livingston (DevOps/CI)
**Date:** 2025-07-19
**Issue:** #22


---


### Location

`.github/workflows/ci.yml`


---


## TeamMdService Design

**Author:** Linus  
**Date:** 2026-02-14  
**Issue:** #21 — Implement team.md parser service


---


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


---


### Implementation

- File: `src/services/TeamMdService.ts`
- Exports: `TeamMdService`, `CopilotCapabilities`, `ExtendedTeamRoster`
- Method: `parseTeamMd(workspaceRoot: string): Promise<ExtendedTeamRoster | null>`


---


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


---


### Vision

Enable SquadUI to act as a control plane for squad initialization and team member lifecycle management. Users can initialize squads, add/remove members with roles, and specify character universes for AI-powered name casting—all without leaving VS Code.


---


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


---


### Data Persistence: team.md Structure

All changes flow through **TeamMdService**, which reads/writes team.md:

```markdown
# team.md

## Members

| Name | Role | Status |
|
---
|
---
|
---
--|
| Alice Smith | Engineer | active |
| Bob Jones | Design | active |

## Alumni

| Name | Role | End Date |
|
---
|
---
|
---
-|
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


---


### Integration Points

#### With Existing Services

- **TeamMdService** (new): Parses/updates team.md, returns SquadMember[]
- **SquadDataProvider**: Already reads team.md, will auto-refresh on file changes
- **SquadTreeProvider**: Already renders tree from SquadDataProvider, will show changes
- **FileWatcherService** (existing): Detects team.md changes, invalidates cache

#### With External CLI

- **squad init**: Respects `--universe` flag, creates initial team.md
- **squad add-member**: Takes name, role, universe; updates team.md directly


---


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


---


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


---


### Open Questions / Risks

1. **Squad CLI Compatibility**: Assume `npx github:bradygaster/squad` is installable. If not, need fallback plan.
2. **team.md Format Stability**: If squad evolves team.md schema, we need parsing resilience.
3. **Universe Enum**: Should universes be hardcoded or loaded from squad CLI config?
4. **Tree View Context Menus**: Are tree item context menus necessary MVP, or nice-to-have for v0.3.1?


---


### Related Issues

- #24: Add squad init command
- #25: Add team member management commands
- #26: Add universe selector for casting
- #27: Create command palette integration


---


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


---


### Scope Decision

- **v0 (MVP):** Tree view + webview UI, orchestration logs as data source, working/idle indicators
- **v1:** Add GitHub issues integration as second data source
- Tree structure: Squad members → Tasks → Work details
- Both data sources will eventually be unified under a common task model


---


### Directive

Use GitHub issues and milestones for this project. Create color-coded labels for each team member assigned to tasks.


---


### Problem Statement

The tree view shows no content when pointing the extension at `D:\blazorlora`, which has a `.ai-team/` folder with an EMPTY `.ai-team/orchestration-log/` folder.


---


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


---


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


---


### The Design Gap

The extension assumes orchestration logs are the primary source of truth for team membership. However:

1. **team.md** contains the canonical team roster with roles and status
2. **orchestration-log/** only records activity (who worked, when, on what)
3. A new project with a team.md but no logs shows NOTHING in the tree


---


### What SHOULD Happen

The tree view should show all members from `team.md`, even if they have no logged activity. Members with activity would show as "working" with tasks; members without activity would show as "idle" with no tasks.


---


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
|
---
|
---
|
---
|
---
--|
| Danny | Lead | `.ai-team/agents/danny/charter.md` | ✅ Active |
```

Parser needs to:
- Find `## Members` section
- Parse markdown table rows
- Extract Name, Role columns
- Filter by Status (Active = show in tree)


---


### Test Cases to Add

1. **Empty orchestration-log with team.md** → shows team.md members as idle
2. **team.md missing, logs present** → falls back to log participants
3. **Both missing** → shows empty state message
4. **Mixed** → team.md members + activity status from logs


---


### Files to Modify

- `src/services/TeamMdService.ts` (new)
- `src/services/SquadDataProvider.ts` (integrate TeamMdService)
- `src/services/index.ts` (export new service)
- `test-fixtures/` (add team.md fixtures)
- `src/test/suite/services.test.ts` (add TeamMdService tests)


---


### For Linus

This diagnosis identifies the exact code paths. The fix requires creating `TeamMdService` and integrating it as the primary member source in `SquadDataProvider`.


---


## 2026-02-14: SquadDataProvider uses team.md as authoritative roster

**By:** Linus
**What:** `SquadDataProvider.getSquadMembers()` now reads team.md first via `TeamMdService`, then overlays orchestration log status on top. If team.md is missing, it falls back to the original log-participant discovery behavior.
**Why:** Without this, projects with a team.md but no orchestration logs showed an empty tree view (#19). The roster should always come from team.md — it's the canonical source of who's on the team. Orchestration logs only tell us *what they're doing*, not *who they are*. This separation of concerns makes the data layer more resilient and the UI more useful on first load.


---


## Issue Detail Webview — Architecture Decision

**Author:** Rusty (Extension Dev)
**Date:** 2026-02-14
**Status:** Proposed


---


### Decisions

#### 1. Completed Issues Use Muted Icon

**Decision:** Completed issues use `$(pass)` icon with `descriptionForeground` color to visually distinguish them from open issues (which use `$(issues)` with `charts.green`).

**Rationale:** The `pass` (checkmark) icon clearly communicates "done" status. Using `descriptionForeground` makes them visually recede compared to active open issues, keeping focus on current work.

#### 2. Issue Webview Uses postMessage for External Links

**Decision:** `IssueDetailWebview` enables scripts and uses `acquireVsCodeApi().postMessage()` to send the GitHub URL back to the extension host, which calls `vscode.env.openExternal()`.

**Rationale:** VS Code webviews don't allow arbitrary `<a href>` navigation for security. The postMessage pattern is the standard VS Code way to handle external links from webviews. `enableScripts: true` is required but CSP is still locked down.

#### 3. Command Accepts Optional Full Issue Object

**Decision:** `squadui.openIssue` command accepts `(url: string, issue?: GitHubIssue)`. When `issue` is provided, it opens the webview; otherwise falls back to `openExternal`.

**Rationale:** Backward-compatible — any existing callers passing only a URL still work. Tree items now pass the full issue object as a second argument for richer display.

#### 4. No Markdown Rendering in Issue Body

**Decision:** Issue body is rendered as escaped plain text with `white-space: pre-wrap`.

**Rationale:** Markdown rendering requires either a markdown library or `enableHtml` in the webview, both adding complexity and security surface. Plain text is sufficient for MVP. Can be upgraded later.


---


### Action Required

- Repository secret `VSCE_PAT` must be configured with a VS Code Marketplace Personal Access Token before the first release
- Publisher `csharpfritz` must be registered on the VS Code Marketplace


---


### Implementation Phases

**Phase 1: Shell + Velocity (COMPLETED 2026-02-13)**
- ✅ `SquadDashboardWebview` scaffolded with tab navigation
- ✅ Velocity tab: line chart (30-day task completion trends)
- ✅ Heatmap: team activity levels (7 days)
- ✅ Activity timeline: swimlane view of member tasks
- ✅ Command registered, status bar integration

**Phase 2: Activity Timeline Enhancements (Next)**
- Date range filter (7/30/90 days selector)
- Swimlane visual design (color-coded by status)
- Task tooltips with full descriptions

**Phase 3: Decision Browser (Future)**
- Parse decisions.md into searchable entries
- Client-side search + tag filtering
- Link decisions to log entries by date

**Phase 4: Polish & Release**
- Loading states, error handling, refresh button
- Keyboard shortcuts in README
- Version bump to 0.4.0


---


### 1. PM Visibility Features — Proposal

**Date:** 2026-02-14  
**Author:** Danny (Lead)  
**Status:** Proposed  
**Requested by:** Jeffrey T. Fritz

#### Context

SquadUI currently displays team members, tasks, and issues in a tree view with individual work details. The extension has access to rich data sources (orchestration logs, decisions.md, ceremonies.md, GitHub issues) but doesn't surface insights that help human PMs understand team health, velocity, or bottlenecks at a glance.

#### Problem Statement

Project managers need to answer these questions quickly:
- How fast is the team moving? (Velocity)
- Where are the bottlenecks? (Blockers, overload)
- What decisions were made and why? (Decision context)
- How healthy is collaboration? (Silos, pairing patterns)
- What patterns emerge from retrospectives? (Learning)

Currently, answering these requires manual archaeology across multiple files.

#### Proposed Features

**Feature 1: Velocity Dashboard** (High Value)
- A webview panel showing work completed over rolling time windows (7d, 14d, 30d)
- Data sources: OrchestrationLogService (completed tasks), GitHubIssuesService (closed issues)
- Metrics: Issues closed per week, average time-to-close, member contribution distribution, burn-up charts
- Implementation: Add VelocityDashboardWebview.ts in src/views/, query services for dated completions, render with CSS/HTML

**Feature 2: Team Health Heatmap** (High Value)
- Visual representation of workload distribution and collaboration patterns
- Data sources: OrchestrationLogService (co-participant patterns), TeamMdService, task assignments
- Metrics: Workload per member, collaboration frequency matrix, idle/working distribution, knowledge silos
- Implementation: Add TeamHealthWebview.ts, parse co-participant patterns, color-code members (green/yellow/red)

**Feature 3: Decision Browser** (Medium Value)
- Searchable, filterable view of all team decisions with context
- Data sources: .ai-team/decisions.md (structured decisions)
- Features: Full-text search, filter by author/date/status, jump to decision in markdown
- Implementation: Add DecisionBrowserWebview.ts, parse decisions.md with regex, store in memory for search

**Feature 4: Ceremony Timeline** (Medium Value)
- Chronological view of retrospectives, design reviews, and other ceremonies
- Data sources: OrchestrationLogService (ceremony sessions), ceremonies.md
- Features: Timeline of ceremonies, outcome summaries, links to issues/decisions, filtering
- Implementation: Add CeremonyTimelineWebview.ts, display as timeline with ceremony icons

**Feature 5: Blocker & Dependency Visualizer** (Lower Priority)
- Dependency graph showing which tasks/members are blocked and why
- Data sources: GitHub issue dependencies, Orchestration logs (blocked state), SquadDataProvider
- Features: Directed graph, highlight blocked tasks, show blocking reason
- Implementation: Add BlockerGraphWebview.ts, parse GitHub issue links, render dependency tree

#### Rationale

These features transform SquadUI from a status viewer to a management dashboard. They surface insights hidden in files, answer PM questions instantly, and reduce manual toil. The data already exists — we just need to aggregate and visualize it.

#### Impact

PMs gain visibility into team velocity, workload balance, decision rationale, ceremony effectiveness, and blockers. Answers key questions: "Are we on track?", "Is the team balanced?", "Where's the risk?"


---


### 2. Squad Visualization Features — UI Enhancement Proposals

**Date:** 2026-02-14  
**Author:** Rusty (Extension Dev)  
**Status:** Proposed

#### Context

Jeffrey T. Fritz requested feature proposals for VS Code UI engagement and visual decision support. Focus is on leveraging VS Code UI capabilities (Tree Views, Webviews, Status Bar).

#### Research Findings

1. **FileDecorationProvider API:** Can add badges (max 2 characters) and icons to tree items
2. **Status Bar API:** Supports custom items with text, icons (including spinning), theme colors, tooltips, click commands
3. **Webview API:** Full HTML/CSS/JS control with postMessage for bidirectional communication
4. **Theme System:** Must use ThemeColor for consistency
5. **TreeView Limitations:** Cannot add multi-badge decorations; complex UI requires webview fallback

#### Proposed Features

**Feature 1: Activity Timeline Visualization** (High Value)
- Interactive timeline webview showing member activity over time with swimlanes
- UX: Command opens side panel webview, D3.js timeline with hourly/daily/weekly zoom, colored activity blocks per member
- Implementation: ActivityTimelineWebview class, parse orchestration logs + GitHub events, D3.js timeline, postMessage filtering
- Feasibility: Medium — D3.js integration, log parsing, established webview patterns

**Feature 2: Real-Time Status Bar Integration** (High Value)
- Live squad status in VS Code status bar: active member count, sprint progress, alerts
- UX: $(organization) 3 active | Sprint: 7/12, spinning icon when working, warning colors for blockers
- Implementation: SquadStatusBarItem class, poll SquadDataProvider every 30s, use ThemeColors
- Feasibility: Easy — straightforward Status Bar API, low overhead

**Feature 3: Tree Item Badge Decorations** (Medium Value)
- Small badges on tree items: task counts (blue), blocked status (red), skill counts (green)
- UX: Member items show "3" badge for 3 active tasks, blocked members show "!"
- Implementation: SquadDecorationProvider implementing FileDecorationProvider, resourceUri pattern for decoration assignment
- Feasibility: Easy — native API, 2-character limit acceptable

**Feature 4: Member Performance Dashboard** (High Value)
- Webview panel showing individual member metrics: tasks completed, avg completion time, issue velocity, contribution graph
- UX: Context menu "View Performance Dashboard", charts for tasks/velocity/types, stats cards
- Implementation: PerformanceDashboardWebview class, parse orchestration logs for metrics, Chart.js via CDN
- Feasibility: Medium — requires metrics calculation, Chart.js integration, provides strong value

**Feature 5: Skill Coverage Matrix** (Medium Value)
- Heatmap webview showing member skills vs. skill catalog, highlighting coverage gaps
- UX: Command opens webview with heatmap (rows=skills, columns=members), cell colors green/yellow/red, filtering
- Implementation: SkillMatrixWebview class, parse charter.md for member skills, match to skill catalog with fuzzy matching
- Feasibility: Medium — skill extraction, fuzzy matching, high strategic value

#### Implementation Recommendations

**Quick Wins (Easy):**
1. Real-Time Status Bar Integration
2. Tree Item Badge Decorations

**High Impact (Medium):**
3. Activity Timeline Visualization
4. Member Performance Dashboard

**Strategic (Later):**
5. Skill Coverage Matrix

#### Rationale

Both Danny's and Rusty's proposals focus on transforming SquadUI from a simple viewer into a comprehensive project management tool. PM-focused features (velocity, health, decisions, ceremonies, blockers) provide data-driven decision support. UI-focused features (timeline, status bar, badges, dashboards, skills) provide real-time visibility and engagement. Together, they create sticky, valuable tool that managers want to keep installed.

#### Impact

- Managers gain real-time visibility into team health, velocity trends, and blockers without leaving VS Code
- Historical decision context reduces onboarding time and repetition
- Ceremony effectiveness tracking closes learning loops
- Skill matrix identifies training needs and team weaknesses
- Activity timeline and performance dashboards provide storytelling for retrospectives
- Status bar alerts enable proactive unblocking and load balancing



---


#
---


# Dashboard Swimlane Visual Refinements for v0.2

**Author:** Rusty (Extension Developer)  
**Date:** 2026-02-14  
**Status:** Implemented

## Context

The Squad Dashboard swimlane view needed visual refinement to distinguish task status at a glance and provide detailed information on hover. This is part of preparing the v0.2.0 release which includes the new dashboard feature.

## Decision


---


### Swimlane Visual Enhancements

1. **Status-Based Color Coding:**
   - **Done tasks**: Green theme with `rgba(40, 167, 69, 0.15)` background and `var(--vscode-charts-green)` left border
   - **In-progress tasks**: Amber/orange theme with `rgba(255, 193, 7, 0.15)` background and `var(--vscode-charts-orange)` left border
   - Use 3px left border for visual status indicator

2. **Hover Tooltips:**
   - Implemented pure CSS tooltips (no JS framework needed)
   - Positioned absolutely above task items when hovered
   - Display: task title, status text, and duration
   - Uses VS Code theme variables: `--vscode-editorWidget-background`, `--vscode-editorWidget-foreground`, `--vscode-editorWidget-border`
   - Smooth opacity transition for better UX

3. **Interactive Polish:**
   - Task items have hover state using `var(--vscode-list-hoverBackground)`
   - Cursor changes to `help` to indicate tooltip availability
   - All task titles HTML-escaped to prevent XSS

4. **Theme Compatibility:**
   - All colors use VS Code CSS variables
   - Works seamlessly in both dark and light themes
   - Follows existing color system from velocity chart and heatmap

## Implementation Details

**Files Modified:**
- `src/views/dashboard/htmlTemplate.ts`: Added CSS classes (`.task-item`, `.done`, `.in-progress`, `.tooltip`) and updated `renderActivitySwimlanes()` function to apply classes and generate tooltip markup

**Version Bump:**
- `package.json`: version `0.3.0` → `0.2.0`
- Created `CHANGELOG.md` with feature list for v0.2.0 release

## Rationale

- **Visual distinction** allows users to quickly scan swimlanes and identify task status without reading text
- **CSS tooltips** avoid JavaScript complexity and postMessage patterns, keeping the webview lightweight
- **Theme variables** ensure the dashboard looks native in VS Code regardless of theme choice
- **HTML escaping** maintains security best practices for user-generated content

## Impact

- Users can now see task status visually (green = done, amber = active)
- Hovering reveals full context without cluttering the swimlane layout
- Dashboard is ready for v0.2.0 release with polished visuals
- Pattern established for future dashboard enhancements (Phase 3 Decision Browser)

## Alternatives Considered

- **title attribute only**: Too basic, no control over styling or multi-line content
- **JavaScript-based tooltips**: Over-engineered for this use case, CSS is sufficient
- **Icons instead of colors**: Less clear at-a-glance, colors provide better visual hierarchy




---

## 2026-02-14/15: Skill Identity & Sidebar Label Fixes

**Date:** 2026-02-14, refined 2026-02-15
**By:** Rusty (Extension Dev)

## Decision

Comprehensive fixes to skill identity handling and sidebar tree view presentation:


---


### 1. Skill Identity Architecture
- Added slug property to the Skill model (set to directory name by parseInstalledSkill())
- Tree items, iewSkill(), and emoveSkill() commands now pass/use slug for filesystem operations
- Display name (from YAML frontmatter or heading) is separated from directory name (canonical identifier)


---


### 2. Skill Display Enhancements  
- Strip "Skill: " prefix from SKILL.md headings when displaying tree labels (case-insensitive)
- Show human-readable 
ame: field from YAML frontmatter instead of raw directory name
- Ensures skill trees show clean, user-friendly labels without redundant prefixes


---


### 3. Sidebar Subsection Filtering
- parseDecisionsMd() filters out generic subsection headings (Context, Decision, Rationale, Impact, Members, Alumni, etc.)
- Only actual decision titles appear in Decisions panel
- Handles malformed ## # Title headings by stripping extra # 

---


### 2026-02-15: User directive — release checklist must include README and release notes

**By:** Jeff (Jeffrey T. Fritz) (via Copilot)

**What:** Whenever we issue a release, the release tasks must include updating the README to showcase current features and writing a good release notes document. These are not optional — they are part of the standard release process.

**Why:** User request — captured for team memory. Ensures every release ships with up-to-date documentation and clear communication of what changed. 

## Rationale

- Display names extracted from frontmatter can differ from directory names; slugifying back to paths is lossy and error-prone
- The directory name is the canonical identifier; display name is for humans. Separating these concerns prevents file-not-found errors
- "Skill: " prefix was redundant since items are already in the Skills panel
- Subsection headings cluttered the Decisions panel with non-decision entries

## Impact

- Users see clean skill labels without redundant prefixes
- Skill commands reliably locate files using canonical slug identifier
- Decisions panel shows only actual decisions, not boilerplate subsections
- Pattern established for consistent skill identity handling across the extension


---

# Recovered Test Files from squad/24 Branch

**Date:** 2026-02-14
**Author:** Rusty (Extension Dev)
**Status:** Implemented

## Context

The `squad/24-init-command` branch contained 3 test files, a branded icon, and a terminal command skill doc that never made it to `main`. The branch itself has stale `package.json` and `extension.ts` changes that would regress current `main` (v0.4.0), so a full merge was not safe.

## Decision

Selectively extracted 5 files using `git checkout origin/squad/24-init-command -- <file>` without merging:

1. `src/test/suite/gitHubIssuesService.test.ts` — 427 lines testing GitHub issues service
2. `src/test/suite/squadDataProviderFallback.test.ts` — 374 lines testing team.md → log fallback
3. `src/test/suite/teamMdService.test.ts` — 508 lines testing team.md parsing
4. `images/icon.png` — branded extension icon
5. `.ai-team/skills/vscode-terminal-command/SKILL.md` — terminal command pattern skill

## Outcome

All 3 test files compile cleanly against current `main` with `tsc --noEmit` — zero errors. Service imports (`GitHubIssuesService`, `SquadDataProvider`, `TeamMdService`) all resolve correctly.

## Impact

- **Basher:** 1,309 new lines of test code to validate. May want to run the full test suite and verify coverage.
- **Livingston:** CI should pick these up automatically on next push.
- **Team:** The `squad/24-init-command` branch can likely be deleted after confirming nothing else is needed from it.



---


### 2026-02-15: User directive — releases require human approval
**By:** Jeffrey T. Fritz (via Copilot)
**What:** Never tag or publish a release without explicit human approval. All releases must be explicitly approved by a human team member before tagging, pushing tags, or triggering release workflows.
**Why:** User request — captured for team memory. Releases are a critical action that should always have a human gate.

---


### 2026-02-15: v0.6.0 Sprint Plan
**By:** Danny
**What:** Proposed sprint plan for v0.6.0 milestone
**Why:** Jeff requested next milestone planning after v0.5.1 shipped green


---


## Sprint Goal
**Ship Add Skill feature and close the skills management loop with QA validation.**

## Context & Opportunity

v0.5.0/v0.5.1 polished the sidebar heavily — member ordering, icon upgrades (Scribe ✏️, Ralph 👁️, Copilot 🤖), decision/skill label cleanup, cross-project log parsing. The infrastructure is solid.

**What's nearly done:**
- SkillCatalogService (#38) — ✅ EXISTS in `src/services/SkillCatalogService.ts`, fetches from awesome-copilot + skills.sh
- Add Skill command (#40) — ✅ FULLY IMPLEMENTED in `src/commands/addSkillCommand.ts`, 3-step QuickPick flow
- Skills tree view (#37) — ✅ SHIPPED in v0.5.0, shows installed skills with source badges

**Current state:** Add Skill button is HIDDEN (`package.json` has `commandPalette when:false`, removed from Skills panel toolbar). Jeff disabled it pending QA.

**The gap:** No validation that the full flow works end-to-end. Once QA'd, this is a one-line re-enable.

## Work Items

| ID | Title | Agent | Size | Relates To |
|
---
-|
---
-|
---
-|
---
|
---
|
| qa-skill-flow | **QA: Skill import end-to-end** — Test Add Skill command flow (browse awesome-copilot/skills.sh, search, download, tree refresh). Verify error handling (network failures, duplicate installs). Document any bugs found. | Basher | S | #40, #38, #37 |
| enable-add-skill | **Re-enable Add Skill UI** — Restore Add Skill button to Skills panel toolbar and command palette (reverse v0.5.0 disable). Update package.json menus and commandPalette when clause. | Rusty | XS | #40 |
| close-skill-issues | **Close completed skill issues** — Close #37, #38, #40 as complete. Verify acceptance criteria match shipped code. | Danny | XS | #37, #38, #40 |
| dashboard-polish | **Dashboard visual polish** — Review dashboard webview (src/views/dashboard/) for visual improvements: CSS refinement, icon consistency, empty states, tab transitions. Ship 2-3 quick wins. | Rusty | S | —- |
| copilot-issues-qa | **QA: @copilot GitHub issues integration** — Test @copilot expandable node showing GitHub issues (introduced v0.5.0). Verify BlazorLora cross-project detection works. Document gaps. | Basher | S | —- |
| issue-audit | **Backlog audit** — Review open issues #25-27. Update descriptions to reflect v0.5.1 state. Mark stale items for closure or v0.7.0. | Danny | XS | #25, #26, #27 |

**Total:** 6 items (4 small, 2 extra-small) — achievable in one focused session.

## Items Deferred (Not in v0.6.0)

**Why defer:**
- **#25 (Team member management)** — Add/remove member commands already exist. Issue describes features that are partially implemented. Needs clarification before implementation, not a quick win.
- **#26 (Universe selector)** — Fun feature but low priority. Casting system works without it. Defer to v0.7.0+.
- **#27 (Command palette integration)** — Already done. All commands use "Squad" category prefix. Issue is stale — mark for closure in issue audit.
- **#39 (Write tests for skills)** — Important but not blocking ship. Defer to v0.7.0 hardening sprint.
- **BlazorLora cross-project work** — Partially working. Jeff mentioned "copilot completed tasks from GitHub still needs work" but didn't specify blockers. QA will surface gaps; defer fixes to v0.7.0.
- **Visual Studio 2026 extension** — Separate project, not part of VS Code extension roadmap.

## Risks & Open Questions

**For Jeff:**

1. **Add Skill QA findings** — If Basher finds blocking bugs, do we fix in v0.6.0 or defer to v0.6.1?
   - **Recommendation:** Fix if trivial (< 30min), defer if complex. Goal is ship, not perfect.

2. **Dashboard polish scope** — You mentioned "some visuals for a next milestone." What specific improvements would make the biggest impact?
   - **Recommendation:** Rusty audits dashboard for low-hanging fruit (color consistency, empty states, hover effects). Ship 2-3 quick wins, defer larger redesigns.

3. **BlazorLora gaps** — You said "copilot completed tasks from GitHub still needs work." What's the exact issue?
   - **Recommendation:** Basher QA's current behavior, documents gaps. We decide if it's v0.6.0 or v0.7.0 based on severity.

4. **Issue #27 (Command palette)** — This looks done. All commands are in package.json with "Squad" category. Should we close?
   - **Recommendation:** Danny audits in issue-audit work item, proposes closure if criteria are met.

## Success Criteria

**v0.6.0 ships when:**
- ✅ Add Skill feature is QA'd green (or known issues documented)
- ✅ Add Skill button is visible and working in Skills panel
- ✅ Dashboard has 2+ visual improvements shipped
- ✅ Issues #37, #38, #40 are closed as complete
- ✅ Backlog issues #25-27 are updated or closed
- ✅ CHANGELOG.md updated with v0.6.0 release notes

## Next Steps

**If approved:**
1. Danny creates sprint tracking table (SQL todos)
2. Basher starts QA on skill import flow
3. Rusty audits dashboard for quick wins
4. Danny reviews issues #25-27 for closure/update

**Estimated delivery:** 1 focused session (4-6 hours) or 2 shorter sessions.

---


# Dashboard Chart & Decisions Rendering Fixes

**Date:** 2026-02-15
**Author:** Rusty
**Status:** Accepted

## Context

The Squad Dashboard had three usability issues: (1) the velocity chart was invisible on dark themes because Canvas 2D context doesn't resolve CSS custom properties in `fillStyle`/`strokeStyle`, (2) the chart had no axis labels so users couldn't read the data, and (3) the decisions panel showed nothing on first load because `renderDecisions()` was called before it was defined (hoisting doesn't apply to function expressions in this template pattern).

## Decision

1. **Canvas colors:** Use `getComputedStyle(document.documentElement).getPropertyValue()` to resolve VS Code CSS variables to actual color values before passing them to canvas drawing methods. Hardcoded fallback colors provided for safety.
2. **Axis labels:** Added Y-axis labels (0, midpoint, max) and X-axis date labels (MM/DD format, ~6 evenly spaced). Increased canvas padding to accommodate labels. Subtle grid lines at 30% opacity for readability.
3. **Decisions empty state:** Moved `renderDecisions()` call after the function definition. Added early-return guard for empty/missing `entries` array with an informative empty state message guiding users to create decision files.

## Impact

- Velocity chart is now readable on both dark and light VS Code themes
- Users can interpret chart data with proper axis labels
- Decisions tab shows helpful guidance when no decisions exist
- No new dependencies introduced; all fixes are in `htmlTemplate.ts`

### 2026-02-15: Dashboard decisions sort order
**By:** Jeffrey T. Fritz (via Copilot)
**What:** Decisions list on the dashboard should be sorted most-recent first (newest at top)
**Why:** User request — captured for team memory

---


### 2026-02-15: Add Skill Error Handling — Network Failures Throw Exceptions
**Date:** 2026-02-15
**Decided by:** Rusty (QA of Add Skill feature #40)
**Status:** Implemented

During QA, found that SkillCatalogService.fetchCatalog() returned empty arrays on network failures, causing misleading "No skills found" messages. Changed service to throw exceptions on network failures; command layer catches and shows appropriate error messages via showErrorMessage(). Improves UX and debugging while maintaining standard VS Code command patterns.

---


### 2026-02-15: Backlog Audit and Issue Cleanup
**By:** Danny
**What:** Closed completed issues (#27, #37, #38), audited remaining backlog (#25, #26, #39, #40)
**Why:** Sprint hygiene — keep the backlog accurate with shipped work

Closed #27 (Command palette integration), #37 (Skills tree view), #38 (SkillCatalogService). Triaged open issues: #25 (team member commands, ready to close), #26 (universe selector, deferred P2), #39 (Basher writing skill import tests), #40 (Rusty QA'ing Add Skill, currently disabled, re-enable is one-line).


# DecisionService Test Coverage

**Date:** 2026-02-15  
**By:** Basher  
**Status:** Implemented

## Context

DecisionService is the most fragile parser in the extension. It has been rewritten twice to fix date extraction bugs, yet had ZERO test coverage until now. The parser handles:

- Mixed heading levels (## decisions vs ### date-prefixed decisions)
- Dual date extraction (heading prefix AND **Date:** metadata)
- Subsection filtering (Context, Decision, Vision, etc.)
- Date ranges (2026-02-14/15 → extract first date)
- Multiple date formats in **Date:** metadata

Without tests, every future change to DecisionService risks breaking date extraction or subsection filtering.

## Decision

Created comprehensive test suite in `src/test/suite/decisionService.test.ts` with 60+ test cases covering:

1. **parseDecisionsMd()** — main parser with 35+ tests
2. **parseDecisionFile()** — individual file parser with 15+ tests  
3. **getDecisions()** — full pipeline with 8+ tests
4. **Edge cases** — CRLF, unicode, malformed content, empty files

Tests document all the nuanced parsing rules:
- ## headings are always decisions
- ### headings are decisions only if date-prefixed (YYYY-MM-DD:)
- Heading date wins over **Date:** metadata
- First date in multi-date strings always wins
- Subsections (Context, Decision) filtered at both levels

## Rationale

DecisionService has bitten us twice already. These tests:
1. **Prevent regressions** — any future parser changes will fail fast
2. **Document behavior** — tests are executable specs for the parsing rules
3. **Enable refactoring** — future maintainers can safely optimize with tests as safety net
4. **Catch edge cases** — tests cover realistic patterns from actual .ai-team/decisions.md files

## Outcome

- `src/test/suite/decisionService.test.ts` created with 60+ tests
- Tests compile successfully (`npx tsc --noEmit`)
- All known date extraction and subsection filtering patterns covered
- DecisionService now has comprehensive test coverage


---

## 2026-02-15: User directive — testing policy

**By:** Jeff (Jeffrey T. Fritz) (via Copilot)

**What:** Always write tests alongside new features. When bugs are reported, write a regression test for every bug so we know it's fixed when the test passes.

**Why:** User request — captured for team memory

---

## Test Coverage & Dashboard Assessment

**Date:** 2026-02-15  
**Author:** Danny (Lead)  
**Requested by:** Jeffrey T. Fritz  
**Status:** Assessment Complete


### Context

Jeff asked: "What tests are we missing? What are we missing from the dashboard?" This is a full audit of test coverage gaps and dashboard completeness.


### Test Coverage Findings

#### Priority 1 — Pure Logic, Zero VS Code Dependencies (Easy Wins)

| File | Key Functions Needing Tests | Test Difficulty |
|------|---------------------------|----------------|
| DashboardDataBuilder.ts | uildVelocityTimeline(), uildActivityHeatmap(), uildActivitySwimlanes(), 	askToTimelineTask() | Easy — pure functions |
| emoveMemberCommand.ts | parseMemberRows() (exported for testing) | Easy — file parsing |
| SquadStatusBar.ts | getHealthIcon() logic (ratio-based emoji selection) | Easy — pure logic |
| IssueDetailWebview.ts | getContrastColor(), ormatDateString(), scapeHtml() | Easy — pure logic |

#### Priority 2 — Requires Mocking but High Value

| File | Key Functions Needing Tests | Notes |
|------|---------------------------|-------|
| FileWatcherService.ts | start(), stop(), onFileChange(), debounce behavior, egisterCacheInvalidator() | Mock scode.workspace.createFileSystemWatcher |
| SquadDashboardWebview.ts | show(), dispose(), message handling (openDecision, openTask, openMember) | Mock scode.window.createWebviewPanel |
| initSquadCommand.ts | Terminal creation, close listener callback | Mock scode.window.createTerminal |

#### Priority 3 — Recently Changed Without Tests (Jeff's Regression Rule)

| Commit | File Changed | Missing Test |
|--------|-------------|-------------|
| 1a8279 | htmlTemplate.ts | Click handler message passing |
| 7da4364 | htmlTemplate.ts | Decision sort order in rendered output |
| 39e3f8 | OrchestrationLogService.ts | Cross-project task extraction |


### Dashboard Findings

#### What's Working ✅
- Three tabs: Velocity, Activity, Decisions
- Decisions sorted most-recent first (Jeff's request)
- Clickable entries: decision cards → file, tasks → work details, members → charter
- Empty states for all panels
- Canvas colors resolved from VS Code theme variables
- Axis labels on velocity chart (Y: 0/mid/max, X: MM/DD dates)
- Search/filter on Decisions tab

#### What's Missing or Incomplete
1. **No summary/overview panel** — No at-a-glance stats (total members, active count, tasks completed this week)
2. **No loading state** — Dashboard shows nothing while data loads; should show skeleton or spinner
3. **Heatmap lacks numeric context** — Activity bars show relative fill but no absolute numbers (e.g., "participated in 5 sessions")
4. **No tab state persistence** — Switching away and back always resets to Velocity tab
5. **No refresh button** — Dashboard only updates on open; no way to manually refresh without closing/reopening


### Recommendation

**Next sprint test work (v0.7.0):**
1. DashboardDataBuilder tests first — highest ROI, zero mocking needed
2. StatusBar + IssueDetailWebview pure logic tests — quick wins
3. FileWatcherService debounce tests — important for reliability
4. Regression tests for recent dashboard changes

**Dashboard improvements for Jeff to prioritize:**
- Loading state (small effort, big UX impact)
- Summary stats panel (medium effort, high value for at-a-glance monitoring)
- Heatmap numeric labels (small effort)


### Impact

This assessment should drive v0.7.0 test hardening sprint and dashboard polish backlog. All findings are documented for the team.

---

## Add Skill Workflow — Investigation Report

**Date:** 2026-02-15
**Author:** Rusty
**Status:** Investigation complete — findings for team review


### Summary

End-to-end investigation of the squadui.addSkill command. The core 3-step QuickPick flow is solid and well-structured. Error handling is good. However, there are significant gaps in what actually gets installed and how duplicates are handled.


### Critical Findings

#### 1. Skills install as metadata stubs, not actual content
downloadSkill() in SkillCatalogService.ts:88-98 checks skill.content but catalog entries from etchAwesomeCopilot() and etchSkillsSh() never populate the content field. The result: every installed skill is just a stub with a name, description, and source link. The user thinks they're installing a skill but they're getting a bookmark.

**Recommendation:** Follow skill.url to fetch actual skill content (README.md or SKILL.md) from the source repo before writing to disk.

#### 2. No duplicate/overwrite protection
downloadSkill() calls s.mkdirSync + s.writeFileSync unconditionally. If a skill with the same slug already exists, it's silently overwritten with no warning. The user could lose local customizations.

**Recommendation:** Check if slug directory exists, warn user, offer to skip or overwrite.

#### 3. No skill preview before install
Users see only 
ame + one-line description in QuickPick. No way to read what the skill actually does before committing.

**Recommendation:** Add a "Preview" option alongside "Install" in the confirmation step, or use a QuickPick with detail panels.


### Action Items for Team

1. **Linus (Backend):** Implement content fetching from skill.url — follow GitHub repo links to download actual SKILL.md/README.md content
2. **Rusty (Extension):** Add duplicate detection in addSkillCommand, add preview webview/markdown preview step
3. **Danny (Lead):** Prioritize these as v0.6.0 or v0.7.0 items


### Files Referenced
- src/commands/addSkillCommand.ts — command flow
- src/services/SkillCatalogService.ts — service layer
- src/views/SquadTreeProvider.ts — SkillsTreeProvider
- src/extension.ts:162-166 — registration
- package.json:90-94, 132-135 — manifest entries


## Add Skill: Content Fetching + Duplicate Protection

# Add Skill: Content Fetching + Duplicate Protection

**Date:** 2026-02-15
**Author:** Rusty
**Status:** Implemented

## Context

The Add Skill workflow had two critical bugs:
1. Skills installed as empty metadata stubs — the actual skill instructions were never fetched from source URLs.
2. Installing a skill that already existed silently overwrote it with no user warning.

## Decisions


### Content Fetching Strategy

- For GitHub repo URLs (`github.com/{owner}/{repo}`), we try fetching raw content from `main` branch in this priority order:
  1. `.github/copilot-instructions.md`
  2. `SKILL.md`
  3. `README.md`
- For non-GitHub URLs, fetch the URL directly as a raw file.
- If all fetch attempts fail, fall back to the existing metadata stub (with a note that content couldn't be fetched).
- The `fetchSkillContent()` method is public so it can be reused by future features (e.g., preview before install).


### Duplicate Protection

- `downloadSkill()` now throws if the target skill directory already exists (unless `force: true`).
- The command layer catches this error and shows a Yes/No QuickPick prompting the user to overwrite.
- This prevents accidental data loss while still allowing intentional reinstalls.

## Impact

- **SkillCatalogService.ts**: New methods `fetchSkillContent()`, `parseGitHubRepoUrl()`. Modified `downloadSkill()` signature (added `force` param).
- **addSkillCommand.ts**: Duplicate error handling with overwrite prompt.
- No changes to models or other files.


---


### 2026-02-15: Dashboard Decisions Null-Safety

**By:** Rusty  
**What:** Fixed TypeError crash in dashboard Decisions tab when DecisionEntry has undefined `content` or `author` fields  
**Why:** The filter function in `renderDecisions()` called `.toLowerCase()` on optional fields without null checks. Added null-coalescing (`(d.content || '')`) to prevent crashes. Also updated card template to show "—" for missing date/author instead of showing undefined.

---


### 2026-02-15: Recent Activity in Team Sidebar

**By:** Rusty  
**What:** Added collapsible "Recent Activity" section to Team tree view showing last 10 orchestration log entries  
**Why:** Jeff requested "I need to see more of the actions taken in the sidebar panels." The Recent Activity section provides quick access to session logs directly from the sidebar. Each entry is clickable and opens the full log file. Implemented by extending TeamTreeProvider with a section header, using OrchestrationLogService.discoverLogFiles(), and registering squadui.openLogEntry command.

---


### 2026-02-15: Recent Sessions in Dashboard Activity Tab

**By:** Rusty  
**What:** Added "Recent Sessions" panel below swimlanes in Dashboard Activity tab, displays last 10 log entries with topic, date, participants, and decision/outcome counts  
**Why:** Complements the sidebar Recent Activity feature by providing richer session context in the dashboard. Extended DashboardData.activity interface to include recentLogs array. Each session card is clickable and searches both log directories to open the matching file. Provides at-a-glance view of team activity and decision velocity.


---

# Fix Three Skill Catalog Bugs

**Date:** 2026-02-15  
**Decided by:** Rusty  
**Status:** Implemented

## Context

Three bugs in SkillCatalogService.ts were breaking the skill search/catalog workflow:
1. awesome-copilot URL was 404 (repo moved)
2. skills.sh parser returned garbage entries (nav links, agent names, tab labels)
3. Search could crash on empty descriptions

## Decision


### Bug 1: Update awesome-copilot URL
Changed from `bradygaster/awesome-copilot` to `github/awesome-copilot` (the repo moved).


### Bug 2: Rewrite skills.sh parser
The old parser used generic anchor regex and picked up navigation links. The new implementation:
- Matches the actual leaderboard pattern: `<a href="/{owner}/{repo}/{skill}">` containing `<h3>{skill-name}</h3>` and `<p>{owner/repo}</p>`
- Extracts skill name from `<h3>`, owner/repo from `<p>` tag
- Builds GitHub URL as `https://github.com/{owner}/{repo}` (not skills.sh URL, so we can fetch content)
- Sets description to `{owner}/{repo}` (the meaningful context)
- Removed Strategy 2 (JSON-LD) — skills.sh doesn't use it, was dead code
- Updated `isBoilerplateLink()` to only accept 3-segment paths (/{owner}/{repo}/{skill})


### Bug 3: Null-safety for search
Added `(skill.description || '')` in `searchSkills()` to prevent crashes on empty descriptions.

## Consequences

- awesome-copilot catalog now loads successfully
- skills.sh parser returns real skill entries, not navigation junk
- Search is now crash-safe and works correctly once skills.sh loads real entries
- Client-side filtering in `searchSkills()` already worked, just needed clean data from the parser

## Files Changed

- `src/services/SkillCatalogService.ts` — Fixed URL, rewrote parser, added null-safety

---

## 2026-02-15: Init Redesign Absorbs Universe Selector

**By:** Danny  
**Context:** User requested two new features for next milestone: native VS Code init experience and squad CLI version checking.


### What

Replace the current terminal-based squad initialization (`npx github:bradygaster/squad init` spawned in terminal) with a native VS Code experience that guides users through setup without leaving the editor.

**This decision absorbs issue #26 (universe selector) into the init flow** rather than implementing it as a standalone command. The universe choice becomes step 1 of the init wizard instead of a separate user action.


### Why

**User experience improvement:**
- Users stay in the IDE instead of context-switching to a terminal
- Step-by-step guided flow (universe → description → team proposal → post-setup sources)
- Better discoverability: "Initialize" command surfaces universe choice naturally
- Single cohesive onboarding rather than scattered commands

**Architectural simplification:**
- Eliminates need for separate `selectUniverse` command that would need its own state management
- Universe selection flows naturally as part of init—makes sense only in that context
- Reduces command clutter in command palette

**Issue #26 context:**
- Opened as "allow users to specify character universe for casting"
- Originally scoped as standalone command with persistent storage in team.md
- New design integrates this into init flow where it's actually used
- Existing issue #26 will be superseded by new issue #41 (broader init redesign)


### Scope Trade-off

**Not included in init redesign:**
- Changing how `squad add-member` works (future enhancement can add universe selector there)
- Persistent universe storage in extension state (squad CLI handles this via flags)
- Custom universe definitions (hardcoded list + "Custom" option sufficient for MVP)

**Included:**
- Universe QuickPick with common options (Marvel, DC, Star Wars, Sci-Fi, Custom)
- Project description InputBox
- Team proposal preview (confirm/adjust)
- Post-setup sources configuration (PRD path, GitHub repo, human members, @copilot)
- Pass `--universe` flag to squad init command


### Implementation Ownership

- **Issue #41** (VS Code-native init + universe): squad:rusty (Extension Dev)
- **Issue #42** (Version check + upgrade): squad:rusty (Extension Dev)
- Related context in decisions.md already captures squad init architecture (terminal spawn, onInitComplete callback)


### Status

Two GitHub issues created:
- #41: VS Code-native init experience with universe selector (M, P1)
- #42: Squad CLI version check and upgrade notification (M, P1)

Issue #26 will be marked as superseded by #41 in a follow-up comment.

---

## 2026-02-15: VS 2026 extension — parallel development track

**By:** Danny (Lead/Architect)


### Issues Created

- **#43** — VS 2026: Project scaffold and VSIX configuration (assigned: squad:virgil, Size: M, P1)
- **#44** — VS 2026: Core services — .ai-team file parsing in C# (assigned: squad:virgil, Size: L, P1)
- **#45** — VS 2026: Team roster tool window (assigned: squad:turk, Size: M, P1)


### Architecture Decision

#### Code Organization

- VS 2026 extension lives in **separate project folder** (`vs2026/` or `src-vs2026/`) in the same monorepo
- Both extensions (VS Code TypeScript + VS 2026 C#/.NET) read the **same `.ai-team/` file format**
- **NO code dependencies** between TypeScript and C# codebases — completely independent implementations

#### Team Assignment

- **Virgil** (VS 2026 Extension Dev) — VSIX infrastructure, MEF registration, core services (TeamMdService, DecisionService, SkillCatalogService, FileWatcherService), command registration
- **Turk** (VS 2026 Extension UI) — WPF/XAML tool windows, MVVM view models, theme integration, user interactions

#### Why This Approach Works

1. **No integration complexity** — different languages (TypeScript vs C#), different APIs (VS Code Extension API vs VisualStudio.Extensibility SDK), different UI frameworks (Webview/HTML vs WPF/XAML)
2. **Parallel velocity** — Virgil and Turk work independently without blocking each other or VS Code track
3. **Shared data format** — both extensions read the same `.ai-team/` files, enabling future cross-IDE dashboard/API
4. **Clean ownership** — one codebase per IDE, clear responsibility boundaries


### Implications

- **Git:** Both projects live in `main` branch, separate project folders
- **CI/CD:** GitHub Actions will need VS 2026 project recognition and build steps
- **Testing:** C# unit tests separate from TypeScript tests
- **Releases:** VS 2026 extension will have independent versioning from VS Code extension (e.g., both can be v0.1.0 simultaneously)
- **Future:** Both extensions can eventually share a backend API/service if needed, but that's out of scope for MVP


### Risk Mitigation

- Virgil confirms VisualStudio.Extensibility SDK knowledge (not legacy VSSDK)
- Turk confirms WPF/XAML + MVVM expertise
- Both review `.ai-team/` file format specs before implementation
- Cross-check project structures match VS Code equivalents for maintainability
