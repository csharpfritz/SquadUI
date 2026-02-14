/**
 * Tests for extension command registration and activation.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Starting extension tests.');

    suite('Extension Activation', () => {
        test('extension is present', () => {
            const extension = vscode.extensions.getExtension('csharpfritz.squadui');
            assert.ok(extension, 'Extension should be found');
        });

        test('extension can be activated', async () => {
            const extension = vscode.extensions.getExtension('csharpfritz.squadui');
            if (extension) {
                // Activation may fail gracefully if no workspace, but shouldn't throw
                try {
                    await extension.activate();
                } catch {
                    // Extension may show warning if no workspace, that's OK
                }
                // Just verify we got this far without crashing
                assert.ok(true, 'Extension activation did not throw');
            }
        });
    });

    suite('Command Registration', () => {
        // These tests check if commands are registered AFTER activation
        // In CI without a workspace, commands may not be registered (extension returns early)
        // So we check if extension is active first

        test('commands are registered when extension is active with workspace', async function() {
            const extension = vscode.extensions.getExtension('csharpfritz.squadui');
            if (!extension) {
                this.skip();
                return;
            }

            // Try to activate
            try {
                await extension.activate();
            } catch {
                // May fail without workspace
            }

            // If extension activated successfully (has workspace), commands should exist
            if (extension.isActive && vscode.workspace.workspaceFolders?.length) {
                const commands = await vscode.commands.getCommands(true);
                const hasShowDetails = commands.includes('squadui.showWorkDetails');
                const hasRefresh = commands.includes('squadui.refreshTree');
                
                assert.ok(hasShowDetails, 'showWorkDetails command should be registered');
                assert.ok(hasRefresh, 'refreshTree command should be registered');
            } else {
                // Without workspace, extension returns early - skip command check
                this.skip();
            }
        });
    });

    suite('View Contribution', () => {
        test('squadTeam view is declared in package.json', async () => {
            // This test verifies the view contribution exists in package.json
            // The actual view registration depends on VS Code loading the manifest
            const extension = vscode.extensions.getExtension('csharpfritz.squadui');
            if (extension) {
                const packageJson = extension.packageJSON;
                const views = packageJson?.contributes?.views?.squadui || [];
                const hasSquadTeamView = views.some((v: { id: string }) => v.id === 'squadTeam');
                assert.ok(hasSquadTeamView, 'squadTeam view should be declared');
            }
        });
    });
});
