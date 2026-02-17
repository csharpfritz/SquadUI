/**
 * Acceptance tests: Session log isolation
 * 
 * Validates that session logs in log/ do not pollute task status or member
 * working state. The parser must distinguish between:
 * - orchestration-log/ entries (active work, affect status)
 * - log/ entries (narrative history, display-only)
 * 
 * Covers two scenarios:
 * 1. Sensei repo — session logs with participant names (bold-name fallback parsing)
 * 2. SquadUI repo — session logs with issue references (#21, #22, #28)
 */

import * as assert from 'assert';
import * as path from 'path';
import { SquadDataProvider } from '../../services/SquadDataProvider';
import { OrchestrationLogService } from '../../services/OrchestrationLogService';

const SENSEI_FIXTURES = path.resolve(__dirname, '../../../test-fixtures/sensei-scenario');
const SESSION_LOG_ISSUES_FIXTURES = path.resolve(__dirname, '../../../test-fixtures/session-log-issues');

suite('Session Log Isolation: Sensei scenario', () => {
    let dataProvider: SquadDataProvider;
    let logService: OrchestrationLogService;

    setup(() => {
        dataProvider = new SquadDataProvider(SENSEI_FIXTURES, '.ai-team', 0);
        logService = new OrchestrationLogService('.ai-team');
    });

    test('members from session logs only should be idle', async () => {
        const members = await dataProvider.getSquadMembers();
        const basher = members.find(m => m.name === 'Basher');

        // Basher appears in most recent session log (2026-02-17-blog-research.md)
        // but NOT in orchestration-log/ — should be idle
        assert.ok(basher, 'Basher should be in roster from team.md');
        assert.strictEqual(basher!.status, 'idle', 'Basher should be idle (only in session log, not orchestration-log)');
    });

    test('members from orchestration-log entries should have correct status', async () => {
        // First, verify orchestration log is being read correctly
        const logService = new OrchestrationLogService('.ai-team');
        const orchestrationEntries = await logService.parseOrchestrationLogs(SENSEI_FIXTURES);
        
        assert.strictEqual(orchestrationEntries.length, 1, 'Should have 1 orchestration log entry');
        assert.ok(orchestrationEntries[0].participants.length > 0, 
            `Orchestration log should have participants. Got: ${JSON.stringify(orchestrationEntries[0].participants)}`);
        assert.ok(orchestrationEntries[0].participants.includes('Linus'), 
            `Orchestration log should include Linus. Got: ${JSON.stringify(orchestrationEntries[0].participants)}`);

        const members = await dataProvider.getSquadMembers();
        const linus = members.find(m => m.name === 'Linus');
        const rusty = members.find(m => m.name === 'Rusty');
        const basher = members.find(m => m.name === 'Basher');
        const livingston = members.find(m => m.name === 'Livingston');

        assert.ok(linus, 'Linus should be in roster from team.md');
        
        // All members should be idle because:
        // - Linus is in the orchestration log, but the task is completed (not in_progress)
        // - The "working" status only applies when there are in_progress tasks
        // - Others are not in any orchestration log
        assert.strictEqual(rusty!.status, 'idle', 'Rusty should be idle (not in orchestration log)');
        assert.strictEqual(basher!.status, 'idle', 'Basher should be idle (not in orchestration log)');
        assert.strictEqual(livingston!.status, 'idle', 'Livingston should be idle (not in orchestration log)');
        assert.strictEqual(linus!.status, 'idle', 
            'Linus should be idle (orchestration log task is completed, not in_progress)');
    });

    test('no issue-based tasks created from session log content', async () => {
        const allTasks = await dataProvider.getTasks();
        
        // Session logs mention Linus and Basher in narrative context,
        // but no issue numbers — those should NOT create tasks
        // However, orchestration log has participant + summary, so a prose task will be created
        assert.ok(allTasks.length > 0, 'Should have prose task from orchestration log');
        
        // Verify NO tasks reference session log content (landing page, blog research)
        const taskTitles = allTasks.map(t => t.title.toLowerCase());
        assert.ok(!taskTitles.some(t => t.includes('blog') || t.includes('research')), 
            'Should not create tasks from session log content');
    });

    test('parseOrchestrationLogs() returns only orchestration-log entries', async () => {
        const orchestrationEntries = await logService.parseOrchestrationLogs(SENSEI_FIXTURES);
        
        // Should only find 2026-02-09T2130-linus.md from orchestration-log/
        assert.strictEqual(orchestrationEntries.length, 1, 'Should find exactly 1 orchestration-log entry');
        assert.strictEqual(orchestrationEntries[0].topic, 'linus', 'Should be the Linus entry from orchestration-log');
        assert.ok(orchestrationEntries[0].participants.includes('Linus'), 'Should have Linus as participant');
    });

    test('parseAllLogs() returns entries from both directories', async () => {
        const allEntries = await logService.parseAllLogs(SENSEI_FIXTURES);
        
        // Should find entries from both orchestration-log/ (1) and log/ (2)
        assert.ok(allEntries.length >= 3, 'Should find at least 3 log entries total (1 orchestration + 2 session)');
        
        const topics = allEntries.map(e => e.topic);
        assert.ok(topics.includes('linus'), 'Should include orchestration-log entry');
        assert.ok(topics.includes('landing-page') || topics.some(t => t.includes('landing')), 'Should include session log entries');
    });
});

suite('Session Log Isolation: Issue reference scenario', () => {
    let dataProvider: SquadDataProvider;

    setup(() => {
        dataProvider = new SquadDataProvider(SESSION_LOG_ISSUES_FIXTURES, '.ai-team', 0);
    });

    test('issues from session log should NOT appear as in-progress tasks', async () => {
        const allTasks = await dataProvider.getTasks();
        
        // Only issue #8 from orchestration-log should appear
        const issueIds = allTasks.map(t => t.id);
        
        assert.ok(issueIds.includes('8'), 'Issue #8 from orchestration-log should be in tasks');
        assert.ok(!issueIds.includes('21'), 'Issue #21 from session log should NOT be in tasks');
        assert.ok(!issueIds.includes('22'), 'Issue #22 from session log should NOT be in tasks');
        assert.ok(!issueIds.includes('28'), 'Issue #28 from session log should NOT be in tasks');
    });

    test('issue #8 from orchestration-log SHOULD appear as in-progress', async () => {
        const rustyTasks = await dataProvider.getTasksForMember('Rusty');
        
        const issueIds = rustyTasks.map(t => t.id);
        assert.ok(issueIds.includes('8'), 'Rusty should own task #8 from orchestration-log');
    });

    test('Livingston should NOT show as working (only in session log)', async () => {
        const members = await dataProvider.getSquadMembers();
        const livingston = members.find(m => m.name === 'Livingston');

        // Livingston appears in session log (2026-02-13-v020-kickoff.md) participants
        // but NOT in orchestration-log/ — should be idle
        assert.ok(livingston, 'Livingston should be in roster from team.md');
        assert.strictEqual(livingston!.status, 'idle', 'Livingston should be idle (only in session log)');
    });

    test('Rusty SHOULD show as working (in orchestration log)', async () => {
        const members = await dataProvider.getSquadMembers();
        const rusty = members.find(m => m.name === 'Rusty');

        // Rusty appears in orchestration-log/2026-02-13-member-working.md
        assert.ok(rusty, 'Rusty should be in roster from team.md');
        assert.strictEqual(rusty!.status, 'working', 'Rusty should be working (in orchestration-log)');
    });
});

suite('parseOrchestrationLogs vs parseAllLogs isolation', () => {

    test('discoverOrchestrationLogFiles() returns only orchestration-log/ files', async () => {
        const logService = new OrchestrationLogService('.ai-team');
        const orchestrationFiles = await logService.discoverOrchestrationLogFiles(SENSEI_FIXTURES);
        
        // Should only find files from orchestration-log/
        assert.strictEqual(orchestrationFiles.length, 1, 'Should find 1 file from orchestration-log/');
        assert.ok(
            orchestrationFiles[0].includes('orchestration-log'),
            'File path should be from orchestration-log/ directory'
        );
        assert.ok(
            !orchestrationFiles.some(f => f.includes(path.join('.ai-team', 'log')) && !f.includes('orchestration-log')),
            'Should NOT include files from log/ directory'
        );
    });

    test('discoverLogFiles() returns files from both directories', async () => {
        const logService = new OrchestrationLogService('.ai-team');
        const allFiles = await logService.discoverLogFiles(SENSEI_FIXTURES);
        
        // Should find files from both orchestration-log/ and log/
        assert.ok(allFiles.length >= 3, 'Should find at least 3 files total');
        
        const hasOrchestrationLog = allFiles.some(f => f.includes('orchestration-log'));
        const hasSessionLog = allFiles.some(f => f.includes(path.join('.ai-team', 'log')) && !f.includes('orchestration-log'));
        
        assert.ok(hasOrchestrationLog, 'Should include files from orchestration-log/');
        assert.ok(hasSessionLog, 'Should include files from log/');
    });

    test('parseOrchestrationLogs() returns fewer entries than parseAllLogs()', async () => {
        const logService = new OrchestrationLogService('.ai-team');
        const orchestrationEntries = await logService.parseOrchestrationLogs(SENSEI_FIXTURES);
        const allEntries = await logService.parseAllLogs(SENSEI_FIXTURES);
        
        assert.ok(
            orchestrationEntries.length < allEntries.length,
            'parseOrchestrationLogs should return fewer entries than parseAllLogs'
        );
    });
});
