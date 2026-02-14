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

---

## Issue Detail Webview — Architecture Decision

**Author:** Rusty (Extension Dev)
**Date:** 2026-02-14
**Status:** Proposed

### Context

Users requested two features: (1) showing completed/closed issues in the tree view under each member, and (2) viewing issue content in a VS Code webview instead of always opening the browser.

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

### Impact

- New file: `src/views/IssueDetailWebview.ts`
- Modified: `src/views/SquadTreeProvider.ts`, `src/extension.ts`, `src/views/index.ts`, `package.json`
- Interface change: `IGitHubIssuesService` now has `getClosedIssuesByMember` (coordinated with Linus)
## 2026-02-13: Acceptance test fixtures isolated in dedicated directory

**By:** Basher
**What:** Created `test-fixtures/acceptance-scenario/` with its own team.md and orchestration logs, separate from the shared `test-fixtures/.ai-team/` fixtures. The acceptance test (`src/test/suite/acceptance.test.ts`) points at this directory exclusively.
**Why:** Acceptance tests need a fully controlled, predictable fixture set where every member and task is known. Sharing fixtures with unit tests creates coupling — if someone adds a log file to the shared fixtures, it could break acceptance assertions about member counts or task assignments. Isolated fixtures also make the acceptance test self-documenting: you can read the fixture files to understand exactly what the test expects.

---

## 2026-02-14: GitHubIssuesService test pattern — cache injection over mocking

**By:** Basher
**What:** For testing GitHubIssuesService without real API calls, inject mock data directly into the private `cache` property via type casting (`(service as unknown as { cache: ... }).cache = ...`) rather than mocking the HTTP layer or using dependency injection.
**Why:** The service uses Node's built-in `https` module directly (no abstraction layer), so mocking HTTP would require intercepting `https.request` globally. Cache injection is simpler, more targeted, and tests the actual filtering/grouping logic without coupling to HTTP implementation details. If the HTTP layer is ever refactored (e.g., to use fetch or axios), these tests remain valid.

---

## Closed Issues Fetching Strategy

**Author:** Linus (Backend Dev)
**Date:** 2026-02-14

### Context

Rusty needs closed issues to display completed work history in the tree view. The `GitHubIssuesService` only fetched open issues. We need to add closed issue support without disrupting the existing open issues flow.

### Decisions

#### 1. Separate Cache for Closed Issues

**Decision:** Closed issues use their own `closedCache` field, separate from the open issues `cache`.

**Rationale:** Open and closed issues have different access patterns. Open issues are the primary view and refreshed frequently. Closed issues are historical context — accessed less often. Separate caches prevent a closed issues fetch from invalidating the more valuable open issues cache.

#### 2. 50-Issue Limit, No Pagination

**Decision:** Fetch at most 50 closed issues in a single API call, sorted by `updated_at` descending.

**Rationale:** Closed issues are for recent history, not full audit trail. 50 gives a meaningful window without burning API rate limits or adding latency from multiple paginated calls. The GitHub API's `per_page` max is 100, so 50 leaves headroom.

#### 3. Case-Insensitive Member Matching

**Decision:** Use `.toLowerCase()` on squad label names when grouping by member, consistent with the open issues method.

**Rationale:** We just fixed a case-sensitivity bug in the open issues path. Applying the same pattern here prevents the same bug from appearing in the new code path.

### Impact

- `IGitHubIssuesService` now has a `getClosedIssuesByMember` method — any consumer of this interface gains access to closed issues
- Cache invalidation clears both open and closed caches — no partial staleness

---

## 2026-02-13: GitHub Issues Service Architecture

**By:** Linus
**What:** GitHubIssuesService uses Node's built-in `https` module with optional auth token, 5-minute cache TTL, and `squad:{member}` label convention for issue-to-member mapping.
**Why:** Using `https` avoids polyfill complexity for fetch in a CommonJS VS Code extension. Optional auth lets the service work immediately without setup while supporting authenticated flows later. The `squad:` label prefix is a simple, human-readable convention that works with GitHub's existing label system.

---

## Release Pipeline

**Author:** Livingston (DevOps/CI)
**Date:** 2025-07-19
**Status:** Proposed

### Context

The project needs an automated release pipeline to package the SquadUI VS Code extension as a `.vsix`, create GitHub Releases with attached artifacts, and publish to the VS Code Marketplace — all triggered by pushing a version tag.

### Decision

Created `.github/workflows/release.yml` with the following design:

1. **Trigger:** Push of tags matching `v*` (e.g., `v0.1.0`, `v1.0.0`)
2. **Self-contained CI:** Duplicates lint → compile → test steps from `ci.yml` rather than calling the existing workflow, ensuring the release pipeline is independent and always runs the full gate
3. **Version verification:** Fails fast if the tag version (stripped `v` prefix) doesn't match `package.json` version — prevents accidental mismatches
4. **VSIX packaging:** Installs `@vscode/vsce` globally and runs `vsce package`
5. **GitHub Release:** Uses `softprops/action-gh-release@v2` with auto-generated release notes; marks versions < 1.0.0 as pre-release
6. **Marketplace publish:** Runs `vsce publish` using the `VSCE_PAT` repository secret; only runs if all prior steps succeed
7. **Permissions:** `contents: write` for creating releases

### Rationale

- Self-contained workflow avoids coupling to CI workflow changes and ensures release always has a full quality gate
- Tag-based trigger is the standard pattern for VS Code extension releases
- Pre-release flag for < 1.0.0 communicates stability expectations to users
- Version match check prevents shipping a VSIX with mismatched metadata

### Action Required

- Repository secret `VSCE_PAT` must be configured with a VS Code Marketplace Personal Access Token before the first release
- Publisher `csharpfritz` must be registered on the VS Code Marketplace

### Location

`.github/workflows/release.yml`

---

## Log Discovery: Union of All Directories

**Author:** Linus (Backend Dev)
**Date:** 2026-02-13

### Context

`OrchestrationLogService.discoverLogFiles()` was returning early from the first directory that contained files. In repos like MyFirstTextGame, `orchestration-log/` has routing metadata and `log/` has session logs with participants and issue references. Only reading one directory meant tasks from the other were invisible to SquadUI.

### Decisions

#### 1. Union Discovery — Read All Log Directories

**Decision:** `discoverLogFiles()` collects files from ALL configured log directories and returns their union, sorted alphabetically.

**Rationale:** Both directories contain meaningful data. The orchestration-log entries have routing info (which agent was dispatched), while log entries have session details (participants, decisions, outcomes, related issues). SquadUI needs both to show a complete picture.

#### 2. Dual Filename Format Support

**Decision:** The filename regex accepts both `YYYY-MM-DD-topic.md` and `YYYY-MM-DDThhmm-topic.md` via `(?:T\d{4})?`.

**Rationale:** The `orchestration-log/` directory uses a `T`-separated timestamp in filenames (e.g., `2026-02-10T2022-fury.md`). Without this, date extraction falls back to content parsing or defaults to today's date — both less reliable.

#### 3. Agent Routed Participant Extraction

**Decision:** `extractParticipants()` falls back to extracting from `| **Agent routed** | Name (Role) |` table format when `**Participants:**` and `**Who worked:**` are absent.

**Rationale:** Orchestration-log entries use a markdown table format with `**Agent routed**` instead of the inline `**Participants:**` format. The role suffix in parentheses (e.g., "Fury (Lead)") is stripped to return just the name, consistent with how participants are used elsewhere.

### Impact

- Files from both `orchestration-log/` and `log/` now appear in SquadUI
- No changes to public API — all fixes are internal to existing methods
- All 203 existing tests continue to pass

---

## Prose-Based Task Extraction in OrchestrationLogService

**Author:** Linus (Backend Dev)
**Date:** 2026-02-13

### Context

`getActiveTasks()` only created tasks from `#NNN` issue references. Real-world repos like MyFirstTextGame have no issue references — they describe work as prose in session log sections ("What Was Done", "Who Worked", "Outcomes") and orchestration log fields ("Agent routed", "Outcome").

### Decisions

#### 1. Two-Pass Extraction: Issues First, Then Prose

**Decision:** The `#NNN` extraction runs as a first pass over all entries. The prose extraction runs as a second pass, only for entries that produced zero issue-based tasks and have participants.

**Rationale:** Preserves existing behavior for repos that use GitHub issues. Prose extraction is additive — it fills the gap for repos that don't use issue numbers. No existing tests or behavior change.

#### 2. "What Was Done" Items Have Highest Prose Priority

**Decision:** Within the prose pass, entries with a `## What Was Done` section are processed before entries that fall to the synthetic fallback path.

**Rationale:** "What Was Done" bullets contain per-agent attributed work items (`- **Banner:** Built full engine...`). These are richer than a synthetic task generated from the first participant + summary. Processing them first prevents ID collisions where a less-specific synthetic task would claim the `{date}-{agent}` ID before the more descriptive one.

#### 3. Deterministic Task IDs: `{date}-{agent-slug}`

**Decision:** Prose-derived tasks use `{date}-{agent-slug}` as their ID (e.g., `2026-02-10-banner`).

**Rationale:** Stable across re-parses (deterministic). Avoids collisions between different agents on the same date. Avoids collisions with numeric `#NNN` issue IDs. Human-readable in debug output.

#### 4. "What Was Done" Items Are Always Status: completed

**Decision:** Tasks parsed from `## What Was Done` bullets are always marked `completed` with `completedAt` set to the entry date.

**Rationale:** These bullets are past-tense descriptions of done work ("Built full engine", "Wrote 131 tests"). The section name itself — "What Was Done" — implies completion.

#### 5. Completion Signal Detection for Synthetic Tasks

**Decision:** Synthetic fallback tasks check for completion keywords ("Completed", "Done", "✅", "pass", "succeeds") in the combined summary + outcomes text.

**Rationale:** Orchestration log outcomes like "Completed — Full engine with 13 models, 9 services" clearly signal done work. Matching these keywords gives reasonable status inference without requiring structured status fields.

#### 6. whatWasDone Field Added to OrchestrationLogEntry

**Decision:** Added optional `whatWasDone: { agent: string; description: string }[]` field to the `OrchestrationLogEntry` interface.

**Rationale:** The Task interface was intentionally not changed (existing fields are sufficient). The log entry interface needed a place to store parsed "What Was Done" data between `parseLogFile()` and `getActiveTasks()`. The field is optional, so all existing code that constructs or reads log entries is unaffected.

### Impact

- `OrchestrationLogEntry` has a new optional field — no breaking change
- `Task` interface unchanged
- All 203 existing tests pass without modification
- Repos with `#NNN` references see zero behavior change
- Repos with only prose descriptions now produce meaningful tasks

## 2026-02-14: Command Test Skip-Guard Pattern

---

## 2026-02-13: Dashboard Architecture - Unified Webview with Tabs

**Date:** 2026-02-13  
**Author:** Danny (Lead/Architect)  
**Status:** Proposed  
**Context:** Implementing Velocity Dashboard, Activity Timeline, and Decision Browser

### Decision

Single unified `SquadDashboardWebview` hosting three tabs (Velocity, Activity, Decisions). No external chart libraries — use HTML5 Canvas and CSS Grid for lightweight visualization.

**Rationale:**
- Consolidates related management views in one place
- Reduces activation cost (single webview lifecycle vs. three)
- Natural grouping: all three are "insights" on same underlying data
- VS Code status bar can show dashboard shortcut
- Users expect tabbed interfaces for multi-faceted views

**Command:** `squadui.openDashboard` (Ctrl+Shift+D / Cmd+Shift+D)

**Charting Strategy:** No Chart.js. HTML5 Canvas for trends/heatmaps, CSS Grid for swimlanes, vanilla JS for search. Keeps bundle lean.

**File Structure:**
- `src/views/SquadDashboardWebview.ts` (main class)
- `src/views/dashboard/DashboardDataBuilder.ts` (transforms logs to chart data)
- `src/views/dashboard/htmlTemplate.ts` (tab UI + inline JS)

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

### Impact

- Pattern for all future "insight" features
- New tabs added by: HTML template + `DashboardData` interface + `DashboardDataBuilder` logic
- Single-webview model keeps activation cost low
- All dashboard code in `src/views/dashboard/`
- No external dependencies added

**By:** Basher (Tester)
**Date:** 2026-02-14

### Context

The VS Code test electron host runs without a workspace folder. The extension's `activate()` returns early when `workspaceFolders` is undefined, so commands like `squadui.addMember` and `squadui.viewCharter` are never registered.

Tests that call `vscode.commands.executeCommand('squadui.addMember')` would throw `Error: command 'squadui.addMember' not found`.

### Decision

All tests that execute registered commands via `executeCommand` **must** use the skip-guard pattern:

```typescript
test('description', async function () {
    const commands = await vscode.commands.getCommands(true);
    if (!commands.includes('squadui.addMember')) {
        this.skip();
        return;
    }
    // ... test body
});
```

Key rules:
1. Use `function()` not arrow `() =>` (needed for `this.skip()`)
2. Check command registration before exercising it
3. Tests show as "pending" in CI, not "failing"

### Rationale

- Tests self-skip gracefully in environments without workspaces (CI, test electron host)
- No false failures in CI pipelines
- Tests still execute fully when run in a proper VS Code development host with a workspace open
- Consistent with the pattern already used in File Creation and Edge Case suites

### Impact

Any future command tests must follow this pattern. Tests that don't will fail in CI.

## 2026-02-14: E2E Validation Test Strategy

**By:** Basher (Tester)
**Date:** 2026-02-14
**Issue:** #14

### Decision

The E2E MVP validation tests (`src/test/suite/e2e-validation.test.ts`) use a **TestableWebviewRenderer** pattern to test webview HTML output without requiring a live `vscode.WebviewPanel`. This mirrors the approach already used in `webview.test.ts` and allows full HTML validation (table rendering, XSS escaping, bold text conversion) in the test electron host without opening actual webview panels.

The tests are organized by acceptance criterion (AC-1 through AC-6) to provide direct traceability between test results and the issue's acceptance criteria.

### Rationale

- Webview panels cannot be reliably created in the test electron host without a visible window
- The HTML generation logic is the critical code path; the panel lifecycle is VS Code boilerplate
- Organizing by AC makes it trivial to verify which criteria pass/fail in CI output
- Manual test plan (`docs/manual-test-plan.md`) covers the visual/interactive aspects that automated tests cannot reach

### Impact

All future acceptance testing should follow this pattern: automated tests for data flow and HTML generation, manual checklist for visual/interactive behavior. The manual test plan should be updated for each release milestone.

## 2026-02-14: Default issue matching uses labels + assignees

**By:** Linus
**Date:** 2026-02-14

When no `Matching` config is present in team.md's Issue Source section, `GitHubIssuesService` defaults to `['labels', 'assignees']` strategies rather than labels-only.

**Why:** Most repositories won't have `squad:{member}` labels set up. Adding assignee matching as a default fallback means issues show up for squad members as soon as `Member Aliases` maps their names to GitHub usernames — no custom label setup required. The `any-label` strategy is opt-in only because it can produce false-positive matches (e.g., a label named "enhancement" matching a hypothetical member named Enhancement).

## 2026-02-14: Member Aliases live in team.md under Issue Source

**By:** Linus
**Date:** 2026-02-14

The `Member Aliases` table (mapping squad member names → GitHub usernames) is parsed as a `### Member Aliases` subsection within team.md, near the Issue Source section.

**Why:** Keeps all issue-related configuration co-located. The aliases are needed by the issue matching service, not by the general team roster, so placing them near the Issue Source section makes semantic sense. They're also parseable by `TeamMdService` without adding a separate config file.

## 2026-02-14: SkillCatalogService uses graceful degradation and no external dependencies

**By:** Linus
**Date:** 2026-02-14

`SkillCatalogService` fetches from two external sources (awesome-copilot GitHub README, skills.sh HTML page) using Node's built-in `https` module. All public methods swallow network errors and return empty arrays — the UI layer never sees exceptions from catalog operations. Deduplication favors the awesome-copilot version when skills appear in both sources.

**Why:** Follows the existing pattern set by `GitHubIssuesService` — no npm dependencies, no `vscode` imports, graceful degradation on failure. The service must work offline (installed skills still readable) and must not crash the extension if an external source is down.

## 2026-02-14: Table-Format Log Summary Extraction Priority Chain

**By:** Linus (Backend Dev)
**Date:** 2026-02-13

### Decision

When extracting the `summary` field from orchestration log entries, use this priority chain:

1. `## Summary` section (prose session logs)
2. `| **Outcome** | value |` table field (orchestration routing logs)
3. Heading title text after em dash `—` (fallback for any heading-based entry)
4. First prose paragraph after heading (last resort — skips table rows)

### Rationale

Real-world orchestration logs (e.g., WorkshopManager) use a metadata table format with no `## Summary` section. Without this chain, raw table markdown (`| Field | Value | ...`) leaks into task titles in the tree view. The priority order ensures the most specific/meaningful text wins.

### Impact

Any new log format that uses different metadata table fields should slot into this chain. The `extractSummaryFallback()` method now skips `|`-prefixed lines, so table-heavy logs won't pollute the fallback path.

## 2026-02-14: Add Member Command UX Pattern

**Date:** 2026-02-14  
**Author:** Rusty (Extension Dev)  
**Status:** Proposed

### Context

The team needs a way to add new members from within the VS Code extension UI, rather than manually editing `.ai-team/` files.

### Decision

1. **Command ID:** `squadui.addMember`
2. **UX Flow:** QuickPick (role) → InputBox (name) → file creation + roster update → tree refresh
3. **Standard Roles:** Lead, Frontend Dev, Backend Dev, Full-Stack Dev, Tester/QA, Designer, DevOps/Infrastructure, Technical Writer, plus "Other..." for freeform entry
4. **File Generation:** Creates `charter.md` and `history.md` in `.ai-team/agents/{slug}/` using templates that match existing charter structure
5. **Roster Update:** Appends a new row to the `## Members` table in `team.md`
6. **Panel Button:** `$(add)` icon in `view/title` navigation group, scoped to `view == squadMembers`
7. **Registration Pattern:** Same factory function pattern as `registerInitSquadCommand` — returns `vscode.Disposable`, accepts callback for post-action refresh

### Rationale

- QuickPick before InputBox reduces friction — users pick from known roles before typing a name
- "Other..." escape hatch ensures the role list doesn't limit users
- Slug-based directory naming (lowercase, hyphenated) avoids filesystem issues across platforms
- Duplicate guard prevents accidental overwrites of existing agent directories
- Tree refresh after creation gives immediate visual feedback

## 2026-02-14: Lightweight Markdown Rendering for Webview Descriptions

**Decided by:** Rusty  
**Date:** 2026-02-13  
**Scope:** WorkDetailsWebview (and potentially IssueDetailWebview)

### Context

Task descriptions containing markdown tables were displayed as raw pipe-delimited text because the webview escaped all HTML and used `white-space: pre-wrap`.

### Decision

Added a `renderMarkdown()` method that performs lightweight markdown-to-HTML conversion directly in the webview class. No npm dependencies were added — this is a pure string transform.

#### What it handles:
- **Markdown tables** → `<table class="md-table">` with `<thead>`/`<tbody>`
- **Bold** (`**text**`) → `<strong>`
- **Inline code** (`` `text` ``) → `<code>`
- **Line breaks** → `<br>` for non-table content

#### Security:
- All cell/text content is HTML-escaped before wrapping in markup tags
- No `innerHTML` or dynamic script injection

#### Key implementation detail:
- Table separator detection (`|---|`) requires at least one `-` to avoid false-positive matching on data rows that contain only pipes and whitespace

### Impact

- If `IssueDetailWebview` also needs markdown rendering, the same pattern can be extracted to a shared utility
- If more markdown features are needed later (headers, links, lists), consider extracting to `src/utils/markdownRenderer.ts`

## 2026-02-14: Remove Member command pattern and palette consistency

**By:** Rusty
**Date:** 2026-02-14

Implemented `squadui.removeMember` command with alumni archival flow, and unified all command categories to `"Squad"` for clean palette display. Added context menus for member/task/issue tree items and hid context-dependent commands (`showWorkDetails`, `openIssue`) from the command palette.

**Why:** Remove-member completes the member lifecycle (add + remove). The palette category was inconsistent (`"SquadUI"` vs `"Squad"`) — standardizing on `"Squad"` gives a cleaner, shorter prefix in the command palette. Context menus make the tree view actionable without the palette. Hiding context-dependent commands avoids user confusion when invoked without arguments.

## 2026-02-14: Skill UI Patterns

**Date:** 2026-02-14  
**Author:** Rusty (Extension Dev)  
**Status:** Proposed

### Context

Skills (#37, #40) introduce a new entity type in the tree view and a multi-step QuickPick command for importing skills from external catalogs.

### Decisions

1. **SkillCatalogService in tree provider:** Instantiated directly inside `SquadTreeProvider` (not late-bound via setter) because the service has no VS Code dependencies — it only uses Node.js `fs` and `https`. This keeps wiring simple.

2. **Skills section placement:** "Skills" is a top-level collapsible node below team members. The `itemType: 'skill'` is reused for both the section header and individual skill items; the section header has no `memberId`, while individual skills use `memberId` to carry the skill name for command arguments.

3. **Source badges:** Skills show their catalog source as a description badge (📦 awesome-copilot, 🏆 skills.sh, 🎯 local) — same emoji scheme used in the QuickPick flow for consistency.

4. **Skill context commands:** `squadui.viewSkill` and `squadui.removeSkill` are registered inline in `extension.ts` (same pattern as `viewCharter`) since they're lightweight. Hidden from command palette.

### Impact

- Tree view `getChildren()` now returns skills section at root level
- `SquadTreeItem.itemType` union expanded to `'member' | 'task' | 'issue' | 'skill'`
- Three new commands in package.json: `addSkill`, `viewSkill`, `removeSkill`

---

## # Existing Tree Tests Must Account for Skills Section Node

**Author:** Basher (Tester / QA)  
**Date:** 2026-02-14  
**Issue:** #39 — Skill Import Feature

## Context

The `SquadTreeProvider.getChildren()` now returns members **plus** a Skills section node at the root level. This broke 9 existing tests across `treeProvider.test.ts`, `acceptance.test.ts`, and `e2e-validation.test.ts` that assumed root items were exclusively members.

## Decision

Root-level tree tests must filter by `itemType === 'member'` when asserting member-specific properties (count, labels, icons, tooltips). Tests that check "all root items" must be aware that the Skills section node is included.

The pattern is:
```typescript
const roots = await treeProvider.getChildren();
const members = roots.filter(r => r.itemType === 'member');
// Assert on members, not roots
```

## Impact

Any future tree node sections (e.g., "Issues", "History") will add more root-level nodes. Tests should always filter by item type rather than assuming a fixed root count.



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

---

### 2026-02-14: Skill identity uses directory slug, not display name

**By:** Rusty
**What:** Added `slug` property to the `Skill` model (set to the directory name by `parseInstalledSkill`). Tree items, `viewSkill`, and `removeSkill` commands now pass/use the slug for filesystem operations instead of slugifying the display name. Also added YAML frontmatter parsing to `parseInstalledSkill()` so skills with frontmatter (like all `.ai-team/skills/` entries) show their human-readable `name:` field instead of the raw directory name.
**Why:** The display name extracted from frontmatter (e.g., `"github-actions-vscode-ci"` → could be `"GitHub Actions CI"`) can differ from the directory name. Slugifying the display name back to a path is lossy and error-prone. The directory name is the canonical identifier; the display name is for humans. Separating these concerns prevents file-not-found errors when skill names don't round-trip through slugification.


---

---

# Dashboard Swimlane Visual Refinements for v0.2

**Author:** Rusty (Extension Developer)  
**Date:** 2026-02-14  
**Status:** Implemented

## Context

The Squad Dashboard swimlane view needed visual refinement to distinguish task status at a glance and provide detailed information on hover. This is part of preparing the v0.2.0 release which includes the new dashboard feature.

## Decision

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


