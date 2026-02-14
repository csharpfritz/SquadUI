import * as vscode from 'vscode';
// Removed unused imports path and fs

const ROLE_PICKS: vscode.QuickPickItem[] = [
    { label: 'Lead', description: 'Team lead / tech lead' },
    { label: 'Frontend Dev', description: 'UI and frontend specialist' },
    { label: 'Backend Dev', description: 'Services, APIs, data layer' },
    { label: 'Full-Stack Dev', description: 'End-to-end development' },
    { label: 'Tester / QA', description: 'Testing and quality assurance' },
    { label: 'Designer', description: 'UX/UI design' },
    { label: 'DevOps / Infrastructure', description: 'CI/CD, deployment, infra' },
    { label: 'Technical Writer', description: 'Documentation and guides' },
    { label: 'Other...', description: 'Enter a custom role' },
];

export function registerAddMemberCommand(
    _context: vscode.ExtensionContext,
    _onMemberAdded: () => void
): vscode.Disposable {
    return vscode.commands.registerCommand('squadui.addMember', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('Squad: No workspace folder open. Open a folder first.');
            return;
        }

        // Pick a role
        const picked = await vscode.window.showQuickPick(ROLE_PICKS, {
            placeHolder: 'Select a role for the new team member',
            title: 'Add Team Member — Role',
        });
        if (!picked) {
            return; // cancelled
        }

        let role = picked.label;
        if (role === 'Other...') {
            const custom = await vscode.window.showInputBox({
                prompt: 'Enter a custom role',
                placeHolder: 'e.g. Security Engineer',
                validateInput: (v) => v.trim() ? undefined : 'Role cannot be empty',
            });
            if (!custom) {
                return; // cancelled
            }
            role = custom.trim();
        }

        // Delegate to Copilot Chat
        const query = `@squad add a new team member with the role: ${role}`;
        await vscode.commands.executeCommand('workbench.action.chat.open', { query });
        
        // We don't call onMemberAdded() here because the action is async in the chat.
        // The file watcher will pick up changes when the agent completes the task.
    });
}
