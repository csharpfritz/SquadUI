### 2026-02-14: Commands module structure established
**By:** Rusty
**What:** Created `src/commands/` directory with barrel export pattern (`index.ts`) and first command module (`initSquadCommand.ts`). Commands export a `register*Command()` factory function that takes `context` and a callback, returning a `vscode.Disposable`.
**Why:** Establishes a consistent pattern for all future v0.3.0 commands (addMember, removeMember, selectUniverse). Each command is a separate file, exported through the barrel, and wired in extension.ts with a single `context.subscriptions.push()` call. Keeps extension.ts thin and commands testable in isolation.
