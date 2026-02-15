# 2026-02-15: Milestone Planning Session

**Requested by:** Jeffrey T. Fritz  
**Participants:** Danny (Lead), Scribe  
**Date:** 2026-02-15

## Session Summary

Danny scoped 6 new GitHub issues across two parallel milestones to address user requests for VS Code and Visual Studio 2026 extension features.

### VS Code Milestone — Init Redesign and Version Management
- **#41** — VS Code-native init experience with universe selector (squad:rusty, M, P1)
- **#42** — Squad CLI version check and upgrade notification (squad:rusty, M, P1)

**Related Decision:** Init redesign absorbs issue #26 (universe selector) into the native init flow rather than implementing it as a standalone command. The universe choice becomes step 1 of the init wizard. This improves UX by keeping users in the IDE and eliminates command palette clutter.

### VS 2026 Milestone — Parallel Development Track
- **#43** — VS 2026: Project scaffold and VSIX configuration (squad:virgil, M, P1)
- **#44** — VS 2026: Core services — .ai-team file parsing in C# (squad:virgil, L, P1)
- **#45** — VS 2026: Team roster tool window (squad:turk, M, P1)

**Related Decision:** VS 2026 extension starts as a parallel development track. Both extensions (VS Code TypeScript + VS 2026 C#/.NET) read the same `.ai-team/` file format with independent codebases. Virgil owns VSIX infrastructure and core services; Turk owns UI (WPF/XAML tool windows).

### User Directives Captured
- **VS 2026 CI/CD Requirement:** The VS 2026 extension must have separate build and publish CI processes from the VS Code extension due to different languages (C#/.NET vs TypeScript), package formats (VSIX vs .vsix), and marketplaces. Independent pipelines prevent coupling and allow independent release cadences.

## Decisions Made

1. **Init redesign absorbs issue #26 (universe selector)** — Merged into #41 native init flow
2. **VS 2026 extension runs as parallel development track** — Separate project folder, independent implementations, shared .ai-team/ format
3. **VS 2026 requires independent CI/CD** — Separate build and publish pipelines from VS Code extension

## Next Steps

- Virgil and Turk to review `.ai-team/` file format specs before VS 2026 implementation
- Rusty to begin work on issues #41 and #42 (VS Code init redesign and version check)
- Livingston to plan separate CI/CD configuration for VS 2026 extension
