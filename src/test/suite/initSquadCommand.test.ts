/**
 * Tests for initSquadCommand.ts — command registration.
 *
 * The command creates a terminal and runs `npx github:bradygaster/squad init`.
 * These tests verify registration returns a Disposable and that the command
 * is registered with VS Code. Execution tests require live VS Code terminals.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { registerInitSquadCommand } from '../../commands/initSquadCommand';

suite('initSquadCommand', () => {
    suite('registerInitSquadCommand()', () => {
        test('returns a Disposable', () => {
            const context = { subscriptions: [] } as any;
            const disposable = registerInitSquadCommand(context, () => {}, () => {});

            assert.ok(disposable, 'Should return a disposable');
            assert.ok(typeof disposable.dispose === 'function', 'Disposable should have dispose()');
            disposable.dispose();
        });

        test('registers the squadui.initSquad command', async function () {
            // This test requires a live VS Code instance with active workspace
            const extension = vscode.extensions.getExtension('csharpfritz.squadui');
            if (!extension || !extension.isActive || !vscode.workspace.workspaceFolders?.length) {
                this.skip();
                return;
            }

            const commands = await vscode.commands.getCommands(true);
            assert.ok(
                commands.includes('squadui.initSquad'),
                'squadui.initSquad should be registered'
            );
        });
    });
});
