---
name: "vscode-dashboard-webviews"
description: "Patterns for building dashboard webviews with tabs and visualizations"
domain: "vscode-extension-ui"
confidence: "high"
source: "manual"
---

## Context
VS Code dashboard webviews require specific patterns for tab navigation, data visualization, and lifecycle management. This skill captures the architecture established for SquadUI's dashboard feature.

## Patterns

### Single Webview with Tab Navigation

Use a single webview panel that hosts multiple tabs rather than separate webviews for related features:

```typescript
export class SquadDashboardWebview {
    private panel: vscode.WebviewPanel | undefined;
    
    constructor(extensionUri: vscode.Uri, dataProvider: DataProvider) {
        this.extensionUri = extensionUri;
        this.dataProvider = dataProvider;
    }
    
    async show(): Promise<void> {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
            await this.updateContent();
        } else {
            this.createPanel();
            await this.updateContent();
        }
    }
}
```

**Why:** Reduces activation cost, natural grouping for related insights, avoids panel proliferation.

### Webview Configuration

```typescript
this.panel = vscode.window.createWebviewPanel(
    'squadui.dashboard',
    'Squad Dashboard',
    vscode.ViewColumn.One,
    {
        enableScripts: true,              // Required for tab navigation JS
        retainContextWhenHidden: true,    // Preserve tab state
        localResourceRoots: [this.extensionUri],
    }
);
```

### Data Pipeline Architecture

Separate concerns: **Service → Builder → Template**

```
OrchestrationLogService + DataProvider
    ↓
DashboardDataBuilder (transforms raw logs → chart data)
    ↓
htmlTemplate.ts (renders HTML with embedded data)
```

**Builder Pattern:**
```typescript
export class DashboardDataBuilder {
    buildDashboardData(
        logEntries: LogEntry[],
        members: Member[],
        tasks: Task[]
    ): DashboardData {
        return {
            velocity: {
                timeline: this.buildVelocityTimeline(tasks),
                heatmap: this.buildActivityHeatmap(members, logEntries),
            },
            activity: { /* ... */ },
            decisions: { /* ... */ },
        };
    }
}
```

### Lightweight Visualization

**Avoid chart libraries.** Use HTML5 Canvas + CSS Grid for simple visualizations:

```javascript
// Line chart with Canvas
function renderVelocityChart() {
    const canvas = document.getElementById('velocity-chart');
    const ctx = canvas.getContext('2d');
    
    // Draw axes
    ctx.strokeStyle = 'var(--vscode-panel-border)';
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, padding + height);
    ctx.stroke();
    
    // Draw line
    ctx.strokeStyle = 'var(--vscode-charts-blue)';
    timeline.forEach((point, i) => {
        const x = padding + i * stepX;
        const y = padding + height - (point.value / maxValue) * height;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
}

// Heatmap with CSS Grid
<div class="heatmap-grid">
    ${heatmap.map(point => `
        <div class="heatmap-cell">
            <div class="member-name">${point.member}</div>
            <div class="activity-bar">
                <div class="activity-fill" style="width: ${point.activityLevel * 100}%"></div>
            </div>
        </div>
    `).join('')}
</div>
```

### Status-Based Visual Styling

**Use color coding and borders** to indicate state at-a-glance:

```css
.task-item.done {
    background-color: rgba(40, 167, 69, 0.15);
    border-left: 3px solid var(--vscode-charts-green);
}
.task-item.in-progress {
    background-color: rgba(255, 193, 7, 0.15);
    border-left: 3px solid var(--vscode-charts-orange);
}
```

```javascript
const isDone = task.endDate !== null;
const statusClass = isDone ? 'done' : 'in-progress';
tasksHtml += `<li class="task-item ${statusClass}">...</li>`;
```

**Color Palette:**
- Green: Done/completed (`var(--vscode-charts-green)`)
- Amber/Orange: In progress (`var(--vscode-charts-orange)`)
- Blue: Charts/data visualization (`var(--vscode-charts-blue)`)

### CSS Tooltips

**Pure CSS tooltips** for hover details (no JS needed):

```css
.task-item .tooltip {
    visibility: hidden;
    position: absolute;
    z-index: 1000;
    bottom: 125%;
    left: 12px;
    min-width: 250px;
    background-color: var(--vscode-editorWidget-background);
    border: 1px solid var(--vscode-editorWidget-border);
    padding: 10px;
    opacity: 0;
    transition: opacity 0.2s;
}
.task-item:hover .tooltip {
    visibility: visible;
    opacity: 1;
}
```

```html
<li class="task-item" title="Task name">
    <span>Task name</span>
    <div class="tooltip">
        <div class="tooltip-title">Task name</div>
        <div class="tooltip-meta">Status: Completed</div>
    </div>
</li>
```

**Why CSS tooltips:** Lighter than JS-based solutions, no postMessage overhead, theme-aware via CSS variables.

### Tab Navigation (Client-Side)

Use vanilla JS for tab switching — no frameworks needed:

```javascript
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        
        // Update buttons
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update content
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(targetTab + '-tab').classList.add('active');
    });
});
```

### Data Embedding

Serialize data as JSON in HTML template:

```typescript
export function getDashboardHtml(data: DashboardData): string {
    const velocityDataJson = JSON.stringify(data.velocity);
    
    return `
    <script>
        const velocityData = ${velocityDataJson};
        renderVelocityChart();
    </script>
    `;
}
```

**Security:** CSP allows `script-src 'unsafe-inline'` for inline scripts. Data is server-controlled, not user input.

### File Structure

```
src/views/
  SquadDashboardWebview.ts      ← Main webview class
  dashboard/                     ← Dashboard-specific logic
    DashboardDataBuilder.ts      ← Data transformation
    htmlTemplate.ts              ← HTML generation
```

### Status Bar Integration

Wire status bar to open dashboard:

```typescript
this.statusBarItem.command = 'squadui.openDashboard';
```

User clicks status bar → dashboard opens → sees visualizations.

## Examples

### Building a Heatmap

```typescript
buildActivityHeatmap(members: Member[], logs: LogEntry[]): HeatmapPoint[] {
    const participationCount = new Map<string, number>();
    let maxParticipation = 0;
    
    for (const entry of logs) {
        for (const participant of entry.participants) {
            const count = (participationCount.get(participant) ?? 0) + 1;
            participationCount.set(participant, count);
            maxParticipation = Math.max(maxParticipation, count);
        }
    }
    
    // Normalize to 0.0-1.0 scale
    return members.map(member => ({
        member: member.name,
        activityLevel: maxParticipation > 0 
            ? (participationCount.get(member.name) ?? 0) / maxParticipation 
            : 0,
    }));
}
```

### Timeline Chart (30 days, fill gaps)

```typescript
buildVelocityTimeline(tasks: Task[]): DataPoint[] {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const tasksByDate = new Map<string, number>();
    for (const task of tasks.filter(t => t.status === 'completed')) {
        const dateKey = task.completedAt.toISOString().split('T')[0];
        tasksByDate.set(dateKey, (tasksByDate.get(dateKey) ?? 0) + 1);
    }
    
    // Fill in missing dates with 0 counts
    const timeline: DataPoint[] = [];
    for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split('T')[0];
        timeline.push({
            date: dateKey,
            completedTasks: tasksByDate.get(dateKey) ?? 0,
        });
    }
    
    return timeline;
}
```

## Anti-Patterns

- **Heavy chart libraries** — Chart.js, D3.js add bundle bloat. Use Canvas + CSS Grid.
- **Multiple webviews for related views** — Consolidate into one tabbed panel.
- **Server-side rendering on every message** — Embed data once, let client-side JS handle interactions.
- **External CSS/JS files** — Inline everything for portability (CSP compliance).
- **Forgetting `retainContextWhenHidden`** — Tabs lose state when user switches away.
- **JavaScript tooltips** — Use pure CSS tooltips. Lighter and theme-aware via CSS variables.
- **Inline HTML attribute styling** — Use CSS classes and VS Code theme variables for consistent theming.
- **Rendering canvas charts on hidden tabs** — Canvas elements inside `display: none` containers return `offsetWidth === 0`. Setting `canvas.width = canvas.offsetWidth` produces a zero-width bitmap. Always defer canvas rendering until the tab is visible. Add `offsetWidth === 0` guards as safety nets.
- **Re-attaching event listeners on re-render** — When a render function is called multiple times (e.g., on tab switch), use a guard (`Set`, flag) to attach listeners only once. Otherwise each call stacks duplicate handlers.
