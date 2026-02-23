# Standup Report: Issue Linkification & Chart Legend

**Date:** 2026-02-23
**Author:** Rusty
**Requested by:** Jeffrey T. Fritz

## Decisions

### 1. AI Summary Issue Linkification
`#N` patterns in AI-generated executive summaries and decisions summaries are now rendered as clickable links that open the corresponding GitHub issue. The repo base URL is derived dynamically from the first issue's `htmlUrl` in the report, with a hardcoded fallback to `https://github.com/csharpfritz/SquadUI`.

**Rationale:** The `escapeAndParagraph()` pipeline is: escape HTML → linkify issue numbers → wrap in `<p>` tags. This ordering prevents HTML injection from user-supplied text while allowing the generated anchor tags to render.

### 2. Velocity Chart Legend Below Canvas
The velocity chart legend was moved from an in-canvas overlay (top-right corner) to a centered HTML `<div class="chart-legend">` row below the canvas element.

**Rationale:** The in-canvas legend overlapped with bar chart data, especially on narrow viewports. An HTML legend is also more accessible and respects VS Code theme colors via CSS variables.
