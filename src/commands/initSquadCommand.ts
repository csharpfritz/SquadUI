import * as vscode from 'vscode';

interface UniverseOption extends vscode.QuickPickItem {
    universe: string;
    capacity: number;
}

const UNIVERSES: UniverseOption[] = [
    { label: "Ocean's Eleven", description: '14 characters available', universe: "Ocean's Eleven", capacity: 14 },
    { label: 'Marvel Cinematic Universe', description: '14 characters available', universe: 'Marvel Cinematic Universe', capacity: 14 },
    { label: 'Star Wars', description: '14 characters available', universe: 'Star Wars', capacity: 14 },
    { label: 'The Matrix', description: '14 characters available', universe: 'The Matrix', capacity: 14 },
    { label: 'Firefly', description: '14 characters available', universe: 'Firefly', capacity: 14 },
    { label: 'Breaking Bad', description: '14 characters available', universe: 'Breaking Bad', capacity: 14 },
    { label: 'The Lord of the Rings', description: '14 characters available', universe: 'The Lord of the Rings', capacity: 14 },
    { label: 'Alien', description: '14 characters available', universe: 'Alien', capacity: 14 },
    { label: 'The Expanse', description: '14 characters available', universe: 'The Expanse', capacity: 14 },
    { label: 'Arcane', description: '14 characters available', universe: 'Arcane', capacity: 14 },
    { label: 'Ted Lasso', description: '14 characters available', universe: 'Ted Lasso', capacity: 14 },
    { label: 'Dune', description: '14 characters available', universe: 'Dune', capacity: 14 },
    { label: 'Stranger Things', description: '14 characters available', universe: 'Stranger Things', capacity: 14 },
    { label: 'Futurama', description: '14 characters available', universe: 'Futurama', capacity: 14 },
    { label: 'Doctor Who', description: '14 characters available', universe: 'Doctor Who', capacity: 14 },
];

/**
 * Native VS Code init wizard: universe QuickPick → mission InputBox → terminal.
 * Absorbs issue #26 (universe selector) into the init flow.
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

        // Step 1 — Universe QuickPick
        const selectedUniverse = await vscode.window.showQuickPick(UNIVERSES, {
            placeHolder: 'Choose a universe for your Squad',
            title: 'Form your Squad — Select Universe',
        });
        if (!selectedUniverse) {
            return; // user cancelled
        }

        // Step 2 — Mission InputBox
        const mission = await vscode.window.showInputBox({
            prompt: 'What is your team building? (language, stack, what it does)',
            placeHolder: 'e.g., A React app for managing inventory with a Node.js backend',
            title: 'Form your Squad — Describe Mission',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Mission description cannot be empty';
                }
                return undefined;
            },
        });
        if (mission === undefined) {
            return; // user cancelled
        }

        // Step 3 — Launch terminal with flags
        const terminal = vscode.window.createTerminal({
            name: 'Squad Init',
            cwd: workspaceFolder.uri,
        });
        terminal.show();
        terminal.sendText(
            `npx github:bradygaster/squad init --universe "${selectedUniverse.universe}" --mission "${mission}"`
        );

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
