import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

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

function toSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function generateCharter(name: string, role: string): string {
    return `# ${name} — ${role}

## Identity

- **Name:** ${name}
- **Role:** ${role}

## What I Own

<!-- Define what this member is responsible for -->

## How I Work

<!-- Describe working style and practices -->

## Boundaries

**I handle:** <!-- areas of responsibility -->

**I don't handle:** <!-- out of scope -->

**When I'm unsure:** I say so and suggest who might know.

## Voice

<!-- Describe communication style -->
`;
}

function generateHistory(_name: string, role: string): string {
    const today = new Date().toISOString().slice(0, 10);
    return `# Project Context

- **Owner:** <!-- project owner -->
- **Project:** VS Code extension for visualizing Squad team members and their tasks
- **Stack:** TypeScript, VS Code Extension API
- **Created:** ${today}

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### ${today}: Joined as ${role}
- Added to the team roster
`;
}

export function registerAddMemberCommand(
    _context: vscode.ExtensionContext,
    onMemberAdded: () => void
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

        // Get name
        const name = await vscode.window.showInputBox({
            prompt: 'Enter the member\'s name',
            placeHolder: 'e.g. Alex',
            title: 'Add Team Member — Name',
            validateInput: (v) => v.trim() ? undefined : 'Name cannot be empty',
        });
        if (!name) {
            return; // cancelled
        }
        const trimmedName = name.trim();
        const slug = toSlug(trimmedName);

        const teamRoot = workspaceFolder.uri.fsPath;
        const agentDir = path.join(teamRoot, '.ai-team', 'agents', slug);

        // Guard against duplicate
        if (fs.existsSync(agentDir)) {
            vscode.window.showWarningMessage(`Agent directory already exists: .ai-team/agents/${slug}`);
            return;
        }

        // Create agent directory and files
        fs.mkdirSync(agentDir, { recursive: true });
        fs.writeFileSync(path.join(agentDir, 'charter.md'), generateCharter(trimmedName, role), 'utf-8');
        fs.writeFileSync(path.join(agentDir, 'history.md'), generateHistory(trimmedName, role), 'utf-8');

        // Append to team.md roster
        const teamMdPath = path.join(teamRoot, '.ai-team', 'team.md');
        if (fs.existsSync(teamMdPath)) {
            const content = fs.readFileSync(teamMdPath, 'utf-8');
            const rosterLine = `| ${trimmedName} | ${role} | \`.ai-team/agents/${slug}/charter.md\` | ✅ Active |`;
            // Insert before the first blank line after the Members table rows
            const lines = content.split('\n');
            let insertIndex = -1;
            let inMembersTable = false;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('## Members')) {
                    inMembersTable = true;
                    continue;
                }
                if (inMembersTable && lines[i].startsWith('|') && !lines[i].startsWith('|--') && !lines[i].includes('Name')) {
                    insertIndex = i + 1; // track last data row
                }
                if (inMembersTable && !lines[i].startsWith('|') && insertIndex > 0) {
                    break; // end of table
                }
            }
            if (insertIndex > 0) {
                lines.splice(insertIndex, 0, rosterLine);
                fs.writeFileSync(teamMdPath, lines.join('\n'), 'utf-8');
            }
        }

        vscode.window.showInformationMessage(`Added ${trimmedName} as ${role}`);
        onMemberAdded();
    });
}
