/**
 * HTML template for the Squad Dashboard webview.
 * Includes tab navigation and visualization containers.
 */

import { DashboardData } from '../../models';

export function getDashboardHtml(data: DashboardData): string {
    const velocityDataJson = JSON.stringify(data.velocity);
    const activityDataJson = JSON.stringify(data.activity);
    const decisionDataJson = JSON.stringify(data.decisions);

    return /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
    <title>Squad Dashboard</title>
    <style>
        :root {
            --vscode-font: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
        }
        body {
            font-family: var(--vscode-font);
            padding: 0;
            margin: 0;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }

        /* Tab Navigation */
        .tabs {
            display: flex;
            border-bottom: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-sideBar-background);
            padding: 0 16px;
        }
        .tab {
            padding: 12px 20px;
            cursor: pointer;
            border: none;
            background: none;
            color: var(--vscode-foreground);
            font-size: 13px;
            font-family: var(--vscode-font);
            transition: all 0.2s;
            border-bottom: 2px solid transparent;
        }
        .tab:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .tab.active {
            border-bottom-color: var(--vscode-textLink-foreground);
            color: var(--vscode-textLink-foreground);
        }

        /* Tab Content */
        .tab-content {
            display: none;
            padding: 24px;
        }
        .tab-content.active {
            display: block;
        }

        h2 {
            font-size: 1.5em;
            margin: 0 0 8px 0;
            font-weight: 600;
        }
        p {
            margin: 0 0 24px 0;
            color: var(--vscode-descriptionForeground);
        }

        /* Velocity Tab */
        .velocity-container {
            display: grid;
            grid-template-columns: 1fr;
            gap: 32px;
        }
        .chart-container {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 16px;
        }
        .chart-title {
            font-size: 1.1em;
            font-weight: 600;
            margin-bottom: 16px;
        }
        canvas {
            width: 100%;
            height: 200px;
        }

        /* Heatmap Grid */
        .heatmap-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 12px;
            margin-top: 16px;
        }
        .heatmap-cell {
            padding: 16px;
            border-radius: 4px;
            text-align: center;
            font-size: 0.9em;
            border: 1px solid var(--vscode-panel-border);
        }
        .heatmap-cell .member-name {
            font-weight: 600;
            margin-bottom: 8px;
        }
        .heatmap-cell .activity-bar {
            height: 8px;
            background-color: var(--vscode-progressBar-background);
            border-radius: 4px;
            overflow: hidden;
        }
        .heatmap-cell .activity-fill {
            height: 100%;
            background-color: var(--vscode-charts-green);
            transition: width 0.3s;
        }

        /* Activity Tab */
        .swimlane {
            margin-bottom: 24px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 12px;
            background-color: var(--vscode-editor-background);
        }
        .swimlane-header {
            font-weight: 600;
            margin-bottom: 8px;
            font-size: 1.05em;
        }
        .swimlane-header .role {
            color: var(--vscode-descriptionForeground);
            font-weight: 400;
            font-size: 0.9em;
        }
        .empty-swimlane {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            padding: 8px 0;
        }
        
        /* Task list styling */
        .task-list {
            margin: 0;
            padding-left: 20px;
            list-style: none;
        }
        .task-item {
            margin: 6px 0;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: help;
            transition: background-color 0.2s;
            position: relative;
        }
        .task-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .task-item.done {
            background-color: rgba(40, 167, 69, 0.15);
            border-left: 3px solid var(--vscode-charts-green);
        }
        .task-item.in-progress {
            background-color: rgba(255, 193, 7, 0.15);
            border-left: 3px solid var(--vscode-charts-orange);
        }
        .task-icon {
            display: inline-block;
            width: 20px;
            font-size: 1.1em;
        }
        .task-title {
            font-weight: 500;
        }
        .task-dates {
            color: var(--vscode-descriptionForeground);
            font-size: 0.85em;
            margin-left: 4px;
        }
        .task-item .tooltip {
            visibility: hidden;
            position: absolute;
            z-index: 1000;
            bottom: 125%;
            left: 12px;
            min-width: 250px;
            max-width: 400px;
            background-color: var(--vscode-editorWidget-background);
            color: var(--vscode-editorWidget-foreground);
            border: 1px solid var(--vscode-editorWidget-border);
            padding: 10px;
            border-radius: 4px;
            font-size: 0.9em;
            line-height: 1.4;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            opacity: 0;
            transition: opacity 0.2s;
        }
        .task-item:hover .tooltip {
            visibility: visible;
            opacity: 1;
        }
        .tooltip-title {
            font-weight: 600;
            margin-bottom: 6px;
        }
        .tooltip-meta {
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
        }

        /* Decisions Tab */
        .decision-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
        }
        .search-input {
            padding: 8px 12px;
            width: 300px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-family: var(--vscode-font);
        }
        .search-input:focus {
            outline: 1px solid var(--vscode-focusBorder);
            border-color: var(--vscode-focusBorder);
        }
        .decision-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 16px;
        }
        .decision-card {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 16px;
            cursor: pointer;
            transition: transform 0.15s, box-shadow 0.15s;
            display: flex;
            flex-direction: column;
        }
        .decision-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            border-color: var(--vscode-focusBorder);
        }
        .decision-title {
            font-weight: 600;
            font-size: 1.1em;
            margin-bottom: 8px;
            color: var(--vscode-textLink-foreground);
        }
        .decision-meta {
            font-size: 0.85em;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 12px;
            display: flex;
            gap: 12px;
        }
        .decision-preview {
            font-size: 0.9em;
            color: var(--vscode-foreground);
            opacity: 0.9;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
            line-height: 1.5;
        }
        .decisions-empty {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            text-align: center;
            padding: 40px;
        }
    </style>
</head>
<body>
    <!-- Tab Navigation -->
    <div class="tabs">
        <button class="tab active" data-tab="velocity">Velocity</button>
        <button class="tab" data-tab="activity">Activity</button>
        <button class="tab" data-tab="decisions">Decisions</button>
    </div>

    <!-- Velocity Tab -->
    <div class="tab-content active" id="velocity-tab">
        <h2>Team Velocity & Health</h2>
        <p>Track task completion trends and team activity levels over time.</p>
        
        <div class="velocity-container">
            <div class="chart-container">
                <div class="chart-title">Completed Tasks (Last 30 Days)</div>
                <canvas id="velocity-chart"></canvas>
            </div>

            <div class="chart-container">
                <div class="chart-title">Team Activity (Last 7 Days)</div>
                <div class="heatmap-grid" id="heatmap-grid"></div>
            </div>
        </div>
    </div>

    <!-- Activity Tab -->
    <div class="tab-content" id="activity-tab">
        <h2>Activity Timeline</h2>
        <p>Swimlane view of member tasks and their progress.</p>
        <div id="activity-swimlanes"></div>
    </div>

    <!-- Decisions Tab -->
    <div class="tab-content" id="decisions-tab">
        <div class="decision-header">
            <div>
                <h2>Decision Browser</h2>
                <p>Explore architectural decision records (ADRs) and team agreements.</p>
            </div>
            <input type="text" id="decision-search" class="search-input" placeholder="Search decisions...">
        </div>
        <div id="decision-list" class="decision-list"></div>
    </div>

    <script>
        // Data from backend
        const velocityData = ${velocityDataJson};
        const activityData = ${activityDataJson};
        const decisionData = ${decisionDataJson};

        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;
                
                // Update tab buttons
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Update tab content
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                document.getElementById(targetTab + '-tab').classList.add('active');
            });
        });

        // Render velocity chart (simple line chart with Canvas)
        function renderVelocityChart() {
            const canvas = document.getElementById('velocity-chart');
            const ctx = canvas.getContext('2d');
            const timeline = velocityData.timeline;

            if (!timeline || timeline.length === 0) {
                ctx.fillStyle = 'var(--vscode-descriptionForeground)';
                ctx.font = '14px var(--vscode-font)';
                ctx.fillText('No data available', 20, 100);
                return;
            }

            // Set canvas size
            canvas.width = canvas.offsetWidth;
            canvas.height = 200;

            const padding = 40;
            const width = canvas.width - padding * 2;
            const height = canvas.height - padding * 2;
            const maxValue = Math.max(...timeline.map(d => d.completedTasks), 1);
            const stepX = width / (timeline.length - 1 || 1);

            // Draw axes
            ctx.strokeStyle = 'var(--vscode-panel-border)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padding, padding);
            ctx.lineTo(padding, padding + height);
            ctx.lineTo(padding + width, padding + height);
            ctx.stroke();

            // Draw line
            ctx.strokeStyle = 'var(--vscode-charts-blue)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            timeline.forEach((point, i) => {
                const x = padding + i * stepX;
                const y = padding + height - (point.completedTasks / maxValue) * height;
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            ctx.stroke();

            // Draw points
            ctx.fillStyle = 'var(--vscode-charts-blue)';
            timeline.forEach((point, i) => {
                const x = padding + i * stepX;
                const y = padding + height - (point.completedTasks / maxValue) * height;
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // Render heatmap
        function renderHeatmap() {
            const container = document.getElementById('heatmap-grid');
            const heatmap = velocityData.heatmap;

            if (!heatmap || heatmap.length === 0) {
                container.innerHTML = '<p style="color: var(--vscode-descriptionForeground);">No activity data available</p>';
                return;
            }

            container.innerHTML = '';
            heatmap.forEach(point => {
                const cell = document.createElement('div');
                cell.className = 'heatmap-cell';
                cell.innerHTML = \`
                    <div class="member-name">\${point.member}</div>
                    <div class="activity-bar">
                        <div class="activity-fill" style="width: \${point.activityLevel * 100}%"></div>
                    </div>
                \`;
                container.appendChild(cell);
            });
        }

        // Render activity swimlanes
        function renderActivitySwimlanes() {
            const container = document.getElementById('activity-swimlanes');
            const swimlanes = activityData.swimlanes;

            if (!swimlanes || swimlanes.length === 0) {
                container.innerHTML = '<p style="color: var(--vscode-descriptionForeground);">No activity data available</p>';
                return;
            }

            container.innerHTML = '';
            swimlanes.forEach(lane => {
                const swimlane = document.createElement('div');
                swimlane.className = 'swimlane';
                
                let tasksHtml = '';
                if (lane.tasks.length === 0) {
                    tasksHtml = '<div class="empty-swimlane">No tasks</div>';
                } else {
                    tasksHtml = '<ul class="task-list">';
                    lane.tasks.forEach(task => {
                        const isDone = task.endDate !== null && task.endDate !== undefined;
                        const statusClass = isDone ? 'done' : 'in-progress';
                        const icon = isDone ? '✅' : '🔄';
                        const dateRange = isDone
                            ? \`\${task.startDate} → \${task.endDate}\`
                            : \`\${task.startDate} → ongoing\`;
                        
                        // Escape HTML for tooltip content
                        const escapedTitle = task.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        const statusText = isDone ? 'Completed' : 'In Progress';
                        
                        tasksHtml += \`
                            <li class="task-item \${statusClass}" title="\${escapedTitle}">
                                <span class="task-icon">\${icon}</span>
                                <span class="task-title">\${escapedTitle}</span>
                                <span class="task-dates">(\${dateRange})</span>
                                <div class="tooltip">
                                    <div class="tooltip-title">\${escapedTitle}</div>
                                    <div class="tooltip-meta">Status: \${statusText}</div>
                                    <div class="tooltip-meta">Duration: \${dateRange}</div>
                                </div>
                            </li>
                        \`;
                    });
                    tasksHtml += '</ul>';
                }

                swimlane.innerHTML = \`
                    <div class="swimlane-header">
                        \${lane.member} <span class="role">· \${lane.role}</span>
                    </div>
                    \${tasksHtml}
                \`;
                container.appendChild(swimlane);
            });
        }

        // Initialize visualizations
        renderVelocityChart();
        renderHeatmap();
        renderActivitySwimlanes();
        renderDecisions();

        // Render decisions
        function renderDecisions(filter = '') {
            const container = document.getElementById('decision-list');
            const entries = decisionData.entries;
            
            const lowerFilter = filter.toLowerCase();
            const filtered = entries.filter(d => 
                d.title.toLowerCase().includes(lowerFilter) || 
                d.content.toLowerCase().includes(lowerFilter) ||
                d.author.toLowerCase().includes(lowerFilter)
            );
            
            if (filtered.length === 0) {
                container.innerHTML = '<div class="decisions-empty">No matching decisions found</div>';
                container.style.display = 'block'; // Ensure it takes full width
                return;
            }
            
            container.style.display = 'grid'; // Restore grid
            container.innerHTML = filtered.map(d => {
                // Simple markdown strip (very basic)
                const plainContent = d.content
                    .replace(/#+\s/g, '')
                    .replace(/[*_\`]/g, '')
                    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

                return \`
                    <div class="decision-card" title="View \${d.title}">
                        <div class="decision-title">\${escapeHtml(d.title)}</div>
                        <div class="decision-meta">
                            <span>📅 \${d.date}</span>
                            <span>👤 \${escapeHtml(d.author)}</span>
                        </div>
                        <div class="decision-preview">
                            \${escapeHtml(plainContent)}
                        </div>
                    </div>
                \`;
            }).join('');
        }

        // Search handler
        document.getElementById('decision-search').addEventListener('input', (e) => {
            renderDecisions(e.target.value);
        });

        // Helper to escape HTML
        function escapeHtml(text) {
            return text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }
    </script>
</body>
</html>
    `.trim();
}
