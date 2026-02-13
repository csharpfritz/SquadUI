# Command Test Skip-Guard Pattern

**Author:** Basher (Tester)
**Date:** 2026-02-14

## Context

The VS Code test electron host runs without a workspace folder. The extension's `activate()` returns early when `workspaceFolders` is undefined, so commands like `squadui.addMember` and `squadui.viewCharter` are never registered.

Tests that call `vscode.commands.executeCommand('squadui.addMember')` would throw `Error: command 'squadui.addMember' not found`.

## Decision

All tests that execute registered commands via `executeCommand` **must** use the skip-guard pattern:

```typescript
test('description', async function () {
    const commands = await vscode.commands.getCommands(true);
    if (!commands.includes('squadui.addMember')) {
        this.skip();
        return;
    }
    // ... test body
});
```

Key rules:
1. Use `function()` not arrow `() =>` (needed for `this.skip()`)
2. Check command registration before exercising it
3. Tests show as "pending" in CI, not "failing"

## Rationale

- Tests self-skip gracefully in environments without workspaces (CI, test electron host)
- No false failures in CI pipelines
- Tests still execute fully when run in a proper VS Code development host with a workspace open
- Consistent with the pattern already used in File Creation and Edge Case suites

## Impact

Any future command tests must follow this pattern. Tests that don't will fail in CI.
