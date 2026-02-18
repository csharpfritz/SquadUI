# Session: 2026-02-18 Velocity Fix

**Requested by:** Jeffrey T. Fritz

## Summary

Linus fixed the velocity chart to count ALL closed GitHub issues, not just member-matched ones. Basher wrote 5 new tests for the velocity fix. Ralph got a charter file so clicking him in the sidebar works.

## What Was Done

- **Linus:** Modified `buildVelocityTimeline()` to use unfiltered `allClosedIssues` instead of `getClosedIssuesByMember()` map. Per-member Team Overview still uses member-matched data.
- **Basher:** Added 5 new tests to validate velocity fix.
- **Ralph:** Charter file created to enable sidebar navigation.

## Outcome

Velocity chart now accurately reflects all team throughput, including issues without squad labels or matching assignees.
