/**
 * Tests for the editCharter command (squadui.editCharter).
 *
 * The command opens a charter file in VS Code's text editor with
 * markdown preview side-by-side for in-place editing.
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

suite('EditCharterCommand', () => {
    // ─── Command Registration ──────────────────────────────────────────────

    suite('Command Registration', () => {
        test('editCharter command is registered', async function () {
            const extension = vscode.extensions.getExtension('csharpfritz.squadui');
            if (!extension || !extension.isActive || !vscode.workspace.workspaceFolders?.length) {
                this.skip();
                return;
            }

            const commands = await vscode.commands.getCommands(true);
            assert.ok(
                commands.includes('squadui.editCharter'),
                'squadui.editCharter command should be registered'
            );
        });

        test('editCharter command is declared in package.json', async () => {
            const extension = vscode.extensions.getExtension('csharpfritz.squadui');
            if (extension) {
                const packageJson = extension.packageJSON;
                const cmds = packageJson?.contributes?.commands || [];
                const hasCmd = cmds.some(
                    (c: { command: string }) => c.command === 'squadui.editCharter'
                );
                assert.ok(hasCmd, 'editCharter should be declared in package.json commands');
            }
        });

        test('editCharter has context menu entry for member items', async () => {
            const extension = vscode.extensions.getExtension('csharpfritz.squadui');
            if (extension) {
                const packageJson = extension.packageJSON;
                const menus = packageJson?.contributes?.menus?.['view/item/context'] || [];
                const hasMenu = menus.some(
                    (m: { command: string; when: string }) =>
                        m.command === 'squadui.editCharter' &&
                        m.when.includes('viewItem == member')
                );
                assert.ok(hasMenu, 'editCharter should have a context menu entry for member items');
            }
        });
    });

    // ─── Opening Charter for Editing ───────────────────────────────────────

    suite('Opening Charter for Editing', () => {
        test('opens charter.md in text editor for a valid member', async function () {
            const commands = await vscode.commands.getCommands(true);
            if (!commands.includes('squadui.editCharter')) {
                this.skip();
                return;
            }

            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) {
                this.skip();
                return;
            }

            const agentDir = path.join(workspaceRoot, '.ai-team', 'agents', 'edittest');
            const charterPath = path.join(agentDir, 'charter.md');
            const charterExistedBefore = fs.existsSync(charterPath);

            try {
                if (!charterExistedBefore) {
                    fs.mkdirSync(agentDir, { recursive: true });
                    fs.writeFileSync(charterPath, '# EditTest — Tester\n\nTest charter content.\n', 'utf-8');
                }

                await vscode.commands.executeCommand('squadui.editCharter', 'EditTest');
                await new Promise(resolve => setTimeout(resolve, 500));

                const activeEditor = vscode.window.activeTextEditor;
                if (activeEditor) {
                    const activeFilePath = activeEditor.document.uri.fsPath;
                    assert.ok(
                        activeFilePath.endsWith(path.join('agents', 'edittest', 'charter.md')),
                        `Active editor should show charter.md, got: ${activeFilePath}`
                    );
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

        test('accepts tree item object with label property', async function () {
            const commands = await vscode.commands.getCommands(true);
            if (!commands.includes('squadui.editCharter')) {
                this.skip();
                return;
            }

            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) {
                this.skip();
                return;
            }

            const agentDir = path.join(workspaceRoot, '.ai-team', 'agents', 'edittest');
            const charterPath = path.join(agentDir, 'charter.md');
            const charterExistedBefore = fs.existsSync(charterPath);

            try {
                if (!charterExistedBefore) {
                    fs.mkdirSync(agentDir, { recursive: true });
                    fs.writeFileSync(charterPath, '# EditTest — Tester\n\nTest charter content.\n', 'utf-8');
                }

                // Simulate tree item object (context menu passes tree item)
                await vscode.commands.executeCommand('squadui.editCharter', { label: 'EditTest', memberId: 'EditTest' });
                await new Promise(resolve => setTimeout(resolve, 500));

                const activeEditor = vscode.window.activeTextEditor;
                if (activeEditor) {
                    const activeFilePath = activeEditor.document.uri.fsPath;
                    assert.ok(
                        activeFilePath.endsWith(path.join('agents', 'edittest', 'charter.md')),
                        `Should open charter from tree item object, got: ${activeFilePath}`
                    );
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

    // ─── Warnings ──────────────────────────────────────────────────────────

    suite('Warnings', () => {
        test('shows warning when charter not found', async function () {
            const commands = await vscode.commands.getCommands(true);
            if (!commands.includes('squadui.editCharter')) {
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

                await vscode.commands.executeCommand('squadui.editCharter', 'NonExistentMember99999');

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

        test('shows warning when no member selected', async function () {
            const commands = await vscode.commands.getCommands(true);
            if (!commands.includes('squadui.editCharter')) {
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

                await vscode.commands.executeCommand('squadui.editCharter', '');
                assert.ok(warningShown, 'Should show a warning when no member is selected');
            } finally {
                (vscode.window as any).showWarningMessage = origWarn;
            }
        });
    });
});
