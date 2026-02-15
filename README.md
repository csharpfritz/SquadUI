# SquadUI

[![CI](https://github.com/csharpfritz/SquadUI/actions/workflows/ci.yml/badge.svg)](https://github.com/csharpfritz/SquadUI/actions/workflows/ci.yml)
[![Release](https://github.com/csharpfritz/SquadUI/actions/workflows/release.yml/badge.svg)](https://github.com/csharpfritz/SquadUI/actions/workflows/release.yml)
[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/csharpfritz.squadui)](https://marketplace.visualstudio.com/items?itemName=csharpfritz.squadui)
[![Visual Studio Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/csharpfritz.squadui)](https://marketplace.visualstudio.com/items?itemName=csharpfritz.squadui)
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/csharpfritz.squadui)](https://marketplace.visualstudio.com/items?itemName=csharpfritz.squadui)
[![License](https://img.shields.io/github/license/csharpfritz/SquadUI)](LICENSE)

**Visualize and manage your GitHub Copilot Squad team directly in VS Code.** SquadUI brings your team's tasks, decisions, and capabilities into the editor where you work—complete with real-time activity tracking, velocity metrics, and skill management.

![SquadUI in VS Code](docs/images/vscode-extensionui.png)

## Features

### Sidebar Panels

**Team Panel** — Your Squad roster at a glance
- View all team members with role badges: 🟢 active, 📋 silent, 🔄 monitor, 🤖 coding agent
- Click any member to view their charter (guidelines and scope)
- Expand members to see:
  - **Assigned tasks** — work items currently assigned
  - **GitHub issues** — open and closed issues at a glance with direct GitHub links
  - **Activity log entries** — recent orchestration sessions where the member participated
- One-click access to the Squad Dashboard

**Skills Panel** — Manage your team's capabilities
- Browse installed skills from `.ai-team/skills/`
- Click any skill to view its full documentation
- Add new skills from official catalogs:
  - [awesome-copilot](https://github.com/github/awesome-copilot) — recommended prompting strategies and patterns
  - [skills.sh](https://skills.sh/) — community-contributed skill library
- Remove skills you no longer need

**Decisions Panel** — Team decisions and design choices
- Browse all decisions from `.ai-team/decisions.md`
- Organized chronologically (most recent first)
- Click any decision to view full context and rationale
- Track design decisions, team directives, and architectural choices

### Dashboard

Access comprehensive team insights with **Squad: Open Dashboard** (Ctrl+Shift+D / Cmd+Shift+D)

**Velocity Tab** — Team productivity metrics
- 30-day completed tasks timeline showing delivery cadence
- 7-day activity heatmap visualizing team engagement patterns
- Identify trends and bottlenecks at a glance

**Activity Tab** — Detailed task tracking
- Swimlane view showing per-member task progress with color-coded status (green = completed, amber = in-progress)
- Hover to see task details
- Browse recent orchestration log sessions for context on what the team has been working on

**Decisions Browser** — Easy decision discovery
- Drill into individual decisions from the dashboard
- Reference team choices without leaving VS Code

### Status Bar

- **Real-time activity indicator** showing which team members are actively working
- Automatically updates as orchestration logs are processed
- Health status icons at a glance

### Integration Features

- **File watching** — automatically refreshes when `.ai-team/` files change
- **GitHub integration** — pulls real-time issue data and links to your repository
- **Cross-project compatibility** — adapts to different `.ai-team/` folder structures
- **Markdown rendering** — beautiful formatting for charters, decisions, and skill docs

## Commands

Run commands via the Command Palette (Cmd/Ctrl+Shift+P):

| Command | Keyboard | Description |
|---------|----------|-------------|
| `Squad: Initialize` | — | Set up `.ai-team/` folder structure for a new Squad |
| `Squad: Add Team Member` | Ctrl+Shift+S | Add an agent to your team roster |
| `Squad: Remove Team Member` | — | Remove an agent from your roster |
| `Squad: View Charter` | — | View a team member's charter (triggered on click) |
| `Squad: Add Skill` | — | Browse and install skills from official catalogs |
| `Squad: View Skill` | — | View skill documentation |
| `Squad: Remove Skill` | — | Remove a skill from your team |
| `Squad: Open Dashboard` | Ctrl+Shift+D | View team velocity, activity, and decisions |
| `Squad: Refresh Team View` | — | Manually refresh the sidebar panels |
| `Squad: Open Log Entry` | — | View detailed orchestration session logs |

## Getting Started

1. **Install from Marketplace**  
   Install the extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=csharpfritz.squadui)

2. **Set up your Squad** (optional)  
   Run `Squad: Initialize` to scaffold a new `.ai-team/` folder structure, or open a repo that already has one

3. **View your team**  
   Open the SquadUI sidebar (activity bar icon) to see:
   - **Team panel** — your squad members and their work
   - **Skills panel** — installed capabilities
   - **Decisions panel** — team decisions

4. **Add team members** (optional)  
   Run `Squad: Add Team Member` to add agents to your roster

5. **Browse the dashboard**  
   Press Ctrl+Shift+D / Cmd+Shift+D to open the Squad Dashboard for metrics and activity

## Requirements

- **VS Code 1.85.0 or later** — needed for all sidebar views and webview panels

## Development

**Setup:**
```bash
npm install
npm run compile
```

**Debug:**
Press F5 to launch the Extension Development Host and test your changes

**Test:**
```bash
npm test
```

## License

See [LICENSE](LICENSE) for details.
