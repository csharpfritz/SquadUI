# Skill Usage Metrics — Architecture Decision

**Author:** Linus (Backend Dev)  
**Date:** 2026-03-27  
**Issue:** #74  
**PR:** #86

## Context

The team needed visibility into which skills are actively used during orchestration sessions, which are unused, and how usage trends change over time. This required parsing orchestration logs for skill references and presenting the data in the dashboard.

## Decision

### Service Design
- **SkillUsageService** is a pure TypeScript service with no VS Code dependencies, consistent with HealthCheckService and DecisionSearchService patterns.
- Service accepts either pre-fetched `installedSkills` array or discovers skills from the filesystem, keeping it decoupled from SkillCatalogService.

### Skill Detection Strategy
- Multi-strategy regex matching: slug word-boundary, display name, `skill:` prefix, SKILL.md file reference.
- Short slugs/names (< 3 chars) are skipped to avoid false positives.
- Each log entry counts at most once per skill (Set-based deduplication) to prevent inflated counts from repeated mentions.

### Data Model
- `SkillUsageData` contains `metrics` (per-skill frequency + trend), `unusedSkills` (names only), and `totalLogEntries`.
- `skills` field on `DashboardData` is optional (`skills?: SkillUsageData`) for backward compatibility with existing dashboard consumers.

### Dashboard Visualization
- Skills tab includes: summary stats bar, horizontal bar chart (frequency), Canvas line chart (daily trends), unused skills list.
- Canvas charts use `requestAnimationFrame` + `offsetWidth > 0` guard to handle tab visibility transitions, consistent with existing burndown chart pattern.

## Consequences
- Teams can now identify unused skills for retirement or promotion.
- Trend data enables spotting adoption/decline patterns over time.
- Pure service design allows easy unit testing (20 tests) without VS Code mocking.
