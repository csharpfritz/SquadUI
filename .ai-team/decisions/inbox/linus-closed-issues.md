# Decision: Closed Issues Fetching Strategy

**Author:** Linus (Backend Dev)
**Date:** 2026-02-14

## Context

Rusty needs closed issues to display completed work history in the tree view. The `GitHubIssuesService` only fetched open issues. We need to add closed issue support without disrupting the existing open issues flow.

## Decisions

### 1. Separate Cache for Closed Issues

**Decision:** Closed issues use their own `closedCache` field, separate from the open issues `cache`.

**Rationale:** Open and closed issues have different access patterns. Open issues are the primary view and refreshed frequently. Closed issues are historical context — accessed less often. Separate caches prevent a closed issues fetch from invalidating the more valuable open issues cache.

### 2. 50-Issue Limit, No Pagination

**Decision:** Fetch at most 50 closed issues in a single API call, sorted by `updated_at` descending.

**Rationale:** Closed issues are for recent history, not full audit trail. 50 gives a meaningful window without burning API rate limits or adding latency from multiple paginated calls. The GitHub API's `per_page` max is 100, so 50 leaves headroom.

### 3. Case-Insensitive Member Matching

**Decision:** Use `.toLowerCase()` on squad label names when grouping by member, consistent with the open issues method.

**Rationale:** We just fixed a case-sensitivity bug in the open issues path. Applying the same pattern here prevents the same bug from appearing in the new code path.

## Impact

- `IGitHubIssuesService` now has a `getClosedIssuesByMember` method — any consumer of this interface gains access to closed issues
- Cache invalidation clears both open and closed caches — no partial staleness
