# Decision: Support H1 Decision Format in DecisionService

**Date:** 2026-02-16
**Author:** Linus

## Context

Some projects (e.g. aspire-minecraft) use a different decisions.md format where each decision is an H1 heading with a `Decision:` prefix, followed by `**Date:**`, `**Author:**`, and optional `**Issue:**` metadata. Subsections like `## Context`, `## Decision`, `## Rationale` appear inside the H1 block.

## Decision

`parseDecisionsMd()` now handles both formats:
- **H1 format:** `# Decision: {title}` — section boundary is next H1 or EOF. Inner H2/H3 subsections are content, not separate decisions.
- **H2/H3 format:** unchanged — original logic remains untouched.

The H1 check runs first in the loop. If it matches, it consumes the entire block (advancing `i` to `sectionEnd`) and `continue`s, so the H2/H3 logic never sees the subsections.

## Rationale

- Additive change — zero risk to existing parsing
- The `continue` + skip pattern is the cleanest way to prevent subsection re-parsing without restructuring the loop
- Non-decision H1 headings (like `# Decisions`) are explicitly skipped to avoid false positives
