# Skill: VS Code Terminal Command Pattern

> Wrapping CLI tools as VS Code commands using the integrated terminal API.

## Confidence
- **Level:** low
- **Source:** earned

## Pattern

When a VS Code extension command needs to run an external CLI tool:

1. **Use `vscode.window.createTerminal()`** — not `child_process.spawn()` — for commands where the user benefits from seeing output in real time.
2. **Name the terminal** descriptively (e.g., `"Squad Init"`) so users can identify it.
3. **Set `cwd`** to the workspace folder URI.
4. **Call `terminal.show()`** before `terminal.sendText()` so the user sees what's happening.
5. **Listen for `onDidCloseTerminal`** to trigger post-completion actions (refresh data, show notifications).
6. **Dispose the listener** after it fires once to avoid memory leaks.
7. **Push the listener** to `context.subscriptions` for cleanup on extension deactivation.

## Why Terminal Over child_process

- Full stdin/stdout/stderr visibility for the user
- Inherits user's shell environment (PATH, npm config, etc.)
- Non-blocking — user can switch to other tabs while it runs
- VS Code handles process lifecycle (kill on window close)
- `child_process` is better when you need to capture and parse output programmatically

## Example

```typescript
const terminal = vscode.window.createTerminal({
    name: 'My CLI Command',
    cwd: workspaceFolder.uri,
});
terminal.show();
terminal.sendText('npx some-cli-tool');

const listener = vscode.window.onDidCloseTerminal(t => {
    if (t === terminal) {
        listener.dispose();
        onComplete();
    }
});
context.subscriptions.push(listener);
```

## When NOT to Use This

- When you need to parse CLI output (use `child_process.exec` instead)
- When the command is silent/instant (use `child_process` with progress notification)
- When you need to handle exit codes programmatically
