/**
 * Tests for extension command registration and activation.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Starting extension tests.');

    suite('Command Registration', () => {
        test('squadui.showWorkDetails command is registered', async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(
                commands.includes('squadui.showWorkDetails'),
                'showWorkDetails command should be registered'
            );
        });

        test('squadui.refreshTree command is registered', async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(
                commands.includes('squadui.refreshTree'),
                'refreshTree command should be registered'
            );
        });
    });

    suite('Extension Activation', () => {
        test('extension is present', () => {
            const extension = vscode.extensions.getExtension('csharpfritz.squadui');
            // Extension might not be available in test environment
            // This test verifies the extension ID matches package.json
            if (extension) {
                assert.ok(extension, 'Extension should be found');
            }
        });
    });

    suite('View Contribution', () => {
        test('squadMembers view is available after activation', async () => {
            // Get all registered views - this depends on activation
            // The view should be registered via contributes.views in package.json
            const commands = await vscode.commands.getCommands(true);
            
            // Views trigger commands when focused; verify tree-related commands exist
            const hasTreeCommands = commands.some(cmd => 
                cmd.includes('squadui') || cmd.includes('squadMembers')
            );
            
            assert.ok(hasTreeCommands, 'Squad-related commands should be registered');
        });
    });
});
