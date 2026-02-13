# Table-Format Log Summary Extraction Priority Chain

**Author:** Linus (Backend Dev)
**Date:** 2026-02-13

## Decision

When extracting the `summary` field from orchestration log entries, use this priority chain:

1. `## Summary` section (prose session logs)
2. `| **Outcome** | value |` table field (orchestration routing logs)
3. Heading title text after em dash `—` (fallback for any heading-based entry)
4. First prose paragraph after heading (last resort — skips table rows)

## Rationale

Real-world orchestration logs (e.g., WorkshopManager) use a metadata table format with no `## Summary` section. Without this chain, raw table markdown (`| Field | Value | ...`) leaks into task titles in the tree view. The priority order ensures the most specific/meaningful text wins.

## Impact

Any new log format that uses different metadata table fields should slot into this chain. The `extractSummaryFallback()` method now skips `|`-prefixed lines, so table-heavy logs won't pollute the fallback path.
