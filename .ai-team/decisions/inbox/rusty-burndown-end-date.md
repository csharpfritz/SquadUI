# Decision: Burndown Chart End Date for Closed Milestones

**Date:** 2026-02-16
**Author:** Rusty (Extension Dev)
**Status:** Implemented

## Context

The burndown chart for closed/completed milestones appeared empty because the end date was always extended to today. For a milestone completed weeks ago, this compressed the actual burndown curve into a tiny portion of the chart with a long flat zero line afterward.

## Decision

For closed milestones (all issues have a `closedAt` date), the chart end date is the latest issue close date (or `dueDate` if later). For open milestones, behavior is unchanged — end date remains today or due date, whichever is later.

## Rationale

The burndown chart should show the meaningful period of work. Extending completed milestones to today adds no information and makes the chart unreadable.
