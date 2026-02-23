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
- Tree items, iewSkill(), and 
emoveSkill() commands now pass/use slug for filesystem operations
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

---

### 2026-02-16: Canvas charts must only render on visible tabs

**By:** Rusty
**What:** Dashboard canvas charts (velocity and burndown) are now deferred until their tab becomes visible, rather than rendering on page load when they're hidden.
**Why:** Canvas elements inside `display: none` containers return `offsetWidth === 0`, causing `canvas.width = 0` and producing blank charts. The burndown milestone selector also had a duplicate event listener bug — each tab switch added another `change` handler. Both issues are fixed in `htmlTemplate.ts`.

---

### 2026-02-16: Test hardening conventions for new test files
**By:** Basher
**What:** Established patterns for command registration tests and tree provider tests in the SquadUI test suite.
**Why:** With 11 new test files added in the test hardening sprint (#54), it's important that all future test files follow these conventions:
1. Command registration tests must use the `this.skip()` triple-guard pattern (`extension/isActive/workspace`) to avoid false failures in CI environments without workspaces.
2. Tree provider tests must `await` `getChildren()` even if the underlying method appears synchronous — `DecisionsTreeProvider.getChildren()` is async.
3. Temp directories should use `test-fixtures/temp-{name}-${Date.now()}` with teardown cleanup to avoid cross-test pollution.
4. Private method access uses `(instance as any).method.bind(instance)` — consistent with existing test patterns.

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

## Branch Cleanup Convention

**Decided by:** Livingston  
**Date:** 2026-02-17  
**Context:** Release v0.7.2 branch cleanup

### Decision

After a release, stale remote branches should be cleaned up using these rules:

1. **Delete** branches whose PRs have been merged or closed
2. **Delete** branches that point to the same commit as `main` HEAD (already merged without PR)
3. **Keep** branches with open PRs or no PR yet (active work)
4. Use `git push origin --delete {branch}` for batch deletion

### Rationale

Stale branches clutter the remote, make branch pickers noisy, and can confuse contributors about what's actively being worked on. Cleaning up after each release keeps the repository tidy.

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

### Test Coverage Findings

#### Priority 1 — Pure Logic, Zero VS Code Dependencies (Easy Wins)

| File | Key Functions Needing Tests | Test Difficulty |
|------|---------------------------|----------------|
| DashboardDataBuilder.ts | uildVelocityTimeline(), uildActivityHeatmap(), uildActivitySwimlanes(), 	askToTimelineTask() | Easy — pure functions |
| 
emoveMemberCommand.ts | parseMemberRows() (exported for testing) | Easy — file parsing |
| SquadStatusBar.ts | getHealthIcon() logic (ratio-based emoji selection) | Easy — pure logic |
| IssueDetailWebview.ts | getContrastColor(), ormatDateString(), scapeHtml() | Easy — pure logic |

#### Priority 2 — Requires Mocking but High Value

| File | Key Functions Needing Tests | Notes |
|------|---------------------------|-------|
| FileWatcherService.ts | start(), stop(), onFileChange(), debounce behavior, 
egisterCacheInvalidator() | Mock scode.workspace.createFileSystemWatcher |
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

---

### 2026-02-15: Broaden FileWatcherService to all .ai-team markdown files
**By:** Rusty
**What:** Changed `FileWatcherService.WATCH_PATTERN` from `**/.ai-team/orchestration-log/**/*.md` to `**/.ai-team/**/*.md`, covering team roster, agent charters, decisions, skills, and orchestration logs.
**Why:** The old pattern only watched orchestration logs, so adding a member (which creates `charter.md` and updates `team.md`) never triggered a tree refresh. The broader pattern catches all team-relevant file changes. The existing 300ms debounce prevents event thrashing from bulk writes.



---

# Decision: Init & Upgrade Welcome View Pattern

**Author:** Rusty (Extension Dev)
**Date:** 2026-02-16

## Context

When no `.ai-team/` directory exists, the sidebar tree views were empty with no guidance for users. We needed onboarding UX.

## Decision

1. **Context key `squadui.hasTeam`** — set on activation by checking `.ai-team/team.md` existence, updated after init/upgrade terminal closes, and re-checked on every file watcher change event.
2. **`viewsWelcome` contribution** — shows Initialize and Upgrade buttons in the empty Team view when `!squadui.hasTeam`.
3. **Upgrade command** — `squadui.upgradeSquad` follows the same terminal-based factory pattern as init. Always available in command palette.
4. **Upgrade in view title** — upgrade button appears in Team view title bar only when `squadui.hasTeam` is true (you can't upgrade what doesn't exist from the toolbar, but welcome view still offers it as an option).

## Impact

- All future commands that modify `.ai-team/` structure should call `setContext('squadui.hasTeam', true)` in their completion callbacks.
- The file watcher already re-checks, so manual deletion of `.ai-team/team.md` will correctly flip the context back and show the welcome view.



## Burndown Chart End Date for Closed Milestones

**Author:** Rusty (Extension Dev)
**Date:** 2026-02-16
**Status:** Implemented

---

### 2026-02-16: User directive
**By:** Jeffrey T. Fritz (via Copilot)
**What:** Always provide a final report and status summary when a task or series of tasks is complete. The user should know when work is finished.
**Why:** User request — captured for team memory


---

# Decision: Init wizard auto-executes squad init in terminal

**Date:** 2025-07-18
**Author:** Jeffrey T. Fritz (directive)
**Implemented by:** Rusty

## Context

After the init wizard collects the universe and mission from the user, the `squad init` command should execute automatically in the VS Code terminal so the team gets populated all at once — no extra user interaction needed.

## Decision

- The init wizard sends the `squad init` command to a terminal via `terminal.sendText()` immediately after the user provides universe and mission.
- A `FileSystemWatcher` on `.ai-team/team.md` triggers an automatic tree view refresh as soon as the file is created, so the Team panel populates without the user needing to close the terminal.
- Terminal close remains as a fallback refresh trigger.
- A boolean flag prevents double-refresh.

## Status

Implemented in commit `7c68208`.


---

# Chat Panel Handoff for Init

**Date:** 2026-02-16
**Author:** Rusty
**Requested by:** Jeffrey T. Fritz

## Decision

The init wizard no longer invokes the Copilot agent via CLI in the terminal. Instead, after `squad init` scaffolds `.ai-team/` and the FileSystemWatcher detects `team.md`, the extension opens VS Code's Copilot Chat panel with the `@squad` agent selected and a setup prompt pre-filled.

## Rationale

- Running `gh copilot -- --agent squad` in the terminal was fragile (required `gh` CLI, platform-specific null redirects, quote escaping).
- The Copilot Chat panel is the native VS Code surface for agent interaction — better UX, visible progress, and user can interact with the agent.
- User sees Squad working in the chat panel while the sidebar populates from the FileSystemWatcher.

## Implementation

- `terminal.sendText()` sends only the `npx github:bradygaster/squad init` command.
- `completeInit()` calls `vscode.commands.executeCommand('workbench.action.chat.open', chatPrompt)` after `onInitComplete()`.
- Removed: `copilotPrompt`, `copilotFlags`, `copilotCmd`, `process.platform` check, `&&` chaining.

## Impact

- No changes to extension API signatures or test contracts.
- `addMemberCommand.ts` already uses the same `workbench.action.chat.open` pattern — consistent approach.


---

### 2026-02-16: Replace chat panel handoff with terminal CLI command + add spinner
**By:** Rusty
**What:** Removed `workbench.action.chat.open` from init flow. Now chains `copilot -a squad "prompt"` after `squad init` via `&&` in the same terminal. Added `$(loading~spin) Allocating team members...` spinner in team panel while charters are being populated. Spinner cleared by both FileWatcher and a 3-second polling fallback.
**Why:** The chat panel approach (`workbench.action.chat.open`) didn't work in practice — it wasn't reliably opening with the right agent context. Terminal CLI via `copilot -a squad` is a direct invocation that actually works. The spinner gives the user visual feedback that something is happening between `squad init` finishing and the team members appearing in the sidebar. Polling fallback ensures the spinner always clears even if the FileWatcher misses a change event.


---

# Init Auto-Refresh via FileSystemWatcher

**Date:** 2026-02-16
**Author:** Rusty
**Status:** Implemented

## Decision

The init wizard (`initSquadCommand.ts`) now uses a `FileSystemWatcher` on `.ai-team/team.md` to trigger tree refresh as soon as the file is created by `squad init`, rather than waiting for the user to close the terminal.

## Rationale

Previously, the Team panel only populated after the user manually closed the Squad Init terminal. This was a poor experience — users expected the sidebar to update as soon as the init command finished writing files.

## Implementation

- `vscode.workspace.createFileSystemWatcher` with `RelativePattern` targeting `.ai-team/team.md`
- `onDidCreate` and `onDidChange` both trigger `onInitComplete()`
- Boolean flag (`initCompleted`) prevents double-refresh
- Terminal close listener kept as fallback
- Watcher disposed after firing or on terminal close (whichever comes first)

## Impact

- No API signature changes — `registerInitSquadCommand` still takes `(context, onInitComplete)`
- Existing tests unaffected (833 passing)
- UX improvement: pick universe → type mission → team appears in sidebar automatically


---

# Two-Command Init: Squad Init + Agent Charter Setup

**Decided by:** Rusty
**Date:** 2026-02-16

## Decision

The init wizard's `terminal.sendText()` now sends two chained commands via `&&`:

1. `npx github:bradygaster/squad init --universe "..." --mission "..."` — scaffolds `.ai-team/`
2. `gh copilot -- --agent squad --allow-all-tools -i 'Set up the team for this project...'` — populates team with characters and charters

## Rationale

- Single `sendText()` with `&&` is cleaner than trying to detect when the first command finishes
- Second command only runs if init exits successfully
- Single quotes around the `-i` prompt avoid conflicts with double quotes in the first command
- Works in both cmd.exe and PowerShell

## Impact

- `src/commands/initSquadCommand.ts` — one line changed (the `sendText()` call)
- No API changes, no new dependencies, all existing tests pass



## Agents Folder Scanning Fallback for Team Detection

**Author:** Linus  
**Date:** 2026-02-16  

---

# Orchestration Log vs Session Log Scope

**Date:** 2026-02-17  
**Author:** Rusty  
**Status:** Proposed

## Context

The OrchestrationLogService previously read from BOTH orchestration-log/ and log/ directories. The sidebar was falsely reporting agents as "working" on completed issues because session logs in log/ contain narrative references to issues (e.g., "Assigned to issue #22", "PR #28 opened"), and these were being parsed as active tasks.

## Decision

**Task status and member working state derivation must ONLY use orchestration-log/ files. Session logs in log/ are historical records and should never affect active status.**

## Implementation

- Added discoverOrchestrationLogFiles() and parseOrchestrationLogs() methods to OrchestrationLogService that only read from orchestration-log/.
- SquadDataProvider uses these methods internally for getSquadMembers() and getTasks().
- The existing discoverLogFiles() and parseAllLogs() methods remain for display purposes (e.g., Recent Activity panel, log entry cards).

## Rationale

The log/ directory contains **session logs** — Scribe's narrative records of past work sessions. These logs reference issues in historical context for documentation purposes, but they are NOT orchestration status data. Treating them as such creates false positives.

The orchestration-log/ directory contains **orchestration entries** — structured status records that drive the sidebar's task and member state display.

## Alternatives Considered

**Option A (rejected):** Remove 'log' from LOG_DIRECTORIES entirely. This would break display features that legitimately need to show session logs.

**Option B (chosen):** Create separate discovery/parsing methods for orchestration-only data. This preserves display functionality while fixing the false-positive bug.

## Consequences

- Task status is now accurate — no false "working" indicators from old session logs.
- Session logs remain visible in Recent Activity and other display contexts.
- Future services that need orchestration data should use parseOrchestrationLogs(), not parseAllLogs().

---

### 2026-02-17: engines.vscode must match @types/vscode

**By:** Rusty

**What:** engines.vscode must always be >= @types/vscode version. VSCE enforces this at package time.

**Why:** Release v0.7.2 failed because engines.vscode was ^1.85.0 but @types/vscode was ^1.109.0. VSCE refuses to package when types exceed engine version.

---

### 2026-02-17: Always use normalizeEol() for markdown parsing
**By:** Jeffrey T. Fritz (via Copilot)
**What:** All parsing of markdown files that inspects line endings MUST use `normalizeEol()` from `src/utils/eol.ts` at the file-read boundary. Use the `EOL` constant from the same module when writing files. This ensures cross-platform compatibility across Mac, Linux, and Windows. Never use inline `\r\n` regex replacements — always go through the utility.
**Why:** User request — captured for team memory. Windows CRLF line endings broke team.md parsing in v0.7.2 and this pattern must be enforced going forward.



---

# Active-Work Markers — Architectural Design

**Author:** Danny (Lead)
**Date:** 2026-02-18
**Issue:** #59 — Subagent progress shows as Idle during VS Code Copilot Chat sessions

---

## Problem

In VS Code Copilot Chat, subagents run concurrently within a single turn. The orchestration log isn't written until the turn completes. During the 30–60+ seconds of active work, `SquadDataProvider.getSquadMembers()` sees only stale log entries, so every agent appears idle. The CLI doesn't have this problem because logs are written before the session ends.

## Solution: Active-Work Marker Files

Lightweight sentinel files whose **presence** signals an agent is currently working. SquadUI watches for them and overrides status to `'working'` — independent of the orchestration log lifecycle.

---

## 1. Marker File Format and Location

**Directory:** `{squadFolder}/active-work/`
- e.g., `.ai-team/active-work/`

**File naming:** `{agent-slug}.md`
- Slug matches the agent's folder name under `agents/` (lowercase, kebab-case)
- Examples: `linus.md`, `rusty.md`, `danny.md`

**Why `.md` extension?** The `FileWatcherService` glob is `**/{.squad,.ai-team}/**/*.md`. Marker files are automatically watched. Zero watcher changes.

**Content (minimal, for debugging and staleness):**
```
agent: Linus
started: 2026-02-18T14:32:00Z
task: Working on issue #59
```

Plain key-value lines. Not parsed structurally — SquadUI only needs the file's **existence** and **mtime** for status. The content is human-readable context.

## 2. Marker Lifecycle

| Event | Action | Who |
|---|---|---|
| Orchestrator dispatches work to agent | Create `active-work/{slug}.md` | Orchestrator |
| Agent completes work | Delete `active-work/{slug}.md` | Orchestrator |
| Turn completes (all agents done) | Delete all markers in `active-work/` | Orchestrator |
| Crash / abandoned session | Marker left behind → staleness handles it | SquadUI (reader) |

**SquadUI is read-only.** It never creates or deletes marker files. It only detects and interprets them.

## 3. Detection Mechanism

Modify `SquadDataProvider.getSquadMembers()` — after resolving the roster and before caching:

```
1. Scan {squadFolder}/active-work/ for *.md files
2. For each marker file:
   a. Extract slug from filename (strip .md)
   b. Check file mtime — if older than STALENESS_THRESHOLD, skip (stale)
   c. Match slug to a roster member (case-insensitive name match)
   d. Override that member's status to 'working'
```

New private method on `SquadDataProvider`:

```typescript
private async detectActiveMarkers(): Promise<Set<string>> {
    const markerDir = path.join(this.teamRoot, this.squadFolder, 'active-work');
    const activeAgents = new Set<string>();
    
    try {
        const files = await fs.promises.readdir(markerDir);
        for (const file of files) {
            if (!file.endsWith('.md')) continue;
            const slug = file.replace(/\.md$/, '');
            const filePath = path.join(markerDir, file);
            const stat = await fs.promises.stat(filePath);
            const ageMs = Date.now() - stat.mtimeMs;
            if (ageMs < STALENESS_THRESHOLD_MS) {
                activeAgents.add(slug.toLowerCase());
            }
        }
    } catch {
        // Directory doesn't exist yet — no markers, no problem
    }
    
    return activeAgents;
}
```

In `getSquadMembers()`, after existing status resolution:

```typescript
const activeMarkers = await this.detectActiveMarkers();
for (const member of members) {
    const slug = member.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (activeMarkers.has(slug)) {
        member.status = 'working';
    }
}
```

**Linus** implements the `detectActiveMarkers()` method and the integration into `getSquadMembers()`.

## 4. FileWatcherService Integration

**No changes needed.** The existing glob `**/{.squad,.ai-team}/**/*.md` already covers `active-work/*.md`.

When a marker is created → watcher fires → `CacheInvalidator.invalidate()` → `SquadDataProvider.refresh()` → tree re-renders with updated status. Same for deletion.

**Rusty** has no watcher work. The tree view already re-renders on cache invalidation.

## 5. Priority / Precedence

```
Active marker (not stale)  →  status = 'working'     (HIGHEST — overrides everything)
No marker                  →  existing log + task logic (unchanged)
```

The marker is a "definitely working right now" signal. It overrides:
- The log-based `getMemberStates()` result
- The "working but no in-progress task → idle" demotion

Rationale: if the orchestrator says an agent is working, it is. The task/log hasn't been written yet — that's the whole problem we're solving.

## 6. Cleanup / Staleness

**Staleness threshold:** 5 minutes (`300_000` ms).

Detection is mtime-based — no content parsing required. If a marker file's `mtime` is older than 5 minutes, `detectActiveMarkers()` ignores it.

**Why 5 minutes?** Most subagent tasks complete in 30–120 seconds. 5 minutes gives generous headroom for complex tasks while ensuring crashed sessions don't show "working" indefinitely.

**Optional future enhancement:** SquadUI could garbage-collect stale markers (delete files older than threshold). Not in v1 — keep it read-only for now.

## 7. Scope Boundary

### In scope (SquadUI changes) — Linus

| Component | Change |
|---|---|
| `SquadDataProvider` | Add `detectActiveMarkers()` private method |
| `SquadDataProvider` | Modify `getSquadMembers()` to check markers after roster resolution |
| Constants | Add `STALENESS_THRESHOLD_MS = 300_000` |
| Tests | Unit tests for marker detection (dir missing, stale markers, active markers) |

### In scope (SquadUI changes) — Rusty

None. Tree view and status bar already react to `SquadDataProvider.refresh()` via cache invalidation. No view-layer changes needed.

### Out of scope

- **Marker creation/deletion** — orchestrator's responsibility, not SquadUI
- **Changes to Squad CLI** — we define the contract; CLI team implements
- **Changes to orchestration log format** — untouched
- **Model changes** — `MemberStatus` already has `'working'` | `'idle'`; no new types needed
- **Stale marker cleanup** — deferred; read-only detection is sufficient for v1

## Implementation Notes

- The `active-work/` directory may not exist until the first marker is written. `detectActiveMarkers()` must handle `ENOENT` gracefully (return empty set).
- Marker detection adds one directory read + N stat calls per refresh cycle. With typical team sizes (3–8 agents), this is negligible.
- The 300ms debounce in `FileWatcherService` naturally coalesces rapid marker create/delete events during turn transitions.

## Decision

Adopt the active-work marker protocol as described. Linus implements the `SquadDataProvider` changes. No orchestrator changes are made in SquadUI — we publish the marker contract for the Squad CLI/Chat team to implement on their side.



---

# Decision: Parse Coding Agent Section for @copilot

**Date:** 2026-02-18  
**Author:** Linus (Backend Dev)  
**Issue:** Member parsing bug — @copilot missing from team member list

## Context

The `team.md` file has TWO member tables:
1. `## Members` (or `## Roster`) — human squad members
2. `## Coding Agent` — the @copilot autonomous coding agent

The `TeamMdService.parseMembers()` method only parsed the first section, causing @copilot to be excluded from the unified member list displayed in the tree view.

## Decision

Extended `TeamMdService.parseMembers()` to parse BOTH sections:
1. First, parse `## Members` / `## Roster` (existing behavior)
2. Then, parse `## Coding Agent` and append those members to the array

Both sections use the same table format (Name | Role | Charter | Status), so the existing `parseMarkdownTable()` and `parseTableRow()` methods handle both without modification.

## Rationale

- **Minimal change:** Leverages existing table parsing infrastructure — just needed a second call to `extractSection()`
- **Unified roster:** All members (human + bot) now appear in the same list for consistent UI rendering
- **Backward compatible:** Repos without a Coding Agent section continue to work (no section = no extra members)
- **Edge case safe:** The `parseTableRow()` method already filters out invalid entries, so malformed tables won't crash the parser



---

### 2026-02-18: Velocity chart counts ALL closed issues, not just member-matched
**By:** Linus
**What:** The velocity timeline in `buildVelocityTimeline()` now uses an unfiltered `allClosedIssues` array from `getClosedIssues()` instead of iterating the `MemberIssueMap` from `getClosedIssuesByMember()`. The per-member Team Overview still uses the member-matched `closedIssues` map — only velocity changed.
**Why:** Issues closed in the repo that lack a `squad:*` label and have no matching assignee alias were silently dropped from the velocity chart. This made the graph undercount actual team throughput. The velocity chart should reflect all repo activity, not just the subset that matches a member routing strategy.

---

## Velocity chart uses all logs; status stays orchestration-only

**Date:** 2026-02-18  
**Author:** Linus  
**Issue:** Velocity chart undercounting — session logs excluded

### Context

The velocity/activity chart only counted tasks from `orchestration-log/` and closed GitHub issues. Session logs in `log/` represent real completed work but were never reflected in velocity.

### Decision

- Added `getVelocityTasks()` to `SquadDataProvider` — extracts tasks from ALL logs (both `orchestration-log/` and `log/`).
- `getTasks()` remains orchestration-only to preserve member status isolation and tree view behavior.
- `DashboardDataBuilder.buildDashboardData()` accepts an optional `velocityTasks` parameter; when provided, velocity timeline uses it instead of `tasks`.
- Activity swimlanes still use orchestration-only `tasks` — only velocity benefits from session logs.

### Rationale

Session logs contain issue references, outcomes, and participants that represent real work. Excluding them from velocity makes the chart misleading (e.g., zero activity for days that had 8+ session logs). The separation keeps member status correct (no false "working" indicators from old session logs) while giving velocity the full picture.


# Dashboard & Decisions Loading — Code Review Findings

**Author:** Danny (Lead)
**Date:** 2026-02-19
**Scope:** Dashboard loading pipeline, decisions panel content loading

---

## Decision: Fix Squad Folder Hardcoding Across Three Files

Three files hardcode `.ai-team` instead of using the detected `squadFolder` parameter. This causes silent failures for any project using the `.squad/` folder structure:

1. **DecisionsTreeProvider** (`SquadTreeProvider.ts:434`) — `new DecisionService()` defaults to `.ai-team`
2. **SquadDataProvider.discoverMembersFromAgentsFolder()** (`SquadDataProvider.ts:271`) — hardcodes `.ai-team` path
3. **SquadDashboardWebview.handleOpenLogEntry()** (`SquadDashboardWebview.ts:167`) — hardcodes `.ai-team` path

**Fix approach:**
- DecisionsTreeProvider should use `dataProvider.getDecisions()` instead of its own DecisionService instance (also eliminates cache bypass)
- discoverMembersFromAgentsFolder should use `this.squadFolder` instead of literal `.ai-team`
- handleOpenLogEntry needs access to the squad folder — either via the data provider or constructor injection

## Decision: Add Panel Null Guard After Async Awaits

`SquadDashboardWebview.updateContent()` checks `this.panel` at the top, then does 5+ sequential awaits. If the user closes the panel during data loading, `this.panel` becomes `undefined` and both the HTML assignment (line 137) and the error handler (line 140) will crash.

**Fix:** Re-check `if (!this.panel) return;` before setting HTML, and add a null guard in the catch block.

## Decision: Sanitize JSON Interpolation in HTML Template

`htmlTemplate.ts` interpolates `JSON.stringify(data)` directly into a `<script>` tag. `JSON.stringify` does not escape `</`, so any decision content containing `</script>` will break the entire dashboard.

**Fix:** Apply `JSON.stringify(data).replace(/</g, '\\u003c')` to all interpolated JSON values.

---

## Severity Summary

| # | File | Issue | Severity |
|---|------|-------|----------|
| 1 | SquadTreeProvider.ts:434 | DecisionsTreeProvider uses default `.ai-team` folder | P1 |
| 2 | SquadDataProvider.ts:271 | discoverMembersFromAgentsFolder hardcodes `.ai-team` | P1 |
| 3 | SquadDashboardWebview.ts:167 | handleOpenLogEntry hardcodes `.ai-team` | P1 |
| 4 | SquadDashboardWebview.ts:96-141 | Race: panel disposed during async fetch | P1 |
| 5 | htmlTemplate.ts:9-13 | `</script>` in content breaks dashboard | P1 |
| 6 | SquadTreeProvider.ts:434-455 | Bypasses dataProvider cache, redundant reads | P2 |
| 7 | SquadTreeProvider.ts:453-476 | No error handling in getDecisionItems() | P2 |
| 8 | DecisionService.ts:207 | No try/catch on readdirSync (TOCTOU) | P2 |

# Decision: Always pass squadFolder through tree providers and webviews

**Date:** 2026-02-18
**Author:** Linus
**By:** Linus (Backend Dev)

## Context

Deep investigation of the dashboard and decisions pipelines revealed four places where the configurable squad folder name (`.squad` vs `.ai-team`) was hardcoded to `.ai-team` instead of using the runtime-detected value. This caused silent failures for any workspace using `.squad`.

## Decision

All service constructors, tree providers, and webview classes that need to resolve paths under the squad folder MUST receive `squadFolder` as a parameter — never hardcode `.ai-team`. Added `getSquadFolder()` to `SquadDataProvider` so downstream consumers (like `SquadDashboardWebview`) can access it without constructor changes.

## Rationale

- The extension supports both `.squad` and `.ai-team` folder names via `detectSquadFolder()`
- Four bugs silently broke features for `.squad` users: agent folder discovery, log entry opening, decisions tree, and team tree log parsing
- A public getter on `SquadDataProvider` is the cleanest way to propagate the value without adding constructor parameters to every consumer



---

# Park Status Indicators

**Date:** 2026-02-23
**Author:** Rusty (requested by Jeffrey T. Fritz)
**Status:** Decided

## Decision

Remove all visible active/idle/working status indicators from the extension UI. The underlying data infrastructure (MemberStatus type, OrchestrationLogService, SquadDataProvider status computation) is preserved — we're parking the feature, not deleting it.

## Rationale

The idle/active status has been unreliable and a source of ongoing issues (false "working" indicators from stale logs, race conditions, etc.). Rather than continuing to fight it, we're parking the UI feature until the underlying status detection is more robust.

## What Changed

- **Tree view:** Members always show `person` icon. Description shows role only, no ⚡/💤 badges. Tooltip shows name + role, no status.
- **Dashboard:** No "Working" summary card. Member cards show 👤 avatar (no ⚡). No status badge line.
- **Status bar:** Shows `Squad: N members` instead of `N/M Active 🟢`. No health icons.
- **Work details webview:** No member status badge in "Assigned To" section.

## Re-enablement

To bring status back, revert the UI-layer changes in:
- `src/views/SquadTreeProvider.ts` (icon + description + tooltip)
- `src/views/dashboard/htmlTemplate.ts` (summary card + member cards)
- `src/views/SquadStatusBar.ts` (active count + health icon)
- `src/views/WorkDetailsWebview.ts` (member status badge)

The data is still flowing — `SquadMember.status` is still computed, `TeamSummary.activeMembers` is still calculated. Just not displayed.


---

### 2026-02-18: Copilot Chat Idle Status Fallback
**By:** Rusty  
**What:** Added fallback status detection when Squad runs in VS Code Copilot Chat without creating active-work marker files. SquadUI now checks if ANY orchestration log file was modified in the last 10 minutes — if so, members who appear in logs are marked as working.  
**Why:** Issue #63 reported that subagents show "Idle" during Copilot Chat sessions because the Squad orchestrator doesn't write active-work marker files. This fallback detects orchestration activity via log file timestamps, providing a signal that work is happening even when the formal marker protocol isn't used. The 10-minute window (vs. 5-minute marker staleness) accounts for delayed log writes. Active-work markers remain the primary status indicator when present.


---

### 2026-02-23: User directive — Park active/idle status feature
**By:** Jeffrey T. Fritz (via Copilot)
**What:** Park the idle/active status indicator feature for squad agents. Remove any indication of 'active' status from the UI. The status detection has been unreliable and is not worth fighting right now.
**Why:** User request — the feature has been a recurring source of bugs (#63, #67) and the team should stop investing in it for now.


---

# StandupReportWebview — HTML Injection Risk

**Date:** 2026-02-23
**Author:** Basher (Tester)
**Status:** Proposed

## Context

`StandupReportWebview.ts` renders issue titles, labels, and decision titles directly into HTML via template literals without escaping. For example:

```typescript
`<span class="issue-number" onclick="openIssue('${issue.htmlUrl}')">#${issue.number}</span> ${issue.title}`
```

If an issue title contains `<script>` or `onclick=...` content, it would be injected into the webview DOM.

## Risk Assessment

**Low-medium.** VS Code webview panels have a Content Security Policy that blocks inline scripts, so a `<script>` tag wouldn't execute. However, crafted HTML attributes or CSS injection could still cause visual corruption or clickjacking within the panel.

## Recommendation

Escape HTML entities in all user-sourced strings before injection: `&`, `<`, `>`, `"`, `'`. A simple utility function like `escapeHtml()` applied to `issue.title`, `decision.title`, and `issue.assignee` would close this gap.

This applies to both `StandupReportWebview.ts` and `formatAsMarkdown()` in `StandupReportService.ts` (markdown injection is lower risk but worth noting).


---

# Test Strategy for Status Override Logic

**Date:** 2026-02-22
**Author:** Basher
**Issue:** #63

## Decision

For testing status override logic and completion signal detection, use synthetic `OrchestrationLogEntry` objects instead of temp files on disk.

## Context

Issue #63 involved two behavior changes:
1. SquadDataProvider working-to-idle override now distinguishes between "no tasks at all" (Copilot Chat, stay working) vs "tasks but none active" (show idle)
2. OrchestrationLogService now checks outcomes for completion signals when extracting tasks from relatedIssues

Both behaviors required comprehensive test coverage.

## Rationale

- **Synthetic entries are faster** — No disk I/O, temp directory cleanup, or async file operations
- **Synthetic entries are clearer** — Test data is inline with assertions, easier to read and maintain
- **Follows existing patterns** — `orchestrationTaskPipeline.test.ts` already uses synthetic entries for unit testing getActiveTasks()
- **Integration tests still use disk** — Where file parsing is the behavior under test (e.g., parseLogFile), we still use temp fixtures

## Implementation

- Import `OrchestrationLogEntry` type from `../../models`
- Construct minimal entry objects with required fields: `timestamp`, `date`, `topic`, `participants`, `summary`
- Add optional fields as needed: `relatedIssues`, `outcomes`
- SquadDataProvider tests still use temp directories because they test the full member resolution flow including team.md parsing

## When to Use Each Approach

- **Synthetic entries:** Unit testing task extraction, member states, completion signals
- **Temp files:** Integration testing file parsing, directory scanning, multi-file workflows


---

## Fork-Aware Issue Fetching

**Author:** @copilot (Coordinator)
**Date:** 2026-02-23
**Status:** Implemented

### Decision

When a Squad workspace repo is a fork, SquadUI now automatically resolves the upstream (parent) repository for issue fetching. All issue-related API calls (open issues, closed issues, milestones) use the upstream repo.

### Resolution Order

1. **Manual override:** **Upstream** | owner/repo in team.md's Issue Source table
2. **Auto-detect:** GitHub API GET /repos/{owner}/{repo}  parent field
3. **Fallback:** Use the configured repository as-is

### Usage

Add to team.md Issue Source table:

```markdown
| **Upstream** | csharpfritz/SquadUI |
```

Or leave it out  SquadUI will auto-detect if the repo is a fork.

### Impact

- GitHubIssuesService, TeamMdService, IssueSourceConfig model
- All existing matching strategies (labels, assignees) work against upstream issues
- No breaking changes  repos without forks behave identically

---

## Standup Report: Issue Linkification & Chart Legend

**Author:** Rusty (Extension Dev)
**Date:** 2026-02-23
**Requested by:** Jeffrey T. Fritz

### Decisions

#### 1. AI Summary Issue Linkification

#N patterns in AI-generated executive summaries and decisions summaries are now rendered as clickable links that open the corresponding GitHub issue. The repo base URL is derived dynamically from the first issue's htmlUrl in the report, with a hardcoded fallback to https://github.com/csharpfritz/SquadUI.

**Rationale:** The scapeAndParagraph() pipeline is: escape HTML  linkify issue numbers  wrap in <p> tags. This ordering prevents HTML injection from user-supplied text while allowing the generated anchor tags to render.

#### 2. Velocity Chart Legend Below Canvas

The velocity chart legend was moved from an in-canvas overlay (top-right corner) to a centered HTML <div class="chart-legend"> row below the canvas element.

**Rationale:** The in-canvas legend overlapped with bar chart data, especially on narrow viewports. An HTML legend is also more accessible and respects VS Code theme colors via CSS variables.


---


# SquadUI Feature Roadmap Analysis

**Author:** Danny (Lead)  
**Date:** 2026-02-24  
**Issue:** Feature planning for v1.0 release and beyond  

---

## Executive Summary

SquadUI is at v0.9.1 with strong foundational features: team visualization, activity tracking, GitHub integration, skills catalog, decisions browser, and standup reports. The extension is **feature-complete for v1.0** but lacks polish, observability, and collaboration depth needed for production teams.

This document proposes 10 feature ideas across three milestones (v1.0, v1.1, v1.2), organized by category:
- **User experience polish** (addressing rough edges)
- **Observability** (helping teams understand agent activity and decisions)
- **Integration depth** (deeper GitHub + Copilot CLI connection)
- **Collaboration** (multi-workspace, team-wide features)
- **Developer workflow** (making SquadUI indispensable to daily work)

---

## Feature Ideas (Prioritized)

| # | Title | Description | Size | Priority | Agent | Category |
|---|-------|-------------|------|----------|-------|----------|
| 1 | **Active Status Redesign** | Replace parked idle/active badges with real-time Copilot Chat detection and active-work marker integration. Show "⚙️ Working on Issue #42" instead of idle/active emoji. Richer context without false positives. | M | P0 | Rusty | Observability |
| 2 | **Decision Search & Filter** | Add searchable decision list in sidebar with filters (by author, date, topic). Quick-search as user types. Decisions tree grows with large repos; search makes it navigable. | S | P1 | Rusty | User Experience |
| 3 | **Issue Backlog View** | New tree view tab showing all `squad:{member}` issues grouped by member and priority. Separate "open", "in-progress", "blocked" buckets. One-click triage + bulk assignment. | M | P1 | Rusty | Developer Workflow |
| 4 | **Markdown Charter Editor** | Right-click "Edit Charter" to open charter.md in editor (not preview). Add inline guidance UI (tooltips on optional sections). Simple but powerful for team composition changes. | S | P1 | Rusty | Collaboration |
| 5 | **Dashboard Member Drill-down** | Click a member card in dashboard to see member-specific metrics: tasks completed this period, current blockers, skill usage trend. Contextualize team velocity by individual contribution. | M | P1 | Rusty | Observability |
| 6 | **Copilot Chat Integration** | Intercept `/@squad` mentions in Copilot Chat to surface team context (active members, skills, recent decisions). Show a preview popover with "Ask @squad about..." suggestions. | L | P0 | Rusty + Linus | Integration Depth |
| 7 | **Skill Usage Metrics** | Dashboard widget showing which skills are actually used in logs (parsed from decision/log notes mentioning skill names). Red flag unused skills; identify missing skills. | M | P2 | Linus | Observability |
| 8 | **Milestone Burndown Template** | Quick-start template in init wizard: select a GitHub milestone, auto-populate burndown goals for standup reports. Tie squad metrics to actual GitHub release planning. | M | P1 | Linus | Integration Depth |
| 9 | **Health Check Command** | Diagnostic tool: `Squad: Health Check` validates team.md, agents/ structure, GitHub connectivity, log parsing, decisions.md format. Color-coded report for quick troubleshooting. | S | P2 | Basher | User Experience |
| 10 | **Multi-Workspace Dashboard** | Allow users with multiple Squad projects to open a unified dashboard showing all squads side-by-side or with a workspace picker. Compare velocity across teams. | L | P2 | Rusty | Collaboration |

---

## Milestone Grouping

### v1.0 — Shipping Quality (Required for Release)
Planned for immediate release; addresses gaps blocking v1.0 maturity.

**Features:**
- **#1 Active Status Redesign** (P0) — Fixes parked #67 issue; real-time agent visibility is table-stakes for v1.0
- **#2 Decision Search & Filter** (P1) — Low friction, high value; scalability issue for growing projects
- **#4 Markdown Charter Editor** (P1) — Team composition is a common ask; edit-in-place reduces friction
- **#9 Health Check Command** (P2) — Self-service troubleshooting reduces support burden; optional but recommended

**Rationale:** These features solve usability pain points (navigation, searchability, real-time status) and reduce support friction without major architecture changes. #1 is critical for competitive parity with other AI team tools.

### v1.1 — Team Intelligence (3–4 weeks out)
Features expanding observability and making the dashboard indispensable.

**Features:**
- **#3 Issue Backlog View** (P1) — Shifts SquadUI from read-only observer to active project management tool
- **#5 Dashboard Member Drill-down** (P1) — Unlocks per-member analytics; teams want to understand individual velocity
- **#6 Copilot Chat Integration** (P0) — Deep integration with GitHub Copilot; makes SquadUI a natural context hub
- **#8 Milestone Burndown Template** (P1) — Ties squad metrics to GitHub release planning; bridges gap between agent work and product roadmap

**Rationale:** These features shift SquadUI from a visualization tool to an active management dashboard. The Copilot Chat integration (#6) is particularly high-impact — it puts Squad context directly where developers are working.

### v1.2+ — Operational Excellence (Post-release)
Advanced features for mature teams running larger squads.

**Features:**
- **#7 Skill Usage Metrics** (P2) — Helps teams evolve their skill catalog over time
- **#10 Multi-Workspace Dashboard** (P2) — Scales to orgs running multiple AI teams

**Rationale:** These are polish and scale features; deferred until core loop is solid and user feedback is in.

---

## Architectural Considerations

### Active Status Redesign (#1)
**Key decision:** This closes issue #67 but shifts from a badge-based model to rich contextual status strings.

- **Current:** Simple emoji badges (🟢 active, 📋 idle) with insufficient signal
- **Proposed:** Status like "⚙️ Working on Issue #42" or "🔄 Reviewing PR #15" with clickable context
- **Implementation:**
  - Extend `MemberStatus` enum to include new status types (working-on-issue, reviewing-pr, waiting-review, idle, monitoring)
  - Enhance `SquadDataProvider.getMemberStatus()` to return rich object: `{ type, current: { linkType, id, title } }`
  - Tree view badges show truncated version; hover tooltip shows full context
  - Dashboard member card shows status + context in larger space
- **Risk:** API change to MemberStatus requires updates across tree views and status bar; mitigate with TypeScript types

### Decision Search (#2)
**Key consideration:** Decisions currently stored in two locations (decisions.md file OR individual .md files). Search must be location-agnostic.

- **Implementation:** Add `DecisionService.search(query)` that:
  - Full-text searches both decisions.md content AND individual decision files
  - Returns ranked results (title match > body match > metadata)
  - Caches results during 2-sec idle (user typing in search field)
- **No data changes needed** — purely a service-layer addition

### Copilot Chat Integration (#6)
**Critical architectural constraint:** Requires parsing Copilot Chat context at runtime. This is **complex and may require GitHub API access**.

- **Risk:** No public API for intercepting Copilot Chat messages or monitoring Copilot context
- **Mitigation:** Start with "manual trigger" — `/ask-squad "topic"` command in chat, or right-click in chat to "Explain to Squad"
- **Future:** If GitHub opens Copilot Chat plugin API, expand to automatic context suggestion
- **Note:** This is a **long-pole feature** — may need to defer to v1.1.1 or later

### Issue Backlog View (#3)
**Implementation note:** Requires fetching ALL `squad:{member}` issues (not just assigned to current user). This scales with repo size.

- **Optimization:** Paginate issues, load on-demand, add filters to reduce payload
- **Cache:** Store results in `SquadDataProvider` with 5-min TTL to avoid hammering GitHub API
- **Security:** Already have `GitHubIssuesService` — extend it to support backlog queries

### Multi-Workspace Dashboard (#10)
**Architecture impact:** Requires redesigning dashboard data flow to support multiple roots simultaneously.

- **Current:** `SquadDataProvider` binds to a single root; dashboard queries it
- **Proposed:** Dashboard accepts array of `{ root, folder }` pairs; queries them in parallel; UI shows unified view with workspace selector or tabs
- **Deferred:** Low priority (few orgs run multiple squads); defer to v1.2

---

## V1.0 Readiness Checklist

✅ **Core features shipping:**
- Team visualization (tree view with roles, status, tasks)
- Dashboard (velocity, activity, decisions)
- Standup reports (daily/weekly, AI summaries)
- Skills catalog (browse, add, remove)
- GitHub integration (issues, fork-aware fetching)
- Init wizard + upgrade command
- Status bar health indicator

⚠️ **Gaps to close before v1.0:**
- [ ] Real-time agent status (#1 — Active Status Redesign)
- [ ] Decision navigation scalability (#2 — Decision Search)
- [ ] Charter editing (#4 — Markdown Editor)
- [ ] Diagnostic tooling (#9 — Health Check)

✅ **Known limitations (acceptable for v1.0):**
- No Copilot Chat integration (deferred to v1.1)
- No multi-workspace support (deferred to v1.2)
- No offline mode (acceptable — requires GitHub connectivity)
- No team member activity feed beyond logs (sufficient for MVP)

---

## Risk Assessment

| Feature | Risk | Mitigation |
|---------|------|-----------|
| #1 Active Status | API change to `MemberStatus` enum; impacts tree/status bar | Add new enum values; update views incrementally; add TypeScript compile checks |
| #6 Copilot Chat | No public API for message interception | Start with manual trigger (`/ask-squad`); plan for API when GitHub releases it |
| #10 Multi-Workspace | Significant data flow refactoring | Defer to v1.2; not blocking v1.0 |
| #3 Issue Backlog | GitHub API rate limiting on large repos | Paginate; cache; warn users about rate limits |

---

## Next Steps

1. **Validate with Jeffrey & team:** Does this roadmap align with v1.0 ship target and community feedback?
2. **Assign implementation:** P0 features (#1, #6) → Rusty + Linus pairing for cross-layer work
3. **Scope v1.0.0 release:** Finalize which features are hard requirements vs. nice-to-have
4. **Backlog grooming:** Create GitHub issues for each feature with acceptance criteria
5. **Schedule:** Estimate v1.0 ship date based on feature scope

