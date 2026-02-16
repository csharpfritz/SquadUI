# Session Log: Burndown Chart End Date Fix

**Date:** 2026-02-16  
**Requested by:** Jeffrey T. Fritz  
**Member:** Rusty (Extension Dev)

## Summary

Burndown chart for closed milestones was extending to today instead of stopping at the last issue close date, making completed sprint burndowns appear empty or unreadable.

## Changes

- **Commit 7b5f56a:** State parameter set to `all` for milestone fetching (retrieves all milestones including closed)
- **Commit 3d58f50:** Closed milestone end date bounding — end date now calculated as the latest issue close date (or due date if later) instead of extending to today

## Outcome

Burndown charts for completed milestones now display correctly with meaningful time periods.
