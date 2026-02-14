# Dashboard Implementation Plan

**Phase 1: Foundation (COMPLETED)**
- ✅ Architecture decision documented (`danny-dashboard-arch.md`)
- ✅ Data models created (`DashboardData` interface and related types)
- ✅ `DashboardDataBuilder` service implemented
- ✅ `SquadDashboardWebview` class scaffolded
- ✅ HTML template with tab navigation (Velocity + Activity + placeholder for Decisions)
- ✅ Command registered: `squadui.openDashboard` (Ctrl+Shift+D / Cmd+Shift+D)
- ✅ Status bar integration (click to open dashboard)
- ✅ Velocity chart: Line chart (completed tasks over 30 days)
- ✅ Heatmap: Team activity levels (last 7 days)
- ✅ Activity timeline: Swimlane view of member tasks
- ✅ Compilation and linting pass

**Phase 2: Activity Timeline Enhancements (Next)**
- Add date range filter (7/30/90 days selector)
- Improve swimlane visual design (color-coded by status)
- Add task tooltips with full descriptions
- Add "zoom to date range" interaction

**Phase 3: Decision Browser (Future)**
- Parse `.ai-team/decisions.md` into `DecisionEntry[]`
- Implement client-side search (filter by title, author, content)
- Add tag filtering if decisions have tags
- Link decisions to related log entries by date

**Phase 4: Polish & Release**
- Add loading states for async data
- Add error handling for missing data
- Add refresh button to reload dashboard data
- Document keyboard shortcuts in README
- Update CHANGELOG
- Bump version to 0.4.0

## For Rusty (Extension Dev)

The foundation is complete and compiles cleanly. Here's what you can extend:

### Adding a New Chart/Visualization
1. Add data type to `models/index.ts` (e.g., `BurndownPoint`)
2. Add builder method in `DashboardDataBuilder.ts`
3. Extend `DashboardData` interface to include new data
4. Add HTML container in `htmlTemplate.ts`
5. Add render function in `<script>` block

### Testing the Dashboard
1. Open a workspace with `.ai-team/log/` entries
2. Press `Ctrl+Shift+D` (or click status bar)
3. Verify tabs switch correctly
4. Verify charts render with real data

### Common Issues
- **Empty charts:** Check that log files exist in `.ai-team/log/` or `.ai-team/orchestration-log/`
- **Data not updating:** Call `dataProvider.refresh()` before opening dashboard
- **Canvas sizing:** Set `canvas.width = canvas.offsetWidth` before drawing

## Notes

- All dashboard code is in `src/views/dashboard/` for maintainability
- No external dependencies added (kept bundle lean)
- Follow established pattern for future tabs
- Dashboard webview persists state when hidden (`retainContextWhenHidden: true`)
