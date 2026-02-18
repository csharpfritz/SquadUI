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

📌 Team update (2026-02-16): Test hardening conventions established — command registration tests use triple-guard pattern (extension/isActive/workspace); tree provider tests must await getChildren(); temp directories use test-fixtures/temp-{name}-${Date.now()} with teardown; private methods accessed via (instance as any).method.bind(instance) — decided by Basher

### Issue #43: Project Scaffold and VSIX Configuration

- **SDK choice:** `Microsoft.VisualStudio.Extensibility.Sdk` 17.14.x (out-of-process model, NOT legacy VSSDK). This is the meta-package that pulls in all required build tooling, code generators, and analyzers.
- **Target framework:** .NET 8.0 — required by the out-of-process extensibility model.
- **Extension entry point:** `Extension.cs` extends `Microsoft.VisualStudio.Extensibility.Extension` with `[VisualStudioContribution]` attribute. Uses `ExtensionConfiguration` property for metadata (id, version, publisher).
- **Command pattern:** Commands extend `Microsoft.VisualStudio.Extensibility.Commands.Command`, use `CommandConfiguration` property for placement/display, and `[VisualStudioContribution]` attribute. Display names use `%key%` syntax referencing `.vsextension/string-resources.json` for localization.
- **Test project gotcha:** Referencing the extension project transitively pulls in VS Extensibility build tooling which emits VSEXT0004 requiring an Extension class in every project. For test projects, omit the ProjectReference until tests actually need extension types, or find a way to suppress the build validation.
- **Project structure:** `vs2026/src/SquadUI.VS2026/` for extension, `vs2026/tests/SquadUI.VS2026.Tests/` for tests, single `.sln` at `vs2026/` root.
