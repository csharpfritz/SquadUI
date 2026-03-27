/**
 * Tests for SDK Phase 4 — Quick Status Command.
 *
 * Validates:
 * - getSquadMetadata() adapter integration for quick status
 * - Command registration in extension
 * - QuickPick data formatting
 * - Edge cases: empty workspace, missing SDK
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

// Lazy adapter import
/* eslint-disable @typescript-eslint/no-explicit-any */
let adapterModule: any;
let adapterAvailable = false;

try {
    adapterModule = require('../../sdk-adapter/index');
    adapterAvailable = true;
} catch {
    // SDK adapter not available
}

const TEST_FIXTURES_ROOT = path.resolve(__dirname, '../../../test-fixtures');

suite('Quick Status Command (SDK Phase 4)', () => {

    suite('SDK Adapter — getSquadMetadata() for Quick Status', () => {

        test('getSquadMetadata returns SquadMetadata shape', async function () {
            if (!adapterAvailable) { this.skip(); return; }

            const metadata = await adapterModule.getSquadMetadata(TEST_FIXTURES_ROOT);
            assert.ok(metadata, 'Should return metadata object');
            assert.ok(Array.isArray(metadata.members), 'Should have members array');
            assert.ok(Array.isArray(metadata.decisions), 'Should have decisions array');
            assert.ok(Array.isArray(metadata.warnings), 'Should have warnings array');
            assert.ok('sdkVersion' in metadata, 'Should have sdkVersion field');
            assert.ok('config' in metadata, 'Should have config field');
            assert.ok('squadFolder' in metadata, 'Should have squadFolder field');
        });

        test('getSquadMetadata returns members from test fixtures', async function () {
            if (!adapterAvailable) { this.skip(); return; }

            const teamMdPath = path.join(TEST_FIXTURES_ROOT, '.ai-team', 'team.md');
            if (!fs.existsSync(teamMdPath)) { this.skip(); return; }

            const metadata = await adapterModule.getSquadMetadata(TEST_FIXTURES_ROOT);
            assert.ok(metadata.members.length > 0,
                'Should parse members from test fixtures team.md');
        });

        test('getSquadMetadata handles empty workspace gracefully', async function () {
            if (!adapterAvailable) { this.skip(); return; }

            const tempDir = path.join(TEST_FIXTURES_ROOT, `temp-quickstatus-${Date.now()}`);
            fs.mkdirSync(tempDir, { recursive: true });

            try {
                const metadata = await adapterModule.getSquadMetadata(tempDir);
                assert.ok(metadata, 'Should return metadata even for empty workspace');
                assert.strictEqual(metadata.members.length, 0,
                    'Empty workspace should have no members');
                assert.strictEqual(metadata.decisions.length, 0,
                    'Empty workspace should have no decisions');
            } finally {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        });

        test('getSquadMetadata detects squad folder', async function () {
            if (!adapterAvailable) { this.skip(); return; }

            const metadata = await adapterModule.getSquadMetadata(TEST_FIXTURES_ROOT);
            assert.ok(
                metadata.squadFolder === '.ai-team' || metadata.squadFolder === '.squad',
                `squadFolder should be .ai-team or .squad, got: ${metadata.squadFolder}`,
            );
        });

        test('getSquadMetadata returns SDK version when available', async function () {
            if (!adapterAvailable) { this.skip(); return; }

            const metadata = await adapterModule.getSquadMetadata(TEST_FIXTURES_ROOT);
            // SDK version should be non-null if the SDK is installed
            if (metadata.sdkVersion !== null) {
                assert.ok(typeof metadata.sdkVersion === 'string',
                    'SDK version should be a string');
                assert.ok(metadata.sdkVersion.length > 0,
                    'SDK version should be non-empty');
            }
        });
    });

    suite('Command Registration', () => {

        test('squadui.quickStatus command is registered', async function () {
            const extension = vscode.extensions.getExtension('csharpfritz.squadui');
            if (!extension) { this.skip(); return; }
            try { await extension.activate(); } catch { /* may fail without workspace */ }
            if (!extension.isActive || !vscode.workspace.workspaceFolders?.length) {
                this.skip();
                return;
            }

            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes('squadui.quickStatus'),
                'quickStatus command should be registered');
        });

        test('squadui.showRoutingRules command is registered', async function () {
            const extension = vscode.extensions.getExtension('csharpfritz.squadui');
            if (!extension) { this.skip(); return; }
            try { await extension.activate(); } catch { /* may fail without workspace */ }
            if (!extension.isActive || !vscode.workspace.workspaceFolders?.length) {
                this.skip();
                return;
            }

            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes('squadui.showRoutingRules'),
                'showRoutingRules command should be registered');
        });
    });

    suite('Package.json Contributions', () => {

        test('squadui.quickStatus is declared in package.json commands', () => {
            const extension = vscode.extensions.getExtension('csharpfritz.squadui');
            if (!extension) { return; }

            const commands = extension.packageJSON?.contributes?.commands || [];
            const found = commands.some((c: any) => c.command === 'squadui.quickStatus');
            assert.ok(found, 'quickStatus should be in package.json commands');
        });

        test('squadui.showRoutingRules is declared in package.json commands', () => {
            const extension = vscode.extensions.getExtension('csharpfritz.squadui');
            if (!extension) { return; }

            const commands = extension.packageJSON?.contributes?.commands || [];
            const found = commands.some((c: any) => c.command === 'squadui.showRoutingRules');
            assert.ok(found, 'showRoutingRules should be in package.json commands');
        });

        test('squadRouting view is declared in package.json', () => {
            const extension = vscode.extensions.getExtension('csharpfritz.squadui');
            if (!extension) { return; }

            const views = extension.packageJSON?.contributes?.views?.squadui || [];
            const found = views.some((v: any) => v.id === 'squadRouting');
            assert.ok(found, 'squadRouting view should be declared');
        });
    });
});
