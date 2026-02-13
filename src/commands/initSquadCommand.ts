import * as vscode from 'vscode';

/**
 * Spawns `npx github:bradygaster/squad init` in a VS Code terminal,
 * then triggers a tree view refresh once the terminal closes.
 */
export function registerInitSquadCommand(
    context: vscode.ExtensionContext,
    onInitComplete: () => void
): vscode.Disposable {
    return vscode.commands.registerCommand('squadui.initSquad', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('Squad: No workspace folder open. Open a folder first.');
            return;
        }

        const terminal = vscode.window.createTerminal({
            name: 'Squad Init',
            cwd: workspaceFolder.uri,
        });
        terminal.show();
        terminal.sendText('npx github:bradygaster/squad init');

        // Listen for terminal close to refresh data
        const listener = vscode.window.onDidCloseTerminal(closedTerminal => {
            if (closedTerminal === terminal) {
                listener.dispose();
                onInitComplete();
                vscode.window.showInformationMessage('Squad initialization complete. Tree view refreshed.');
            }
        });

        context.subscriptions.push(listener);
    });
}
