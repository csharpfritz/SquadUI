import * as vscode from 'vscode';
import { Skill } from '../models';
import { SkillCatalogService } from '../services';

interface SkillQuickPickItem extends vscode.QuickPickItem {
    skill?: Skill;
}

const SOURCE_PICKS: vscode.QuickPickItem[] = [
    { label: '📦 awesome-copilot', description: 'Browse skills from the awesome-copilot repo' },
    { label: '🏆 skills.sh', description: 'Browse skills from the skills.sh leaderboard' },
    { label: '🔍 Search all sources', description: 'Search across both' },
];

function sourceBadge(source: string): string {
    switch (source) {
        case 'awesome-copilot': return '📦 awesome-copilot';
        case 'skills.sh': return '🏆 skills.sh';
        default: return '🎯 local';
    }
}

function toQuickPickItems(skills: Skill[]): SkillQuickPickItem[] {
    return skills.map(skill => ({
        label: skill.name,
        description: skill.description,
        detail: sourceBadge(skill.source),
        skill,
    }));
}

export function registerAddSkillCommand(
    _context: vscode.ExtensionContext,
    onSkillAdded: () => void
): vscode.Disposable {
    const catalogService = new SkillCatalogService();

    return vscode.commands.registerCommand('squadui.addSkill', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('Squad: No workspace folder open. Open a folder first.');
            return;
        }

        // Step 1: Source selection
        const sourcePick = await vscode.window.showQuickPick(SOURCE_PICKS, {
            placeHolder: 'Where would you like to browse skills?',
            title: 'Add Skill — Source',
        });
        if (!sourcePick) {
            return;
        }

        let skills: Skill[];

        if (sourcePick.label === '🔍 Search all sources') {
            // Step 2a: Search flow
            const query = await vscode.window.showInputBox({
                prompt: 'Search for a skill...',
                placeHolder: 'e.g. code review, testing, documentation',
                title: 'Add Skill — Search',
            });
            if (!query) {
                return;
            }

            try {
                skills = await vscode.window.withProgress(
                    { location: vscode.ProgressLocation.Notification, title: 'Searching skills...' },
                    () => catalogService.searchSkills(query)
                );
            } catch (err) {
                vscode.window.showErrorMessage(`Failed to search skills: ${err instanceof Error ? err.message : 'Unknown error'}`);
                return;
            }
        } else {
            // Step 2b: Browse specific source
            const source = sourcePick.label.includes('awesome-copilot') ? 'awesome-copilot' as const : 'skills.sh' as const;

            try {
                skills = await vscode.window.withProgress(
                    { location: vscode.ProgressLocation.Notification, title: `Fetching ${source} catalog...` },
                    () => catalogService.fetchCatalog(source)
                );
            } catch (err) {
                vscode.window.showErrorMessage(`Failed to fetch ${source} catalog: ${err instanceof Error ? err.message : 'Unknown error'}`);
                return;
            }
        }

        if (skills.length === 0) {
            vscode.window.showInformationMessage('No skills found.');
            return;
        }

        // Step 2 continued: Pick a skill
        const picked = await vscode.window.showQuickPick(toQuickPickItems(skills), {
            placeHolder: 'Select a skill to install',
            title: 'Add Skill — Select',
            matchOnDescription: true,
        });
        if (!picked?.skill) {
            return;
        }

        const skill = picked.skill;

        // Step 3: Confirm & install
        const confirm = await vscode.window.showQuickPick(
            [
                { label: '$(check) Install', description: `Download "${skill.name}" to .ai-team/skills/` },
                { label: '$(close) Cancel', description: 'Go back' },
            ],
            {
                placeHolder: `Install "${skill.name}"? (${skill.description})`,
                title: 'Add Skill — Confirm',
            }
        );
        if (!confirm || confirm.label === '$(close) Cancel') {
            return;
        }

        // Download with progress
        const teamRoot = workspaceFolder.uri.fsPath;
        try {
            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: `Installing ${skill.name}...` },
                () => catalogService.downloadSkill(skill, teamRoot)
            );

            vscode.window.showInformationMessage(`Installed skill: ${skill.name}`);
            onSkillAdded();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';

            // Handle duplicate/overwrite scenario
            if (message.includes('already installed')) {
                const overwrite = await vscode.window.showQuickPick(
                    [
                        { label: '$(check) Yes', description: 'Overwrite the existing skill' },
                        { label: '$(close) No', description: 'Keep the existing skill' },
                    ],
                    {
                        placeHolder: `"${skill.name}" is already installed. Overwrite?`,
                        title: 'Add Skill — Overwrite',
                    }
                );
                if (overwrite?.label === '$(check) Yes') {
                    try {
                        await vscode.window.withProgress(
                            { location: vscode.ProgressLocation.Notification, title: `Overwriting ${skill.name}...` },
                            () => catalogService.downloadSkill(skill, teamRoot, true)
                        );
                        vscode.window.showInformationMessage(`Reinstalled skill: ${skill.name}`);
                        onSkillAdded();
                    } catch (retryErr) {
                        vscode.window.showErrorMessage(`Failed to install skill: ${retryErr instanceof Error ? retryErr.message : 'Unknown error'}`);
                    }
                }
            } else {
                vscode.window.showErrorMessage(`Failed to install skill: ${message}`);
            }
        }
    });
}
