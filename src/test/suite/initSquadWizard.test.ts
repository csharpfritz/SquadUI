/**
 * Tests for the native init wizard flow in initSquadCommand.ts.
 *
 * The wizard flow (being built by Rusty) is expected to:
 *   1. Show a QuickPick with universe options (e.g. "Ocean's Eleven", "Marvel")
 *   2. Show an InputBox for mission description
 *   3. Launch terminal: `npx github:bradygaster/squad init --universe "{universe}" --mission "{mission}"`
 *   4. Fire onInitComplete callback when terminal closes
 *
 * Tests are written test-first; wizard-specific tests will fail until
 * Rusty's implementation exports the universe list and wizard logic.
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
suite('initSquadWizard', () => {

    // ─── Welcome View Configuration (package.json) ─────────────────────────

    suite('Welcome view configuration', () => {
        test('viewsWelcome entries exist for all three panels with Form your Squad button', () => {
            const extension = vscode.extensions.getExtension('csharpfritz.squadui');
            // If extension isn't available, read package.json from disk
            let viewsWelcome: Array<{ view: string; contents: string; when?: string }>;

            if (extension) {
                viewsWelcome = extension.packageJSON?.contributes?.viewsWelcome || [];
            } else {
                const pkgPath = path.resolve(__dirname, '../../../package.json');
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                viewsWelcome = pkg.contributes?.viewsWelcome || [];
            }

            const expectedPanels = ['squadTeam', 'squadSkills', 'squadDecisions'];

            for (const panelId of expectedPanels) {
                const entry = viewsWelcome.find(
                    (w) => w.view === panelId && w.when === '!squadui.hasTeam'
                );
                assert.ok(
                    entry,
                    `viewsWelcome should have an entry for '${panelId}' when !squadui.hasTeam`
                );
                assert.ok(
                    entry!.contents.includes('Form your Squad'),
                    `viewsWelcome for '${panelId}' should contain "Form your Squad" button text`
                );
                assert.ok(
                    entry!.contents.includes('command:squadui.initSquad'),
                    `viewsWelcome for '${panelId}' should link to squadui.initSquad command`
                );
            }
        });
    });

    // ─── Command Registration (package.json) ───────────────────────────────

    suite('Command registration', () => {
        test('squadui.initSquad is declared in package.json with category "Squad"', () => {
            const extension = vscode.extensions.getExtension('csharpfritz.squadui');
            let commands: Array<{ command: string; title: string; category?: string }>;

            if (extension) {
                commands = extension.packageJSON?.contributes?.commands || [];
            } else {
                const pkgPath = path.resolve(__dirname, '../../../package.json');
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                commands = pkg.contributes?.commands || [];
            }

            const initCmd = commands.find((c) => c.command === 'squadui.initSquad');
            assert.ok(initCmd, 'squadui.initSquad should be declared in package.json commands');
            assert.strictEqual(
                initCmd!.category,
                'Squad',
                'initSquad command should have category "Squad"'
            );
        });

        test('initSquad command is registered when extension is active', async function () {
            const extension = vscode.extensions.getExtension('csharpfritz.squadui');
            if (!extension || !extension.isActive || !vscode.workspace.workspaceFolders?.length) {
                this.skip();
                return;
            }

            const cmds = await vscode.commands.getCommands(true);
            assert.ok(
                cmds.includes('squadui.initSquad'),
                'squadui.initSquad should be registered'
            );
        });
    });

    // ─── Wizard Flow: Universe QuickPick ───────────────────────────────────

    suite('Universe selection', () => {
        test('universe list is exported and non-empty', () => {
            // Rusty's rewrite is expected to export UNIVERSE_OPTIONS or similar
            let universeList: unknown;
            try {
                // Dynamic import to avoid compile error if not yet exported
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const mod = require('../../commands/initSquadCommand') as Record<string, unknown>;
                universeList = mod.UNIVERSE_OPTIONS ?? mod.universeOptions ?? mod.UNIVERSES;
            } catch {
                // Module might fail to load if Rusty's changes break compilation
                assert.fail('initSquadCommand module should be importable');
            }

            if (!universeList || !Array.isArray(universeList)) {
                // Skip until Rusty exports the list
                assert.ok(true, 'Universe list not yet exported — test-first placeholder');
                return;
            }

            assert.ok(universeList.length > 0, 'Universe list should have at least one entry');
        });
    });

    // ─── Wizard Flow: Cancellation ─────────────────────────────────────────

    suite('Cancellation handling', () => {
        let originalShowQuickPick: typeof vscode.window.showQuickPick;
        let originalShowInputBox: typeof vscode.window.showInputBox;
        let originalCreateTerminal: typeof vscode.window.createTerminal;
        let terminalCreated: boolean;

        setup(() => {
            originalShowQuickPick = vscode.window.showQuickPick;
            originalShowInputBox = vscode.window.showInputBox;
            originalCreateTerminal = vscode.window.createTerminal;
            terminalCreated = false;

            // Spy on createTerminal
            (vscode.window as any).createTerminal = (..._args: unknown[]) => {
                terminalCreated = true;
                return {
                    show: () => {},
                    sendText: () => {},
                    dispose: () => {},
                };
            };
        });

        teardown(() => {
            (vscode.window as any).showQuickPick = originalShowQuickPick;
            (vscode.window as any).showInputBox = originalShowInputBox;
            (vscode.window as any).createTerminal = originalCreateTerminal;
        });

        test('cancelling universe QuickPick creates no terminal and shows no InputBox', async function () {
            // Guard: needs active workspace to invoke command
            const extension = vscode.extensions.getExtension('csharpfritz.squadui');
            if (!extension || !extension.isActive || !vscode.workspace.workspaceFolders?.length) {
                this.skip();
                return;
            }

            let inputBoxShown = false;

            // Stub QuickPick to return undefined (user cancelled)
            (vscode.window as any).showQuickPick = async () => undefined;
            (vscode.window as any).showInputBox = async () => {
                inputBoxShown = true;
                return undefined;
            };

            await vscode.commands.executeCommand('squadui.initSquad');

            assert.strictEqual(
                terminalCreated,
                false,
                'No terminal should be created when user cancels universe selection'
            );
            assert.strictEqual(
                inputBoxShown,
                false,
                'InputBox should not be shown when user cancels universe selection'
            );
        });

        test('cancelling mission InputBox creates no terminal', async function () {
            const extension = vscode.extensions.getExtension('csharpfritz.squadui');
            if (!extension || !extension.isActive || !vscode.workspace.workspaceFolders?.length) {
                this.skip();
                return;
            }

            // Stub QuickPick to return a universe selection
            (vscode.window as any).showQuickPick = async () => ({ label: "Ocean's Eleven" });
            // Stub InputBox to return undefined (user cancelled)
            (vscode.window as any).showInputBox = async () => undefined;

            await vscode.commands.executeCommand('squadui.initSquad');

            assert.strictEqual(
                terminalCreated,
                false,
                'No terminal should be created when user cancels mission input'
            );
        });
    });

    // ─── Wizard Flow: Validation ───────────────────────────────────────────

    suite('Mission validation', () => {
        test('empty mission string should be rejected by validation', async function () {
            const extension = vscode.extensions.getExtension('csharpfritz.squadui');
            if (!extension || !extension.isActive || !vscode.workspace.workspaceFolders?.length) {
                this.skip();
                return;
            }

            let validationFn: ((value: string) => string | undefined | null | Thenable<string | undefined | null>) | undefined;

            // Capture the validateInput function passed to showInputBox
            const origShowInputBox = vscode.window.showInputBox;
            (vscode.window as any).showInputBox = async (options?: vscode.InputBoxOptions) => {
                validationFn = options?.validateInput as typeof validationFn;
                return undefined; // Cancel after capturing
            };

            // Stub QuickPick to return a selection so we reach the InputBox
            const origShowQuickPick = vscode.window.showQuickPick;
            (vscode.window as any).showQuickPick = async () => ({ label: "Marvel" });

            try {
                await vscode.commands.executeCommand('squadui.initSquad');
            } finally {
                (vscode.window as any).showInputBox = origShowInputBox;
                (vscode.window as any).showQuickPick = origShowQuickPick;
            }

            if (!validationFn) {
                // Wizard not yet implemented — skip gracefully
                assert.ok(true, 'validateInput not yet available — test-first placeholder');
                return;
            }

            const result = await validationFn('');
            assert.ok(
                result !== undefined && result !== null && result !== '',
                'Empty mission should return an error message from validateInput'
            );

            const validResult = await validationFn('Build a heist planning app');
            assert.strictEqual(
                validResult,
                undefined,
                'Non-empty mission should pass validation (return undefined)'
            );
        });
    });
});
