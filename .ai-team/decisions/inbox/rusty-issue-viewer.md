# Issue Detail Webview — Architecture Decision

**Author:** Rusty (Extension Dev)
**Date:** 2026-02-14
**Status:** Proposed

## Context

Users requested two features: (1) showing completed/closed issues in the tree view under each member, and (2) viewing issue content in a VS Code webview instead of always opening the browser.

## Decisions

### 1. Completed Issues Use Muted Icon

**Decision:** Completed issues use `$(pass)` icon with `descriptionForeground` color to visually distinguish them from open issues (which use `$(issues)` with `charts.green`).

**Rationale:** The `pass` (checkmark) icon clearly communicates "done" status. Using `descriptionForeground` makes them visually recede compared to active open issues, keeping focus on current work.

### 2. Issue Webview Uses postMessage for External Links

**Decision:** `IssueDetailWebview` enables scripts and uses `acquireVsCodeApi().postMessage()` to send the GitHub URL back to the extension host, which calls `vscode.env.openExternal()`.

**Rationale:** VS Code webviews don't allow arbitrary `<a href>` navigation for security. The postMessage pattern is the standard VS Code way to handle external links from webviews. `enableScripts: true` is required but CSP is still locked down.

### 3. Command Accepts Optional Full Issue Object

**Decision:** `squadui.openIssue` command accepts `(url: string, issue?: GitHubIssue)`. When `issue` is provided, it opens the webview; otherwise falls back to `openExternal`.

**Rationale:** Backward-compatible — any existing callers passing only a URL still work. Tree items now pass the full issue object as a second argument for richer display.

### 4. No Markdown Rendering in Issue Body

**Decision:** Issue body is rendered as escaped plain text with `white-space: pre-wrap`.

**Rationale:** Markdown rendering requires either a markdown library or `enableHtml` in the webview, both adding complexity and security surface. Plain text is sufficient for MVP. Can be upgraded later.

## Impact

- New file: `src/views/IssueDetailWebview.ts`
- Modified: `src/views/SquadTreeProvider.ts`, `src/extension.ts`, `src/views/index.ts`, `package.json`
- Interface change: `IGitHubIssuesService` now has `getClosedIssuesByMember` (coordinated with Linus)
