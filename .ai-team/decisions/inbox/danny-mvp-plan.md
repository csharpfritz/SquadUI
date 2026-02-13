# MVP Plan: v0.1.0

> Created by Danny (Lead) on 2026-02-13

## Overview

The v0.1.0 MVP delivers a functional VS Code extension that visualizes Squad team members and their tasks from orchestration logs.

## Issue Summary

| # | Title | Assignee | Size | Depends On |
|---|-------|----------|------|------------|
| #1 | Scaffold VS Code extension project | @copilot | S | — |
| #2 | Define data models for squad members and tasks | Linus | S | #1 |
| #3 | Implement orchestration log parser service | Linus | M | #2 |
| #6 | Create SquadDataProvider service | Linus | M | #3 |
| #4 | Implement file watcher for orchestration logs | Linus | S | #6 |
| #13 | Create sample orchestration log fixtures | @copilot | S | #1 |
| #11 | Implement SquadTreeProvider for tree view | Rusty | M | #6 |
| #7 | Create webview panel for work details | Rusty | M | #6 |
| #9 | Register commands and wire up interactions | Rusty | S | #11, #7 |
| #12 | Write integration tests for data layer | Basher | M | #4 |
| #10 | Write tests for extension components | Basher | M | #9 |
| #14 | End-to-end MVP validation | Basher | S | All |

## Dependency Graph

```
#1 Scaffold
├── #2 Data Models (Linus)
│   └── #3 Log Parser (Linus)
│       └── #6 Data Provider (Linus)
│           ├── #4 File Watcher (Linus)
│           │   └── #12 Data Tests (Basher)
│           ├── #11 Tree Provider (Rusty)
│           │   └── #9 Commands (Rusty)
│           │       └── #10 Extension Tests (Basher)
│           └── #7 Webview (Rusty)
│               └── #9 Commands (Rusty)
└── #13 Sample Fixtures (@copilot)

#14 E2E Validation (Basher) — depends on all
```

## Work Breakdown by Agent

### @copilot (2 issues)
- #1: Scaffold VS Code extension project (S) — **START HERE**
- #13: Create sample orchestration log fixtures (S)

### Linus (4 issues)
- #2: Define data models (S)
- #3: Implement orchestration log parser (M)
- #6: Create SquadDataProvider service (M)
- #4: Implement file watcher (S)

### Rusty (3 issues)
- #11: Implement SquadTreeProvider (M)
- #7: Create webview panel (M)
- #9: Register commands and wire up (S)

### Basher (3 issues)
- #12: Write integration tests for data layer (M)
- #10: Write tests for extension components (M)
- #14: End-to-end MVP validation (S)

## Execution Order

**Phase 1: Foundation** (parallel start)
- #1 @copilot: Scaffold extension
- #13 @copilot: Create sample fixtures

**Phase 2: Data Layer** (sequential)
- #2 Linus: Data models
- #3 Linus: Log parser
- #6 Linus: Data provider
- #4 Linus: File watcher

**Phase 3: UI Layer** (after #6, parallel)
- #11 Rusty: Tree provider
- #7 Rusty: Webview

**Phase 4: Integration**
- #9 Rusty: Commands and wiring

**Phase 5: Testing** (parallel after respective deps)
- #12 Basher: Data layer tests
- #10 Basher: Extension tests

**Phase 6: Validation**
- #14 Basher: E2E validation

## Sizing Summary

- Small (S): 6 issues
- Medium (M): 6 issues
- **Total: 12 issues**

## Notes

- Issue numbers #5 and #8 were skipped due to GitHub API timing
- All issues assigned to v0.1.0 milestone
- Squad labels applied for routing
