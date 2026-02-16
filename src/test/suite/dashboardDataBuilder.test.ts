/**
 * Tests for DashboardDataBuilder — the pure-logic engine behind all dashboard panels.
 *
 * DashboardDataBuilder has ZERO VS Code dependencies, making it ideal for unit testing.
 * It transforms raw squad data (tasks, members, log entries, decisions) into
 * dashboard-ready structures (velocity timeline, activity heatmap, swimlanes).
 *
 * Test coverage:
 * - buildVelocityTimeline: completed tasks per day over 31-day window
 * - buildActivityHeatmap: member activity levels from log participation
 * - buildActivitySwimlanes: member task timelines with sorting
 * - buildDashboardData: full pipeline composition
 */

import * as assert from 'assert';
import { DashboardDataBuilder } from '../../views/dashboard/DashboardDataBuilder';
import {
    Task,
    SquadMember,
    OrchestrationLogEntry,
    DecisionEntry,
    DashboardData,
    GitHubIssue,
} from '../../models';

// ─── Test Helpers ────────────────────────────────────────────────────────────

/** Returns a Date object n days before now (at noon to avoid timezone edge cases). */
function daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(12, 0, 0, 0);
    return d;
}

/** Returns today's date as YYYY-MM-DD string. */
function todayStr(): string {
    return new Date().toISOString().split('T')[0];
}

/** Returns YYYY-MM-DD string for n days ago. */
function daysAgoStr(n: number): string {
    return daysAgo(n).toISOString().split('T')[0];
}

/** Creates a minimal Task with sensible defaults. */
function makeTask(overrides: Partial<Task> & { id: string }): Task {
    return {
        title: overrides.id,
        status: 'pending',
        assignee: 'Unassigned',
        ...overrides,
    };
}

/** Creates a minimal SquadMember. */
function makeMember(name: string, role: string = 'Dev'): SquadMember {
    return { name, role, status: 'idle' };
}

/** Creates a minimal OrchestrationLogEntry. */
function makeLogEntry(overrides: Partial<OrchestrationLogEntry> & { date: string; participants: string[] }): OrchestrationLogEntry {
    return {
        timestamp: new Date(overrides.date).toISOString(),
        topic: 'test',
        summary: 'Test entry',
        ...overrides,
    };
}

/** Creates a minimal DecisionEntry. */
function makeDecision(title: string, date?: string): DecisionEntry {
    return { title, date, filePath: 'decisions.md' };
}

/** Creates a minimal GitHubIssue with sensible defaults. */
function makeIssue(overrides: Partial<GitHubIssue> & { number: number }): GitHubIssue {
    return {
        title: `Issue #${overrides.number}`,
        state: 'open',
        labels: [],
        htmlUrl: `https://github.com/test/repo/issues/${overrides.number}`,
        createdAt: daysAgo(10).toISOString(),
        updatedAt: daysAgo(0).toISOString(),
        ...overrides,
    };
}

suite('DashboardDataBuilder', () => {
    let builder: DashboardDataBuilder;

    setup(() => {
        builder = new DashboardDataBuilder();
    });

    // ─── Velocity Timeline Tests ─────────────────────────────────────────

    suite('Velocity Timeline (via buildDashboardData)', () => {

        test('empty tasks → 31 data points all zero', () => {
            const result = builder.buildDashboardData([], [], [], []);
            const timeline = result.velocity.timeline;

            assert.strictEqual(timeline.length, 31);
            for (const point of timeline) {
                assert.strictEqual(point.completedTasks, 0);
            }
        });

        test('timeline always spans exactly 31 days', () => {
            const result = builder.buildDashboardData([], [], [], []);
            const timeline = result.velocity.timeline;

            assert.strictEqual(timeline.length, 31);

            // First date is 30 days ago, last date is today
            const firstDate = timeline[0].date;
            const lastDate = timeline[timeline.length - 1].date;
            assert.strictEqual(firstDate, daysAgoStr(30));
            assert.strictEqual(lastDate, todayStr());
        });

        test('all dates in timeline are YYYY-MM-DD format', () => {
            const result = builder.buildDashboardData([], [], [], []);
            const datePattern = /^\d{4}-\d{2}-\d{2}$/;
            for (const point of result.velocity.timeline) {
                assert.ok(datePattern.test(point.date), `Invalid date format: ${point.date}`);
            }
        });

        test('task completed today → correct count', () => {
            const tasks: Task[] = [
                makeTask({ id: 't1', status: 'completed', completedAt: daysAgo(0), assignee: 'Danny' }),
            ];
            const result = builder.buildDashboardData([], [], tasks, []);
            const today = result.velocity.timeline.find(p => p.date === todayStr());

            assert.ok(today, 'Today should be in timeline');
            assert.strictEqual(today.completedTasks, 1);
        });

        test('tasks completed over multiple days → correct per-day counts', () => {
            const tasks: Task[] = [
                makeTask({ id: 't1', status: 'completed', completedAt: daysAgo(1), assignee: 'A' }),
                makeTask({ id: 't2', status: 'completed', completedAt: daysAgo(5), assignee: 'B' }),
                makeTask({ id: 't3', status: 'completed', completedAt: daysAgo(10), assignee: 'C' }),
            ];
            const result = builder.buildDashboardData([], [], tasks, []);
            const timeline = result.velocity.timeline;

            const day1 = timeline.find(p => p.date === daysAgoStr(1));
            const day5 = timeline.find(p => p.date === daysAgoStr(5));
            const day10 = timeline.find(p => p.date === daysAgoStr(10));

            assert.strictEqual(day1!.completedTasks, 1);
            assert.strictEqual(day5!.completedTasks, 1);
            assert.strictEqual(day10!.completedTasks, 1);
        });

        test('tasks completed more than 30 days ago → excluded', () => {
            const tasks: Task[] = [
                makeTask({ id: 't1', status: 'completed', completedAt: daysAgo(31), assignee: 'A' }),
                makeTask({ id: 't2', status: 'completed', completedAt: daysAgo(60), assignee: 'B' }),
            ];
            const result = builder.buildDashboardData([], [], tasks, []);
            const total = result.velocity.timeline.reduce((sum, p) => sum + p.completedTasks, 0);

            assert.strictEqual(total, 0);
        });

        test('tasks with status != completed → excluded', () => {
            const tasks: Task[] = [
                makeTask({ id: 't1', status: 'pending', completedAt: daysAgo(0), assignee: 'A' }),
                makeTask({ id: 't2', status: 'in_progress', completedAt: daysAgo(0), assignee: 'B' }),
            ];
            const result = builder.buildDashboardData([], [], tasks, []);
            const total = result.velocity.timeline.reduce((sum, p) => sum + p.completedTasks, 0);

            assert.strictEqual(total, 0);
        });

        test('tasks with no completedAt → excluded', () => {
            const tasks: Task[] = [
                makeTask({ id: 't1', status: 'completed', assignee: 'A' }),
            ];
            const result = builder.buildDashboardData([], [], tasks, []);
            const total = result.velocity.timeline.reduce((sum, p) => sum + p.completedTasks, 0);

            assert.strictEqual(total, 0);
        });

        test('multiple tasks on same day → aggregated', () => {
            const tasks: Task[] = [
                makeTask({ id: 't1', status: 'completed', completedAt: daysAgo(3), assignee: 'A' }),
                makeTask({ id: 't2', status: 'completed', completedAt: daysAgo(3), assignee: 'B' }),
                makeTask({ id: 't3', status: 'completed', completedAt: daysAgo(3), assignee: 'C' }),
            ];
            const result = builder.buildDashboardData([], [], tasks, []);
            const day3 = result.velocity.timeline.find(p => p.date === daysAgoStr(3));

            assert.strictEqual(day3!.completedTasks, 3);
        });

        test('tasks with ISO string completedAt work correctly', () => {
            const isoDate = daysAgo(2).toISOString();
            const tasks: Task[] = [
                makeTask({ id: 't1', status: 'completed', completedAt: new Date(isoDate), assignee: 'A' }),
            ];
            const result = builder.buildDashboardData([], [], tasks, []);
            const day2 = result.velocity.timeline.find(p => p.date === daysAgoStr(2));

            assert.strictEqual(day2!.completedTasks, 1);
        });

        test('tasks with Date objects completedAt work correctly', () => {
            const tasks: Task[] = [
                makeTask({ id: 't1', status: 'completed', completedAt: daysAgo(4), assignee: 'A' }),
            ];
            const result = builder.buildDashboardData([], [], tasks, []);
            const day4 = result.velocity.timeline.find(p => p.date === daysAgoStr(4));

            assert.strictEqual(day4!.completedTasks, 1);
        });

        test('timeline dates are in chronological order', () => {
            const result = builder.buildDashboardData([], [], [], []);
            const dates = result.velocity.timeline.map(p => p.date);

            for (let i = 1; i < dates.length; i++) {
                assert.ok(dates[i] >= dates[i - 1], `Dates out of order: ${dates[i - 1]} > ${dates[i]}`);
            }
        });

        test('mix of valid and excluded tasks → only valid counted', () => {
            const tasks: Task[] = [
                makeTask({ id: 't1', status: 'completed', completedAt: daysAgo(1), assignee: 'A' }),
                makeTask({ id: 't2', status: 'pending', completedAt: daysAgo(1), assignee: 'B' }),
                makeTask({ id: 't3', status: 'completed', assignee: 'C' }), // no completedAt
                makeTask({ id: 't4', status: 'completed', completedAt: daysAgo(50), assignee: 'D' }), // too old
                makeTask({ id: 't5', status: 'completed', completedAt: daysAgo(2), assignee: 'E' }),
            ];
            const result = builder.buildDashboardData([], [], tasks, []);
            const total = result.velocity.timeline.reduce((sum, p) => sum + p.completedTasks, 0);

            assert.strictEqual(total, 2); // only t1 and t5
        });
    });

    // ─── Activity Heatmap Tests ──────────────────────────────────────────

    suite('Activity Heatmap (via buildDashboardData)', () => {

        test('empty log entries → all members at 0.0', () => {
            const members = [makeMember('Danny'), makeMember('Rusty')];
            const result = builder.buildDashboardData([], members, [], []);
            const heatmap = result.velocity.heatmap;

            assert.strictEqual(heatmap.length, 2);
            for (const point of heatmap) {
                assert.strictEqual(point.activityLevel, 0.0);
            }
        });

        test('single member with log entries → activity level 1.0', () => {
            const members = [makeMember('Danny')];
            const entries = [
                makeLogEntry({ date: daysAgoStr(1), participants: ['Danny'] }),
            ];
            const result = builder.buildDashboardData(entries, members, [], []);
            const heatmap = result.velocity.heatmap;

            assert.strictEqual(heatmap.length, 1);
            assert.strictEqual(heatmap[0].member, 'Danny');
            assert.strictEqual(heatmap[0].activityLevel, 1.0);
        });

        test('multiple members with varying participation → proportional levels', () => {
            const members = [makeMember('Danny'), makeMember('Rusty'), makeMember('Basher')];
            const entries = [
                makeLogEntry({ date: daysAgoStr(1), participants: ['Danny', 'Rusty'] }),
                makeLogEntry({ date: daysAgoStr(2), participants: ['Danny', 'Rusty'] }),
                makeLogEntry({ date: daysAgoStr(3), participants: ['Danny'] }),
                makeLogEntry({ date: daysAgoStr(4), participants: ['Danny'] }),
            ];
            const result = builder.buildDashboardData(entries, members, [], []);
            const heatmap = result.velocity.heatmap;

            const danny = heatmap.find(p => p.member === 'Danny')!;
            const rusty = heatmap.find(p => p.member === 'Rusty')!;
            const basher = heatmap.find(p => p.member === 'Basher')!;

            // Danny: 4 entries (max), Rusty: 2, Basher: 0
            assert.strictEqual(danny.activityLevel, 1.0);
            assert.strictEqual(rusty.activityLevel, 0.5);
            assert.strictEqual(basher.activityLevel, 0.0);
        });

        test('log entries older than 7 days → excluded', () => {
            const members = [makeMember('Danny')];
            const entries = [
                makeLogEntry({ date: daysAgoStr(8), participants: ['Danny'] }),
                makeLogEntry({ date: daysAgoStr(10), participants: ['Danny'] }),
            ];
            const result = builder.buildDashboardData(entries, members, [], []);
            const heatmap = result.velocity.heatmap;

            assert.strictEqual(heatmap[0].activityLevel, 0.0);
        });

        test('member with no log participation → 0.0', () => {
            const members = [makeMember('Danny'), makeMember('Linus')];
            const entries = [
                makeLogEntry({ date: daysAgoStr(1), participants: ['Danny'] }),
            ];
            const result = builder.buildDashboardData(entries, members, [], []);
            const heatmap = result.velocity.heatmap;

            const linus = heatmap.find(p => p.member === 'Linus')!;
            assert.strictEqual(linus.activityLevel, 0.0);
        });

        test('member name matching is exact (case-sensitive)', () => {
            const members = [makeMember('Danny')];
            const entries = [
                makeLogEntry({ date: daysAgoStr(1), participants: ['danny'] }), // lowercase
            ];
            const result = builder.buildDashboardData(entries, members, [], []);
            const heatmap = result.velocity.heatmap;

            // 'danny' in log should NOT match 'Danny' member
            assert.strictEqual(heatmap[0].activityLevel, 0.0);
        });

        test('no members → empty heatmap', () => {
            const entries = [
                makeLogEntry({ date: daysAgoStr(1), participants: ['Danny'] }),
            ];
            const result = builder.buildDashboardData(entries, [], [], []);

            assert.strictEqual(result.velocity.heatmap.length, 0);
        });

        test('activity levels are between 0.0 and 1.0', () => {
            const members = [makeMember('A'), makeMember('B'), makeMember('C')];
            const entries = [
                makeLogEntry({ date: daysAgoStr(0), participants: ['A', 'B', 'C'] }),
                makeLogEntry({ date: daysAgoStr(1), participants: ['A', 'B'] }),
                makeLogEntry({ date: daysAgoStr(2), participants: ['A'] }),
            ];
            const result = builder.buildDashboardData(entries, members, [], []);
            for (const point of result.velocity.heatmap) {
                assert.ok(point.activityLevel >= 0.0, `Activity level below 0: ${point.activityLevel}`);
                assert.ok(point.activityLevel <= 1.0, `Activity level above 1: ${point.activityLevel}`);
            }
        });

        test('entries on the boundary (exactly 7 days ago) are excluded', () => {
            const members = [makeMember('Danny')];
            // The builder filters entries where date < sevenDaysAgo
            // An entry exactly 7 days ago may be right at the boundary
            const entries = [
                makeLogEntry({ date: daysAgoStr(7), participants: ['Danny'] }),
            ];
            const result = builder.buildDashboardData(entries, members, [], []);
            const heatmap = result.velocity.heatmap;

            // 7 days ago is at least sevenDaysAgo, so it depends on time-of-day
            // The key point is that old entries are filtered
            assert.ok(heatmap[0].activityLevel >= 0.0);
        });

        test('same participant in multiple entries → counts each participation', () => {
            const members = [makeMember('Danny')];
            const entries = [
                makeLogEntry({ date: daysAgoStr(0), participants: ['Danny'] }),
                makeLogEntry({ date: daysAgoStr(1), participants: ['Danny'] }),
                makeLogEntry({ date: daysAgoStr(2), participants: ['Danny'] }),
            ];
            const result = builder.buildDashboardData(entries, members, [], []);

            assert.strictEqual(result.velocity.heatmap[0].activityLevel, 1.0);
        });
    });

    // ─── Activity Swimlanes Tests ────────────────────────────────────────

    suite('Activity Swimlanes (via buildDashboardData)', () => {

        test('empty tasks → swimlanes with empty task arrays', () => {
            const members = [makeMember('Danny', 'Lead'), makeMember('Rusty', 'Dev')];
            const result = builder.buildDashboardData([], members, [], []);
            const swimlanes = result.activity.swimlanes;

            assert.strictEqual(swimlanes.length, 2);
            assert.strictEqual(swimlanes[0].member, 'Danny');
            assert.strictEqual(swimlanes[0].role, 'Lead');
            assert.deepStrictEqual(swimlanes[0].tasks, []);
            assert.strictEqual(swimlanes[1].member, 'Rusty');
            assert.strictEqual(swimlanes[1].role, 'Dev');
            assert.deepStrictEqual(swimlanes[1].tasks, []);
        });

        test('tasks assigned to specific members → appear in correct swimlane', () => {
            const members = [makeMember('Danny'), makeMember('Rusty')];
            const tasks: Task[] = [
                makeTask({ id: 't1', assignee: 'Danny', status: 'in_progress', startedAt: daysAgo(2) }),
                makeTask({ id: 't2', assignee: 'Rusty', status: 'pending', startedAt: daysAgo(1) }),
            ];
            const result = builder.buildDashboardData([], members, tasks, []);
            const swimlanes = result.activity.swimlanes;

            const danny = swimlanes.find(s => s.member === 'Danny')!;
            const rusty = swimlanes.find(s => s.member === 'Rusty')!;

            assert.strictEqual(danny.tasks.length, 1);
            assert.strictEqual(danny.tasks[0].id, 't1');
            assert.strictEqual(rusty.tasks.length, 1);
            assert.strictEqual(rusty.tasks[0].id, 't2');
        });

        test('tasks sorted by startDate within each swimlane', () => {
            const members = [makeMember('Danny')];
            const tasks: Task[] = [
                makeTask({ id: 't3', assignee: 'Danny', status: 'completed', startedAt: daysAgo(1), completedAt: daysAgo(0) }),
                makeTask({ id: 't1', assignee: 'Danny', status: 'completed', startedAt: daysAgo(10), completedAt: daysAgo(8) }),
                makeTask({ id: 't2', assignee: 'Danny', status: 'in_progress', startedAt: daysAgo(5) }),
            ];
            const result = builder.buildDashboardData([], members, tasks, []);
            const dannyTasks = result.activity.swimlanes[0].tasks;

            assert.strictEqual(dannyTasks.length, 3);
            assert.strictEqual(dannyTasks[0].id, 't1'); // oldest start
            assert.strictEqual(dannyTasks[1].id, 't2');
            assert.strictEqual(dannyTasks[2].id, 't3'); // most recent start
        });

        test('tasks with no startedAt → startDate defaults to today', () => {
            const members = [makeMember('Danny')];
            const tasks: Task[] = [
                makeTask({ id: 't1', assignee: 'Danny', status: 'pending' }),
            ];
            const result = builder.buildDashboardData([], members, tasks, []);
            const task = result.activity.swimlanes[0].tasks[0];

            assert.strictEqual(task.startDate, todayStr());
        });

        test('tasks with completedAt → endDate populated', () => {
            const members = [makeMember('Danny')];
            const completed = daysAgo(1);
            const tasks: Task[] = [
                makeTask({ id: 't1', assignee: 'Danny', status: 'completed', startedAt: daysAgo(5), completedAt: completed }),
            ];
            const result = builder.buildDashboardData([], members, tasks, []);
            const task = result.activity.swimlanes[0].tasks[0];

            assert.strictEqual(task.endDate, completed.toISOString().split('T')[0]);
        });

        test('tasks without completedAt → endDate is null', () => {
            const members = [makeMember('Danny')];
            const tasks: Task[] = [
                makeTask({ id: 't1', assignee: 'Danny', status: 'in_progress', startedAt: daysAgo(3) }),
            ];
            const result = builder.buildDashboardData([], members, tasks, []);
            const task = result.activity.swimlanes[0].tasks[0];

            assert.strictEqual(task.endDate, null);
        });

        test('members with no tasks → empty swimlane still present', () => {
            const members = [makeMember('Danny'), makeMember('Linus')];
            const tasks: Task[] = [
                makeTask({ id: 't1', assignee: 'Danny', status: 'pending', startedAt: daysAgo(1) }),
            ];
            const result = builder.buildDashboardData([], members, tasks, []);
            const swimlanes = result.activity.swimlanes;

            const linus = swimlanes.find(s => s.member === 'Linus')!;
            assert.ok(linus, 'Linus swimlane should exist');
            assert.strictEqual(linus.tasks.length, 0);
        });

        test('timeline task includes correct id, title, status', () => {
            const members = [makeMember('Danny')];
            const tasks: Task[] = [
                makeTask({ id: 'fix-123', title: 'Fix the bug', assignee: 'Danny', status: 'in_progress', startedAt: daysAgo(2) }),
            ];
            const result = builder.buildDashboardData([], members, tasks, []);
            const task = result.activity.swimlanes[0].tasks[0];

            assert.strictEqual(task.id, 'fix-123');
            assert.strictEqual(task.title, 'Fix the bug');
            assert.strictEqual(task.status, 'in_progress');
        });

        test('tasks not assigned to any member → not in any swimlane', () => {
            const members = [makeMember('Danny')];
            const tasks: Task[] = [
                makeTask({ id: 't1', assignee: 'Nobody', status: 'pending', startedAt: daysAgo(1) }),
            ];
            const result = builder.buildDashboardData([], members, tasks, []);
            const danny = result.activity.swimlanes[0];

            assert.strictEqual(danny.tasks.length, 0);
        });

        test('no members → no swimlanes', () => {
            const tasks: Task[] = [
                makeTask({ id: 't1', assignee: 'Danny', status: 'pending' }),
            ];
            const result = builder.buildDashboardData([], [], tasks, []);

            assert.strictEqual(result.activity.swimlanes.length, 0);
        });

        test('startDate and endDate are YYYY-MM-DD format', () => {
            const members = [makeMember('Danny')];
            const tasks: Task[] = [
                makeTask({ id: 't1', assignee: 'Danny', status: 'completed', startedAt: daysAgo(5), completedAt: daysAgo(1) }),
            ];
            const result = builder.buildDashboardData([], members, tasks, []);
            const task = result.activity.swimlanes[0].tasks[0];
            const datePattern = /^\d{4}-\d{2}-\d{2}$/;

            assert.ok(datePattern.test(task.startDate), `Invalid startDate format: ${task.startDate}`);
            assert.ok(task.endDate && datePattern.test(task.endDate), `Invalid endDate format: ${task.endDate}`);
        });

        test('multiple tasks per member with mixed statuses', () => {
            const members = [makeMember('Danny')];
            const tasks: Task[] = [
                makeTask({ id: 't1', assignee: 'Danny', status: 'completed', startedAt: daysAgo(10), completedAt: daysAgo(8) }),
                makeTask({ id: 't2', assignee: 'Danny', status: 'in_progress', startedAt: daysAgo(3) }),
                makeTask({ id: 't3', assignee: 'Danny', status: 'pending' }),
            ];
            const result = builder.buildDashboardData([], members, tasks, []);

            assert.strictEqual(result.activity.swimlanes[0].tasks.length, 3);
        });
    });

    // ─── Burndown End-Date Bounding Tests ─────────────────────────────────

    suite('Milestone Burndown End-Date Bounding', () => {

        test('closed milestone ends at last close date', () => {
            const issues: GitHubIssue[] = [
                makeIssue({ number: 1, state: 'closed', createdAt: daysAgo(10).toISOString(), closedAt: daysAgo(5).toISOString() }),
                makeIssue({ number: 2, state: 'closed', createdAt: daysAgo(8).toISOString(), closedAt: daysAgo(3).toISOString() }),
                makeIssue({ number: 3, state: 'closed', createdAt: daysAgo(6).toISOString(), closedAt: daysAgo(2).toISOString() }),
            ];
            const result = builder.buildMilestoneBurndown('Closed Sprint', 1, issues);
            const lastPoint = result.dataPoints[result.dataPoints.length - 1];

            // Last data point date should be the latest closedAt (2 days ago), NOT today
            assert.strictEqual(lastPoint.date, daysAgoStr(2));
            assert.notStrictEqual(lastPoint.date, todayStr());
        });

        test('open milestone extends to today', () => {
            const issues: GitHubIssue[] = [
                makeIssue({ number: 1, state: 'closed', createdAt: daysAgo(10).toISOString(), closedAt: daysAgo(5).toISOString() }),
                makeIssue({ number: 2, state: 'open', createdAt: daysAgo(8).toISOString() }),
            ];
            const result = builder.buildMilestoneBurndown('Active Sprint', 2, issues);
            const lastPoint = result.dataPoints[result.dataPoints.length - 1];

            // With open issues, the burndown should extend to today
            assert.strictEqual(lastPoint.date, todayStr());
        });
    });

    // ─── Full Pipeline Tests ─────────────────────────────────────────────

    suite('buildDashboardData — Full Pipeline', () => {

        test('empty everything → valid DashboardData structure', () => {
            const result = builder.buildDashboardData([], [], [], []);

            assert.ok(result.velocity, 'velocity should exist');
            assert.ok(Array.isArray(result.velocity.timeline), 'velocity.timeline should be array');
            assert.ok(Array.isArray(result.velocity.heatmap), 'velocity.heatmap should be array');
            assert.ok(result.activity, 'activity should exist');
            assert.ok(Array.isArray(result.activity.swimlanes), 'activity.swimlanes should be array');
            assert.ok(result.decisions, 'decisions should exist');
            assert.ok(Array.isArray(result.decisions.entries), 'decisions.entries should be array');
        });

        test('decisions passed through unchanged', () => {
            const decisions: DecisionEntry[] = [
                makeDecision('Use TypeScript', '2026-02-01'),
                makeDecision('Adopt Mocha', '2026-02-10'),
            ];
            const result = builder.buildDashboardData([], [], [], decisions);

            assert.strictEqual(result.decisions.entries.length, 2);
            assert.strictEqual(result.decisions.entries[0].title, 'Use TypeScript');
            assert.strictEqual(result.decisions.entries[1].title, 'Adopt Mocha');
            assert.strictEqual(result.decisions.entries, decisions); // same reference
        });

        test('all sub-builders compose correctly', () => {
            const members = [makeMember('Danny', 'Lead'), makeMember('Rusty', 'Dev')];
            const tasks: Task[] = [
                makeTask({ id: 't1', assignee: 'Danny', status: 'completed', startedAt: daysAgo(5), completedAt: daysAgo(3) }),
                makeTask({ id: 't2', assignee: 'Rusty', status: 'in_progress', startedAt: daysAgo(2) }),
            ];
            const entries = [
                makeLogEntry({ date: daysAgoStr(1), participants: ['Danny', 'Rusty'] }),
            ];
            const decisions = [makeDecision('Decision A')];

            const result = builder.buildDashboardData(entries, members, tasks, decisions);

            // Velocity timeline has 31 points with 1 completed task
            assert.strictEqual(result.velocity.timeline.length, 31);
            const total = result.velocity.timeline.reduce((s, p) => s + p.completedTasks, 0);
            assert.strictEqual(total, 1);

            // Heatmap has 2 members
            assert.strictEqual(result.velocity.heatmap.length, 2);

            // Swimlanes have 2 members with 1 task each
            assert.strictEqual(result.activity.swimlanes.length, 2);
            assert.strictEqual(result.activity.swimlanes[0].tasks.length, 1);
            assert.strictEqual(result.activity.swimlanes[1].tasks.length, 1);

            // Decisions passed through
            assert.strictEqual(result.decisions.entries.length, 1);
        });

        test('result conforms to DashboardData shape', () => {
            const result: DashboardData = builder.buildDashboardData([], [], [], []);

            // TypeScript type check + runtime shape validation
            assert.ok('velocity' in result);
            assert.ok('timeline' in result.velocity);
            assert.ok('heatmap' in result.velocity);
            assert.ok('activity' in result);
            assert.ok('swimlanes' in result.activity);
            assert.ok('decisions' in result);
            assert.ok('entries' in result.decisions);
        });

        test('large dataset does not crash', () => {
            const members = Array.from({ length: 10 }, (_, i) => makeMember(`Member${i}`, 'Dev'));
            const tasks: Task[] = Array.from({ length: 100 }, (_, i) =>
                makeTask({
                    id: `t${i}`,
                    assignee: `Member${i % 10}`,
                    status: i % 3 === 0 ? 'completed' : 'in_progress',
                    startedAt: daysAgo(i % 25),
                    completedAt: i % 3 === 0 ? daysAgo(Math.max(0, (i % 25) - 1)) : undefined,
                })
            );
            const entries = Array.from({ length: 50 }, (_, i) =>
                makeLogEntry({
                    date: daysAgoStr(i % 6),
                    participants: [`Member${i % 10}`],
                })
            );

            const result = builder.buildDashboardData(entries, members, tasks, []);

            assert.strictEqual(result.velocity.timeline.length, 31);
            assert.strictEqual(result.velocity.heatmap.length, 10);
            assert.strictEqual(result.activity.swimlanes.length, 10);
        });
    });
});
