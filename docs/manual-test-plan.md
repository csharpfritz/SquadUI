# Manual Test Plan — SquadUI MVP (v0.3.0)

> Issue: [#14 — End-to-end MVP validation](https://github.com/csharpfritz/SquadUI/issues/14)
>
> Last updated: 2026-02-14

## Prerequisites

- VS Code 1.85.0+
- Node.js 18+ installed
- A workspace folder with a valid `.ai-team/` directory structure containing:
  - `.ai-team/team.md` with at least one member
  - `.ai-team/orchestration-log/` or `.ai-team/log/` with at least one dated `.md` file
- Extension installed locally (`npm run compile` then F5 to launch Extension Development Host)

---

## Test Scenarios

### 1. Extension Loads Without Errors

| Step | Action | Expected | ✓ |
|------|--------|----------|---|
| 1.1 | Open VS Code with a workspace containing `.ai-team/` | Extension activates without errors in the Output panel | ☐ |
| 1.2 | Open the Developer Console (`Help > Toggle Developer Tools`) | No errors referencing "squadui" or "SquadUI" | ☐ |
| 1.3 | Open the Command Palette (`Ctrl+Shift+P`) and type "SquadUI" | Should see: "Show Work Details", "Refresh Team View", "Initialize" commands | ☐ |
| 1.4 | Check activity bar (left sidebar) | SquadUI icon (organization icon) should appear | ☐ |

### 2. Tree View Shows Squad Members

| Step | Action | Expected | ✓ |
|------|--------|----------|---|
| 2.1 | Click the SquadUI icon in the activity bar | "Team Members" tree view opens in the sidebar | ☐ |
| 2.2 | Inspect root-level items | Each member from `.ai-team/team.md` appears as a tree item | ☐ |
| 2.3 | Check member labels | Names match the "Name" column in team.md | ☐ |
| 2.4 | Check member descriptions | Format: `{Role} • {status}` (e.g., "Lead • idle") | ☐ |
| 2.5 | Check member icons | Working members show spinning sync icon (`sync~spin`), idle show person icon (`person`) | ☐ |
| 2.6 | Hover over a member | Tooltip shows: name (bold), role, status, and current task if working | ☐ |

### 3. Clicking Member Expands to Show Tasks

| Step | Action | Expected | ✓ |
|------|--------|----------|---|
| 3.1 | Click the expand arrow on a member with tasks | Tree expands to show child task items | ☐ |
| 3.2 | Inspect task labels | Meaningful titles (e.g., "Issue #10"), not raw markdown or pipe characters | ☐ |
| 3.3 | Check task icons | Each task shows a `tasklist` icon | ☐ |
| 3.4 | Check task descriptions | Shows status: "pending", "in_progress", or "completed" | ☐ |
| 3.5 | Hover over a task | Tooltip shows task title (bold), status, and description if available | ☐ |
| 3.6 | Expand a member with no tasks (e.g., if they aren't the first participant in any log) | No child items appear — tree shows empty expansion | ☐ |

### 4. Clicking Task Shows Details in Webview

| Step | Action | Expected | ✓ |
|------|--------|----------|---|
| 4.1 | Click on a task item | Webview panel opens in column 2 ("Work Details") | ☐ |
| 4.2 | Check webview title bar | Shows the task title | ☐ |
| 4.3 | Check task title in webview | Displayed in `<h1>` heading | ☐ |
| 4.4 | Check status badge | Badge shows "Pending", "In Progress", or "Completed" with appropriate styling | ☐ |
| 4.5 | Check description section | Task description displayed (or "No description provided" if absent) | ☐ |
| 4.6 | Check timestamps section | "Started" and "Completed" dates shown (or "Not started" / "—") | ☐ |
| 4.7 | Check "Assigned To" section | Shows member avatar (initials), name, role, and status badge | ☐ |
| 4.8 | If description contains a markdown table | Table renders as HTML `<table>` with proper headers and cells — no raw `|` pipes visible | ☐ |
| 4.9 | If description contains `**bold**` text | Renders as `<strong>` tags (visible bold text) | ☐ |
| 4.10 | Click a different task | Webview updates to show the new task details (re-uses same panel) | ☐ |

### 5. File Changes Trigger Tree Refresh

| Step | Action | Expected | ✓ |
|------|--------|----------|---|
| 5.1 | With tree view open, edit a file in `.ai-team/orchestration-log/` | Tree view refreshes automatically (may take 1-2 seconds due to debounce) | ☐ |
| 5.2 | Add a new `.md` log file to the orchestration-log directory | New data appears in tree after auto-refresh | ☐ |
| 5.3 | Click the refresh button in the tree view title bar | Tree refreshes and shows info message "Squad tree refreshed" | ☐ |
| 5.4 | Run command `SquadUI: Refresh Team View` from palette | Same as 5.3 | ☐ |

### 6. Integration — Full Pipeline

| Step | Action | Expected | ✓ |
|------|--------|----------|---|
| 6.1 | Open a project with multiple orchestration log files | Tree shows all members from team.md with correct working/idle status | ☐ |
| 6.2 | Expand a working member | Tasks from related issues appear as children | ☐ |
| 6.3 | Click a task → verify webview | Webview shows correct data matching the log entry | ☐ |
| 6.4 | Edit team.md to add a new member | After refresh, new member appears in tree | ☐ |
| 6.5 | Delete all log files | After refresh, all members show as "idle" with no tasks | ☐ |

---

## Known Edge Cases to Check Manually

| Scenario | What to verify |
|----------|---------------|
| **No `.ai-team/` directory** | Extension shows warning: "No workspace folder found" or loads with empty tree |
| **team.md exists but no logs** | All members appear as idle, no tasks |
| **Logs exist but no team.md** | Members derived from log participants (fallback behavior) |
| **Empty orchestration-log directory** | Tree shows team.md members, all idle, no tasks |
| **Log file with malformed markdown** | Gracefully skipped, other logs still parsed |
| **Special characters in member names** | Names display correctly (no encoding issues) |
| **Very long task descriptions** | Webview scrolls properly, no overflow |
| **Multiple VS Code windows** | Extension works independently in each window |
| **Extension reload (`Developer: Reload Window`)** | Extension re-activates cleanly, tree repopulates |

---

## Automated Test Coverage

The following automated tests validate the acceptance criteria programmatically:

| Test File | Coverage |
|-----------|----------|
| `src/test/suite/e2e-validation.test.ts` | Full MVP acceptance criteria (AC-1 through AC-6) + edge cases |
| `src/test/suite/acceptance.test.ts` | Pipeline: fixtures → data layer → tree items |
| `src/test/suite/treeProvider.test.ts` | Tree item rendering, icons, commands, refresh |
| `src/test/suite/webview.test.ts` | HTML generation, markdown rendering, XSS prevention |
| `src/test/suite/services.test.ts` | OrchestrationLogService and SquadDataProvider |
| `src/test/suite/extension.test.ts` | Extension activation and command registration |

Run all automated tests:
```bash
npm test
```

---

## Sign-off

| Criterion | Automated | Manual | Signed Off |
|-----------|-----------|--------|------------|
| Extension loads without errors | ✅ | ☐ | ☐ |
| Tree view shows squad members with correct status | ✅ | ☐ | ☐ |
| Clicking member expands to show tasks | ✅ | ☐ | ☐ |
| Clicking task shows details in webview | ✅ | ☐ | ☐ |
| File changes trigger tree refresh | ✅ | ☐ | ☐ |
| Full pipeline integration | ✅ | ☐ | ☐ |

**Tester:** _______________  
**Date:** _______________  
**Result:** ☐ PASS / ☐ FAIL
