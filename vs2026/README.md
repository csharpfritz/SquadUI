# SquadUI — Visual Studio 2026 Extension

A Visual Studio 2026 extension that visualizes Squad AI team members and their tasks directly inside the IDE.

## Project Structure

```
vs2026/
├── SquadUI.VS2026.sln              # Solution file
├── .editorconfig                    # C# coding style rules
├── src/
│   └── SquadUI.VS2026/
│       ├── SquadUI.VS2026.csproj    # Extension project (out-of-process)
│       ├── Extension.cs             # Entry point — extends VisualStudio.Extensibility.Extension
│       ├── Commands/
│       │   └── HelloSquadCommand.cs # Verification command ("Hello Squad")
│       ├── Properties/
│       │   └── launchSettings.json  # F5 debug configuration
│       └── .vsextension/
│           └── string-resources.json # Localized display strings
└── tests/
    └── SquadUI.VS2026.Tests/
        └── SquadUI.VS2026.Tests.csproj  # xUnit test project
```

## SDK

This extension uses the **VisualStudio.Extensibility SDK** (out-of-process model), not the legacy VSSDK. Extensions run in a separate process from Visual Studio, which means:

- Extension crashes don't take down Visual Studio
- Hot-reload — install without restarting VS
- Modern async APIs with dependency injection
- Targets .NET 8.0

## Build

```bash
# Restore and build the extension
cd vs2026/src/SquadUI.VS2026
dotnet restore
dotnet build

# Build the full solution (extension + tests)
cd vs2026
dotnet build SquadUI.VS2026.sln
```

## Debug

1. Open `SquadUI.VS2026.sln` in Visual Studio 2026.
2. Set `SquadUI.VS2026` as the startup project.
3. Press **F5** — this launches the VS Experimental Instance with the extension loaded.
4. Find **Hello Squad** under the **Extensions** menu.

## Architecture Notes

- **Extension.cs** — The entry point. Registers services via `InitializeServices()`.
- **Commands/** — Each command extends `Microsoft.VisualStudio.Extensibility.Commands.Command` and is annotated with `[VisualStudioContribution]`.
- **string-resources.json** — Display names use `%key%` syntax referencing this file, enabling localization.
