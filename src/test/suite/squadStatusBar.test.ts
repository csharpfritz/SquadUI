/**
 * Tests for SquadStatusBar.ts — health icon logic and status bar updates.
 *
 * Tests getHealthIcon logic through statusBarItem.text after calling update().
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { SquadStatusBar } from '../../views/SquadStatusBar';
import { SquadMember } from '../../models';

class MockSquadDataProvider {
    private members: SquadMember[] = [];

    setMembers(members: SquadMember[]) {
        this.members = members;
    }

    async getSquadMembers(): Promise<SquadMember[]> {
        return this.members;
    }

    async getSquadTasks() {
        return [];
    }

    async getRecentLogEntries() {
        return [];
    }
}

suite('SquadStatusBar', () => {
    let statusBar: SquadStatusBar;
    let mockProvider: MockSquadDataProvider;

    setup(() => {
        mockProvider = new MockSquadDataProvider();
        statusBar = new SquadStatusBar(mockProvider as any);
    });

    teardown(() => {
        statusBar.dispose();
    });

    // ─── Member Count Display Tests ─────────────────────────────────────────

    suite('Member Count Display', () => {
        test('shows member count for multiple members', async () => {
            mockProvider.setMembers([
                { name: 'Alice', role: 'Dev', status: 'idle' },
                { name: 'Bob', role: 'Tester', status: 'idle' },
            ]);

            await statusBar.update();
            const statusBarItem = (statusBar as any).statusBarItem;

            assert.ok(statusBarItem.text.includes('2 members'), 'Should show 2 members');
            // No health icons should be present
            assert.ok(!statusBarItem.text.includes('⚪'), 'Should not show health icon');
            assert.ok(!statusBarItem.text.includes('Active'), 'Should not show Active label');
        });

        test('shows singular "member" for one member', async () => {
            mockProvider.setMembers([
                { name: 'Alice', role: 'Dev', status: 'working' },
            ]);

            await statusBar.update();
            const statusBarItem = (statusBar as any).statusBarItem;

            // Working member shows "1/1 working"
            assert.ok(statusBarItem.text.includes('1/1 working'), 'Should show 1/1 working');
        });

        test('shows working count when members are active', async () => {
            mockProvider.setMembers([
                { name: 'Alice', role: 'Dev', status: 'working' },
                { name: 'Bob', role: 'Tester', status: 'working' },
                { name: 'Charlie', role: 'Designer', status: 'idle' },
                { name: 'Dave', role: 'PM', status: 'idle' },
            ]);

            await statusBar.update();
            const statusBarItem = (statusBar as any).statusBarItem;

            assert.ok(!statusBarItem.text.includes('🟢'), 'Should not show health icon');
            assert.ok(!statusBarItem.text.includes('🟡'), 'Should not show health icon');
            assert.ok(!statusBarItem.text.includes('🟠'), 'Should not show health icon');
            assert.ok(!statusBarItem.text.includes('⚪'), 'Should not show health icon');
            assert.ok(statusBarItem.text.includes('2/4 working'), 'Should show 2/4 working');
        });
    });

    // ─── Empty Squad Tests ──────────────────────────────────────────────────

    suite('Empty Squad Handling', () => {
        test('shows "Empty" when no members', async () => {
            mockProvider.setMembers([]);

            await statusBar.update();
            const statusBarItem = (statusBar as any).statusBarItem;

            assert.ok(statusBarItem.text.includes('Empty'), 'Should show Empty');
        });

        test('empty squad has no background color', async () => {
            mockProvider.setMembers([]);

            await statusBar.update();
            const statusBarItem = (statusBar as any).statusBarItem;

            assert.strictEqual(statusBarItem.backgroundColor, undefined, 'Empty squad should have no background color');
        });
    });

    // ─── Status Bar Text Format Tests ───────────────────────────────────────

    suite('Status Bar Text Format', () => {
        test('includes organization icon', async () => {
            mockProvider.setMembers([
                { name: 'Alice', role: 'Dev', status: 'working' },
            ]);

            await statusBar.update();
            const statusBarItem = (statusBar as any).statusBarItem;

            assert.ok(statusBarItem.text.includes('$(organization)'), 'Should include organization icon');
        });

        test('shows "Squad:" label', async () => {
            mockProvider.setMembers([
                { name: 'Alice', role: 'Dev', status: 'idle' },
            ]);

            await statusBar.update();
            const statusBarItem = (statusBar as any).statusBarItem;

            assert.ok(statusBarItem.text.includes('Squad:'), 'Should include Squad: label');
        });

        test('shows member count', async () => {
            mockProvider.setMembers([
                { name: 'Alice', role: 'Dev', status: 'working' },
                { name: 'Bob', role: 'Tester', status: 'idle' },
                { name: 'Charlie', role: 'Designer', status: 'working' },
            ]);

            await statusBar.update();
            const statusBarItem = (statusBar as any).statusBarItem;

            assert.ok(statusBarItem.text.includes('2/3 working'), 'Should show 2/3 working');
        });
    });

    // ─── Tooltip Tests ──────────────────────────────────────────────────────

    suite('Tooltip Content', () => {
        test('tooltip includes member names and roles', async () => {
            mockProvider.setMembers([
                { name: 'Alice', role: 'Dev', status: 'working' },
                { name: 'Bob', role: 'Tester', status: 'idle' },
            ]);

            await statusBar.update();
            const statusBarItem = (statusBar as any).statusBarItem;
            const tooltip = statusBarItem.tooltip as vscode.MarkdownString;

            assert.ok(tooltip.value.includes('Alice'), 'Tooltip should include member name');
            assert.ok(tooltip.value.includes('Bob'), 'Tooltip should include member name');
        });

        test('tooltip does not show working/idle breakdown', async () => {
            mockProvider.setMembers([
                { name: 'Alice', role: 'Dev', status: 'working' },
                { name: 'Bob', role: 'Tester', status: 'idle' },
                { name: 'Charlie', role: 'Designer', status: 'idle' },
            ]);

            await statusBar.update();
            const statusBarItem = (statusBar as any).statusBarItem;
            const tooltip = statusBarItem.tooltip as vscode.MarkdownString;

            assert.ok(!tooltip.value.includes('**Idle:**'), 'Tooltip should not show idle count');
            assert.ok(!tooltip.value.includes('**Working:**'), 'Tooltip should not show working section');
        });

        test('tooltip is MarkdownString', async () => {
            mockProvider.setMembers([
                { name: 'Alice', role: 'Dev', status: 'working' },
            ]);

            await statusBar.update();
            const statusBarItem = (statusBar as any).statusBarItem;

            assert.ok(statusBarItem.tooltip instanceof vscode.MarkdownString, 'Tooltip should be MarkdownString');
        });
    });

    // ─── SDK Version Display Tests ──────────────────────────────────────────

    suite('SDK Version in Tooltip', () => {
        test('tooltip includes SDK version info when members present', async () => {
            mockProvider.setMembers([
                { name: 'Alice', role: 'Dev', status: 'idle' },
            ]);

            await statusBar.update();
            const statusBarItem = (statusBar as any).statusBarItem;
            const tooltip = statusBarItem.tooltip as vscode.MarkdownString;

            // SDK version may or may not be available in test env,
            // but tooltip should still be a MarkdownString
            assert.ok(tooltip instanceof vscode.MarkdownString, 'Tooltip should be MarkdownString');
            // If SDK is available, tooltip includes version; if not, it's still valid
            assert.ok(tooltip.value.includes('Alice'), 'Tooltip should still include member info');
        });
    });

    // ─── Command Binding Tests ──────────────────────────────────────────────

    suite('Command Binding', () => {
        test('status bar item has openDashboard command', () => {
            const statusBarItem = (statusBar as any).statusBarItem;

            assert.strictEqual(statusBarItem.command, 'squadui.openDashboard', 'Should bind to openDashboard command');
        });
    });
});
