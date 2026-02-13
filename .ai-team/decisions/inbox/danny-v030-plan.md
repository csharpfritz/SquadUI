# v0.3.0 Squad Management Features — Architecture Plan

**Author:** Danny (Lead)  
**Date:** 2026-02-13  
**Status:** Accepted for implementation

---

## Vision

Enable SquadUI to act as a control plane for squad initialization and team member lifecycle management. Users can initialize squads, add/remove members with roles, and specify character universes for AI-powered name casting—all without leaving VS Code.

---

## Core Features

### 1. Squad Initialization

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

---

### 2. Team Member Management

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

---

### 3. Universe Selector

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

---

### 4. Command Palette Integration

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

## Data Persistence: team.md Structure

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

---

## Integration Points

### With Existing Services

- **TeamMdService** (new): Parses/updates team.md, returns SquadMember[]
- **SquadDataProvider**: Already reads team.md, will auto-refresh on file changes
- **SquadTreeProvider**: Already renders tree from SquadDataProvider, will show changes
- **FileWatcherService** (existing): Detects team.md changes, invalidates cache

### With External CLI

- **squad init**: Respects `--universe` flag, creates initial team.md
- **squad add-member**: Takes name, role, universe; updates team.md directly

---

## File Structure (v0.3.0 additions)

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

## Acceptance Criteria

### ✅ Core Features
- [ ] Squad init command spawns `npx squad init` and shows output
- [ ] Add member: InputBox + QuickPick, updates team.md
- [ ] Remove member: QuickPick, moves to Alumni, confirms first
- [ ] Universe selector: QuickPick, persists in team.md @copilot
- [ ] All commands registered in package.json with "Squad:" prefix

### ✅ UX/Workflow
- [ ] Commands appear in command palette as "Squad: ..."
- [ ] Progress/success messages shown to user
- [ ] Tree view refreshes after member changes
- [ ] Confirmation dialogs for destructive ops (remove)
- [ ] Error handling for malformed team.md

### ✅ Testing
- [ ] Unit tests for TeamMdService.addMember, removeToAlumni
- [ ] Integration tests: add member → team.md changes → tree refreshes
- [ ] Command tests: all four commands callable without error

---

## Open Questions / Risks

1. **Squad CLI Compatibility**: Assume `npx github:bradygaster/squad` is installable. If not, need fallback plan.
2. **team.md Format Stability**: If squad evolves team.md schema, we need parsing resilience.
3. **Universe Enum**: Should universes be hardcoded or loaded from squad CLI config?
4. **Tree View Context Menus**: Are tree item context menus necessary MVP, or nice-to-have for v0.3.1?

---

## Related Issues

- #24: Add squad init command
- #25: Add team member management commands
- #26: Add universe selector for casting
- #27: Create command palette integration

---

## Success Metrics

- All 4 commands are functional and accessible from command palette
- team.md can be modified entirely within VS Code
- Tree view reflects member additions/removals without manual refresh
- No crashes or unhandled errors in command execution
