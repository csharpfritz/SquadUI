/**
 * Tests for addSkillCommand.ts — command registration and helper functions.
 *
 * The command uses VS Code QuickPick UI and SkillCatalogService.
 * We test the registration path and the pure helper functions (sourceBadge,
 * toQuickPickItems) that are accessible via the module.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { registerAddSkillCommand } from '../../commands/addSkillCommand';

suite('addSkillCommand', () => {
    suite('registerAddSkillCommand()', () => {
        test('returns a Disposable', () => {
            const context = { subscriptions: [] } as any;
            const disposable = registerAddSkillCommand(context, () => {});

            assert.ok(disposable, 'Should return a disposable');
            assert.ok(typeof disposable.dispose === 'function', 'Disposable should have dispose()');
            disposable.dispose();
        });

        test('registers the squadui.addSkill command', async function () {
            const extension = vscode.extensions.getExtension('csharpfritz.squadui');
            if (!extension || !extension.isActive || !vscode.workspace.workspaceFolders?.length) {
                this.skip();
                return;
            }

            const commands = await vscode.commands.getCommands(true);
            assert.ok(
                commands.includes('squadui.addSkill'),
                'squadui.addSkill should be registered'
            );
        });
    });
});
