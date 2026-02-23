# Decision: DecisionSearchService API Design

**Date:** 2026-02-24
**Author:** Linus
**Issue:** #69

## Context

Issue #69 requires search and filtering for decisions. The existing `DecisionService` handles parsing; we need a separate service for query operations.

## Decision

Created `DecisionSearchService` as a pure, stateless service operating on `DecisionEntry[]`:

- **`search(decisions, query)`** — full-text search with relevance ranking (title 10× > author 5× > content 3×)
- **`filterByDate(decisions, startDate, endDate)`** — inclusive date range using YYYY-MM-DD string comparison
- **`filterByAuthor(decisions, author)`** — case-insensitive substring match
- **`filter(decisions, criteria)`** — chains all three: search first (preserves ranking), then date, then author

Exported types: `DecisionSearchCriteria`, `ScoredDecision`.

## Rationale

- Separation from `DecisionService` keeps parsing and querying decoupled — each can evolve independently
- Pure functions on arrays = trivially testable, no file I/O or VS Code deps
- Search-first chaining preserves relevance ordering through subsequent filters
- String comparison on YYYY-MM-DD avoids timezone issues that plague Date object comparisons

## Impact

- Rusty can consume `DecisionSearchService` from tree view code to wire up the search UI
- The `filter()` method accepts a `DecisionSearchCriteria` object — Rusty should bind UI inputs to this interface
- No changes to `DecisionEntry` model or `DecisionService` were needed
