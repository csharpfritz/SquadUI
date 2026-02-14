# Dashboard Architecture for Deep Value Features

**Date:** 2026-02-13  
**Author:** Danny (Lead/Architect)  
**Status:** Proposed  
**Context:** Implementing Velocity Dashboard, Activity Timeline, and Decision Browser

## Decision

### Single Unified Webview with Tab Navigation

We'll build a single `SquadDashboardWebview` that hosts three tabs:
1. **Velocity** - Team health metrics and trends
2. **Activity** - Timeline swimlane of work across members
3. **Decisions** - Searchable browser for decisions.md

**Rationale:**
- Consolidates related management views in one place
- Reduces activation cost (single webview lifecycle vs. three)
- Natural grouping: all three features are "insights" on the same underlying data
- VS Code status bar can show shortcut to open dashboard
- Users expect tabbed interfaces for multi-faceted views

### Architecture Components

#### 1. Webview Class: `SquadDashboardWebview.ts`
- Manages panel lifecycle (create, reveal, dispose)
- Passes data from `OrchestrationLogService` and `SquadDataProvider` to HTML
- Handles messages from webview (tab switching, date range filters)
- Supports `enableScripts: true` for interactive charts/filters

#### 2. Data Pipeline
```
OrchestrationLogService + SquadDataProvider
    ↓
SquadDashboardWebview.show(data: DashboardData)
    ↓
HTML/JS renders tabs with:
  - Velocity: CSS grid + HTML5 Canvas charts
  - Activity: CSS grid swimlanes
  - Decisions: Client-side search over decisions.md content
```

#### 3. Command Registration
- `squadui.openDashboard` - Opens/reveals dashboard webview
- Keybinding: `Ctrl+Shift+D` / `Cmd+Shift+D`
- Status bar integration: clickable dashboard icon

### Charting Strategy

**No external chart libraries.** Keep it lightweight:
- **Velocity:** HTML5 Canvas for simple line charts (trends) and heatmap (CSS grid + color scale)
- **Activity:** CSS Grid for swimlane layout, flexbox for task bars
- **Decisions:** Plain HTML with `<input type="search">` + vanilla JS filter

**Why no Chart.js?**
- Extension size matters (bundle bloat)
- Simple visualizations don't need heavy libraries
- Canvas API is sufficient for line charts and bar charts
- CSS Grid handles layout better than chart library wrappers

### File Structure

```
src/
  views/
    SquadDashboardWebview.ts       ← New: Main dashboard webview class
    dashboard/                      ← New: Dashboard-specific utilities
      DashboardDataBuilder.ts       ← Transforms logs → chart data
      htmlTemplate.ts               ← HTML template with tabs + inline JS
```

### Data Model

```typescript
export interface DashboardData {
  velocity: {
    timeline: { date: string; completedTasks: number }[];
    heatmap: { member: string; activityLevel: number }[]; // 0-1 scale
  };
  activity: {
    swimlanes: { member: string; tasks: TimelineTask[] }[];
  };
  decisions: {
    entries: { date: string; title: string; content: string }[];
  };
}

interface TimelineTask {
  id: string;
  title: string;
  startDate: string;
  endDate: string | null; // null = in progress
  status: TaskStatus;
}
```

## Implementation Phases

### Phase 1: Shell + Velocity (This PR)
- Scaffold `SquadDashboardWebview` with tab navigation
- Implement Velocity tab with simple line chart (completed tasks over time)
- Wire up `squadui.openDashboard` command
- Status bar integration: add dashboard icon

### Phase 2: Activity Timeline (Next PR)
- Build swimlane layout with CSS Grid
- Parse log entries into timeline tasks
- Add date range filter (last 7/30/90 days)

### Phase 3: Decision Browser (Final PR)
- Parse decisions.md into searchable entries
- Add client-side search + tag filtering
- Link decisions to related log entries (by date)

## Testing Strategy

- Manual testing: Open dashboard, verify tabs render
- Unit tests for `DashboardDataBuilder` (logs → chart data)
- Integration test: Load sample logs, verify dashboard opens without error

## Impact

This establishes the pattern for all future "insight" features. New dashboard tabs can be added by:
1. Adding a new tab to the HTML template
2. Extending `DashboardData` interface
3. Adding data builder logic in `DashboardDataBuilder`

The single-webview pattern keeps activation cost low while allowing unlimited feature expansion.
