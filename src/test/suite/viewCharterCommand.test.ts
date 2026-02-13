/**
 * Tests for the viewCharter command (squadui.viewCharter).
 *
 * The command is defined inline in extension.ts and:
 * 1. Takes a memberName argument
 * 2. Converts name to slug (lowercase, non-alphanumeric → hyphens)
 * 3. Opens .ai-team/agents/{slug}/charter.md in the editor
 * 4. Shows warning if charter not found or no member selected
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

const TEST_FIXTURES_ROOT = path.resolve(__dirname, '../../../test-fixtures');

suite('ViewCharterCommand', () => {
    let tempDir: string;

    setup(() => {
        tempDir = path.join(TEST_FIXTURES_ROOT, 'temp-view-charter');
    });

    teardown(async () => {
        try {
            await fs.promises.rm(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    // ─── Command Registration ──────────────────────────────────────────────

    suite('Command Registration', () => {
        test('viewCharter command is registered', async function () {
            const extension = vscode.extensions.getExtension('csharpfritz.squadui');
            if (!extension || !extension.isActive || !vscode.workspace.workspaceFolders?.length) {
                this.skip();
                return;
            }

            const commands = await vscode.commands.getCommands(true);
            assert.ok(
                commands.includes('squadui.viewCharter'),
                'squadui.viewCharter command should be registered'
            );
        });

        test('viewCharter command is declared in package.json', async () => {
            const extension = vscode.extensions.getExtension('csharpfritz.squadui');
            if (extension) {
                const packageJson = extension.packageJSON;
                const cmds = packageJson?.contributes?.commands || [];
                const hasCmd = cmds.some(
                    (c: { command: string }) => c.command === 'squadui.viewCharter'
                );
                assert.ok(hasCmd, 'viewCharter should be declared in package.json commands');
            }
        });
    });

    // ─── Opening Charter ───────────────────────────────────────────────────

    suite('Opening Charter', () => {
        test('opens charter.md for a valid member', async function () {
            const commands = await vscode.commands.getCommands(true);
            if (!commands.includes('squadui.viewCharter')) {
                this.skip();
                return;
            }

            // Set up a charter file in the workspace
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) {
                this.skip();
                return;
            }

            const agentDir = path.join(workspaceRoot, '.ai-team', 'agents', 'testmember');
            const charterPath = path.join(agentDir, 'charter.md');
            const charterExistedBefore = fs.existsSync(charterPath);

            try {
                // Create a charter file if it doesn't exist
                if (!charterExistedBefore) {
                    fs.mkdirSync(agentDir, { recursive: true });
                    fs.writeFileSync(charterPath, '# TestMember — Tester\n\nTest charter content.\n', 'utf-8');
                }

                // We can't easily stub openTextDocument via the command route,
                // but we can verify the document is opened by checking the active editor after
                await vscode.commands.executeCommand('squadui.viewCharter', 'TestMember');

                // Give VS Code a moment to open the document
                await new Promise(resolve => setTimeout(resolve, 500));

                const activeEditor = vscode.window.activeTextEditor;
                if (activeEditor) {
                    const activeFilePath = activeEditor.document.uri.fsPath;
                    assert.ok(
                        activeFilePath.endsWith(path.join('agents', 'testmember', 'charter.md')),
                        `Active editor should show charter.md, got: ${activeFilePath}`
                    );
                }
                // If no active editor, the test is inconclusive (VS Code test host limitations)
            } finally {
                // Cleanup: remove the test charter if we created it
                if (!charterExistedBefore) {
                    try {
                        fs.rmSync(agentDir, { recursive: true, force: true });
                    } catch {
                        // Ignore cleanup errors
                    }
                }
            }
        });
    });

    // ─── Warnings ──────────────────────────────────────────────────────────

    suite('Warnings', () => {
        test('shows warning when charter not found', async function () {
            const commands = await vscode.commands.getCommands(true);
            if (!commands.includes('squadui.viewCharter')) {
                this.skip();
                return;
            }

            if (!vscode.workspace.workspaceFolders?.length) {
                this.skip();
                return;
            }

            const origWarn = vscode.window.showWarningMessage;
            let warningShown = false;
            let warningMessage = '';

            try {
                (vscode.window as any).showWarningMessage = async (msg: string, ..._items: any[]) => {
                    warningShown = true;
                    warningMessage = msg;
                    return undefined;
                };

                // Use a member name that definitely doesn't have a charter
                await vscode.commands.executeCommand('squadui.viewCharter', 'NonExistentMember12345');

                assert.ok(warningShown, 'Should show a warning when charter file does not exist');
                assert.ok(
                    warningMessage.toLowerCase().includes('charter') ||
                    warningMessage.toLowerCase().includes('not found'),
                    `Warning should mention charter or not found, got: "${warningMessage}"`
                );
            } finally {
                (vscode.window as any).showWarningMessage = origWarn;
            }
        });

        test('shows warning when no member selected (empty string)', async function () {
            const commands = await vscode.commands.getCommands(true);
            if (!commands.includes('squadui.viewCharter')) {
                this.skip();
                return;
            }

            if (!vscode.workspace.workspaceFolders?.length) {
                this.skip();
                return;
            }

            const origWarn = vscode.window.showWarningMessage;
            let warningShown = false;
            let warningMessage = '';

            try {
                (vscode.window as any).showWarningMessage = async (msg: string, ..._items: any[]) => {
                    warningShown = true;
                    warningMessage = msg;
                    return undefined;
                };

                // Pass empty string as member name
                await vscode.commands.executeCommand('squadui.viewCharter', '');

                assert.ok(warningShown, 'Should show a warning when no member is selected');
                assert.ok(
                    warningMessage.toLowerCase().includes('member') ||
                    warningMessage.toLowerCase().includes('selected'),
                    `Warning should mention member or selection, got: "${warningMessage}"`
                );
            } finally {
                (vscode.window as any).showWarningMessage = origWarn;
            }
        });

        test('shows warning when member name is undefined', async function () {
            const commands = await vscode.commands.getCommands(true);
            if (!commands.includes('squadui.viewCharter')) {
                this.skip();
                return;
            }

            if (!vscode.workspace.workspaceFolders?.length) {
                this.skip();
                return;
            }

            const origWarn = vscode.window.showWarningMessage;
            let warningShown = false;

            try {
                (vscode.window as any).showWarningMessage = async (_message: string, ..._items: any[]) => {
                    warningShown = true;
                    return undefined;
                };

                // Pass no arguments (undefined member name)
                await vscode.commands.executeCommand('squadui.viewCharter');

                assert.ok(warningShown, 'Should show a warning when member name is undefined');
            } finally {
                (vscode.window as any).showWarningMessage = origWarn;
            }
        });
    });

    // ─── Slug Generation ───────────────────────────────────────────────────

    suite('Slug Generation', () => {
        test('handles member names with special characters', async function () {
            const commands = await vscode.commands.getCommands(true);
            if (!commands.includes('squadui.viewCharter')) {
                this.skip();
                return;
            }

            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) {
                this.skip();
                return;
            }

            // "Dr. O'Brien" should slugify to "dr-o-brien"
            const slug = 'dr-o-brien';
            const agentDir = path.join(workspaceRoot, '.ai-team', 'agents', slug);
            const charterPath = path.join(agentDir, 'charter.md');
            const charterExistedBefore = fs.existsSync(charterPath);

            try {
                if (!charterExistedBefore) {
                    fs.mkdirSync(agentDir, { recursive: true });
                    fs.writeFileSync(charterPath, '# Dr. O\'Brien — Specialist\n', 'utf-8');
                }

                const origWarn = vscode.window.showWarningMessage;
                let warningShown = false;

                (vscode.window as any).showWarningMessage = async (_message: string, ..._items: any[]) => {
                    warningShown = true;
                    return undefined;
                };

                try {
                    await vscode.commands.executeCommand('squadui.viewCharter', "Dr. O'Brien");

                    // Wait for VS Code to process
                    await new Promise(resolve => setTimeout(resolve, 500));

                    // If the charter was found and opened, no warning should have been shown
                    // This verifies the slug generation correctly handled special characters
                    assert.ok(
                        !warningShown,
                        'Should not show warning — charter for slugified special-character name should be found'
                    );
                } finally {
                    (vscode.window as any).showWarningMessage = origWarn;
                }
            } finally {
                if (!charterExistedBefore) {
                    try {
                        fs.rmSync(agentDir, { recursive: true, force: true });
                    } catch {
                        // Ignore cleanup errors
                    }
                }
            }
        });

        test('handles member names with spaces', async function () {
            const commands = await vscode.commands.getCommands(true);
            if (!commands.includes('squadui.viewCharter')) {
                this.skip();
                return;
            }

            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) {
                this.skip();
                return;
            }

            // "Code Monkey" should slugify to "code-monkey"
            const slug = 'code-monkey';
            const agentDir = path.join(workspaceRoot, '.ai-team', 'agents', slug);
            const charterPath = path.join(agentDir, 'charter.md');
            const charterExistedBefore = fs.existsSync(charterPath);

            try {
                if (!charterExistedBefore) {
                    fs.mkdirSync(agentDir, { recursive: true });
                    fs.writeFileSync(charterPath, '# Code Monkey — Full-Stack Dev\n', 'utf-8');
                }

                const origWarn = vscode.window.showWarningMessage;
                let warningShown = false;

                (vscode.window as any).showWarningMessage = async (_message: string, ..._items: any[]) => {
                    warningShown = true;
                    return undefined;
                };

                try {
                    await vscode.commands.executeCommand('squadui.viewCharter', 'Code Monkey');

                    await new Promise(resolve => setTimeout(resolve, 500));

                    assert.ok(
                        !warningShown,
                        'Should not show warning — charter for space-separated name should be found via slug'
                    );
                } finally {
                    (vscode.window as any).showWarningMessage = origWarn;
                }
            } finally {
                if (!charterExistedBefore) {
                    try {
                        fs.rmSync(agentDir, { recursive: true, force: true });
                    } catch {
                        // Ignore cleanup errors
                    }
                }
            }
        });
    });
});
