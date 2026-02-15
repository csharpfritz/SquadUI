# Changelog

All notable changes to the SquadUI extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-02-14

### Added
- **Real-time Status Bar**: Live activity indicator showing active team members with refresh on orchestration log updates
- **Roster Activity Badges**: Visual indicators (🟢 active, 📋 silent, 🔄 monitoring) next to member names in the tree view
- **Squad Dashboard**: New interactive dashboard with three tabs:
  - **Velocity Tab**: Completed tasks timeline (30 days) and team activity heatmap (7 days)
  - **Activity Timeline**: Swimlane view showing per-member task progress with color-coded status
  - **Decisions Browser**: Placeholder for future decision exploration (Phase 3)
- **Dashboard Swimlanes**: Enhanced visual styling with:
  - Distinct colors for completed (green) vs in-progress (amber/orange) tasks
  - CSS tooltips showing full task details on hover
  - Responsive layout optimized for VS Code dark/light themes
- **Skills Management**: Add, view, and remove skills from catalogs (awesome-copilot, skills.sh)
- **Team Management Integration**: Skills appear in tree view as top-level collapsible section

### Changed
- Unified command palette categories to "Squad" for consistency
- Improved tree view to show members from team.md with fallback to log participants

### Fixed
- Context menu commands now properly scoped to their respective tree item types

## [0.1.0] - 2026-02-13

### Added
- Initial extension scaffolding with TypeScript and VS Code Extension API
- SquadUI activity bar container with Team Members tree view
- Tree view showing squad members with tasks and GitHub issues
- Work Details webview with markdown rendering support
- Issue Detail webview with GitHub integration
- Commands: Initialize Squad, Add/Remove Team Member, Refresh Tree
- GitHub Issues integration with squad label filtering
- Team.md parser service for member roster management
- Orchestration log service for runtime activity tracking

[0.4.0]: https://github.com/csharpfritz/SquadUI/releases/tag/v0.4.0
[0.1.0]: https://github.com/csharpfritz/SquadUI/releases/tag/v0.1.0
