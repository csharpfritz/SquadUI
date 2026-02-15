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

    // ─── getHealthIcon Logic Tests ──────────────────────────────────────────

    suite('getHealthIcon() — Health Status Logic', () => {
        test('0 active members shows ⚪ (all idle)', async () => {
            mockProvider.setMembers([
                { name: 'Alice', role: 'Dev', status: 'idle' },
                { name: 'Bob', role: 'Tester', status: 'idle' },
            ]);

            await statusBar.update();
            const statusBarItem = (statusBar as any).statusBarItem;

            assert.ok(statusBarItem.text.includes('⚪'), 'Should show ⚪ when all idle');
            assert.ok(statusBarItem.text.includes('0/2 Active'), 'Should show 0/2 active');
        });

        test('70%+ active shows 🟢 (high activity)', async () => {
            mockProvider.setMembers([
                { name: 'Alice', role: 'Dev', status: 'working' },
                { name: 'Bob', role: 'Tester', status: 'working' },
                { name: 'Charlie', role: 'Designer', status: 'working' },
                { name: 'Dave', role: 'PM', status: 'idle' },
            ]);

            await statusBar.update();
            const statusBarItem = (statusBar as any).statusBarItem;

            // 3/4 = 75% active
            assert.ok(statusBarItem.text.includes('🟢'), 'Should show 🟢 for 75% active');
            assert.ok(statusBarItem.text.includes('3/4 Active'), 'Should show 3/4 active');
        });

        test('30-69% active shows 🟡 (moderate activity)', async () => {
            mockProvider.setMembers([
                { name: 'Alice', role: 'Dev', status: 'working' },
                { name: 'Bob', role: 'Tester', status: 'working' },
                { name: 'Charlie', role: 'Designer', status: 'idle' },
                { name: 'Dave', role: 'PM', status: 'idle' },
            ]);

            await statusBar.update();
            const statusBarItem = (statusBar as any).statusBarItem;

            // 2/4 = 50% active
            assert.ok(statusBarItem.text.includes('🟡'), 'Should show 🟡 for 50% active');
            assert.ok(statusBarItem.text.includes('2/4 Active'), 'Should show 2/4 active');
        });

        test('1-29% active shows 🟠 (low activity)', async () => {
            mockProvider.setMembers([
                { name: 'Alice', role: 'Dev', status: 'working' },
                { name: 'Bob', role: 'Tester', status: 'idle' },
                { name: 'Charlie', role: 'Designer', status: 'idle' },
                { name: 'Dave', role: 'PM', status: 'idle' },
            ]);

            await statusBar.update();
            const statusBarItem = (statusBar as any).statusBarItem;

            // 1/4 = 25% active
            assert.ok(statusBarItem.text.includes('🟠'), 'Should show 🟠 for 25% active');
            assert.ok(statusBarItem.text.includes('1/4 Active'), 'Should show 1/4 active');
        });

        test('exactly 70% active shows 🟢', async () => {
            mockProvider.setMembers([
                { name: 'A', role: 'Dev', status: 'working' },
                { name: 'B', role: 'Dev', status: 'working' },
                { name: 'C', role: 'Dev', status: 'working' },
                { name: 'D', role: 'Dev', status: 'working' },
                { name: 'E', role: 'Dev', status: 'working' },
                { name: 'F', role: 'Dev', status: 'working' },
                { name: 'G', role: 'Dev', status: 'working' },
                { name: 'H', role: 'Dev', status: 'idle' },
                { name: 'I', role: 'Dev', status: 'idle' },
                { name: 'J', role: 'Dev', status: 'idle' },
            ]);

            await statusBar.update();
            const statusBarItem = (statusBar as any).statusBarItem;

            // 7/10 = 70% active (boundary)
            assert.ok(statusBarItem.text.includes('🟢'), 'Should show 🟢 for exactly 70% active');
            assert.ok(statusBarItem.text.includes('7/10 Active'), 'Should show 7/10 active');
        });

        test('exactly 30% active shows 🟡', async () => {
            mockProvider.setMembers([
                { name: 'A', role: 'Dev', status: 'working' },
                { name: 'B', role: 'Dev', status: 'working' },
                { name: 'C', role: 'Dev', status: 'working' },
                { name: 'D', role: 'Dev', status: 'idle' },
                { name: 'E', role: 'Dev', status: 'idle' },
                { name: 'F', role: 'Dev', status: 'idle' },
                { name: 'G', role: 'Dev', status: 'idle' },
                { name: 'H', role: 'Dev', status: 'idle' },
                { name: 'I', role: 'Dev', status: 'idle' },
                { name: 'J', role: 'Dev', status: 'idle' },
            ]);

            await statusBar.update();
            const statusBarItem = (statusBar as any).statusBarItem;

            // 3/10 = 30% active (boundary)
            assert.ok(statusBarItem.text.includes('🟡'), 'Should show 🟡 for exactly 30% active');
            assert.ok(statusBarItem.text.includes('3/10 Active'), 'Should show 3/10 active');
        });

        test('29% active shows 🟠 (below 30% threshold)', async () => {
            mockProvider.setMembers([
                { name: 'A', role: 'Dev', status: 'working' },
                { name: 'B', role: 'Dev', status: 'working' },
                { name: 'C', role: 'Dev', status: 'idle' },
                { name: 'D', role: 'Dev', status: 'idle' },
                { name: 'E', role: 'Dev', status: 'idle' },
                { name: 'F', role: 'Dev', status: 'idle' },
                { name: 'G', role: 'Dev', status: 'idle' },
            ]);

            await statusBar.update();
            const statusBarItem = (statusBar as any).statusBarItem;

            // 2/7 ≈ 28.6% active
            assert.ok(statusBarItem.text.includes('🟠'), 'Should show 🟠 for 28.6% active');
        });

        test('69% active shows 🟡 (below 70% threshold)', async () => {
            mockProvider.setMembers([
                { name: 'A', role: 'Dev', status: 'working' },
                { name: 'B', role: 'Dev', status: 'working' },
                { name: 'C', role: 'Dev', status: 'working' },
                { name: 'D', role: 'Dev', status: 'working' },
                { name: 'E', role: 'Dev', status: 'working' },
                { name: 'F', role: 'Dev', status: 'idle' },
                { name: 'G', role: 'Dev', status: 'idle' },
                { name: 'H', role: 'Dev', status: 'idle' },
            ]);

            await statusBar.update();
            const statusBarItem = (statusBar as any).statusBarItem;

            // 5/8 = 62.5% active
            assert.ok(statusBarItem.text.includes('🟡'), 'Should show 🟡 for 62.5% active');
        });

        test('single working member shows 🟢 (100% active)', async () => {
            mockProvider.setMembers([
                { name: 'Alice', role: 'Dev', status: 'working' },
            ]);

            await statusBar.update();
            const statusBarItem = (statusBar as any).statusBarItem;

            // 1/1 = 100% active
            assert.ok(statusBarItem.text.includes('🟢'), 'Should show 🟢 for 100% active');
            assert.ok(statusBarItem.text.includes('1/1 Active'), 'Should show 1/1 active');
        });

        test('single idle member shows ⚪ (0% active)', async () => {
            mockProvider.setMembers([
                { name: 'Alice', role: 'Dev', status: 'idle' },
            ]);

            await statusBar.update();
            const statusBarItem = (statusBar as any).statusBarItem;

            // 0/1 = 0% active
            assert.ok(statusBarItem.text.includes('⚪'), 'Should show ⚪ for 0% active');
            assert.ok(statusBarItem.text.includes('0/1 Active'), 'Should show 0/1 active');
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

        test('shows active count before total count', async () => {
            mockProvider.setMembers([
                { name: 'Alice', role: 'Dev', status: 'working' },
                { name: 'Bob', role: 'Tester', status: 'idle' },
                { name: 'Charlie', role: 'Designer', status: 'working' },
            ]);

            await statusBar.update();
            const statusBarItem = (statusBar as any).statusBarItem;

            assert.ok(statusBarItem.text.includes('2/3'), 'Should show 2/3 format');
        });
    });

    // ─── Tooltip Tests ──────────────────────────────────────────────────────

    suite('Tooltip Content', () => {
        test('tooltip includes working members', async () => {
            mockProvider.setMembers([
                { name: 'Alice', role: 'Dev', status: 'working', currentTask: { title: 'Fix bug #42' } } as any,
                { name: 'Bob', role: 'Tester', status: 'idle' },
            ]);

            await statusBar.update();
            const statusBarItem = (statusBar as any).statusBarItem;
            const tooltip = statusBarItem.tooltip as vscode.MarkdownString;

            assert.ok(tooltip.value.includes('Alice'), 'Tooltip should include working member');
            assert.ok(tooltip.value.includes('Fix bug #42'), 'Tooltip should include current task');
        });

        test('tooltip shows idle count', async () => {
            mockProvider.setMembers([
                { name: 'Alice', role: 'Dev', status: 'working' },
                { name: 'Bob', role: 'Tester', status: 'idle' },
                { name: 'Charlie', role: 'Designer', status: 'idle' },
            ]);

            await statusBar.update();
            const statusBarItem = (statusBar as any).statusBarItem;
            const tooltip = statusBarItem.tooltip as vscode.MarkdownString;

            assert.ok(tooltip.value.includes('**Idle:** 2'), 'Tooltip should show idle count');
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

    // ─── Command Binding Tests ──────────────────────────────────────────────

    suite('Command Binding', () => {
        test('status bar item has openDashboard command', () => {
            const statusBarItem = (statusBar as any).statusBarItem;

            assert.strictEqual(statusBarItem.command, 'squadui.openDashboard', 'Should bind to openDashboard command');
        });
    });
});
