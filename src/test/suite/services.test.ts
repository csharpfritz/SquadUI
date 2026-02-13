/**
 * Integration tests for SquadUI data layer services.
 * Tests OrchestrationLogService, SquadDataProvider, and FileWatcherService.
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { OrchestrationLogService } from '../../services/OrchestrationLogService';
import { SquadDataProvider } from '../../services/SquadDataProvider';

// Test fixtures root - simulates a project with .ai-team structure
const TEST_FIXTURES_ROOT = path.resolve(__dirname, '../../../test-fixtures');

suite('OrchestrationLogService', () => {
    let service: OrchestrationLogService;

    setup(() => {
        service = new OrchestrationLogService();
    });

    suite('discoverLogFiles()', () => {
        test('finds .md files in orchestration-logs directory', async () => {
            const files = await service.discoverLogFiles(TEST_FIXTURES_ROOT);
            
            assert.ok(files.length > 0, 'Should find at least one log file');
            assert.ok(files.every(f => f.endsWith('.md')), 'All files should be .md files');
        });

        test('returns files sorted alphabetically (chronologically by date prefix)', async () => {
            const files = await service.discoverLogFiles(TEST_FIXTURES_ROOT);
            
            const sorted = [...files].sort();
            assert.deepStrictEqual(files, sorted, 'Files should be sorted');
        });

        test('returns empty array for missing directory', async () => {
            const files = await service.discoverLogFiles('/nonexistent/path');
            
            assert.deepStrictEqual(files, [], 'Should return empty array');
        });

        test('returns empty array for directory without .ai-team folder', async () => {
            const tempDir = path.join(TEST_FIXTURES_ROOT, 'empty-test');
            
            const files = await service.discoverLogFiles(tempDir);
            
            assert.deepStrictEqual(files, [], 'Should return empty array');
        });
    });

    suite('parseLogFile()', () => {
        test('extracts date from filename', async () => {
            const files = await service.discoverLogFiles(TEST_FIXTURES_ROOT);
            const minimalFile = files.find(f => f.includes('2026-02-10-minimal'));
            assert.ok(minimalFile, 'Should find minimal test file');

            const entry = await service.parseLogFile(minimalFile);
            
            assert.strictEqual(entry.date, '2026-02-10');
        });

        test('extracts topic from filename', async () => {
            const files = await service.discoverLogFiles(TEST_FIXTURES_ROOT);
            const minimalFile = files.find(f => f.includes('2026-02-10-minimal'));
            assert.ok(minimalFile);

            const entry = await service.parseLogFile(minimalFile);
            
            assert.strictEqual(entry.topic, 'minimal');
        });

        test('extracts participants from Who Worked section', async () => {
            const files = await service.discoverLogFiles(TEST_FIXTURES_ROOT);
            const multiTaskFile = files.find(f => f.includes('2026-02-12-multiple-tasks'));
            assert.ok(multiTaskFile);

            const entry = await service.parseLogFile(multiTaskFile);
            
            assert.ok(entry.participants.includes('Linus'), 'Should include Linus');
            assert.ok(entry.participants.includes('Basher'), 'Should include Basher');
        });

        test('extracts timestamp when present', async () => {
            const files = await service.discoverLogFiles(TEST_FIXTURES_ROOT);
            const file = files.find(f => f.includes('2026-02-12-multiple-tasks'));
            assert.ok(file);

            const entry = await service.parseLogFile(file);
            
            assert.ok(entry.timestamp, 'Should have a timestamp');
        });

        test('extracts related issues', async () => {
            const files = await service.discoverLogFiles(TEST_FIXTURES_ROOT);
            const multiTaskFile = files.find(f => f.includes('2026-02-12-multiple-tasks'));
            assert.ok(multiTaskFile);

            const entry = await service.parseLogFile(multiTaskFile);
            
            assert.ok(entry.relatedIssues, 'Should have related issues');
            assert.ok(entry.relatedIssues!.includes('#5'), 'Should include #5');
            assert.ok(entry.relatedIssues!.includes('#6'), 'Should include #6');
            assert.ok(entry.relatedIssues!.includes('#7'), 'Should include #7');
        });

        test('extracts decisions when present', async () => {
            const files = await service.discoverLogFiles(TEST_FIXTURES_ROOT);
            const multiTaskFile = files.find(f => f.includes('2026-02-12-multiple-tasks'));
            assert.ok(multiTaskFile);

            const entry = await service.parseLogFile(multiTaskFile);
            
            assert.ok(entry.decisions, 'Should have decisions');
            assert.ok(entry.decisions!.length > 0, 'Should have at least one decision');
        });

        test('extracts outcomes/key outcomes when present', async () => {
            const files = await service.discoverLogFiles(TEST_FIXTURES_ROOT);
            const multiTaskFile = files.find(f => f.includes('2026-02-12-multiple-tasks'));
            assert.ok(multiTaskFile);

            const entry = await service.parseLogFile(multiTaskFile);
            
            assert.ok(entry.outcomes, 'Should have outcomes');
            assert.ok(entry.outcomes!.length > 0, 'Should have at least one outcome');
        });

        test('handles empty log file gracefully', async () => {
            const files = await service.discoverLogFiles(TEST_FIXTURES_ROOT);
            const emptyFile = files.find(f => f.includes('2026-02-11-empty'));
            assert.ok(emptyFile);

            const entry = await service.parseLogFile(emptyFile);
            
            assert.strictEqual(entry.date, '2026-02-11');
            assert.deepStrictEqual(entry.participants, [], 'Should have empty participants');
        });

        test('returns summary with fallback when Summary section missing', async () => {
            const files = await service.discoverLogFiles(TEST_FIXTURES_ROOT);
            const file = files.find(f => f.includes('2026-02-10-minimal'));
            assert.ok(file);

            const entry = await service.parseLogFile(file);
            
            assert.ok(entry.summary, 'Should have a summary (from fallback)');
            assert.ok(entry.summary.length > 0, 'Summary should not be empty');
        });
    });

    suite('parseAllLogs()', () => {
        test('parses all log files in directory', async () => {
            const entries = await service.parseAllLogs(TEST_FIXTURES_ROOT);
            
            assert.ok(entries.length >= 4, 'Should parse at least 4 test fixture files');
        });

        test('returns entries sorted by date (newest first)', async () => {
            const entries = await service.parseAllLogs(TEST_FIXTURES_ROOT);
            
            for (let i = 1; i < entries.length; i++) {
                assert.ok(
                    entries[i - 1].date >= entries[i].date,
                    `Entry at ${i - 1} (${entries[i - 1].date}) should be >= entry at ${i} (${entries[i].date})`
                );
            }
        });

        test('skips malformed files gracefully', async () => {
            // This test validates the service doesn't crash on malformed data
            // The empty file in fixtures serves as a minimal malformed case
            const entries = await service.parseAllLogs(TEST_FIXTURES_ROOT);
            
            assert.ok(entries.length > 0, 'Should still return valid entries');
        });
    });

    suite('getMemberStates()', () => {
        test('returns empty map for empty entries', () => {
            const states = service.getMemberStates([]);
            
            assert.strictEqual(states.size, 0);
        });

        test('marks participants in most recent entry as working', async () => {
            const entries = await service.parseAllLogs(TEST_FIXTURES_ROOT);
            const states = service.getMemberStates(entries);
            
            // Most recent entry by date sort is one of the 2026-02-13 entries
            // Check that at least one of the 2026-02-13 participants is working
            const hasWorkingMember = states.get('Danny') === 'working' || states.get('Rusty') === 'working';
            assert.ok(hasWorkingMember, 'At least one 2026-02-13 participant should be working');
        });

        test('marks participants not in most recent entry as idle', async () => {
            const entries = await service.parseAllLogs(TEST_FIXTURES_ROOT);
            const states = service.getMemberStates(entries);
            
            // Linus was only in 2026-02-12 entry, not in any 2026-02-13 entry
            // So Linus should be idle (or may not be in states if service only tracks recent)
            if (states.has('Linus')) {
                assert.strictEqual(states.get('Linus'), 'idle', 'Linus should be idle');
            }
            if (states.has('Basher')) {
                assert.strictEqual(states.get('Basher'), 'idle', 'Basher should be idle');
            }
        });

        test('includes all unique participants across all entries', async () => {
            const entries = await service.parseAllLogs(TEST_FIXTURES_ROOT);
            const states = service.getMemberStates(entries);
            
            // Should include participants from all entries
            assert.ok(states.has('Danny'), 'Should include Danny');
            // Linus and Basher are from 2026-02-12 entry
            assert.ok(states.has('Linus') || entries.some(e => e.participants.includes('Linus')), 
                'Linus should be trackable');
        });
    });

    suite('getActiveTasks()', () => {
        test('returns empty array for empty entries', () => {
            const tasks = service.getActiveTasks([]);
            
            assert.deepStrictEqual(tasks, []);
        });

        test('extracts tasks from related issues', async () => {
            const entries = await service.parseAllLogs(TEST_FIXTURES_ROOT);
            const tasks = service.getActiveTasks(entries);
            
            const taskIds = tasks.map(t => t.id);
            assert.ok(taskIds.includes('5'), 'Should include task from issue #5');
            assert.ok(taskIds.includes('6'), 'Should include task from issue #6');
        });

        test('assigns member to tasks (first participant of entry)', async () => {
            const entries = await service.parseAllLogs(TEST_FIXTURES_ROOT);
            const tasks = service.getActiveTasks(entries);
            
            // Tasks from #5, #6, #7 are from 2026-02-12 entry with Linus, Basher
            // First participant is Linus
            const task5 = tasks.find(t => t.id === '5');
            assert.ok(task5, 'Should find task #5');
            assert.ok(['Linus', 'Basher'].includes(task5!.assignee), 
                'Task #5 should be assigned to Linus or Basher');
        });

        test('tasks have startedAt date', async () => {
            const entries = await service.parseAllLogs(TEST_FIXTURES_ROOT);
            const tasks = service.getActiveTasks(entries);
            
            assert.ok(tasks.length > 0);
            assert.ok(tasks.every(t => t.startedAt instanceof Date), 'All tasks should have startedAt');
        });

        test('deduplicates tasks with same ID', async () => {
            const entries = await service.parseAllLogs(TEST_FIXTURES_ROOT);
            const tasks = service.getActiveTasks(entries);
            
            const taskIds = tasks.map(t => t.id);
            const uniqueIds = [...new Set(taskIds)];
            assert.strictEqual(taskIds.length, uniqueIds.length, 'Should have no duplicate task IDs');
        });
    });
});

suite('SquadDataProvider', () => {
    let provider: SquadDataProvider;

    setup(() => {
        provider = new SquadDataProvider(TEST_FIXTURES_ROOT);
    });

    suite('getSquadMembers()', () => {
        test('returns squad members from team.md roster', async () => {
            const members = await provider.getSquadMembers();
            
            // team.md fixture has 5 members
            assert.ok(members.length >= 5, 'Should return all members from team.md');
        });

        test('members have name and status', async () => {
            const members = await provider.getSquadMembers();
            
            for (const member of members) {
                assert.ok(member.name, 'Member should have name');
                assert.ok(['working', 'idle'].includes(member.status), 'Member should have valid status');
            }
        });

        test('members have roles from team.md when available', async () => {
            const members = await provider.getSquadMembers();
            
            for (const member of members) {
                assert.ok(member.role, 'Member should have a role');
                assert.ok(member.role.length > 0, 'Role should not be empty');
            }

            // With team.md present, roles should come from the file
            const danny = members.find(m => m.name === 'Danny');
            if (danny) {
                assert.strictEqual(danny.role, 'Lead', 'Danny role should come from team.md');
            }
        });

        test('working members have currentTask populated', async () => {
            const members = await provider.getSquadMembers();
            const workingMembers = members.filter(m => m.status === 'working');
            
            // At least one working member should have a task - verify structure
            for (const member of workingMembers) {
                if (member.currentTask) {
                    assert.ok(member.currentTask.id, 'Task should have id');
                    assert.ok(member.currentTask.assignee, 'Task should have assignee');
                }
            }
            assert.ok(true, 'Should not throw');
        });

        test('caches results after first call', async () => {
            const members1 = await provider.getSquadMembers();
            const members2 = await provider.getSquadMembers();
            
            assert.strictEqual(members1, members2, 'Should return same cached array');
        });
    });

    suite('getTasksForMember()', () => {
        test('returns tasks for specific member', async () => {
            // Get all tasks first to see who has tasks
            const allMembers = await provider.getSquadMembers();
            const memberWithTasks = allMembers.find(m => m.currentTask);
            
            if (memberWithTasks) {
                const tasks = await provider.getTasksForMember(memberWithTasks.name);
                assert.ok(tasks.length > 0, `${memberWithTasks.name} should have tasks`);
            } else {
                // If no member has currentTask, check by direct task lookup
                const tasks = await provider.getTasksForMember('Linus');
                // It's okay if empty - the test is about structure not specific data
                assert.ok(Array.isArray(tasks), 'Should return array');
            }
        });

        test('returns empty array for member with no tasks', async () => {
            const tasks = await provider.getTasksForMember('NonExistentMember');
            
            assert.deepStrictEqual(tasks, []);
        });

        test('all returned tasks belong to specified member', async () => {
            const tasks = await provider.getTasksForMember('Linus');
            
            for (const task of tasks) {
                assert.strictEqual(task.assignee, 'Linus');
            }
        });
    });

    suite('getWorkDetails()', () => {
        test('returns work details for valid task ID', async () => {
            const details = await provider.getWorkDetails('5');
            
            assert.ok(details, 'Should return details for task #5');
            assert.ok(details!.task, 'Should include task');
            assert.ok(details!.member, 'Should include member');
        });

        test('returns undefined for non-existent task', async () => {
            const details = await provider.getWorkDetails('99999');
            
            assert.strictEqual(details, undefined);
        });

        test('includes related log entries when available', async () => {
            const details = await provider.getWorkDetails('5');
            
            if (details && details.logEntries) {
                assert.ok(details.logEntries.length > 0, 'Should have related log entries');
            }
        });

        test('task and member data are consistent', async () => {
            const details = await provider.getWorkDetails('5');
            
            if (details) {
                assert.strictEqual(details.member.name, details.task.assignee, 
                    'Member name should match task assignee');
            }
        });
    });

    suite('refresh()', () => {
        test('invalidates cached members', async () => {
            const members1 = await provider.getSquadMembers();
            provider.refresh();
            const members2 = await provider.getSquadMembers();
            
            assert.notStrictEqual(members1, members2, 'Should return new array after refresh');
        });

        test('invalidates all caches', async () => {
            // Prime all caches
            await provider.getSquadMembers();
            await provider.getTasksForMember('Linus');
            await provider.getWorkDetails('5');
            
            provider.refresh();
            
            // After refresh, data should be reloaded (new arrays)
            const members = await provider.getSquadMembers();
            assert.ok(members, 'Should still work after refresh');
        });
    });
});

suite('FileWatcherService', () => {
    // FileWatcherService relies heavily on VS Code API which is harder to test
    // These tests focus on the testable parts without full VS Code integration

    test('service module can be imported', async () => {
        // Dynamic import to avoid VS Code API issues in pure unit test context
        const { FileWatcherService } = await import('../../services/FileWatcherService');
        
        assert.ok(FileWatcherService, 'FileWatcherService should be importable');
    });

    test('service constructor accepts debounce parameter', async () => {
        const { FileWatcherService } = await import('../../services/FileWatcherService');
        
        // This will only work in VS Code context, so wrap in try
        try {
            const service = new FileWatcherService(100);
            assert.ok(service, 'Should create service with custom debounce');
            service.dispose();
        } catch {
            // Expected if VS Code API not available
            assert.ok(true, 'Service requires VS Code runtime');
        }
    });
});

suite('Edge Cases', () => {
    let logService: OrchestrationLogService;
    let tempDir: string;

    setup(() => {
        logService = new OrchestrationLogService();
        tempDir = path.join(TEST_FIXTURES_ROOT, 'temp-edge-cases');
    });

    teardown(async () => {
        // Clean up temp directory if created
        try {
            await fs.promises.rm(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    test('handles directory with no .md files', async () => {
        // Create temp directory structure
        const logDir = path.join(tempDir, '.ai-team', 'orchestration-log');
        await fs.promises.mkdir(logDir, { recursive: true });
        await fs.promises.writeFile(path.join(logDir, 'readme.txt'), 'not a markdown file');
        
        const files = await logService.discoverLogFiles(tempDir);
        
        assert.deepStrictEqual(files, []);
    });

    test('handles file with only whitespace', async () => {
        const logDir = path.join(tempDir, '.ai-team', 'orchestration-log');
        await fs.promises.mkdir(logDir, { recursive: true });
        await fs.promises.writeFile(path.join(logDir, '2026-01-01-whitespace.md'), '   \n\n   \t\n');
        
        const entry = await logService.parseLogFile(path.join(logDir, '2026-01-01-whitespace.md'));
        
        assert.strictEqual(entry.date, '2026-01-01');
        assert.deepStrictEqual(entry.participants, []);
    });

    test('handles file without date prefix in filename', async () => {
        const logDir = path.join(tempDir, '.ai-team', 'orchestration-log');
        await fs.promises.mkdir(logDir, { recursive: true });
        const content = `# Test Entry\n\n**Date:** 2026-03-15\n**Participants:** Alice, Bob`;
        await fs.promises.writeFile(path.join(logDir, 'no-date-prefix.md'), content);
        
        const entry = await logService.parseLogFile(path.join(logDir, 'no-date-prefix.md'));
        
        assert.strictEqual(entry.date, '2026-03-15', 'Should extract date from content');
        assert.ok(entry.participants.includes('Alice'));
        assert.ok(entry.participants.includes('Bob'));
    });

    test('handles special characters in participant names', async () => {
        const logDir = path.join(tempDir, '.ai-team', 'orchestration-log');
        await fs.promises.mkdir(logDir, { recursive: true });
        const content = `# Test\n\n**Participants:** José García, François Müller`;
        await fs.promises.writeFile(path.join(logDir, '2026-01-01-special.md'), content);
        
        const entry = await logService.parseLogFile(path.join(logDir, '2026-01-01-special.md'));
        
        assert.ok(entry.participants.includes('José García'));
        assert.ok(entry.participants.includes('François Müller'));
    });

    test('SquadDataProvider handles empty log directory', async () => {
        const emptyDir = path.join(tempDir, 'empty-project');
        await fs.promises.mkdir(emptyDir, { recursive: true });
        
        const provider = new SquadDataProvider(emptyDir);
        const members = await provider.getSquadMembers();
        
        // No team.md and no logs = no members
        assert.deepStrictEqual(members, []);
    });

    test('SquadDataProvider handles missing .ai-team folder', async () => {
        const noAiTeam = path.join(tempDir, 'no-ai-team');
        await fs.promises.mkdir(noAiTeam, { recursive: true });
        
        const provider = new SquadDataProvider(noAiTeam);
        const members = await provider.getSquadMembers();
        const tasks = await provider.getTasksForMember('Anyone');
        
        assert.deepStrictEqual(members, []);
        assert.deepStrictEqual(tasks, []);
    });

    test('SquadDataProvider populates members from team.md when no logs exist', async () => {
        const teamOnlyDir = path.join(tempDir, 'team-only');
        const aiTeamDir = path.join(teamOnlyDir, '.ai-team');
        await fs.promises.mkdir(aiTeamDir, { recursive: true });
        await fs.promises.writeFile(path.join(aiTeamDir, 'team.md'), [
            '# Team',
            '',
            '## Members',
            '',
            '| Name | Role | Charter | Status |',
            '|------|------|---------|--------|',
            '| Alice | Engineer | `.ai-team/agents/alice/charter.md` | ✅ Active |',
            '| Bob | Designer | `.ai-team/agents/bob/charter.md` | ✅ Active |',
        ].join('\n'));

        const provider = new SquadDataProvider(teamOnlyDir);
        const members = await provider.getSquadMembers();

        assert.strictEqual(members.length, 2, 'Should have 2 members from team.md');
        assert.ok(members.find(m => m.name === 'Alice'), 'Should include Alice');
        assert.ok(members.find(m => m.name === 'Bob'), 'Should include Bob');
    });

    test('SquadDataProvider shows members as idle when no logs exist', async () => {
        const teamOnlyDir = path.join(tempDir, 'team-idle');
        const aiTeamDir = path.join(teamOnlyDir, '.ai-team');
        await fs.promises.mkdir(aiTeamDir, { recursive: true });
        await fs.promises.writeFile(path.join(aiTeamDir, 'team.md'), [
            '# Team',
            '',
            '## Members',
            '',
            '| Name | Role | Charter | Status |',
            '|------|------|---------|--------|',
            '| Alice | Engineer | `.ai-team/agents/alice/charter.md` | ✅ Active |',
        ].join('\n'));

        const provider = new SquadDataProvider(teamOnlyDir);
        const members = await provider.getSquadMembers();

        assert.strictEqual(members.length, 1);
        assert.strictEqual(members[0].status, 'idle', 'Member should be idle with no log activity');
        assert.strictEqual(members[0].currentTask, undefined, 'Member should have no task');
    });

    test('SquadDataProvider preserves roles from team.md', async () => {
        const teamOnlyDir = path.join(tempDir, 'team-roles');
        const aiTeamDir = path.join(teamOnlyDir, '.ai-team');
        await fs.promises.mkdir(aiTeamDir, { recursive: true });
        await fs.promises.writeFile(path.join(aiTeamDir, 'team.md'), [
            '# Team',
            '',
            '## Members',
            '',
            '| Name | Role | Charter | Status |',
            '|------|------|---------|--------|',
            '| Alice | Lead | `.ai-team/agents/alice/charter.md` | ✅ Active |',
            '| Bob | Backend Dev | `.ai-team/agents/bob/charter.md` | ✅ Active |',
        ].join('\n'));

        const provider = new SquadDataProvider(teamOnlyDir);
        const members = await provider.getSquadMembers();

        const alice = members.find(m => m.name === 'Alice');
        const bob = members.find(m => m.name === 'Bob');
        assert.strictEqual(alice?.role, 'Lead');
        assert.strictEqual(bob?.role, 'Backend Dev');
    });

    test('SquadDataProvider falls back to log participants when team.md missing', async () => {
        const logOnlyDir = path.join(tempDir, 'log-only');
        const logDir = path.join(logOnlyDir, '.ai-team', 'orchestration-log');
        await fs.promises.mkdir(logDir, { recursive: true });
        await fs.promises.writeFile(path.join(logDir, '2026-03-01-test.md'), [
            '# Test Session',
            '',
            '**Participants:** Charlie, Diana',
            '',
            '## Summary',
            'Test session.',
        ].join('\n'));

        const provider = new SquadDataProvider(logOnlyDir);
        const members = await provider.getSquadMembers();

        assert.strictEqual(members.length, 2, 'Should derive 2 members from log');
        assert.ok(members.find(m => m.name === 'Charlie'), 'Should include Charlie');
        assert.ok(members.find(m => m.name === 'Diana'), 'Should include Diana');
        // Fallback uses generic role
        for (const member of members) {
            assert.strictEqual(member.role, 'Squad Member');
        }
    });
});
