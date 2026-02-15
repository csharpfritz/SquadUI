# Markdown Link Handling in Member Names

**Date:** 2026-02-15
**Author:** Rusty
**Issue:** #48

## Decision

Created a shared utility module (`src/utils/markdownUtils.ts`) for handling markdown link syntax in display text. Two functions:

- **`stripMarkdownLinks(text)`** — For plain-text contexts (tree view labels, tooltips, data attributes). Extracts display text from `[text](url)`.
- **`renderMarkdownLinks(text)`** — For HTML contexts (dashboard webviews, work details). Converts `[text](url)` to `<a href="url" target="_blank">text</a>`.

## Why

Member names in `team.md` can contain markdown links. These need different treatment depending on context:
- Tree view sidebar: plain text only (VS Code TreeItem labels don't render HTML)
- Webview HTML: render as proper clickable hyperlinks

## Impact

Any future code displaying member names should use these utilities. The regex pattern `\[([^\]]+)\]\([^)]+\)` is now centralized — no more scattered regex copies.
