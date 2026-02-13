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

---

## 2026-02-14: IGitHubIssuesService interface contract for tree view integration

**By:** Rusty
**What:** Defined `IGitHubIssuesService` interface in `src/models/index.ts` with a single method `getIssuesByMember(workspaceRoot: string): Promise<MemberIssueMap>`. The tree provider depends on this interface, not the concrete `GitHubIssuesService` class.
**Why:** Decouples the tree view from the issues service implementation. Allows the tree to compile and work without the service (graceful degradation). When Linus's #18 lands, the concrete service just needs to implement this interface and be wired via `treeProvider.setIssuesService()`.

---

## 2026-02-14: Issue icons use $(issues) codicon with ThemeColor tinting

**By:** Rusty
**What:** Issues in the tree view use the `$(issues)` codicon with `charts.green` color for open issues and `charts.purple` for closed. Tasks continue to use `$(tasklist)` with no color override.
**Why:** Makes issues visually distinct from orchestration tasks at a glance. Uses VS Code's built-in theme colors so it adapts to any color theme. The `charts.*` colors are well-established in the VS Code palette.

---

## 2026-02-14: Squad labels filtered from issue description display

**By:** Rusty
**What:** When rendering issue labels in the tree item description, labels starting with `squad:` are excluded.
**Why:** The `squad:{member}` label is used for routing/mapping issues to members — it's structural, not informational. Showing it in the UI would be redundant since the issue already appears under that member's node.

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
