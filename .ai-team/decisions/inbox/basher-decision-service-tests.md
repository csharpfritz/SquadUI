# DecisionService Test Coverage

**Date:** 2026-02-15  
**By:** Basher  
**Status:** Implemented

## Context

DecisionService is the most fragile parser in the extension. It has been rewritten twice to fix date extraction bugs, yet had ZERO test coverage until now. The parser handles:

- Mixed heading levels (## decisions vs ### date-prefixed decisions)
- Dual date extraction (heading prefix AND **Date:** metadata)
- Subsection filtering (Context, Decision, Vision, etc.)
- Date ranges (2026-02-14/15 → extract first date)
- Multiple date formats in **Date:** metadata

Without tests, every future change to DecisionService risks breaking date extraction or subsection filtering.

## Decision

Created comprehensive test suite in `src/test/suite/decisionService.test.ts` with 60+ test cases covering:

1. **parseDecisionsMd()** — main parser with 35+ tests
2. **parseDecisionFile()** — individual file parser with 15+ tests  
3. **getDecisions()** — full pipeline with 8+ tests
4. **Edge cases** — CRLF, unicode, malformed content, empty files

Tests document all the nuanced parsing rules:
- ## headings are always decisions
- ### headings are decisions only if date-prefixed (YYYY-MM-DD:)
- Heading date wins over **Date:** metadata
- First date in multi-date strings always wins
- Subsections (Context, Decision) filtered at both levels

## Rationale

DecisionService has bitten us twice already. These tests:
1. **Prevent regressions** — any future parser changes will fail fast
2. **Document behavior** — tests are executable specs for the parsing rules
3. **Enable refactoring** — future maintainers can safely optimize with tests as safety net
4. **Catch edge cases** — tests cover realistic patterns from actual .ai-team/decisions.md files

## Outcome

- `src/test/suite/decisionService.test.ts` created with 60+ tests
- Tests compile successfully (`npx tsc --noEmit`)
- All known date extraction and subsection filtering patterns covered
- DecisionService now has comprehensive test coverage
