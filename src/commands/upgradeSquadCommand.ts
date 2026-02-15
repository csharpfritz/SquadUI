import * as vscode from 'vscode';

/**
 * Spawns `npx github:bradygaster/squad upgrade` in a VS Code terminal,
 * then triggers a tree view refresh once the terminal closes.
 */
export function registerUpgradeSquadCommand(
    context: vscode.ExtensionContext,
    onUpgradeComplete: () => void
): vscode.Disposable {
    return vscode.commands.registerCommand('squadui.upgradeSquad', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('Squad: No workspace folder open. Open a folder first.');
            return;
        }

        const terminal = vscode.window.createTerminal({
            name: 'Squad Upgrade',
            cwd: workspaceFolder.uri,
        });
        terminal.show();
        terminal.sendText('npx github:bradygaster/squad upgrade');

        // Listen for terminal close to refresh data
        const listener = vscode.window.onDidCloseTerminal(closedTerminal => {
            if (closedTerminal === terminal) {
                listener.dispose();
                onUpgradeComplete();
                vscode.window.showInformationMessage('Squad upgrade complete. Tree view refreshed.');
            }
        });

        context.subscriptions.push(listener);
    });
}
