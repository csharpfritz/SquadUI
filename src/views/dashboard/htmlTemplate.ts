/**
 * HTML template for the Squad Dashboard webview.
 * Includes tab navigation and visualization containers.
 */

import { DashboardData } from '../../models';

export function getDashboardHtml(data: DashboardData): string {
    const teamDataJson = JSON.stringify(data.team);
    const burndownDataJson = JSON.stringify(data.burndown);
    const velocityDataJson = JSON.stringify(data.velocity);
    const activityDataJson = JSON.stringify(data.activity);
    const decisionDataJson = JSON.stringify(data.decisions);
    const skillsDataJson = JSON.stringify(data.skills ?? { metrics: [], unusedSkills: [], totalLogsScanned: 0 });

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
        .tab.standup-btn {
            margin-left: auto;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-radius: 4px;
            padding: 6px 14px;
            font-size: 12px;
            margin-top: 4px;
            margin-bottom: 4px;
        }
        .tab.standup-btn:hover {
            opacity: 0.9;
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
            height: 250px;
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
            cursor: pointer;
            text-decoration: underline;
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
        .swimlane-header .member-link {
            cursor: pointer;
            text-decoration: underline;
        }
        .swimlane-header .member-link:hover {
            color: var(--vscode-textLink-foreground);
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
            cursor: pointer;
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

        /* Team Tab */
        .team-summary {
            display: flex;
            gap: 16px;
            margin-bottom: 24px;
            flex-wrap: wrap;
        }
        .summary-card {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 16px 24px;
            text-align: center;
            min-width: 120px;
        }
        .summary-card .value {
            font-size: 2em;
            font-weight: 700;
            display: block;
            margin-bottom: 4px;
        }
        .summary-card .label {
            font-size: 0.85em;
            color: var(--vscode-descriptionForeground);
        }
        .member-cards {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
            gap: 16px;
        }
        .member-card {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 16px;
            transition: transform 0.15s, box-shadow 0.15s;
        }
        .member-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            border-color: var(--vscode-focusBorder);
        }
        .member-card-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        }
        .member-avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            flex-shrink: 0;
        }
        .member-card-name {
            font-weight: 600;
            font-size: 1.05em;
            cursor: pointer;
            text-decoration: underline;
        }
        .member-card-name:hover {
            color: var(--vscode-textLink-foreground);
        }
        .member-card-role {
            font-size: 0.85em;
            color: var(--vscode-descriptionForeground);
        }
        .member-card-status {
            font-size: 0.8em;
            margin-top: 4px;
            padding: 2px 6px;
            border-radius: 3px;
            display: inline-block;
        }
        .member-card-status.active {
            background-color: var(--vscode-inputValidation-infoBackground, #063b49);
            color: var(--vscode-inputValidation-infoForeground, #3794ff);
        }
        .member-card-status.idle {
            color: var(--vscode-descriptionForeground);
        }
        .member-card-stats {
            display: flex;
            gap: 12px;
            font-size: 0.85em;
            margin-top: 8px;
            flex-wrap: wrap;
        }
        .member-stat {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        /* Member Drill-down Panel */
        .member-card.expanded {
            grid-column: 1 / -1;
        }
        .member-card .drilldown-toggle {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-top: 8px;
            padding: 4px;
            cursor: pointer;
            color: var(--vscode-descriptionForeground);
            font-size: 0.8em;
            transition: color 0.2s;
        }
        .member-card .drilldown-toggle:hover {
            color: var(--vscode-textLink-foreground);
        }
        .member-drilldown {
            display: none;
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid var(--vscode-panel-border);
        }
        .member-card.expanded .member-drilldown {
            display: block;
        }
        .drilldown-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }
        .drilldown-section {
            background-color: var(--vscode-sideBar-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 12px;
        }
        .drilldown-section h4 {
            margin: 0 0 8px 0;
            font-size: 0.9em;
            font-weight: 600;
        }
        .drilldown-list {
            list-style: none;
            padding: 0;
            margin: 0;
            max-height: 180px;
            overflow-y: auto;
        }
        .drilldown-list li {
            padding: 4px 0;
            font-size: 0.85em;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .drilldown-list li:last-child {
            border-bottom: none;
        }
        .drilldown-empty {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            font-size: 0.85em;
        }
        .skill-bar-mini {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;
            font-size: 0.85em;
        }
        .skill-bar-mini .bar {
            flex: 1;
            height: 6px;
            background-color: var(--vscode-panel-border);
            border-radius: 3px;
            overflow: hidden;
        }
        .skill-bar-mini .bar-fill {
            height: 100%;
            background-color: var(--vscode-progressBar-background);
            border-radius: 3px;
        }
        .skill-bar-mini .bar-label {
            min-width: 80px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .skill-bar-mini .bar-count {
            min-width: 20px;
            text-align: right;
            color: var(--vscode-descriptionForeground);
        }
        .activity-entry {
            display: flex;
            gap: 8px;
            font-size: 0.85em;
            padding: 4px 0;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .activity-entry:last-child {
            border-bottom: none;
        }
        .activity-date {
            color: var(--vscode-descriptionForeground);
            white-space: nowrap;
            min-width: 80px;
        }
        .activity-topic {
            font-weight: 500;
        }
        .blocker-item {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .blocker-icon {
            color: var(--vscode-charts-red, #f44747);
        }

        /* Burndown Tab */
        .burndown-container {
            display: flex;
            flex-direction: column;
            gap: 32px;
        }
        .burndown-chart-wrapper {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 16px;
        }
        .burndown-title {
            font-size: 1.2em;
            font-weight: 600;
            margin-bottom: 4px;
        }
        .burndown-subtitle {
            font-size: 0.85em;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 16px;
        }
        .burndown-legend {
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
            margin-top: 12px;
        }
        .legend-item {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.85em;
        }
        .legend-swatch {
            width: 14px;
            height: 14px;
            border-radius: 3px;
        }
        .milestone-selector {
            padding: 6px 12px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-family: var(--vscode-font);
            font-size: 13px;
        }
        .burndown-empty {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            text-align: center;
            padding: 40px;
        }

        /* Skills Tab */
        .skills-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        @media (max-width: 700px) { .skills-grid { grid-template-columns: 1fr; } }
        .skill-bar-container { margin-bottom: 10px; }
        .skill-bar-label { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-size: 0.9em; }
        .skill-bar-name { font-weight: 600; }
        .skill-bar-count { color: var(--vscode-descriptionForeground); font-size: 0.85em; }
        .skill-bar-track { height: 20px; background-color: var(--vscode-input-background); border-radius: 4px; overflow: hidden; }
        .skill-bar-fill { height: 100%; background-color: var(--vscode-charts-blue, #3794ff); border-radius: 4px; transition: width 0.4s ease; min-width: 2px; }
        .skill-bar-fill.unused { background-color: var(--vscode-charts-red, #f44747); min-width: 0; }
        .unused-skill-list { list-style: none; padding: 0; margin: 8px 0 0 0; }
        .unused-skill-list li { padding: 8px 12px; margin-bottom: 4px; border-radius: 4px; background-color: var(--vscode-input-background); border-left: 3px solid var(--vscode-charts-orange, #d18616); font-size: 0.9em; }
        .skills-empty { color: var(--vscode-descriptionForeground); font-style: italic; text-align: center; padding: 40px; }
        .skills-summary { display: flex; gap: 24px; margin-bottom: 20px; }
        .skills-stat { background-color: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 4px; padding: 12px 20px; text-align: center; }
        .skills-stat .value { font-size: 1.6em; font-weight: 700; display: block; }
        .skills-stat .label { font-size: 0.8em; color: var(--vscode-descriptionForeground); }
    </style>
</head>
<body>
    <!-- Tab Navigation -->
    <div class="tabs">
        <button class="tab active" data-tab="team">Team</button>
        <button class="tab" data-tab="burndown">Burndown</button>
        <button class="tab" data-tab="velocity">Velocity</button>
        <button class="tab" data-tab="activity">Activity</button>
        <button class="tab" data-tab="decisions">Decisions</button>
        <button class="tab" data-tab="skills">Skills</button>
        <button class="tab standup-btn" id="open-standup-btn" title="Generate Standup Report">📊 Standup</button>
    </div>

    <!-- Team Tab -->
    <div class="tab-content active" id="team-tab">
        <h2>Team Overview</h2>
        <p>Your squad at a glance — members, workload, and activity.</p>
        <div class="team-summary" id="team-summary"></div>
        <div class="member-cards" id="member-cards"></div>
    </div>

    <!-- Burndown Tab -->
    <div class="tab-content" id="burndown-tab">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div>
                <h2>Milestone Burndown</h2>
                <p>Track remaining work over time, colored by team member.</p>
            </div>
            <select id="milestone-selector" class="milestone-selector"></select>
        </div>
        <div id="burndown-container" class="burndown-container"></div>
    </div>

    <!-- Velocity Tab -->
    <div class="tab-content" id="velocity-tab">
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
        
        <div class="chart-container" style="margin-top: 24px;">
            <div class="chart-title">Recent Sessions</div>
            <div id="recent-sessions"></div>
        </div>
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

    <!-- Skills Tab -->
    <div class="tab-content" id="skills-tab">
        <h2>Skill Usage</h2>
        <p>Track which skills are referenced in orchestration logs and identify gaps.</p>
        <div class="skills-summary" id="skills-summary"></div>
        <div class="skills-grid">
            <div class="chart-container">
                <div class="chart-title">Skill Reference Frequency</div>
                <div id="skill-bars"></div>
            </div>
            <div class="chart-container">
                <div class="chart-title">Skill Usage Trend</div>
                <canvas id="skill-trend-chart"></canvas>
            </div>
        </div>
        <div class="chart-container" style="margin-top: 24px;" id="unused-skills-section">
            <div class="chart-title">⚠️ Unused Skills</div>
            <p style="margin: 0 0 8px 0; color: var(--vscode-descriptionForeground); font-size: 0.85em;">Installed skills with zero references in orchestration logs.</p>
            <ul class="unused-skill-list" id="unused-skill-list"></ul>
        </div>
    </div>

    <script>
        // VS Code webview API
        const vscode = acquireVsCodeApi();

        // Data from backend
        const teamData = ${teamDataJson};
        const burndownData = ${burndownDataJson};
        const velocityData = ${velocityDataJson};
        const activityData = ${activityDataJson};
        const decisionData = ${decisionDataJson};
        const skillsData = ${skillsDataJson};

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

                // Render canvas charts when their tab becomes visible
                // (canvas needs non-zero offsetWidth to render correctly)
                if (targetTab === 'burndown') {
                    requestAnimationFrame(() => renderBurndownChart());
                } else if (targetTab === 'velocity') {
                    requestAnimationFrame(() => renderVelocityChart());
                } else if (targetTab === 'skills') {
                    requestAnimationFrame(() => renderSkillTrendChart());
                }
            });
        });

        // Resolve CSS variable to actual color for canvas usage
        function resolveColor(varName, fallback) {
            const resolved = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
            return resolved || fallback;
        }

        // ─── Team Overview ──────────────────────────────────────────────

        function renderTeamOverview() {
            const summaryEl = document.getElementById('team-summary');
            const cardsEl = document.getElementById('member-cards');
            const summary = teamData.summary;
            const members = teamData.members;

            // Summary cards
            summaryEl.innerHTML = \`
                <div class="summary-card">
                    <span class="value">\${summary.totalMembers}</span>
                    <span class="label">Members</span>
                </div>
                <div class="summary-card">
                    <span class="value" style="color: var(--vscode-charts-green);">\${summary.activeMembers}</span>
                    <span class="label">Working</span>
                </div>
                <div class="summary-card">
                    <span class="value" style="color: var(--vscode-charts-blue);">\${summary.totalOpenIssues}</span>
                    <span class="label">Open Issues</span>
                </div>
                <div class="summary-card">
                    <span class="value" style="color: var(--vscode-charts-purple);">\${summary.totalClosedIssues}</span>
                    <span class="label">Closed</span>
                </div>
                <div class="summary-card">
                    <span class="value" style="color: var(--vscode-charts-orange);">\${summary.totalActiveTasks}</span>
                    <span class="label">In Progress</span>
                </div>
            \`;

            // Member cards
            if (members.length === 0) {
                cardsEl.innerHTML = '<div class="decisions-empty">No team members found.<br>Initialize a squad with <code>Squad: Initialize</code>.</div>';
                return;
            }

            cardsEl.innerHTML = members.map((m, idx) => {
                const icon = m.iconType === 'scribe' ? '✏️'
                    : m.iconType === 'ralph' ? '👁️'
                    : m.iconType === 'copilot' ? '🤖'
                    : '👤';
                const displayName = stripMarkdownLinks(m.name);
                const hasActivity = m.activityContext && m.activityContext.shortLabel;
                const statusHtml = hasActivity
                    ? \`<div class="member-card-status active" title="\${escapeHtml(m.activityContext.description)}">\${escapeHtml(m.activityContext.shortLabel)}</div>\`
                    : \`<div class="member-card-status idle">—</div>\`;

                const dd = m.drilldown;

                return \`
                    <div class="member-card" id="member-card-\${idx}">
                        <div class="member-card-header">
                            <div class="member-avatar">\${icon}</div>
                            <div>
                                <div class="member-card-name" data-action="open-member" data-member-name="\${escapeHtml(displayName)}">\${escapeHtml(displayName)}</div>
                                <div class="member-card-role">\${escapeHtml(m.role)}</div>
                                \${statusHtml}
                            </div>
                        </div>
                        <div class="member-card-stats">
                            <span class="member-stat">📋 \${m.openIssueCount} open</span>
                            <span class="member-stat">✅ \${m.closedIssueCount} closed</span>
                            <span class="member-stat">🔄 \${m.activeTaskCount} in progress</span>
                            <span class="member-stat">📊 \${m.recentActivityCount} sessions</span>
                        </div>
                        <div class="drilldown-toggle" data-action="toggle-drilldown" data-card-id="member-card-\${idx}">
                            ▼ Details
                        </div>
                        \${dd ? renderDrilldown(dd) : ''}
                    </div>
                \`;
            }).join('');
        }

        function renderDrilldown(dd) {
            const completedHtml = dd.completedTasks.length > 0
                ? \`<ul class="drilldown-list">\${dd.completedTasks.map(t =>
                    \`<li>✅ <strong>\${escapeHtml(t.id)}</strong> \${escapeHtml(t.title)}\${t.completedDate ? \` <span style="color:var(--vscode-descriptionForeground);">(\${escapeHtml(t.completedDate.substring(0, 10))})</span>\` : ''}</li>\`
                ).join('')}</ul>\`
                : '<div class="drilldown-empty">No completed tasks yet</div>';

            const blockersHtml = dd.blockers.length > 0
                ? \`<ul class="drilldown-list">\${dd.blockers.map(b =>
                    \`<li class="blocker-item"><span class="blocker-icon">🚫</span> <strong>\${escapeHtml(b.id)}</strong> \${escapeHtml(b.title)}</li>\`
                ).join('')}</ul>\`
                : '<div class="drilldown-empty">No blockers — all clear! 🎉</div>';

            const maxSkillCount = dd.skillUsage.length > 0 ? dd.skillUsage[0].count : 1;
            const skillsHtml = dd.skillUsage.length > 0
                ? dd.skillUsage.map(s =>
                    \`<div class="skill-bar-mini">
                        <span class="bar-label">\${escapeHtml(s.name)}</span>
                        <div class="bar"><div class="bar-fill" style="width: \${Math.round((s.count / maxSkillCount) * 100)}%"></div></div>
                        <span class="bar-count">\${s.count}</span>
                    </div>\`
                ).join('')
                : '<div class="drilldown-empty">No skill data available</div>';

            const activityHtml = dd.recentActivity.length > 0
                ? dd.recentActivity.map(a =>
                    \`<div class="activity-entry">
                        <span class="activity-date">\${escapeHtml(a.date)}</span>
                        <span class="activity-topic">\${escapeHtml(a.topic)}</span>
                    </div>\`
                ).join('')
                : '<div class="drilldown-empty">No recent activity</div>';

            return \`
                <div class="member-drilldown">
                    <div class="drilldown-grid">
                        <div class="drilldown-section">
                            <h4>✅ Completed Tasks (\${dd.completedTasks.length})</h4>
                            \${completedHtml}
                        </div>
                        <div class="drilldown-section">
                            <h4>🚫 Blockers (\${dd.blockers.length})</h4>
                            \${blockersHtml}
                        </div>
                        <div class="drilldown-section">
                            <h4>📈 Topic Frequency</h4>
                            \${skillsHtml}
                        </div>
                        <div class="drilldown-section">
                            <h4>📋 Recent Activity</h4>
                            \${activityHtml}
                        </div>
                    </div>
                </div>
            \`;
        }

        // ─── Burndown Chart ─────────────────────────────────────────────

        let currentMilestoneIndex = 0;

        function renderBurndownChart() {
            const container = document.getElementById('burndown-container');
            const selector = document.getElementById('milestone-selector');
            const milestones = burndownData.milestones;

            if (!milestones || milestones.length === 0) {
                container.innerHTML = '<div class="burndown-empty">No milestone data available.<br><br>Assign issues to a GitHub milestone to see burndown charts.</div>';
                selector.style.display = 'none';
                return;
            }

            // Populate milestone selector
            selector.innerHTML = milestones.map((ms, i) =>
                \`<option value="\${i}" \${i === currentMilestoneIndex ? 'selected' : ''}>\${escapeHtml(ms.title)} (\${ms.totalIssues} issues)</option>\`
            ).join('');
            selector.style.display = 'block';

            // Only attach the change listener once to prevent duplicates
            if (!renderedTabs.has('burndown')) {
                renderedTabs.add('burndown');
                selector.addEventListener('change', (e) => {
                    currentMilestoneIndex = parseInt(e.target.value, 10);
                    drawBurndown(milestones[currentMilestoneIndex], container);
                });
            }

            drawBurndown(milestones[currentMilestoneIndex], container);
        }

        function drawBurndown(milestone, container) {
            const dp = milestone.dataPoints;
            if (!dp || dp.length === 0) {
                container.innerHTML = '<div class="burndown-empty">No data points for this milestone.</div>';
                return;
            }

            // Build legend
            const legendHtml = milestone.memberNames.map((name, i) => \`
                <div class="legend-item">
                    <div class="legend-swatch" style="background-color: \${milestone.memberColors[i]};"></div>
                    <span>\${escapeHtml(name)}</span>
                </div>
            \`).join('');

            const dueInfo = milestone.dueDate ? \`Due: \${milestone.dueDate}\` : '';

            container.innerHTML = \`
                <div class="burndown-chart-wrapper">
                    <div class="burndown-title">\${escapeHtml(milestone.title)}</div>
                    <div class="burndown-subtitle">\${milestone.totalIssues} total issues \${dueInfo ? '· ' + dueInfo : ''}</div>
                    <canvas id="burndown-canvas" style="width:100%; height:350px;"></canvas>
                    <div class="burndown-legend">\${legendHtml}</div>
                </div>
            \`;

            // Draw the stacked area chart
            requestAnimationFrame(() => drawBurndownCanvas(milestone));
        }

        function drawBurndownCanvas(milestone) {
            const canvas = document.getElementById('burndown-canvas');
            if (!canvas) return;
            // Skip rendering if canvas is not visible (zero width on hidden tabs)
            if (canvas.offsetWidth === 0) return;
            const ctx = canvas.getContext('2d');
            const dp = milestone.dataPoints;
            const members = milestone.memberNames;
            const colors = milestone.memberColors;

            canvas.width = canvas.offsetWidth;
            canvas.height = 350;

            const paddingLeft = 55;
            const paddingRight = 20;
            const paddingTop = 20;
            const paddingBottom = 50;
            const w = canvas.width - paddingLeft - paddingRight;
            const h = canvas.height - paddingTop - paddingBottom;

            const maxVal = Math.max(milestone.totalIssues, 1);
            const stepX = w / (dp.length - 1 || 1);

            const axisColor = resolveColor('--vscode-panel-border', '#444');
            const labelColor = resolveColor('--vscode-foreground', '#ccc');

            // Draw axes
            ctx.strokeStyle = axisColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(paddingLeft, paddingTop);
            ctx.lineTo(paddingLeft, paddingTop + h);
            ctx.lineTo(paddingLeft + w, paddingTop + h);
            ctx.stroke();

            // Y-axis labels
            ctx.fillStyle = labelColor;
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            const ySteps = [0, Math.round(maxVal / 4), Math.round(maxVal / 2), Math.round(3 * maxVal / 4), maxVal];
            ySteps.forEach(val => {
                const y = paddingTop + h - (val / maxVal) * h;
                ctx.fillText(String(val), paddingLeft - 8, y);
                if (val > 0) {
                    ctx.strokeStyle = axisColor;
                    ctx.globalAlpha = 0.2;
                    ctx.beginPath();
                    ctx.moveTo(paddingLeft, y);
                    ctx.lineTo(paddingLeft + w, y);
                    ctx.stroke();
                    ctx.globalAlpha = 1.0;
                }
            });

            // X-axis date labels
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            const xLabelCount = Math.min(8, dp.length);
            const xStep = Math.max(1, Math.floor((dp.length - 1) / (xLabelCount - 1)));
            for (let i = 0; i < dp.length; i += xStep) {
                const x = paddingLeft + i * stepX;
                const parts = dp[i].date.split('-');
                ctx.fillText(parts[1] + '/' + parts[2], x, paddingTop + h + 8);
            }
            // Last date
            if ((dp.length - 1) % xStep !== 0) {
                const lastX = paddingLeft + (dp.length - 1) * stepX;
                const parts = dp[dp.length - 1].date.split('-');
                ctx.fillText(parts[1] + '/' + parts[2], lastX, paddingTop + h + 8);
            }

            // Draw ideal burndown line (straight line from total to 0)
            ctx.strokeStyle = labelColor;
            ctx.globalAlpha = 0.3;
            ctx.setLineDash([6, 4]);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(paddingLeft, paddingTop + h - (maxVal / maxVal) * h);
            ctx.lineTo(paddingLeft + w, paddingTop + h);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1.0;

            // Draw stacked areas (bottom-up: each member's area stacks on top of previous)
            // We need to compute cumulative values for stacking
            for (let mi = members.length - 1; mi >= 0; mi--) {
                ctx.beginPath();
                ctx.globalAlpha = 0.5;

                // Top edge: cumulative sum up to this member
                for (let di = 0; di < dp.length; di++) {
                    let cumulative = 0;
                    for (let k = 0; k <= mi; k++) {
                        cumulative += (dp[di].byMember[members[k]] || 0);
                    }
                    const x = paddingLeft + di * stepX;
                    const y = paddingTop + h - (cumulative / maxVal) * h;
                    if (di === 0) { ctx.moveTo(x, y); }
                    else { ctx.lineTo(x, y); }
                }

                // Bottom edge: cumulative sum up to previous member (or baseline)
                for (let di = dp.length - 1; di >= 0; di--) {
                    let cumulative = 0;
                    for (let k = 0; k < mi; k++) {
                        cumulative += (dp[di].byMember[members[k]] || 0);
                    }
                    const x = paddingLeft + di * stepX;
                    const y = paddingTop + h - (cumulative / maxVal) * h;
                    ctx.lineTo(x, y);
                }

                ctx.closePath();
                ctx.fillStyle = colors[mi];
                ctx.fill();
                ctx.globalAlpha = 1.0;
            }

            // Draw total remaining line on top
            ctx.strokeStyle = resolveColor('--vscode-foreground', '#ccc');
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let di = 0; di < dp.length; di++) {
                const x = paddingLeft + di * stepX;
                const y = paddingTop + h - (dp[di].remaining / maxVal) * h;
                if (di === 0) { ctx.moveTo(x, y); }
                else { ctx.lineTo(x, y); }
            }
            ctx.stroke();

            // Draw due date marker if present
            if (milestone.dueDate && dp.length > 1) {
                const dueDateStr = milestone.dueDate.split('T')[0];
                const dueIndex = dp.findIndex(d => d.date >= dueDateStr);
                if (dueIndex >= 0) {
                    const dueX = paddingLeft + dueIndex * stepX;
                    ctx.strokeStyle = resolveColor('--vscode-charts-red', '#f44747');
                    ctx.lineWidth = 2;
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath();
                    ctx.moveTo(dueX, paddingTop);
                    ctx.lineTo(dueX, paddingTop + h);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    ctx.fillStyle = resolveColor('--vscode-charts-red', '#f44747');
                    ctx.font = '11px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('Due', dueX, paddingTop - 5);
                }
            }
        }

        // Render velocity chart (simple line chart with Canvas)
        function renderVelocityChart() {
            const canvas = document.getElementById('velocity-chart');
            // Skip rendering if canvas is not visible (zero width on hidden tabs)
            if (!canvas || canvas.offsetWidth === 0) return;
            const ctx = canvas.getContext('2d');
            const timeline = velocityData.timeline;

            // Resolve theme colors for canvas drawing
            const lineColor = resolveColor('--vscode-charts-blue', '#3794ff');
            const axisColor = resolveColor('--vscode-panel-border', '#444');
            const labelColor = resolveColor('--vscode-foreground', '#ccc');
            const mutedColor = resolveColor('--vscode-descriptionForeground', '#999');

            if (!timeline || timeline.length === 0) {
                canvas.width = canvas.offsetWidth;
                canvas.height = 250;
                ctx.fillStyle = mutedColor;
                ctx.font = '14px sans-serif';
                ctx.fillText('No data available', 20, 100);
                return;
            }

            // Check if all values are zero — show helpful empty state
            const hasData = timeline.some(d => d.completedTasks > 0);
            if (!hasData) {
                canvas.width = canvas.offsetWidth;
                canvas.height = 250;
                ctx.fillStyle = mutedColor;
                ctx.font = '14px sans-serif';
                ctx.fillText('No completed tasks or closed issues in the last 30 days.', 20, 100);
                ctx.font = '12px sans-serif';
                ctx.fillText('Close GitHub issues or complete orchestration tasks to see velocity.', 20, 125);
                return;
            }

            // Set canvas size
            canvas.width = canvas.offsetWidth;
            canvas.height = 250;

            const paddingLeft = 55;
            const paddingRight = 20;
            const paddingTop = 20;
            const paddingBottom = 45;
            const width = canvas.width - paddingLeft - paddingRight;
            const height = canvas.height - paddingTop - paddingBottom;
            const maxValue = Math.max(...timeline.map(d => d.completedTasks), 1);
            const stepX = width / (timeline.length - 1 || 1);

            // Draw axes
            ctx.strokeStyle = axisColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(paddingLeft, paddingTop);
            ctx.lineTo(paddingLeft, paddingTop + height);
            ctx.lineTo(paddingLeft + width, paddingTop + height);
            ctx.stroke();

            // Y-axis labels (0, mid, max)
            ctx.fillStyle = labelColor;
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            const yLabels = [0, Math.round(maxValue / 2), maxValue];
            yLabels.forEach(val => {
                const y = paddingTop + height - (val / maxValue) * height;
                ctx.fillText(String(val), paddingLeft - 8, y);
                // Draw subtle grid line
                if (val > 0) {
                    ctx.strokeStyle = axisColor;
                    ctx.globalAlpha = 0.3;
                    ctx.beginPath();
                    ctx.moveTo(paddingLeft, y);
                    ctx.lineTo(paddingLeft + width, y);
                    ctx.stroke();
                    ctx.globalAlpha = 1.0;
                }
            });

            // X-axis date labels (show ~6 evenly spaced dates)
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = labelColor;
            const labelCount = Math.min(6, timeline.length);
            const labelStep = Math.max(1, Math.floor((timeline.length - 1) / (labelCount - 1)));
            for (let i = 0; i < timeline.length; i += labelStep) {
                const x = paddingLeft + i * stepX;
                const dateStr = timeline[i].date;
                const parts = dateStr.split('-');
                const label = parts[1] + '/' + parts[2]; // MM/DD
                ctx.fillText(label, x, paddingTop + height + 8);
            }
            // Always show last date
            if ((timeline.length - 1) % labelStep !== 0) {
                const lastX = paddingLeft + (timeline.length - 1) * stepX;
                const lastDate = timeline[timeline.length - 1].date;
                const lastParts = lastDate.split('-');
                ctx.fillText(lastParts[1] + '/' + lastParts[2], lastX, paddingTop + height + 8);
            }

            // Draw line
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            timeline.forEach((point, i) => {
                const x = paddingLeft + i * stepX;
                const y = paddingTop + height - (point.completedTasks / maxValue) * height;
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            ctx.stroke();

            // Draw points
            ctx.fillStyle = lineColor;
            timeline.forEach((point, i) => {
                const x = paddingLeft + i * stepX;
                const y = paddingTop + height - (point.completedTasks / maxValue) * height;
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
                    <div class="member-name" data-action="open-member" data-member-name="\${escapeHtml(stripMarkdownLinks(point.member))}">\${renderMarkdownLinks(escapeHtml(point.member))}</div>
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
                            <li class="task-item \${statusClass}" title="\${escapedTitle}" data-action="open-task" data-task-id="\${task.id}">
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
                        <span class="member-link" data-action="open-member" data-member-name="\${escapeHtml(stripMarkdownLinks(lane.member))}">\${renderMarkdownLinks(escapeHtml(lane.member))}</span> <span class="role">· \${lane.role}</span>
                    </div>
                    \${tasksHtml}
                \`;
                container.appendChild(swimlane);
            });
        }

        // Track which tabs have been rendered to avoid re-initializing listeners
        const renderedTabs = new Set();

        // Initialize visualizations — only render charts on visible tabs.
        // Canvas charts on hidden tabs get offsetWidth=0 and render blank.
        renderTeamOverview();
        renderHeatmap();
        renderActivitySwimlanes();
        renderRecentSessions();

        // Render recent sessions
        function renderRecentSessions() {
            const container = document.getElementById('recent-sessions');
            const recentLogs = activityData.recentLogs;

            if (!recentLogs || recentLogs.length === 0) {
                container.innerHTML = '<p style="color: var(--vscode-descriptionForeground);">No session logs available</p>';
                return;
            }

            container.innerHTML = '';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '12px';

            recentLogs.forEach(log => {
                const logCard = document.createElement('div');
                logCard.className = 'log-entry-card';
                logCard.style.cssText = 'padding: 12px; border: 1px solid var(--vscode-panel-border); border-radius: 4px; cursor: pointer; transition: background-color 0.2s;';
                logCard.onmouseover = () => logCard.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                logCard.onmouseout = () => logCard.style.backgroundColor = 'transparent';
                
                const decisionCount = (log.decisions || []).length;
                const outcomeCount = (log.outcomes || []).length;
                
                logCard.innerHTML = \`
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                        <strong style="font-size: 14px;">\${escapeHtml(log.topic.replace(/-/g, ' '))}</strong>
                        <span style="color: var(--vscode-descriptionForeground); font-size: 12px;">\${log.date}</span>
                    </div>
                    <div style="color: var(--vscode-descriptionForeground); font-size: 12px; margin-bottom: 6px;">
                        👥 \${escapeHtml(log.participants.join(', '))}
                    </div>
                    <div style="font-size: 12px;">
                        <span style="margin-right: 12px;">📋 \${decisionCount} decision\${decisionCount !== 1 ? 's' : ''}</span>
                        <span>✅ \${outcomeCount} outcome\${outcomeCount !== 1 ? 's' : ''}</span>
                    </div>
                \`;
                
                logCard.addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'openLogEntry',
                        date: log.date,
                        topic: log.topic
                    });
                });
                
                container.appendChild(logCard);
            });
        }

        // Render decisions
        function renderDecisions(filter = '') {
            const container = document.getElementById('decision-list');
            const entries = decisionData.entries;
            
            if (!entries || entries.length === 0) {
                container.innerHTML = '<div class="decisions-empty">No decisions recorded yet.<br><br>Decisions appear here as your team makes architectural and process decisions.<br>Create decision files in <code>.ai-team/decisions/</code> to get started.</div>';
                container.style.display = 'block';
                return;
            }

            const lowerFilter = filter.toLowerCase();
            const filtered = entries.filter(d => 
                d.title.toLowerCase().includes(lowerFilter) || 
                (d.content || '').toLowerCase().includes(lowerFilter) ||
                (d.author || '').toLowerCase().includes(lowerFilter)
            );
            
            if (filtered.length === 0) {
                container.innerHTML = '<div class="decisions-empty">No matching decisions found</div>';
                container.style.display = 'block';
                return;
            }
            
            // Sort most-recent first
            filtered.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

            container.style.display = 'grid'; // Restore grid
            container.innerHTML = filtered.map(d => {
                // Simple markdown strip (very basic)
                const plainContent = (d.content || '')
                    .replace(/#+\\s/g, '')
                    .replace(/[*_\\\`]/g, '')
                    .replace(/\\[([^\\]]+)\\]\\([^)]+\\)/g, '$1');

                return \`
                    <div class="decision-card" title="View \${d.title}" data-action="open-decision" data-file-path="\${escapeHtml(d.filePath || '')}" data-line-number="\${d.lineNumber || 0}">
                        <div class="decision-title">\${escapeHtml(d.title)}</div>
                        <div class="decision-meta">
                            <span>📅 \${d.date || '—'}</span>
                            <span>👤 \${escapeHtml(d.author || '—')}</span>
                        </div>
                        <div class="decision-preview">
                            \${escapeHtml(plainContent || 'No preview available')}
                        </div>
                    </div>
                \`;
            }).join('');
        }

        // Search handler
        document.getElementById('decision-search').addEventListener('input', (e) => {
            renderDecisions(e.target.value);
        });

        // Initialize decisions after function is defined
        renderDecisions();

        // ─── Skills Usage ──────────────────────────────────────────────

        function renderSkillUsage() {
            const summaryEl = document.getElementById('skills-summary');
            const barsEl = document.getElementById('skill-bars');
            const unusedEl = document.getElementById('unused-skill-list');
            const unusedSection = document.getElementById('unused-skills-section');
            const metrics = skillsData.metrics || [];
            const unusedSkills = skillsData.unusedSkills || [];

            if (metrics.length === 0) {
                barsEl.innerHTML = '<div class="skills-empty">No skills found.<br><br>Install skills in <code>.ai-team/skills/</code> to track usage.</div>';
                summaryEl.innerHTML = '';
                unusedSection.style.display = 'none';
                return;
            }

            const usedSkills = metrics.filter(m => m.totalReferences > 0);
            const totalRefs = metrics.reduce((sum, m) => sum + m.totalReferences, 0);

            summaryEl.innerHTML = \`
                <div class="skills-stat"><span class="value">\${metrics.length}</span><span class="label">Total Skills</span></div>
                <div class="skills-stat"><span class="value">\${usedSkills.length}</span><span class="label">Active Skills</span></div>
                <div class="skills-stat"><span class="value">\${unusedSkills.length}</span><span class="label">Unused Skills</span></div>
                <div class="skills-stat"><span class="value">\${totalRefs}</span><span class="label">Total References</span></div>
                <div class="skills-stat"><span class="value">\${skillsData.totalLogsScanned}</span><span class="label">Logs Scanned</span></div>
            \`;

            const maxRefs = Math.max(...metrics.map(m => m.totalReferences), 1);
            barsEl.innerHTML = metrics.map(m => {
                const pct = (m.totalReferences / maxRefs) * 100;
                const isUnused = m.totalReferences === 0;
                const lastUsedStr = m.lastUsed ? \` · Last: \${m.lastUsed}\` : '';
                const installedTag = m.isInstalled ? '' : ' <span style="opacity:0.6">(not installed)</span>';
                return \`<div class="skill-bar-container"><div class="skill-bar-label"><span class="skill-bar-name">\${escapeHtml(m.skillName)}\${installedTag}</span><span class="skill-bar-count">\${m.totalReferences} ref\${m.totalReferences !== 1 ? 's' : ''}\${lastUsedStr}</span></div><div class="skill-bar-track"><div class="skill-bar-fill\${isUnused ? ' unused' : ''}" style="width: \${isUnused ? 0 : Math.max(pct, 2)}%"></div></div></div>\`;
            }).join('');

            if (unusedSkills.length === 0) {
                unusedSection.style.display = 'none';
            } else {
                unusedSection.style.display = 'block';
                unusedEl.innerHTML = unusedSkills.map(name => \`<li>📦 \${escapeHtml(name)}</li>\`).join('');
            }
        }

        function renderSkillTrendChart() {
            const canvas = document.getElementById('skill-trend-chart');
            if (!canvas || canvas.offsetWidth === 0) return;
            const ctx = canvas.getContext('2d');
            const metrics = (skillsData.metrics || []).filter(m => m.totalReferences > 0);
            const lineColors = ['#3794ff', '#89d185', '#d18616', '#c586c0', '#4ec9b0', '#ce9178', '#569cd6', '#dcdcaa'];
            const axisColor = resolveColor('--vscode-panel-border', '#444');
            const labelColor = resolveColor('--vscode-foreground', '#ccc');
            const mutedColor = resolveColor('--vscode-descriptionForeground', '#999');

            canvas.width = canvas.offsetWidth;
            canvas.height = 250;

            if (metrics.length === 0) {
                ctx.fillStyle = mutedColor;
                ctx.font = '14px sans-serif';
                ctx.fillText('No skill usage data to chart.', 20, 100);
                return;
            }

            const allDatesSet = new Set();
            for (const m of metrics) { for (const pt of m.trend) { allDatesSet.add(pt.date); } }
            const allDates = Array.from(allDatesSet).sort();
            if (allDates.length === 0) { ctx.fillStyle = mutedColor; ctx.font = '14px sans-serif'; ctx.fillText('No trend data available.', 20, 100); return; }

            const topSkills = metrics.slice(0, 8);
            const series = topSkills.map(m => {
                const dateMap = new Map();
                for (const pt of m.trend) { dateMap.set(pt.date, pt.count); }
                return allDates.map(d => dateMap.get(d) || 0);
            });
            const maxVal = Math.max(...series.flat(), 1);

            const paddingLeft = 45, paddingRight = 20, paddingTop = 20, paddingBottom = 50;
            const width = canvas.width - paddingLeft - paddingRight;
            const height = canvas.height - paddingTop - paddingBottom;
            const stepX = allDates.length > 1 ? width / (allDates.length - 1) : width;

            ctx.strokeStyle = axisColor; ctx.lineWidth = 1; ctx.beginPath();
            ctx.moveTo(paddingLeft, paddingTop); ctx.lineTo(paddingLeft, paddingTop + height);
            ctx.lineTo(paddingLeft + width, paddingTop + height); ctx.stroke();

            ctx.fillStyle = labelColor; ctx.font = '11px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
            [0, Math.round(maxVal / 2), maxVal].forEach(val => {
                const y = paddingTop + height - (val / maxVal) * height;
                ctx.fillText(String(val), paddingLeft - 8, y);
            });

            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            const labelCount = Math.min(6, allDates.length);
            const labelStep = Math.max(1, Math.floor((allDates.length - 1) / (labelCount - 1)));
            for (let i = 0; i < allDates.length; i += labelStep) {
                const x = paddingLeft + i * stepX;
                const parts = allDates[i].split('-');
                ctx.fillText(parts[1] + '/' + parts[2], x, paddingTop + height + 8);
            }

            for (let s = 0; s < series.length; s++) {
                ctx.strokeStyle = lineColors[s % lineColors.length]; ctx.lineWidth = 2; ctx.beginPath();
                for (let i = 0; i < series[s].length; i++) {
                    const x = paddingLeft + i * stepX;
                    const y = paddingTop + height - (series[s][i] / maxVal) * height;
                    if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
                }
                ctx.stroke();
                ctx.fillStyle = lineColors[s % lineColors.length];
                for (let i = 0; i < series[s].length; i++) {
                    const x = paddingLeft + i * stepX;
                    const y = paddingTop + height - (series[s][i] / maxVal) * height;
                    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
                }
            }

            ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
            let legendX = paddingLeft; const legendY = paddingTop + height + 30;
            for (let s = 0; s < topSkills.length; s++) {
                ctx.fillStyle = lineColors[s % lineColors.length];
                ctx.fillRect(legendX, legendY, 10, 10);
                ctx.fillStyle = labelColor;
                const name = topSkills[s].skillName.length > 12 ? topSkills[s].skillName.substring(0, 11) + '…' : topSkills[s].skillName;
                ctx.fillText(name, legendX + 14, legendY + 9);
                legendX += ctx.measureText(name).width + 28;
                if (legendX > canvas.width - 60) break;
            }
        }

        renderSkillUsage();

        // Helper to escape HTML
        function escapeHtml(text) {
            return text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        // Convert markdown links [text](url) to <a> tags
        function renderMarkdownLinks(text) {
            return text.replace(
                /\\[([^\\]]+)\\]\\(([^)]+)\\)/g,
                '<a href="$2" target="_blank">$1</a>'
            );
        }

        // Strip markdown links [text](url) to plain text
        function stripMarkdownLinks(text) {
            return text.replace(/\\[([^\\]]+)\\]\\([^)]+\\)/g, '$1');
        }

        // Event delegation for clickable items
        document.body.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;
            switch (action) {
                case 'open-decision':
                    vscode.postMessage({
                        command: 'openDecision',
                        filePath: target.dataset.filePath,
                        lineNumber: parseInt(target.dataset.lineNumber || '0', 10)
                    });
                    break;
                case 'open-task':
                    vscode.postMessage({
                        command: 'openTask',
                        taskId: target.dataset.taskId
                    });
                    break;
                case 'open-member':
                    vscode.postMessage({
                        command: 'openMember',
                        memberName: target.dataset.memberName
                    });
                    break;
                case 'toggle-drilldown': {
                    const cardId = target.dataset.cardId;
                    const card = document.getElementById(cardId);
                    if (card) {
                        const isExpanded = card.classList.toggle('expanded');
                        target.textContent = isExpanded ? '▲ Collapse' : '▼ Details';
                    }
                    break;
                }
            }
        });

        // Standup report button handler
        document.getElementById('open-standup-btn').addEventListener('click', () => {
            vscode.postMessage({ command: 'openStandup' });
        });
    </script>
</body>
</html>
    `.trim();
}
