/**
 * Tests for the deep-link API feature.
 *
 * Covers:
 * 1. URI handler parsing — extracting path and member params from URIs
 * 2. switchToRoot validation — invalid paths handled gracefully
 * 3. Backward compatibility — commands work with no optional teamRoot arg
 * 4. SquadDataProvider.setRoot — updates internal state correctly
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { SquadDataProvider } from '../../services/SquadDataProvider';

const TEST_FIXTURES_ROOT = path.resolve(__dirname, '../../../test-fixtures');

// ─── URI Handler Parsing ────────────────────────────────────────────────────
// The URI handler uses URLSearchParams to extract params from query strings.
// These tests validate the same parsing logic the handler relies on.

suite('Deep-Link: URI Handler Parsing', () => {

    test('extracts path param from dashboard URI', () => {
        const uri = vscode.Uri.parse('vscode://csharpfritz.squadui/dashboard?path=/some/project');
        const params = new URLSearchParams(uri.query);

        assert.strictEqual(uri.path, '/dashboard');
        assert.strictEqual(params.get('path'), '/some/project');
    });

    test('extracts member and path params from charter URI', () => {
        const uri = vscode.Uri.parse('vscode://csharpfritz.squadui/charter?member=Danny&path=/some/project');
        const params = new URLSearchParams(uri.query);

        assert.strictEqual(uri.path, '/charter');
        assert.strictEqual(params.get('member'), 'Danny');
        assert.strictEqual(params.get('path'), '/some/project');
    });

    test('handles dashboard URI with no query params', () => {
        const uri = vscode.Uri.parse('vscode://csharpfritz.squadui/dashboard');
        const params = new URLSearchParams(uri.query);

        assert.strictEqual(uri.path, '/dashboard');
        assert.strictEqual(params.get('path'), null);
    });

    test('handles charter URI with member but no path', () => {
        const uri = vscode.Uri.parse('vscode://csharpfritz.squadui/charter?member=Rusty');
        const params = new URLSearchParams(uri.query);

        assert.strictEqual(uri.path, '/charter');
        assert.strictEqual(params.get('member'), 'Rusty');
        assert.strictEqual(params.get('path'), null);
    });

    test('handles charter URI with no member param', () => {
        const uri = vscode.Uri.parse('vscode://csharpfritz.squadui/charter?path=/some/project');
        const params = new URLSearchParams(uri.query);

        assert.strictEqual(uri.path, '/charter');
        assert.strictEqual(params.get('member'), null);
    });

    test('handles unknown URI path gracefully', () => {
        const uri = vscode.Uri.parse('vscode://csharpfritz.squadui/unknown');

        assert.strictEqual(uri.path, '/unknown');
        // Unknown paths should simply not match any case — no crash
    });

    test('handles URI with encoded special characters in member name', () => {
        const uri = vscode.Uri.parse('vscode://csharpfritz.squadui/charter?member=Dr.%20O%27Brien');
        const params = new URLSearchParams(uri.query);

        assert.strictEqual(params.get('member'), "Dr. O'Brien");
    });
});

// ─── switchToRoot Validation ────────────────────────────────────────────────
// switchToRoot checks fs.existsSync before switching. When the path doesn't
// exist it shows a warning and returns without changing state.

suite('Deep-Link: switchToRoot Validation', () => {

    test('refreshTree with non-existent teamRoot shows warning', async function () {
        const commands = await vscode.commands.getCommands(true);
        if (!commands.includes('squadui.refreshTree')) {
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

            await vscode.commands.executeCommand('squadui.refreshTree', '/nonexistent/path/12345');

            assert.ok(warningShown, 'Should show warning for non-existent path');
            assert.ok(
                warningMessage.includes('does not exist'),
                `Warning should mention path not existing, got: "${warningMessage}"`
            );
        } finally {
            (vscode.window as any).showWarningMessage = origWarn;
        }
    });

    test('openDashboard with non-existent teamRoot shows warning', async function () {
        const commands = await vscode.commands.getCommands(true);
        if (!commands.includes('squadui.openDashboard')) {
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
            (vscode.window as any).showWarningMessage = async (_msg: string, ..._items: any[]) => {
                warningShown = true;
                return undefined;
            };

            await vscode.commands.executeCommand('squadui.openDashboard', '/nonexistent/path/12345');

            assert.ok(warningShown, 'Should show warning for non-existent path');
        } finally {
            (vscode.window as any).showWarningMessage = origWarn;
        }
    });
});

// ─── Backward Compatibility ─────────────────────────────────────────────────
// Commands must continue to work when invoked without the optional teamRoot
// argument (pre-deep-link behavior).

suite('Deep-Link: Backward Compatibility', () => {

    test('refreshTree works with no arguments', async function () {
        const commands = await vscode.commands.getCommands(true);
        if (!commands.includes('squadui.refreshTree')) {
            this.skip();
            return;
        }

        if (!vscode.workspace.workspaceFolders?.length) {
            this.skip();
            return;
        }

        // Should not throw — captures the info message to verify it ran
        const origInfo = vscode.window.showInformationMessage;
        let infoShown = false;

        try {
            (vscode.window as any).showInformationMessage = async (msg: string, ..._items: any[]) => {
                if (msg.includes('refreshed')) {
                    infoShown = true;
                }
                return undefined;
            };

            await vscode.commands.executeCommand('squadui.refreshTree');

            assert.ok(infoShown, 'refreshTree with no args should show "refreshed" message');
        } finally {
            (vscode.window as any).showInformationMessage = origInfo;
        }
    });

    test('openDashboard works with no arguments', async function () {
        const commands = await vscode.commands.getCommands(true);
        if (!commands.includes('squadui.openDashboard')) {
            this.skip();
            return;
        }

        if (!vscode.workspace.workspaceFolders?.length) {
            this.skip();
            return;
        }

        // Should not throw
        try {
            await vscode.commands.executeCommand('squadui.openDashboard');
            assert.ok(true, 'openDashboard with no args should not throw');
        } catch (err) {
            assert.fail(`openDashboard with no args should not throw: ${err}`);
        }
    });

    test('viewCharter works with memberName only (no teamRoot)', async function () {
        const commands = await vscode.commands.getCommands(true);
        if (!commands.includes('squadui.viewCharter')) {
            this.skip();
            return;
        }

        if (!vscode.workspace.workspaceFolders?.length) {
            this.skip();
            return;
        }

        // Calling with just a member name (no teamRoot) should not throw,
        // even if the charter doesn't exist (will show a warning)
        try {
            await vscode.commands.executeCommand('squadui.viewCharter', 'SomeMember');
            assert.ok(true, 'viewCharter with memberName only should not throw');
        } catch (err) {
            assert.fail(`viewCharter with memberName only should not throw: ${err}`);
        }
    });
});

// ─── Tree Item Object Arg Handling ──────────────────────────────────────────
// VS Code passes tree item objects (not strings) as the first arg when commands
// are invoked from tree view buttons. Commands must ignore non-string args.

suite('Deep-Link: Tree Item Object Arg Handling', () => {

    test('refreshTree ignores tree item object arg', async function () {
        const commands = await vscode.commands.getCommands(true);
        if (!commands.includes('squadui.refreshTree')) {
            this.skip();
            return;
        }

        if (!vscode.workspace.workspaceFolders?.length) {
            this.skip();
            return;
        }

        const origInfo = vscode.window.showInformationMessage;
        let infoShown = false;

        try {
            (vscode.window as any).showInformationMessage = async (msg: string, ..._items: any[]) => {
                if (msg.includes('refreshed')) {
                    infoShown = true;
                }
                return undefined;
            };

            // Simulate VS Code passing a tree item object
            await vscode.commands.executeCommand('squadui.refreshTree', { label: 'Team', contextValue: 'member' });

            assert.ok(infoShown, 'refreshTree should still refresh when passed a tree item object');
        } finally {
            (vscode.window as any).showInformationMessage = origInfo;
        }
    });

    test('openDashboard ignores tree item object arg', async function () {
        const commands = await vscode.commands.getCommands(true);
        if (!commands.includes('squadui.openDashboard')) {
            this.skip();
            return;
        }

        if (!vscode.workspace.workspaceFolders?.length) {
            this.skip();
            return;
        }

        // Should not throw — the object should be ignored, falling back to workspace root
        try {
            await vscode.commands.executeCommand('squadui.openDashboard', { label: 'Dashboard', contextValue: 'squad' });
            assert.ok(true, 'openDashboard should not throw when passed a tree item object');
        } catch (err) {
            assert.fail(`openDashboard should not throw with tree item arg: ${err}`);
        }
    });

    test('refreshTree accepts valid string path', async function () {
        const commands = await vscode.commands.getCommands(true);
        if (!commands.includes('squadui.refreshTree')) {
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
            (vscode.window as any).showWarningMessage = async (_msg: string, ..._items: any[]) => {
                warningShown = true;
                return undefined;
            };

            // Pass a non-existent but valid string — triggers switchToRoot warning
            await vscode.commands.executeCommand('squadui.refreshTree', '/nonexistent/string/path');
            assert.ok(warningShown, 'refreshTree should try to switch root when given a string path');
        } finally {
            (vscode.window as any).showWarningMessage = origWarn;
        }
    });

    test('openDashboard accepts valid string path', async function () {
        const commands = await vscode.commands.getCommands(true);
        if (!commands.includes('squadui.openDashboard')) {
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
            (vscode.window as any).showWarningMessage = async (_msg: string, ..._items: any[]) => {
                warningShown = true;
                return undefined;
            };

            // Pass a non-existent but valid string — triggers switchToRoot warning
            await vscode.commands.executeCommand('squadui.openDashboard', '/nonexistent/string/path');
            assert.ok(warningShown, 'openDashboard should try to switch root when given a string path');
        } finally {
            (vscode.window as any).showWarningMessage = origWarn;
        }
    });
});

// ─── SquadDataProvider.setRoot ───────────────────────────────────────────────
// setRoot switches the provider to a new team root and squad folder,
// recreates internal services, and clears cached data.

suite('Deep-Link: SquadDataProvider.setRoot', () => {
    let tempDir: string;

    setup(() => {
        tempDir = path.join(TEST_FIXTURES_ROOT, `temp-deeplink-${Date.now()}`);
        fs.mkdirSync(path.join(tempDir, '.ai-team'), { recursive: true });
    });

    teardown(() => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    test('setRoot updates getWorkspaceRoot()', () => {
        const provider = new SquadDataProvider(tempDir, '.ai-team');
        assert.strictEqual(provider.getWorkspaceRoot(), tempDir);

        const newRoot = path.join(tempDir, 'subproject');
        fs.mkdirSync(path.join(newRoot, '.ai-team'), { recursive: true });

        provider.setRoot(newRoot, '.ai-team');
        assert.strictEqual(provider.getWorkspaceRoot(), newRoot);
    });

    test('setRoot updates getSquadFolder()', () => {
        const provider = new SquadDataProvider(tempDir, '.ai-team');
        assert.strictEqual(provider.getSquadFolder(), '.ai-team');

        provider.setRoot(tempDir, '.squad');
        assert.strictEqual(provider.getSquadFolder(), '.squad');
    });

    test('setRoot clears cached members', async () => {
        // Create team.md in original root
        fs.writeFileSync(path.join(tempDir, '.ai-team', 'team.md'), [
            '# Team',
            '',
            '## Members',
            '',
            '| Name | Role | Status |',
            '|------|------|--------|',
            '| Alice | Engineer | ✅ Active |',
        ].join('\n'));

        const provider = new SquadDataProvider(tempDir, '.ai-team');
        const members1 = await provider.getSquadMembers();
        assert.strictEqual(members1.length, 1);
        assert.strictEqual(members1[0].name, 'Alice');

        // Create new root with different team
        const newRoot = path.join(tempDir, 'other');
        fs.mkdirSync(path.join(newRoot, '.ai-team'), { recursive: true });
        fs.writeFileSync(path.join(newRoot, '.ai-team', 'team.md'), [
            '# Team',
            '',
            '## Members',
            '',
            '| Name | Role | Status |',
            '|------|------|--------|',
            '| Bob | Designer | ✅ Active |',
            '| Charlie | QA | ✅ Active |',
        ].join('\n'));

        provider.setRoot(newRoot, '.ai-team');
        const members2 = await provider.getSquadMembers();
        assert.strictEqual(members2.length, 2);
        assert.ok(members2.some(m => m.name === 'Bob'));
        assert.ok(members2.some(m => m.name === 'Charlie'));
    });

    test('setRoot clears cached decisions', async () => {
        fs.writeFileSync(path.join(tempDir, '.ai-team', 'decisions.md'), [
            '## Old Decision',
            '**Date:** 2026-01-01',
            'Old decision content.',
        ].join('\n'));

        const provider = new SquadDataProvider(tempDir, '.ai-team');
        const decisions1 = await provider.getDecisions();
        assert.ok(decisions1.length >= 1);

        // Switch to root with no decisions
        const newRoot = path.join(tempDir, 'empty-root');
        fs.mkdirSync(path.join(newRoot, '.ai-team'), { recursive: true });

        provider.setRoot(newRoot, '.ai-team');
        const decisions2 = await provider.getDecisions();
        assert.deepStrictEqual(decisions2, []);
    });

    test('setRoot with .squad folder works correctly', () => {
        const squadRoot = path.join(tempDir, 'squad-project');
        fs.mkdirSync(path.join(squadRoot, '.squad'), { recursive: true });

        const provider = new SquadDataProvider(tempDir, '.ai-team');
        provider.setRoot(squadRoot, '.squad');

        assert.strictEqual(provider.getWorkspaceRoot(), squadRoot);
        assert.strictEqual(provider.getSquadFolder(), '.squad');
    });
});
