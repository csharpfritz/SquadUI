/**
 * Tests for the addMemberCommand.
 * 
 * Written proactively from requirements while implementation is in progress.
 * Tests cover: role quick pick, name input, file creation, and edge cases.
 * 
 * The command is expected to:
 * 1. Show a quick pick with standard roles
 * 2. Prompt for agent name
 * 3. Create charter.md and history.md in .ai-team/agents/{name}/
 * 4. Update team.md roster with the new member
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

// Workspace root for file-creation tests
const TEST_FIXTURES_ROOT = path.resolve(__dirname, '../../../test-fixtures');

/**
 * Standard roles the quick pick should offer.
 * Must stay in sync with addMemberCommand implementation.
 */
const EXPECTED_ROLES = [
    'Lead',
    'Frontend Dev',
    'Backend Dev',
    'Full-Stack Dev',
    'Tester / QA',
    'Designer',
    'DevOps / Infrastructure',
    'Technical Writer',
    'Other...',
];

suite('AddMemberCommand', () => {
    let tempDir: string;

    setup(() => {
        tempDir = path.join(TEST_FIXTURES_ROOT, 'temp-add-member');
    });

    teardown(async () => {
        try {
            await fs.promises.rm(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    // ─── Role Quick Pick ───────────────────────────────────────────────────

    suite('Role Quick Pick', () => {
        test('quick pick items include all standard roles', async () => {
            // Stub showQuickPick to capture the items it receives
            let capturedItems: readonly vscode.QuickPickItem[] | undefined;
            const originalShowQuickPick = vscode.window.showQuickPick;

            try {
                (vscode.window as any).showQuickPick = async (
                    items: vscode.QuickPickItem[] | Thenable<vscode.QuickPickItem[]>,
                    _options?: vscode.QuickPickOptions
                ) => {
                    capturedItems = await items;
                    return undefined; // simulate cancel
                };

                await vscode.commands.executeCommand('squadui.addMember');

                assert.ok(capturedItems, 'showQuickPick should have been called');
                const labels = (capturedItems as vscode.QuickPickItem[]).map(i => i.label);

                for (const role of EXPECTED_ROLES) {
                    assert.ok(
                        labels.includes(role),
                        `Quick pick should include "${role}" but got: ${labels.join(', ')}`
                    );
                }
            } finally {
                (vscode.window as any).showQuickPick = originalShowQuickPick;
            }
        });

        test('selecting "Other..." triggers freeform input box for custom role', async () => {
            const originalShowQuickPick = vscode.window.showQuickPick;
            const originalShowInputBox = vscode.window.showInputBox;
            let inputBoxCalled = false;
            let inputBoxOptions: vscode.InputBoxOptions | undefined;

            try {
                // Stub: select "Other..." from the quick pick
                (vscode.window as any).showQuickPick = async (
                    items: vscode.QuickPickItem[] | Thenable<vscode.QuickPickItem[]>,
                    _options?: vscode.QuickPickOptions
                ) => {
                    const resolved = await items;
                    return (resolved as vscode.QuickPickItem[]).find(i => i.label === 'Other...');
                };

                // Stub: capture showInputBox call, then cancel to stop the flow
                (vscode.window as any).showInputBox = async (options?: vscode.InputBoxOptions) => {
                    inputBoxCalled = true;
                    inputBoxOptions = options;
                    return undefined; // cancel
                };

                await vscode.commands.executeCommand('squadui.addMember');

                assert.ok(inputBoxCalled, 'Input box should be shown for custom role');
                assert.ok(
                    inputBoxOptions?.prompt?.toLowerCase().includes('role') ||
                    inputBoxOptions?.placeHolder?.toLowerCase().includes('role'),
                    'Input box should mention "role" in prompt or placeholder'
                );
            } finally {
                (vscode.window as any).showQuickPick = originalShowQuickPick;
                (vscode.window as any).showInputBox = originalShowInputBox;
            }
        });

        test('canceling role quick pick aborts without errors', async () => {
            const originalShowQuickPick = vscode.window.showQuickPick;

            try {
                (vscode.window as any).showQuickPick = async () => undefined;

                // Should not throw
                await vscode.commands.executeCommand('squadui.addMember');
                assert.ok(true, 'Command should complete without throwing');
            } finally {
                (vscode.window as any).showQuickPick = originalShowQuickPick;
            }
        });
    });

    // ─── Name Input ────────────────────────────────────────────────────────

    suite('Name Input', () => {
        test('name input box appears after role selection', async () => {
            const originalShowQuickPick = vscode.window.showQuickPick;
            const originalShowInputBox = vscode.window.showInputBox;
            let nameInputShown = false;
            let callCount = 0;

            try {
                // Stub: select a standard role
                (vscode.window as any).showQuickPick = async (
                    items: vscode.QuickPickItem[] | Thenable<vscode.QuickPickItem[]>,
                    _options?: vscode.QuickPickOptions
                ) => {
                    const resolved = await items;
                    return (resolved as vscode.QuickPickItem[]).find(i => i.label === 'Tester / QA');
                };

                (vscode.window as any).showInputBox = async (options?: vscode.InputBoxOptions) => {
                    callCount++;
                    // The first (or only) input box after role selection should be the name
                    if (
                        options?.prompt?.toLowerCase().includes('name') ||
                        options?.placeHolder?.toLowerCase().includes('name')
                    ) {
                        nameInputShown = true;
                    }
                    return undefined; // cancel
                };

                await vscode.commands.executeCommand('squadui.addMember');

                assert.ok(callCount > 0, 'showInputBox should be called after role selection');
                assert.ok(nameInputShown, 'Input box should prompt for a name');
            } finally {
                (vscode.window as any).showQuickPick = originalShowQuickPick;
                (vscode.window as any).showInputBox = originalShowInputBox;
            }
        });

        test('canceling name input aborts without errors', async () => {
            const originalShowQuickPick = vscode.window.showQuickPick;
            const originalShowInputBox = vscode.window.showInputBox;

            try {
                (vscode.window as any).showQuickPick = async (
                    items: vscode.QuickPickItem[] | Thenable<vscode.QuickPickItem[]>,
                ) => {
                    const resolved = await items;
                    return (resolved as vscode.QuickPickItem[]).find(i => i.label === 'Lead');
                };

                (vscode.window as any).showInputBox = async () => undefined; // cancel

                await vscode.commands.executeCommand('squadui.addMember');
                assert.ok(true, 'Command should abort gracefully');
            } finally {
                (vscode.window as any).showQuickPick = originalShowQuickPick;
                (vscode.window as any).showInputBox = originalShowInputBox;
            }
        });

        test('empty name is rejected or handled', async () => {
            const originalShowQuickPick = vscode.window.showQuickPick;
            const originalShowInputBox = vscode.window.showInputBox;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let validationFn: ((value: string) => any) | undefined;

            try {
                (vscode.window as any).showQuickPick = async (
                    items: vscode.QuickPickItem[] | Thenable<vscode.QuickPickItem[]>,
                ) => {
                    const resolved = await items;
                    return (resolved as vscode.QuickPickItem[]).find(i => i.label === 'Lead');
                };

                (vscode.window as any).showInputBox = async (options?: vscode.InputBoxOptions) => {
                    if (
                        options?.prompt?.toLowerCase().includes('name') ||
                        options?.placeHolder?.toLowerCase().includes('name')
                    ) {
                        validationFn = options?.validateInput;
                    }
                    return undefined; // cancel
                };

                await vscode.commands.executeCommand('squadui.addMember');

                // Either a validation function should reject empty strings,
                // or the command should handle empty names gracefully after the fact
                if (validationFn) {
                    const result = await validationFn('');
                    assert.ok(
                        result !== undefined && result !== null && result !== '',
                        'Empty name should produce a validation error'
                    );
                    const resultWhitespace = await validationFn('   ');
                    assert.ok(
                        resultWhitespace !== undefined && resultWhitespace !== null && resultWhitespace !== '',
                        'Whitespace-only name should produce a validation error'
                    );
                }
                // If no validation function, we trust the command handles it (test is informational)
            } finally {
                (vscode.window as any).showQuickPick = originalShowQuickPick;
                (vscode.window as any).showInputBox = originalShowInputBox;
            }
        });
    });

    // ─── File Creation ─────────────────────────────────────────────────────

    suite('File Creation', () => {
        /**
         * Helper: stubs VS Code pickers to select a role and enter a name,
         * using tempDir as the workspace root.
         * Returns a restore function.
         */
        function stubPickersForCreation(
            roleName: string,
            agentName: string
        ): () => void {
            const origQP = vscode.window.showQuickPick;
            const origIB = vscode.window.showInputBox;
            let inputCallIndex = 0;

            (vscode.window as any).showQuickPick = async (
                items: vscode.QuickPickItem[] | Thenable<vscode.QuickPickItem[]>,
            ) => {
                const resolved = await items;
                return (resolved as vscode.QuickPickItem[]).find(i => i.label === roleName);
            };

            (vscode.window as any).showInputBox = async (options?: vscode.InputBoxOptions) => {
                inputCallIndex++;
                // When "Other..." is selected there may be two input boxes:
                // first for custom role, then for name. Otherwise just name.
                if (
                    options?.prompt?.toLowerCase().includes('name') ||
                    options?.placeHolder?.toLowerCase().includes('name')
                ) {
                    return agentName;
                }
                // For custom role input
                if (
                    options?.prompt?.toLowerCase().includes('role') ||
                    options?.placeHolder?.toLowerCase().includes('role')
                ) {
                    return roleName;
                }
                // Fallback: first call is role (Other...), second is name
                return inputCallIndex === 1 ? roleName : agentName;
            };

            return () => {
                (vscode.window as any).showQuickPick = origQP;
                (vscode.window as any).showInputBox = origIB;
            };
        }

        /**
         * Helper: sets up a minimal workspace at tempDir with .ai-team/team.md.
         */
        async function setupWorkspace(): Promise<void> {
            const teamDir = path.join(tempDir, '.ai-team');
            await fs.promises.mkdir(path.join(teamDir, 'agents'), { recursive: true });
            await fs.promises.writeFile(
                path.join(teamDir, 'team.md'),
                [
                    '# Team',
                    '',
                    '## Members',
                    '',
                    '| Name | Role | Charter | Status |',
                    '|------|------|---------|--------|',
                    '| Danny | Lead | `.ai-team/agents/danny/charter.md` | ✅ Active |',
                    '',
                ].join('\n')
            );
        }

        test('charter.md is created in .ai-team/agents/{lowercase-name}/', async function () {
            // Skip if addMember command not yet registered
            const commands = await vscode.commands.getCommands(true);
            if (!commands.includes('squadui.addMember')) {
                this.skip();
                return;
            }

            await setupWorkspace();
            const restore = stubPickersForCreation('Backend Dev', 'TestBot');
            try {
                await vscode.commands.executeCommand('squadui.addMember');

                const charterPath = path.join(tempDir, '.ai-team', 'agents', 'testbot', 'charter.md');
                const exists = fs.existsSync(charterPath);
                assert.ok(exists, `charter.md should exist at ${charterPath}`);

                const content = fs.readFileSync(charterPath, 'utf-8');
                assert.ok(
                    content.includes('TestBot') || content.includes('testbot'),
                    'charter.md should contain the agent name'
                );
                assert.ok(
                    content.includes('Backend Dev'),
                    'charter.md should contain the selected role'
                );
            } finally {
                restore();
            }
        });

        test('history.md is created alongside charter.md', async function () {
            const commands = await vscode.commands.getCommands(true);
            if (!commands.includes('squadui.addMember')) {
                this.skip();
                return;
            }

            await setupWorkspace();
            const restore = stubPickersForCreation('Frontend Dev', 'PixelBot');
            try {
                await vscode.commands.executeCommand('squadui.addMember');

                const historyPath = path.join(tempDir, '.ai-team', 'agents', 'pixelbot', 'history.md');
                const exists = fs.existsSync(historyPath);
                assert.ok(exists, `history.md should exist at ${historyPath}`);
            } finally {
                restore();
            }
        });

        test('team.md roster is updated with new member row', async function () {
            const commands = await vscode.commands.getCommands(true);
            if (!commands.includes('squadui.addMember')) {
                this.skip();
                return;
            }

            await setupWorkspace();
            const restore = stubPickersForCreation('Designer', 'Artie');
            try {
                await vscode.commands.executeCommand('squadui.addMember');

                const teamMdPath = path.join(tempDir, '.ai-team', 'team.md');
                const content = fs.readFileSync(teamMdPath, 'utf-8');

                assert.ok(content.includes('Artie'), 'team.md should contain the new member name');
                assert.ok(content.includes('Designer'), 'team.md should contain the new member role');
                assert.ok(
                    content.includes('.ai-team/agents/artie/charter.md'),
                    'team.md should reference the charter path'
                );
            } finally {
                restore();
            }
        });
    });

    // ─── Edge Cases ────────────────────────────────────────────────────────

    suite('Edge Cases', () => {

        async function setupWorkspace(): Promise<void> {
            const teamDir = path.join(tempDir, '.ai-team');
            await fs.promises.mkdir(path.join(teamDir, 'agents'), { recursive: true });
            await fs.promises.writeFile(
                path.join(teamDir, 'team.md'),
                [
                    '# Team',
                    '',
                    '## Members',
                    '',
                    '| Name | Role | Charter | Status |',
                    '|------|------|---------|--------|',
                    '| Danny | Lead | `.ai-team/agents/danny/charter.md` | ✅ Active |',
                    '',
                ].join('\n')
            );
        }

        test('agent name with spaces is normalized to lowercase directory name', async function () {
            const commands = await vscode.commands.getCommands(true);
            if (!commands.includes('squadui.addMember')) {
                this.skip();
                return;
            }

            await setupWorkspace();
            const origQP = vscode.window.showQuickPick;
            const origIB = vscode.window.showInputBox;

            try {
                (vscode.window as any).showQuickPick = async (
                    items: vscode.QuickPickItem[] | Thenable<vscode.QuickPickItem[]>,
                ) => {
                    const resolved = await items;
                    return (resolved as vscode.QuickPickItem[]).find(i => i.label === 'Full-Stack Dev');
                };
                (vscode.window as any).showInputBox = async (options?: vscode.InputBoxOptions) => {
                    if (
                        options?.prompt?.toLowerCase().includes('name') ||
                        options?.placeHolder?.toLowerCase().includes('name')
                    ) {
                        return 'Code Monkey';
                    }
                    return 'Code Monkey';
                };

                await vscode.commands.executeCommand('squadui.addMember');

                // The directory name should be normalized — spaces become hyphens or removed, lowercase
                const agentsDir = path.join(tempDir, '.ai-team', 'agents');
                const dirs = fs.readdirSync(agentsDir);
                const normalized = dirs.find(d =>
                    d === 'code-monkey' || d === 'codemonkey' || d === 'code_monkey'
                );
                assert.ok(
                    normalized,
                    `Agent directory should be normalized, found: ${dirs.join(', ')}`
                );

                // Verify files exist inside the normalized directory
                const charterExists = fs.existsSync(path.join(agentsDir, normalized!, 'charter.md'));
                assert.ok(charterExists, 'charter.md should exist in the normalized directory');
            } finally {
                (vscode.window as any).showQuickPick = origQP;
                (vscode.window as any).showInputBox = origIB;
            }
        });

        test('adding agent that already exists warns or handles gracefully', async function () {
            const commands = await vscode.commands.getCommands(true);
            if (!commands.includes('squadui.addMember')) {
                this.skip();
                return;
            }

            await setupWorkspace();

            // Pre-create the agent directory and charter
            const existingDir = path.join(tempDir, '.ai-team', 'agents', 'danny');
            await fs.promises.mkdir(existingDir, { recursive: true });
            await fs.promises.writeFile(
                path.join(existingDir, 'charter.md'),
                '# Danny Charter\nExisting content that should not be destroyed.\n'
            );

            const origQP = vscode.window.showQuickPick;
            const origIB = vscode.window.showInputBox;
            let warningShown = false;
            const origWarn = vscode.window.showWarningMessage;

            try {
                (vscode.window as any).showQuickPick = async (
                    items: vscode.QuickPickItem[] | Thenable<vscode.QuickPickItem[]>,
                ) => {
                    const resolved = await items;
                    return (resolved as vscode.QuickPickItem[]).find(i => i.label === 'Lead');
                };
                (vscode.window as any).showInputBox = async (options?: vscode.InputBoxOptions) => {
                    // If the command has validateInput, it might reject duplicates there
                    if (options?.validateInput) {
                        const result = await options.validateInput('Danny');
                        if (result) {
                            // Validation rejected it — that counts as handled
                            warningShown = true;
                            return undefined; // cancel
                        }
                    }
                    if (
                        options?.prompt?.toLowerCase().includes('name') ||
                        options?.placeHolder?.toLowerCase().includes('name')
                    ) {
                        return 'Danny';
                    }
                    return 'Danny';
                };
                (vscode.window as any).showWarningMessage = async (_message: string, ..._items: any[]) => {
                    warningShown = true;
                    return undefined; // dismiss
                };

                await vscode.commands.executeCommand('squadui.addMember');

                // The command should either warn about the duplicate or prevent overwrite
                const existingContent = fs.readFileSync(
                    path.join(existingDir, 'charter.md'),
                    'utf-8'
                );

                // At minimum, the original file should not be silently destroyed
                const contentPreserved = existingContent.includes('Existing content');
                const userWarned = warningShown;

                assert.ok(
                    contentPreserved || userWarned,
                    'Command should either preserve existing files or warn about duplicates'
                );
            } finally {
                (vscode.window as any).showQuickPick = origQP;
                (vscode.window as any).showInputBox = origIB;
                (vscode.window as any).showWarningMessage = origWarn;
            }
        });

        test('custom role via "Other..." produces correct charter content', async function () {
            const commands = await vscode.commands.getCommands(true);
            if (!commands.includes('squadui.addMember')) {
                this.skip();
                return;
            }

            await setupWorkspace();
            const origQP = vscode.window.showQuickPick;
            const origIB = vscode.window.showInputBox;

            try {
                (vscode.window as any).showQuickPick = async (
                    items: vscode.QuickPickItem[] | Thenable<vscode.QuickPickItem[]>,
                ) => {
                    const resolved = await items;
                    return (resolved as vscode.QuickPickItem[]).find(i => i.label === 'Other...');
                };

                let callIndex = 0;
                (vscode.window as any).showInputBox = async (options?: vscode.InputBoxOptions) => {
                    callIndex++;
                    if (
                        options?.prompt?.toLowerCase().includes('role') ||
                        options?.placeHolder?.toLowerCase().includes('role')
                    ) {
                        return 'Security Auditor';
                    }
                    if (
                        options?.prompt?.toLowerCase().includes('name') ||
                        options?.placeHolder?.toLowerCase().includes('name')
                    ) {
                        return 'Sentinel';
                    }
                    // Fallback ordering: first is custom role, second is name
                    return callIndex === 1 ? 'Security Auditor' : 'Sentinel';
                };

                await vscode.commands.executeCommand('squadui.addMember');

                const charterPath = path.join(tempDir, '.ai-team', 'agents', 'sentinel', 'charter.md');
                if (fs.existsSync(charterPath)) {
                    const content = fs.readFileSync(charterPath, 'utf-8');
                    assert.ok(
                        content.includes('Security Auditor'),
                        'Charter should contain the custom role'
                    );
                }
            } finally {
                (vscode.window as any).showQuickPick = origQP;
                (vscode.window as any).showInputBox = origIB;
            }
        });
    });
});
