# Dashboard and Sidebar Activity Enhancements

### 2026-02-15: Dashboard Decisions Null-Safety

**By:** Rusty  
**What:** Fixed TypeError crash in dashboard Decisions tab when DecisionEntry has undefined `content` or `author` fields  
**Why:** The filter function in `renderDecisions()` called `.toLowerCase()` on optional fields without null checks. Added null-coalescing (`(d.content || '')`) to prevent crashes. Also updated card template to show "—" for missing date/author instead of showing undefined.

### 2026-02-15: Recent Activity in Team Sidebar

**By:** Rusty  
**What:** Added collapsible "Recent Activity" section to Team tree view showing last 10 orchestration log entries  
**Why:** Jeff requested "I need to see more of the actions taken in the sidebar panels." The Recent Activity section provides quick access to session logs directly from the sidebar. Each entry is clickable and opens the full log file. Implemented by extending TeamTreeProvider with a section header, using OrchestrationLogService.discoverLogFiles(), and registering squadui.openLogEntry command.

### 2026-02-15: Recent Sessions in Dashboard Activity Tab

**By:** Rusty  
**What:** Added "Recent Sessions" panel below swimlanes in Dashboard Activity tab, displays last 10 log entries with topic, date, participants, and decision/outcome counts  
**Why:** Complements the sidebar Recent Activity feature by providing richer session context in the dashboard. Extended DashboardData.activity interface to include recentLogs array. Each session card is clickable and searches both log directories to open the matching file. Provides at-a-glance view of team activity and decision velocity.
