/**
 * Tests for initSquadCommand.ts — command registration and configuration.
 *
 * The command creates a terminal and runs `npx github:bradygaster/squad init`.
 * These tests verify registration returns a Disposable and that the command
 * is registered with VS Code. Execution tests require live VS Code terminals.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
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

    suite('package.json configuration', () => {
        let packageJson: any;

        setup(() => {
            const pkgPath = path.resolve(__dirname, '../../../package.json');
            packageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        });

        test('squadui.initSquad command is declared', () => {
            const commands: any[] = packageJson.contributes.commands;
            const cmd = commands.find((c: any) => c.command === 'squadui.initSquad');
            assert.ok(cmd, 'squadui.initSquad should be declared in package.json');
            assert.strictEqual(cmd.category, 'Squad', 'category should be "Squad"');
        });

        test('welcome view has Form your Squad button', () => {
            const welcome = packageJson.contributes.viewsWelcome;
            const teamWelcome = welcome.find((w: any) => w.view === 'squadTeam');
            assert.ok(teamWelcome, 'Should have welcome view for squadTeam');
            assert.ok(teamWelcome.contents.includes('command:squadui.initSquad'), 
                'Welcome view should link to initSquad command');
        });
    });
});
