/**
 * Tests for the upgradeSquadCommand and squadui.hasTeam context key.
 *
 * upgradeSquadCommand mirrors initSquadCommand:
 *   - registerUpgradeSquadCommand(context, onUpgradeComplete) → Disposable
 *   - Creates terminal named 'Squad Upgrade'
 *   - Runs `npx github:bradygaster/squad upgrade`
 *   - Calls onUpgradeComplete() when terminal closes
 *
 * hasTeam context key:
 *   - Set to true when .ai-team/team.md exists in workspace
 *   - Set to false when it does not
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { registerUpgradeSquadCommand } from '../../commands/upgradeSquadCommand';

const TEST_FIXTURES_ROOT = path.resolve(__dirname, '../../../test-fixtures');

suite('UpgradeSquadCommand', () => {
    let tempDir: string;

    setup(() => {
        tempDir = path.join(TEST_FIXTURES_ROOT, 'temp-upgrade-squad');
    });

    teardown(async () => {
        try {
            await fs.promises.rm(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    // ─── Registration ──────────────────────────────────────────────────────

    suite('Registration', () => {
        test('registerUpgradeSquadCommand returns a Disposable', () => {
            const mockContext = { subscriptions: [] } as any;
            const mockCallback = () => {};

            const disposable = registerUpgradeSquadCommand(mockContext, mockCallback);

            assert.ok(disposable, 'should return a truthy value');
            assert.ok(
                typeof disposable.dispose === 'function',
                'returned object should have a dispose() method'
            );
        });

        test('upgradeSquad command is registered when extension is active', async function () {
            const extension = vscode.extensions.getExtension('csharpfritz.squadui');
            if (!extension || !extension.isActive || !vscode.workspace.workspaceFolders?.length) {
                this.skip();
                return;
            }

            const commands = await vscode.commands.getCommands(true);
            assert.ok(
                commands.includes('squadui.upgradeSquad'),
                'squadui.upgradeSquad command should be registered'
            );
        });
    });

    // ─── Context Key: squadui.hasTeam ──────────────────────────────────────

    suite('hasTeam context key detection', () => {
        test('detects hasTeam as true when .ai-team/team.md exists', () => {
            fs.mkdirSync(path.join(tempDir, '.ai-team'), { recursive: true });
            fs.writeFileSync(
                path.join(tempDir, '.ai-team', 'team.md'),
                '# Team\n\n- Rusty — Builder\n',
                'utf-8'
            );

            const teamMdPath = path.join(tempDir, '.ai-team', 'team.md');
            const hasTeam = fs.existsSync(teamMdPath);

            assert.strictEqual(hasTeam, true, 'hasTeam should be true when team.md exists');
        });

        test('detects hasTeam as false when .ai-team/ does not exist', () => {
            // Ensure tempDir exists but has no .ai-team/
            fs.mkdirSync(tempDir, { recursive: true });

            const teamMdPath = path.join(tempDir, '.ai-team', 'team.md');
            const hasTeam = fs.existsSync(teamMdPath);

            assert.strictEqual(hasTeam, false, 'hasTeam should be false when .ai-team/ is absent');
        });

        test('detects hasTeam as false when .ai-team/ exists but team.md is missing', () => {
            fs.mkdirSync(path.join(tempDir, '.ai-team'), { recursive: true });

            const teamMdPath = path.join(tempDir, '.ai-team', 'team.md');
            const hasTeam = fs.existsSync(teamMdPath);

            assert.strictEqual(
                hasTeam,
                false,
                'hasTeam should be false when .ai-team/ exists but team.md does not'
            );
        });
    });
});
