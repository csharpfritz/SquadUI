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
