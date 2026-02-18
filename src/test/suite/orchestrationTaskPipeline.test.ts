/**
 * Tests for the task identification pipeline in OrchestrationLogService.
 * Covers getMemberStates() and getActiveTasks() with synthetic entries.
 */

import * as assert from 'assert';
import { OrchestrationLogService } from '../../services/OrchestrationLogService';
import { OrchestrationLogEntry } from '../../models';

/** Creates a minimal OrchestrationLogEntry with sensible defaults. */
function makeEntry(overrides: Partial<OrchestrationLogEntry> = {}): OrchestrationLogEntry {
    return {
        timestamp: '2026-02-10T00:00:00Z',
        date: '2026-02-10',
        topic: 'test',
        participants: [],
        summary: 'Test summary',
        ...overrides,
    };
}

suite('Orchestration Task Pipeline — getMemberStates()', () => {
    let service: OrchestrationLogService;

    setup(() => {
        service = new OrchestrationLogService();
    });

    test('returns empty map for empty entries', () => {
        const states = service.getMemberStates([]);
        assert.strictEqual(states.size, 0, 'Should return empty map');
    });

    test('marks most-recent-entry participants as working, others as idle', () => {
        const entries: OrchestrationLogEntry[] = [
            makeEntry({ date: '2026-02-10', participants: ['Alice', 'Bob'] }),
            makeEntry({ date: '2026-02-12', participants: ['Charlie'] }),
        ];
        const states = service.getMemberStates(entries);

        assert.strictEqual(states.get('Charlie'), 'working',
            'Charlie is in the most recent entry → working');
        assert.strictEqual(states.get('Alice'), 'idle',
            'Alice is only in an older entry → idle');
        assert.strictEqual(states.get('Bob'), 'idle',
            'Bob is only in an older entry → idle');
    });

    test('case-insensitive member matching (Danny vs danny)', () => {
        // "Danny" in an older entry, "danny" in the newest.
        // These resolve to one member (first casing wins) marked 'working'.
        const entries: OrchestrationLogEntry[] = [
            makeEntry({ date: '2026-02-10', participants: ['Danny'] }),
            makeEntry({ date: '2026-02-12', participants: ['danny'] }),
        ];
        const states = service.getMemberStates(entries);

        // Should dedup to one entry using first-seen casing
        assert.strictEqual(states.size, 1, 'Should dedup Danny/danny to one member');

        // First-seen casing preserved: 'Danny'
        assert.strictEqual(states.get('Danny'), 'working',
            'Most-recent entry participant should be working');
    });

    test('handles entries with empty participants array', () => {
        const entries: OrchestrationLogEntry[] = [
            makeEntry({ date: '2026-02-10', participants: [] }),
        ];
        const states = service.getMemberStates(entries);
        assert.strictEqual(states.size, 0, 'No participants → empty map');
    });

    test('handles single entry with multiple participants', () => {
        const entries: OrchestrationLogEntry[] = [
            makeEntry({
                date: '2026-02-10',
                participants: ['Alice', 'Bob', 'Charlie'],
            }),
        ];
        const states = service.getMemberStates(entries);

        assert.strictEqual(states.size, 3, 'Should track 3 members');
        assert.strictEqual(states.get('Alice'), 'working');
        assert.strictEqual(states.get('Bob'), 'working');
        assert.strictEqual(states.get('Charlie'), 'working');
    });
});

suite('Orchestration Task Pipeline — getActiveTasks()', () => {
    let service: OrchestrationLogService;

    setup(() => {
        service = new OrchestrationLogService();
    });

    test('extracts tasks from relatedIssues (e.g. "#42")', () => {
        const entries: OrchestrationLogEntry[] = [
            makeEntry({
                participants: ['Linus'],
                relatedIssues: ['#42'],
            }),
        ];
        const tasks = service.getActiveTasks(entries);

        const task42 = tasks.find(t => t.id === '42');
        assert.ok(task42, 'Should extract task from #42 reference');
        assert.strictEqual(task42!.title, 'Issue #42');
        assert.strictEqual(task42!.assignee, 'Linus');
    });

    test('deduplicates tasks across entries', () => {
        const entries: OrchestrationLogEntry[] = [
            makeEntry({
                date: '2026-02-10',
                participants: ['Alice'],
                relatedIssues: ['#10', '#20'],
            }),
            makeEntry({
                date: '2026-02-11',
                participants: ['Bob'],
                relatedIssues: ['#10', '#30'],
            }),
        ];
        const tasks = service.getActiveTasks(entries);

        const ids = tasks.map(t => t.id);
        assert.strictEqual(ids.length, new Set(ids).size,
            'Should have no duplicate task IDs');
        assert.ok(ids.includes('10'));
        assert.ok(ids.includes('20'));
        assert.ok(ids.includes('30'));
    });

    test('extracts prose-based tasks from What Was Done sections', () => {
        const entries: OrchestrationLogEntry[] = [
            makeEntry({
                date: '2026-02-10',
                participants: ['Banner'],
                whatWasDone: [
                    { agent: 'Banner', description: 'Implemented auth middleware' },
                ],
            }),
        ];
        const tasks = service.getActiveTasks(entries);

        assert.ok(tasks.length > 0, 'Should extract at least one prose task');
        const proseTask = tasks.find(t => t.id === '2026-02-10-banner');
        assert.ok(proseTask, 'Should generate deterministic prose task ID');
        assert.ok(
            proseTask!.description?.includes('auth middleware'),
            'Task description should reference the work done',
        );
    });

    test('assigns tasks to correct members (first participant)', () => {
        const entries: OrchestrationLogEntry[] = [
            makeEntry({
                participants: ['Alice', 'Bob'],
                relatedIssues: ['#50'],
            }),
        ];
        const tasks = service.getActiveTasks(entries);

        const task50 = tasks.find(t => t.id === '50');
        assert.ok(task50, 'Should find task #50');
        assert.strictEqual(task50!.assignee, 'Alice',
            'Issue task should be assigned to first participant of its entry');
    });

    test('marks tasks from old entries (>30 days) — staleness awareness', () => {
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 45);
        const oldDateStr = oldDate.toISOString().split('T')[0];

        const entries: OrchestrationLogEntry[] = [
            makeEntry({
                date: oldDateStr,
                participants: ['OldMember'],
                relatedIssues: ['#99'],
            }),
        ];
        const tasks = service.getActiveTasks(entries);

        // Stale in-progress tasks (>30 days) are filtered out
        const task99 = tasks.find(t => t.id === '99');
        assert.ok(!task99, 'In-progress tasks older than 30 days should be filtered out');
    });

    test('handles entries with no tasks gracefully', () => {
        const entries: OrchestrationLogEntry[] = [
            makeEntry({
                participants: ['Alice'],
                summary: 'General discussion, no actionable items',
                // No relatedIssues, no outcomes with #refs, no whatWasDone
            }),
        ];
        const tasks = service.getActiveTasks(entries);

        // Should not throw; may produce a synthetic prose task from summary
        assert.ok(Array.isArray(tasks), 'Should return an array');
    });

    test('case-insensitive completion detection (Completed, DONE, ✅)', () => {
        const entries: OrchestrationLogEntry[] = [
            makeEntry({
                date: '2026-02-10',
                participants: ['Alice'],
                outcomes: ['Completed review of #61'],
            }),
            makeEntry({
                date: '2026-02-11',
                participants: ['Bob'],
                outcomes: ['Issue #62 is DONE'],
            }),
        ];
        const tasks = service.getActiveTasks(entries);

        const task61 = tasks.find(t => t.id === '61');
        const task62 = tasks.find(t => t.id === '62');
        assert.ok(task61, 'Should find task from #61');
        assert.ok(task62, 'Should find task from #62');
        assert.strictEqual(task61!.status, 'completed',
            '"Completed" (title-case) should be detected');
        assert.strictEqual(task62!.status, 'completed',
            '"DONE" (upper-case) should be detected');
    });

    test('handles entries with both issue tasks and prose tasks', () => {
        const entries: OrchestrationLogEntry[] = [
            makeEntry({
                date: '2026-02-10',
                participants: ['Alice'],
                relatedIssues: ['#70'],
                whatWasDone: [
                    { agent: 'Alice', description: 'Refactored the config module' },
                ],
            }),
        ];
        const tasks = service.getActiveTasks(entries);

        // Issue task should be present
        const issueTask = tasks.find(t => t.id === '70');
        assert.ok(issueTask, 'Should include issue-based task #70');

        // Prose task should NOT be created because the entry already
        // produced issue tasks (prose extraction is a fallback path)
        const proseTask = tasks.find(t => t.id === '2026-02-10-alice');
        assert.strictEqual(proseTask, undefined,
            'Should not create prose task when entry already has issue tasks');
    });
});
