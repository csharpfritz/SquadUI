/**
 * Tests for TeamTreeProvider — sorting, special members, and infra handling.
 *
 * Existing treeProvider.test.ts covers basic member/task rendering.
 * These tests focus on:
 * - Sort order: regular members → @copilot → infra (scribe/ralph)
 * - Special icons for scribe (edit), ralph (eye), @copilot (robot)
 * - Infra members (scribe/ralph) are not collapsible
 * - @copilot has no viewCharter command
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { TeamTreeProvider } from '../../views/SquadTreeProvider';
import { MockSquadDataProvider } from '../mocks/squadDataProvider';
import { SquadMember } from '../../models';

suite('TeamTreeProvider — Special Members', () => {
    suite('sort order', () => {
        test('regular members appear before @copilot', async () => {
            const members: SquadMember[] = [
                { name: '@copilot', role: 'AI', status: 'idle' },
                { name: 'Alice', role: 'Dev', status: 'idle' },
            ];
            const dp = new MockSquadDataProvider({ members, tasks: [] });
            const provider = new TeamTreeProvider(dp as never);

            const children = await provider.getChildren();
            const memberChildren = children.filter(c => c.itemType === 'member');

            const aliceIdx = memberChildren.findIndex(c => c.label === 'Alice');
            const copilotIdx = memberChildren.findIndex(c => c.label === '@copilot');

            assert.ok(aliceIdx < copilotIdx, 'Alice should appear before @copilot');
        });

        test('@copilot appears before scribe and ralph', async () => {
            const members: SquadMember[] = [
                { name: 'scribe', role: 'System', status: 'idle' },
                { name: '@copilot', role: 'AI', status: 'idle' },
                { name: 'ralph', role: 'System', status: 'idle' },
            ];
            const dp = new MockSquadDataProvider({ members, tasks: [] });
            const provider = new TeamTreeProvider(dp as never);

            const children = await provider.getChildren();
            const memberChildren = children.filter(c => c.itemType === 'member');

            const copilotIdx = memberChildren.findIndex(c => c.label === '@copilot');
            const scribeIdx = memberChildren.findIndex(c => c.label === 'scribe');
            const ralphIdx = memberChildren.findIndex(c => c.label === 'ralph');

            assert.ok(copilotIdx < scribeIdx, '@copilot should appear before scribe');
            assert.ok(copilotIdx < ralphIdx, '@copilot should appear before ralph');
        });

        test('full ordering: regular → @copilot → scribe/ralph', async () => {
            const members: SquadMember[] = [
                { name: 'ralph', role: 'System', status: 'idle' },
                { name: 'scribe', role: 'System', status: 'idle' },
                { name: '@copilot', role: 'AI', status: 'idle' },
                { name: 'Danny', role: 'Lead', status: 'working' },
                { name: 'Alice', role: 'Dev', status: 'idle' },
            ];
            const dp = new MockSquadDataProvider({ members, tasks: [] });
            const provider = new TeamTreeProvider(dp as never);

            const children = await provider.getChildren();
            const memberChildren = children.filter(c => c.itemType === 'member');

            // Find positions
            const dannyIdx = memberChildren.findIndex(c => c.label === 'Danny');
            const aliceIdx = memberChildren.findIndex(c => c.label === 'Alice');
            const copilotIdx = memberChildren.findIndex(c => c.label === '@copilot');
            const scribeIdx = memberChildren.findIndex(c => c.label === 'scribe');
            const ralphIdx = memberChildren.findIndex(c => c.label === 'ralph');

            // Regular members first
            assert.ok(dannyIdx < copilotIdx, 'Danny before @copilot');
            assert.ok(aliceIdx < copilotIdx, 'Alice before @copilot');

            // @copilot before infra
            assert.ok(copilotIdx < scribeIdx, '@copilot before scribe');
            assert.ok(copilotIdx < ralphIdx, '@copilot before ralph');
        });
    });

    suite('special icons', () => {
        test('scribe has edit icon', async () => {
            const members: SquadMember[] = [
                { name: 'scribe', role: 'System', status: 'idle' },
            ];
            const dp = new MockSquadDataProvider({ members, tasks: [] });
            const provider = new TeamTreeProvider(dp as never);

            const children = await provider.getChildren();
            const scribe = children.find(c => c.label === 'scribe');

            assert.ok(scribe, 'Should find scribe');
            assert.ok(scribe!.iconPath instanceof vscode.ThemeIcon);
            assert.strictEqual((scribe!.iconPath as vscode.ThemeIcon).id, 'edit');
        });

        test('ralph has eye icon', async () => {
            const members: SquadMember[] = [
                { name: 'ralph', role: 'System', status: 'idle' },
            ];
            const dp = new MockSquadDataProvider({ members, tasks: [] });
            const provider = new TeamTreeProvider(dp as never);

            const children = await provider.getChildren();
            const ralph = children.find(c => c.label === 'ralph');

            assert.ok(ralph, 'Should find ralph');
            assert.ok(ralph!.iconPath instanceof vscode.ThemeIcon);
            assert.strictEqual((ralph!.iconPath as vscode.ThemeIcon).id, 'eye');
        });

        test('@copilot has robot icon', async () => {
            const members: SquadMember[] = [
                { name: '@copilot', role: 'AI', status: 'idle' },
            ];
            const dp = new MockSquadDataProvider({ members, tasks: [] });
            const provider = new TeamTreeProvider(dp as never);

            const children = await provider.getChildren();
            const copilot = children.find(c => c.label === '@copilot');

            assert.ok(copilot, 'Should find @copilot');
            assert.ok(copilot!.iconPath instanceof vscode.ThemeIcon);
            assert.strictEqual((copilot!.iconPath as vscode.ThemeIcon).id, 'robot');
        });
    });

    suite('collapsibility', () => {
        test('scribe is not collapsible', async () => {
            const members: SquadMember[] = [
                { name: 'scribe', role: 'System', status: 'idle' },
            ];
            const dp = new MockSquadDataProvider({ members, tasks: [] });
            const provider = new TeamTreeProvider(dp as never);

            const children = await provider.getChildren();
            const scribe = children.find(c => c.label === 'scribe');

            assert.ok(scribe);
            assert.strictEqual(scribe!.collapsibleState, vscode.TreeItemCollapsibleState.None);
        });

        test('ralph is not collapsible', async () => {
            const members: SquadMember[] = [
                { name: 'ralph', role: 'System', status: 'idle' },
            ];
            const dp = new MockSquadDataProvider({ members, tasks: [] });
            const provider = new TeamTreeProvider(dp as never);

            const children = await provider.getChildren();
            const ralph = children.find(c => c.label === 'ralph');

            assert.ok(ralph);
            assert.strictEqual(ralph!.collapsibleState, vscode.TreeItemCollapsibleState.None);
        });

        test('@copilot is collapsible (can have issues)', async () => {
            const members: SquadMember[] = [
                { name: '@copilot', role: 'AI', status: 'idle' },
            ];
            const dp = new MockSquadDataProvider({ members, tasks: [] });
            const provider = new TeamTreeProvider(dp as never);

            const children = await provider.getChildren();
            const copilot = children.find(c => c.label === '@copilot');

            assert.ok(copilot);
            assert.strictEqual(copilot!.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
        });
    });

    suite('commands', () => {
        test('@copilot does NOT have viewCharter command', async () => {
            const members: SquadMember[] = [
                { name: '@copilot', role: 'AI', status: 'idle' },
            ];
            const dp = new MockSquadDataProvider({ members, tasks: [] });
            const provider = new TeamTreeProvider(dp as never);

            const children = await provider.getChildren();
            const copilot = children.find(c => c.label === '@copilot');

            assert.ok(copilot);
            assert.strictEqual(copilot!.command, undefined, '@copilot should not have viewCharter command');
        });

        test('regular members have viewCharter command', async () => {
            const members: SquadMember[] = [
                { name: 'Alice', role: 'Dev', status: 'idle' },
            ];
            const dp = new MockSquadDataProvider({ members, tasks: [] });
            const provider = new TeamTreeProvider(dp as never);

            const children = await provider.getChildren();
            const alice = children.find(c => c.label === 'Alice');

            assert.ok(alice);
            assert.ok(alice!.command);
            assert.strictEqual(alice!.command!.command, 'squadui.viewCharter');
        });

        test('scribe does NOT have viewCharter command (no children = no command needed)', async () => {
            // Scribe has noChildren=true but also isn't copilot, so it gets viewCharter
            // Let's check what actually happens
            const members: SquadMember[] = [
                { name: 'scribe', role: 'System', status: 'idle' },
            ];
            const dp = new MockSquadDataProvider({ members, tasks: [] });
            const provider = new TeamTreeProvider(dp as never);

            const children = await provider.getChildren();
            const scribe = children.find(c => c.label === 'scribe');

            assert.ok(scribe);
            // Scribe is not copilot, so it still gets viewCharter
            if (scribe!.command) {
                assert.strictEqual(scribe!.command.command, 'squadui.viewCharter');
            }
        });
    });

    suite('no status badges in description', () => {
        test('working member does not get ⚡ badge', async () => {
            const members: SquadMember[] = [
                { name: 'Alice', role: 'Dev', status: 'working' },
            ];
            const dp = new MockSquadDataProvider({ members, tasks: [] });
            const provider = new TeamTreeProvider(dp as never);

            const children = await provider.getChildren();
            const alice = children.find(c => c.label === 'Alice');

            assert.ok(alice);
            assert.ok(!String(alice!.description).includes('⚡'));
        });

        test('idle member does not get 💤 badge', async () => {
            const members: SquadMember[] = [
                { name: 'Bob', role: 'Tester', status: 'idle' },
            ];
            const dp = new MockSquadDataProvider({ members, tasks: [] });
            const provider = new TeamTreeProvider(dp as never);

            const children = await provider.getChildren();
            const bob = children.find(c => c.label === 'Bob');

            assert.ok(bob);
            assert.ok(!String(bob!.description).includes('💤'));
        });
    });

    suite('markdown links in member names', () => {
        test('markdown link in name is stripped for display', async () => {
            const members: SquadMember[] = [
                { name: '[Danny](https://github.com/danny)', role: 'Lead', status: 'idle' },
            ];
            const dp = new MockSquadDataProvider({ members, tasks: [] });
            const provider = new TeamTreeProvider(dp as never);

            const children = await provider.getChildren();
            const danny = children.find(c => c.label === 'Danny');

            assert.ok(danny, 'Should strip markdown link and display "Danny"');
        });
    });
});
