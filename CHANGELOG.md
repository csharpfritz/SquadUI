# Changelog

All notable changes to the SquadUI extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-02-15

### Added
- **Dashboard decisions panel**: Decisions now render in the Activity tab with proper null-safety
- **Dashboard "Recent Sessions" panel**: Shows recent orchestration log sessions for quick access
- **Dashboard sidebar button**: One-click access to the dashboard from Team panel header
- **Clickable dashboard entries**: Drill into decision and session details from dashboard panels
- **Per-member activity logs**: Orchestration log entries appear under each team member in sidebar (filtered by participant)
- **Re-enabled Add Skill UI**: Restored skill addition with improved error handling and duplicate protection
- **Skill install enhancements**: Fetches actual SKILL.md content from GitHub repos during installation
- **90+ comprehensive tests**: New P1 test coverage for IssueDetailWebview, SquadStatusBar, removeMemberCommand, and skillCatalog

### Fixed
- **awesome-copilot skill catalog**: Updated URL after repo moved to github/awesome-copilot, rewrote parser for new table format
- **awesome-copilot skill install**: extractGitHubSubpath() now resolves SKILL.md from subdirectories
- **skills.sh parser**: Rewrote parser to handle new leaderboard h3/p pattern (was picking up nav links)
- **Skill search null-safety**: Added safe navigation (description?.toLowerCase()) to prevent runtime errors
- **Decision date extraction**: Complete parser rewrite for reliable date/author extraction from heading prefixes
- **Decision sort order**: Ensures decisions display most-recent-first
- **Dashboard rendering null-safety**: Fixed potential errors in decision panel rendering
- **Decision subsection filters**: Fixed filtering for proper subsection isolation

### Changed
- **Activity relocation**: Activity moved from root-level "Recent Activity" section to per-member children in Team panel
- **Decision heading parser**: Now handles both H2 and H3 levels with proper date/author metadata extraction

### Removed
- **Root-level "Recent Activity" node**: Removed from Team sidebar (activity now per-member in Team panel children)

## [0.5.0] - 2026-02-15

### Added
- **Cross-project compatibility**: Auto-detect H2 vs H3 decision heading levels for different `.ai-team/` structures
- **Broader task extraction**: Support for `## What Happened`, `**Work done:**`, and unbolded agent name formats in session logs
- **@copilot expandable node**: Copilot team member now shows GitHub issues as child items

### Changed
- **Member ordering**: @copilot now appears above Scribe and Ralph in the Team panel (since it may have active tasks)
- **Skill labels**: Stripped "Skill: " prefix and removed "local" source indicator
- **Decision labels**: Stripped date prefixes, "User directive —", "Decision:", "Design Decision:", and other generic prefixes
- **Scribe & Ralph**: Unique icons (quill and eye), no expandable children
- **@copilot**: Robot icon, no charter click-through
- **Removed redundant "View" button** from team member context menu
- **Removed collapse-all** from Skills and Decisions panels (no expandable items)

### Disabled
- **Add Skill button**: Temporarily removed from Skills panel header (feature incomplete — backlog item)

### Fixed
- Skill click error: now passes slug instead of display name to `viewSkill` command
- Decision panel: prefers H1 heading for individual decision files over H2/H3
- BlazorLora session log parsing: handles `## What Happened` section format

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

[0.6.0]: https://github.com/csharpfritz/SquadUI/releases/tag/v0.6.0
[0.5.0]: https://github.com/csharpfritz/SquadUI/releases/tag/v0.5.0
[0.4.0]: https://github.com/csharpfritz/SquadUI/releases/tag/v0.4.0
[0.1.0]: https://github.com/csharpfritz/SquadUI/releases/tag/v0.1.0
