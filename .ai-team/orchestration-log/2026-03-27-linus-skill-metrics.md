# Orchestration: Linus — Skill Usage Metrics

**Date:** 2026-03-27T15:42:00Z  
**Agent:** Linus (Backend Dev)  
**Issue:** #74  
**Priority:** P2

## Status: SUCCESS

PR #86 opened. Skills dashboard tab with metrics and charts implemented.

## Work Completed

- `SkillUsageService` computes per-member skill frequencies from orchestration logs
- Skills dashboard tab with three visualizations:
  - Bar chart: skill usage frequency by member
  - Trend chart: skill adoption over time (30-day rolling window)
  - Unused skills list: skills defined in roster but never practiced
- Graceful degradation when no skill data available
- 20 new tests added

## Key Decisions

1. **Frequency from log topic analysis:** Log entries parsed for skill mentions; no new data schema
2. **Per-member breakdown:** Bar chart groups usage by member for team composition visibility
3. **Trend analysis:** 30-day rolling window shows skill adoption velocity
4. **Unused skills flag:** Identifies skills in team.md not yet applied in work

## Test Results

20 new tests added. All tests passing.

## Impact

- Team can now track skill utilization across members
- Unused skills prompt coaching/assignment opportunities
- Trend charts support capacity planning (e.g., ramping new skill adoption)
- Foundation for skill gap analysis and cross-training recommendations
