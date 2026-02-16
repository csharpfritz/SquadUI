# History — Turk

## Project Learnings (from import)

- **Project:** SquadUI — VS Code extension for visualizing Squad team members and their tasks
- **Owner:** Jeffrey T. Fritz (csharpfritz)
- **Stack:** TypeScript (VS Code), with a future sprint planned for Visual Studio 2026 (C#/.NET)
- **Goal:** Port the SquadUI sidebar UI to Visual Studio 2026 tool windows using WPF/XAML
- **Existing UI:** Three tree views (Team, Skills, Decisions) in VS Code sidebar, plus webview detail panels
- **Key UI patterns to port:** Tree items with icons (ThemeIcon), collapsible sections, member status badges, click-to-open detail views

## Learnings

### 2026-02-15: VS 2026 Extension Kickoff — Parallel Development Track

📌 Team update (2026-02-15): VS 2026 extension is now a parallel development track with issues #43 (project scaffold/VSIX), #44 (core services/C# file parsing), and #45 (team roster tool window). Both VS Code (TypeScript) and VS 2026 (C#/.NET) extensions read the same `.ai-team/` file format with completely independent codebases. Turk owns WPF/XAML tool windows, MVVM view models, theme integration, and user interactions for VS 2026. Both teams operate independently to maximize velocity. — decided by Danny

📌 Team update (2026-02-16): Test hardening conventions established — command registration tests use triple-guard pattern (extension/isActive/workspace); tree provider tests must await getChildren(); temp directories use test-fixtures/temp-{name}-${Date.now()} with teardown; private methods accessed via (instance as any).method.bind(instance) — decided by Basher
