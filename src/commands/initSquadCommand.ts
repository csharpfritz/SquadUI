import * as vscode from 'vscode';

interface UniverseOption extends vscode.QuickPickItem {
    universe: string;
    capacity: number;
}

interface PostSetupChoice extends vscode.QuickPickItem {
    id: 'prd' | 'github' | 'copilot' | 'skip';
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

const POST_SETUP_CHOICES: PostSetupChoice[] = [
    { label: '📋 Connect PRD', description: 'Specify a Product Requirements Document', id: 'prd' },
    { label: '🔗 Connect GitHub Issues', description: 'Link to a GitHub repository for issue tracking', id: 'github' },
    { label: '🤖 Enable @copilot', description: 'Add the GitHub Copilot coding agent to your team', id: 'copilot' },
    { label: '✓ Skip additional setup', description: 'Finish and start working', id: 'skip' },
];

/**
 * Native VS Code init wizard: universe QuickPick → mission InputBox → terminal.
 * Absorbs issue #26 (universe selector) into the init flow.
 * Enhanced with post-setup options per issue #41.
 */
export function registerInitSquadCommand(
    context: vscode.ExtensionContext,
    onInitStart: () => void,
    onTerminalClose: () => void
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

        // Step 3 — Post-setup options (optional, can skip)
        let enableCopilot = false;
        let githubRepo: string | undefined;
        let prdPath: string | undefined;

        let continueSetup = true;
        while (continueSetup) {
            const choice = await vscode.window.showQuickPick(POST_SETUP_CHOICES, {
                placeHolder: 'Configure additional options (or skip to finish)',
                title: 'Form your Squad — Additional Setup',
            });
            
            if (!choice || choice.id === 'skip') {
                continueSetup = false;
            } else if (choice.id === 'copilot') {
                enableCopilot = true;
                vscode.window.showInformationMessage('✓ @copilot will be added to your team');
            } else if (choice.id === 'github') {
                const repo = await vscode.window.showInputBox({
                    prompt: 'Enter GitHub repository (owner/repo)',
                    placeHolder: 'e.g., csharpfritz/SquadUI',
                    title: 'Connect GitHub Issues',
                    validateInput: (value) => {
                        if (value && !value.match(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/)) {
                            return 'Format should be owner/repo';
                        }
                        return undefined;
                    },
                });
                if (repo) {
                    githubRepo = repo;
                    vscode.window.showInformationMessage(`✓ Will connect to ${repo}`);
                }
            } else if (choice.id === 'prd') {
                const prd = await vscode.window.showInputBox({
                    prompt: 'Enter path to PRD file (relative to workspace)',
                    placeHolder: 'e.g., docs/PRD.md',
                    title: 'Connect PRD',
                });
                if (prd) {
                    prdPath = prd;
                    vscode.window.showInformationMessage(`✓ PRD path set to ${prd}`);
                }
            }
        }

        // Start spinner immediately so user sees progress
        onInitStart();

        // Build copilot prompt with all collected info
        let copilotPrompt = `Set up the team for this project. The universe is ${selectedUniverse.universe}. The mission is: ${mission}`;
        if (enableCopilot) {
            copilotPrompt += `. Add @copilot to the team roster as the Coding Agent.`;
        }
        if (githubRepo) {
            copilotPrompt += `. Connect to GitHub repository ${githubRepo} for issue tracking.`;
        }
        if (prdPath) {
            copilotPrompt += `. Read the PRD at ${prdPath} and decompose into work items.`;
        }

        // Step 4 — Launch terminal with flags, then invoke copilot agent to set up charters
        const terminal = vscode.window.createTerminal({
            name: 'Squad Init',
            cwd: workspaceFolder.uri,
        });
        terminal.show();
        const initCmd = `npx github:bradygaster/squad init --universe "${selectedUniverse.universe}" --mission "${mission}"`;
        const copilotCmd = `copilot --agent squad -p "${copilotPrompt}" --allow-all-tools`;
        terminal.sendText(`${initCmd} && ${copilotCmd}`);

        // Auto-refresh when team.md appears
        let initCompleted = false;
        const completeInit = () => {
            if (initCompleted) { return; }
            initCompleted = true;
            watcher.dispose();
        };

        const teamMdPattern = new vscode.RelativePattern(workspaceFolder, '{.squad,.ai-team}/team.md');
        const watcher = vscode.workspace.createFileSystemWatcher(teamMdPattern, false, false, true);
        watcher.onDidCreate(() => completeInit());
        watcher.onDidChange(() => completeInit());

        // Signal extension when the terminal closes (both commands finished)
        const listener = vscode.window.onDidCloseTerminal(closedTerminal => {
            if (closedTerminal === terminal) {
                listener.dispose();
                completeInit();
                onTerminalClose();
            }
        });

        context.subscriptions.push(watcher, listener);
    });
}
