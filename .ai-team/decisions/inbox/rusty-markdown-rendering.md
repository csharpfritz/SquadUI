# Decision: Lightweight Markdown Rendering for Webview Descriptions

**Decided by:** Rusty  
**Date:** 2026-02-13  
**Scope:** WorkDetailsWebview (and potentially IssueDetailWebview)

## Context

Task descriptions containing markdown tables were displayed as raw pipe-delimited text because the webview escaped all HTML and used `white-space: pre-wrap`.

## Decision

Added a `renderMarkdown()` method that performs lightweight markdown-to-HTML conversion directly in the webview class. No npm dependencies were added — this is a pure string transform.

### What it handles:
- **Markdown tables** → `<table class="md-table">` with `<thead>`/`<tbody>`
- **Bold** (`**text**`) → `<strong>`
- **Inline code** (`` `text` ``) → `<code>`
- **Line breaks** → `<br>` for non-table content

### Security:
- All cell/text content is HTML-escaped before wrapping in markup tags
- No `innerHTML` or dynamic script injection

### Key implementation detail:
- Table separator detection (`|---|`) requires at least one `-` to avoid false-positive matching on data rows that contain only pipes and whitespace

## Impact

- If `IssueDetailWebview` also needs markdown rendering, the same pattern can be extracted to a shared utility
- If more markdown features are needed later (headers, links, lists), consider extracting to `src/utils/markdownRenderer.ts`
