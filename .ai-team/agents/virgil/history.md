# History — Virgil

## Project Learnings (from import)

- **Project:** SquadUI — VS Code extension for visualizing Squad team members and their tasks
- **Owner:** Jeffrey T. Fritz (csharpfritz)
- **Stack:** TypeScript (VS Code), with a future sprint planned for Visual Studio 2026 (C#/.NET)
- **Goal:** Port the SquadUI sidebar experience (team panel, skills panel, decisions panel) to Visual Studio 2026
- **Existing extension:** VS Code extension with tree views (TeamTreeProvider, SkillsTreeProvider, DecisionsTreeProvider), webviews, and services for parsing .ai-team/ files

## Learnings

### 2026-02-15: VS 2026 Extension Kickoff — Parallel Development Track

📌 Team update (2026-02-15): VS 2026 extension is now a parallel development track with issues #43 (project scaffold/VSIX), #44 (core services/C# file parsing), and #45 (team roster tool window). Both VS Code (TypeScript) and VS 2026 (C#/.NET) extensions read the same `.ai-team/` file format with completely independent codebases. Virgil owns VSIX infrastructure, MEF registration, and core services (TeamMdService, DecisionService, SkillCatalogService, FileWatcherService). Both teams operate independently to maximize velocity. — decided by Danny
