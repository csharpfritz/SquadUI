# Chat Panel Handoff for Init

**Date:** 2026-02-16
**Author:** Rusty
**Requested by:** Jeffrey T. Fritz

## Decision

The init wizard no longer invokes the Copilot agent via CLI in the terminal. Instead, after `squad init` scaffolds `.ai-team/` and the FileSystemWatcher detects `team.md`, the extension opens VS Code's Copilot Chat panel with the `@squad` agent selected and a setup prompt pre-filled.

## Rationale

- Running `gh copilot -- --agent squad` in the terminal was fragile (required `gh` CLI, platform-specific null redirects, quote escaping).
- The Copilot Chat panel is the native VS Code surface for agent interaction — better UX, visible progress, and user can interact with the agent.
- User sees Squad working in the chat panel while the sidebar populates from the FileSystemWatcher.

## Implementation

- `terminal.sendText()` sends only the `npx github:bradygaster/squad init` command.
- `completeInit()` calls `vscode.commands.executeCommand('workbench.action.chat.open', chatPrompt)` after `onInitComplete()`.
- Removed: `copilotPrompt`, `copilotFlags`, `copilotCmd`, `process.platform` check, `&&` chaining.

## Impact

- No changes to extension API signatures or test contracts.
- `addMemberCommand.ts` already uses the same `workbench.action.chat.open` pattern — consistent approach.
