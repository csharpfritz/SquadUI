/**
 * Tests for StandupReportService
 */

import * as assert from 'assert';
import { StandupReportService, StandupReport } from '../../services/StandupReportService';
import { GitHubIssue, DecisionEntry, OrchestrationLogEntry } from '../../models';

suite('StandupReportService', () => {
    let service: StandupReportService;

    setup(() => {
        service = new StandupReportService();
    });

    const createIssue = (overrides: Partial<GitHubIssue> = {}): GitHubIssue => ({
        number: 1,
        title: 'Test Issue',
        state: 'open',
        labels: [],
        htmlUrl: 'https://github.com/test/test/issues/1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
    });

    const createDecision = (overrides: Partial<DecisionEntry> = {}): DecisionEntry => ({
        title: 'Test Decision',
        filePath: '/path/to/decisions.md',
        ...overrides,
    });

    const createLogEntry = (overrides: Partial<OrchestrationLogEntry> = {}): OrchestrationLogEntry => ({
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        topic: 'test',
        participants: ['Alice'],
        summary: 'Test summary',
        ...overrides,
    });

    suite('generateReport()', () => {
        test('returns empty report with no data', () => {
            const report = service.generateReport([], [], [], [], 'day');
            
            assert.strictEqual(report.period, 'day');
            assert.strictEqual(report.summary.closedCount, 0);
            assert.strictEqual(report.summary.newCount, 0);
            assert.strictEqual(report.summary.blockingCount, 0);
            assert.strictEqual(report.closedIssues.length, 0);
            assert.strictEqual(report.newIssues.length, 0);
            assert.strictEqual(report.blockingIssues.length, 0);
        });

        test('counts closed issues in period', () => {
            const closedIssues = [
                createIssue({ number: 1, closedAt: new Date().toISOString() }),
                createIssue({ number: 2, closedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() }),
                createIssue({ number: 3, closedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() }),
            ];
            
            const report = service.generateReport([], closedIssues, [], [], 'day');
            assert.strictEqual(report.summary.closedCount, 1, 'Only issue closed today');
            
            const weekReport = service.generateReport([], closedIssues, [], [], 'week');
            assert.strictEqual(weekReport.summary.closedCount, 2, 'Issues closed in last week');
        });

        test('counts new issues in period', () => {
            const now = new Date();
            const openIssues = [
                createIssue({ number: 1, createdAt: now.toISOString() }),
                createIssue({ number: 2, createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() }),
                createIssue({ number: 3, createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() }),
            ];
            
            const report = service.generateReport(openIssues, [], [], [], 'day');
            assert.strictEqual(report.summary.newCount, 1, 'Only issue created today');
            
            const weekReport = service.generateReport(openIssues, [], [], [], 'week');
            assert.strictEqual(weekReport.summary.newCount, 2, 'Issues created in last week');
        });

        test('identifies blocking issues', () => {
            const openIssues = [
                createIssue({ number: 1, labels: [{ name: 'blocked' }] }),
                createIssue({ number: 2, labels: [{ name: 'blocker' }] }),
                createIssue({ number: 3, labels: [{ name: 'enhancement' }] }),
                createIssue({ number: 4, labels: [{ name: 'BLOCKING' }] }),
            ];
            
            const report = service.generateReport(openIssues, [], [], [], 'day');
            assert.strictEqual(report.summary.blockingCount, 3);
            assert.strictEqual(report.blockingIssues.length, 3);
        });

        test('filters decisions by period', () => {
            const today = new Date().toISOString().split('T')[0];
            const lastWeek = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            
            const decisions = [
                createDecision({ title: 'Today Decision', date: today }),
                createDecision({ title: 'Last Week Decision', date: lastWeek }),
                createDecision({ title: 'Old Decision', date: oldDate }),
            ];
            
            const dayReport = service.generateReport([], [], decisions, [], 'day');
            assert.strictEqual(dayReport.recentDecisions.length, 1);
            
            const weekReport = service.generateReport([], [], decisions, [], 'week');
            assert.strictEqual(weekReport.recentDecisions.length, 2);
        });

        test('suggests next steps sorted by priority', () => {
            const openIssues = [
                createIssue({ number: 1, title: 'Low', labels: [{ name: 'p3' }] }),
                createIssue({ number: 2, title: 'High', labels: [{ name: 'p1' }] }),
                createIssue({ number: 3, title: 'Critical', labels: [{ name: 'p0' }] }),
                createIssue({ number: 4, title: 'Medium', labels: [{ name: 'p2' }] }),
            ];
            
            const report = service.generateReport(openIssues, [], [], [], 'day');
            
            assert.strictEqual(report.suggestedNextSteps[0].title, 'Critical');
            assert.strictEqual(report.suggestedNextSteps[1].title, 'High');
            assert.strictEqual(report.suggestedNextSteps[2].title, 'Medium');
            assert.strictEqual(report.suggestedNextSteps[3].title, 'Low');
        });

        test('excludes blockers from next steps', () => {
            const openIssues = [
                createIssue({ number: 1, title: 'Normal', labels: [] }),
                createIssue({ number: 2, title: 'Blocked', labels: [{ name: 'blocked' }] }),
            ];
            
            const report = service.generateReport(openIssues, [], [], [], 'day');
            
            assert.strictEqual(report.suggestedNextSteps.length, 1);
            assert.strictEqual(report.suggestedNextSteps[0].title, 'Normal');
        });

        test('limits next steps to 5 items', () => {
            const openIssues = Array.from({ length: 10 }, (_, i) => 
                createIssue({ number: i + 1, title: `Issue ${i + 1}` })
            );
            
            const report = service.generateReport(openIssues, [], [], [], 'day');
            assert.strictEqual(report.suggestedNextSteps.length, 5);
        });

        test('filters log entries by period', () => {
            const today = new Date().toISOString().split('T')[0];
            const lastWeek = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            
            const logs = [
                createLogEntry({ date: today, topic: 'today' }),
                createLogEntry({ date: lastWeek, topic: 'last-week' }),
                createLogEntry({ date: oldDate, topic: 'old' }),
            ];
            
            const dayReport = service.generateReport([], [], [], logs, 'day');
            assert.strictEqual(dayReport.recentLogs.length, 1);
            
            const weekReport = service.generateReport([], [], [], logs, 'week');
            assert.strictEqual(weekReport.recentLogs.length, 2);
        });
    });

    suite('formatAsMarkdown()', () => {
        test('generates valid markdown', () => {
            const report: StandupReport = {
                period: 'day',
                summary: {
                    closedCount: 5,
                    newCount: 3,
                    blockingCount: 1,
                    periodStart: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    periodEnd: new Date(),
                },
                closedIssues: [createIssue({ number: 1, title: 'Fixed bug' })],
                newIssues: [createIssue({ number: 2, title: 'New feature' })],
                blockingIssues: [createIssue({ number: 3, title: 'Blocked', labels: [{ name: 'blocked' }] })],
                recentDecisions: [createDecision({ title: 'Use TypeScript', author: 'Alice' })],
                suggestedNextSteps: [createIssue({ number: 4, title: 'Next task', assignee: 'Bob' })],
                recentLogs: [],
            };
            
            const markdown = service.formatAsMarkdown(report);
            
            assert.ok(markdown.includes('# Daily Standup Report'));
            assert.ok(markdown.includes('✅ Issues Closed'));
            assert.ok(markdown.includes('Fixed bug'));
            assert.ok(markdown.includes('New feature'));
            assert.ok(markdown.includes('Blocked'));
            assert.ok(markdown.includes('Use TypeScript'));
            assert.ok(markdown.includes('Next task'));
            assert.ok(markdown.includes('@Bob'));
        });

        test('handles weekly report', () => {
            const report: StandupReport = {
                period: 'week',
                summary: {
                    closedCount: 0,
                    newCount: 0,
                    blockingCount: 0,
                    periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    periodEnd: new Date(),
                },
                closedIssues: [],
                newIssues: [],
                blockingIssues: [],
                recentDecisions: [],
                suggestedNextSteps: [],
                recentLogs: [],
            };
            
            const markdown = service.formatAsMarkdown(report);
            assert.ok(markdown.includes('# Weekly Standup Report'));
        });
    });

    // ─── Edge Cases: Empty & Missing Data ──────────────────────────────────

    suite('Edge Cases — empty & missing data', () => {
        test('closed issues without closedAt are excluded', () => {
            const closedIssues = [
                createIssue({ number: 1, closedAt: undefined }),
                createIssue({ number: 2, closedAt: new Date().toISOString() }),
            ];
            const report = service.generateReport([], closedIssues, [], [], 'week');
            assert.strictEqual(report.closedIssues.length, 1);
            assert.strictEqual(report.closedIssues[0].number, 2);
        });

        test('decisions without date are excluded', () => {
            const decisions = [
                createDecision({ title: 'No date', date: undefined }),
                createDecision({ title: 'Has date', date: new Date().toISOString().split('T')[0] }),
            ];
            const report = service.generateReport([], [], decisions, [], 'week');
            assert.strictEqual(report.recentDecisions.length, 1);
            assert.strictEqual(report.recentDecisions[0].title, 'Has date');
        });

        test('log entries with unparseable date are excluded', () => {
            const logs = [
                createLogEntry({ date: 'not-a-date', topic: 'bad' }),
                createLogEntry({ date: new Date().toISOString().split('T')[0], topic: 'good' }),
            ];
            const report = service.generateReport([], [], [], logs, 'week');
            assert.strictEqual(report.recentLogs.length, 1);
            assert.strictEqual(report.recentLogs[0].topic, 'good');
        });

        test('all arrays empty produces a complete report shape', () => {
            const report = service.generateReport([], [], [], [], 'day');
            assert.ok(report.summary);
            assert.ok(report.summary.periodStart instanceof Date);
            assert.ok(report.summary.periodEnd instanceof Date);
            assert.strictEqual(report.closedIssues.length, 0);
            assert.strictEqual(report.newIssues.length, 0);
            assert.strictEqual(report.blockingIssues.length, 0);
            assert.strictEqual(report.recentDecisions.length, 0);
            assert.strictEqual(report.suggestedNextSteps.length, 0);
            assert.strictEqual(report.recentLogs.length, 0);
        });

        test('open issues with no labels do not crash blocking check', () => {
            const openIssues = [createIssue({ number: 1, labels: [] })];
            const report = service.generateReport(openIssues, [], [], [], 'day');
            assert.strictEqual(report.blockingIssues.length, 0);
            assert.strictEqual(report.suggestedNextSteps.length, 1);
        });
    });

    // ─── Edge Cases: Date Boundaries ───────────────────────────────────────

    suite('Edge Cases — date boundaries', () => {
        test('issue closed just within 24h ago is included in day report', () => {
            // Use 23h59m to avoid ms-level timing race between test and service
            const justWithin24h = new Date(Date.now() - 23 * 60 * 60 * 1000 - 59 * 60 * 1000).toISOString();
            const closedIssues = [createIssue({ number: 1, closedAt: justWithin24h })];
            const report = service.generateReport([], closedIssues, [], [], 'day');
            assert.strictEqual(report.closedIssues.length, 1);
        });

        test('issue closed just past 24h ago is excluded from day report', () => {
            const justPast24h = new Date(Date.now() - 24 * 60 * 60 * 1000 - 1000).toISOString();
            const closedIssues = [createIssue({ number: 1, closedAt: justPast24h })];
            const report = service.generateReport([], closedIssues, [], [], 'day');
            assert.strictEqual(report.closedIssues.length, 0);
        });

        test('issue closed just within 7 days ago is included in week report', () => {
            // Use 6d23h59m to avoid ms-level timing race between test and service
            const justWithin7d = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000 - 23 * 60 * 60 * 1000 - 59 * 60 * 1000).toISOString();
            const closedIssues = [createIssue({ number: 1, closedAt: justWithin7d })];
            const report = service.generateReport([], closedIssues, [], [], 'week');
            assert.strictEqual(report.closedIssues.length, 1);
        });

        test('default period is day', () => {
            const report = service.generateReport([], [], [], []);
            assert.strictEqual(report.period, 'day');
        });
    });

    // ─── Edge Cases: parseDate() ───────────────────────────────────────────

    suite('Edge Cases — parseDate()', () => {
        test('parses YYYY-MM-DD format', () => {
            const parseDate = (service as any).parseDate.bind(service);
            const d = parseDate('2026-01-15');
            assert.ok(d instanceof Date);
            assert.strictEqual(d!.getFullYear(), 2026);
            assert.strictEqual(d!.getMonth(), 0); // January
            assert.strictEqual(d!.getDate(), 15);
        });

        test('parses ISO 8601 strings', () => {
            const parseDate = (service as any).parseDate.bind(service);
            const d = parseDate('2026-02-18T10:30:00Z');
            assert.ok(d instanceof Date);
            assert.strictEqual(d!.getFullYear(), 2026);
        });

        test('returns null for garbage strings', () => {
            const parseDate = (service as any).parseDate.bind(service);
            const d = parseDate('hello-world');
            assert.strictEqual(d, null);
        });

        test('returns null for empty string', () => {
            const parseDate = (service as any).parseDate.bind(service);
            const d = parseDate('');
            assert.strictEqual(d, null);
        });

        test('handles YYYY-MM-DD embedded in longer text', () => {
            const parseDate = (service as any).parseDate.bind(service);
            const d = parseDate('Date: 2026-03-10 was the deadline');
            assert.ok(d instanceof Date);
            assert.strictEqual(d!.getFullYear(), 2026);
            assert.strictEqual(d!.getMonth(), 2); // March
        });
    });

    // ─── Edge Cases: Priority Sorting ──────────────────────────────────────

    suite('Edge Cases — priority sorting', () => {
        test('issues with no priority label sort after prioritized issues', () => {
            const openIssues = [
                createIssue({ number: 1, title: 'No label', labels: [] }),
                createIssue({ number: 2, title: 'P2', labels: [{ name: 'p2' }] }),
            ];
            const report = service.generateReport(openIssues, [], [], [], 'day');
            assert.strictEqual(report.suggestedNextSteps[0].title, 'P2');
            assert.strictEqual(report.suggestedNextSteps[1].title, 'No label');
        });

        test('all PRIORITY_ORDER labels are recognized', () => {
            const labelNames = ['p0', 'priority:critical', 'urgent', 'p1', 'priority:high', 'high',
                               'p2', 'priority:medium', 'medium', 'p3', 'priority:low', 'low'];
            // Each issue gets one priority label — all should get a priority < 99
            const openIssues = labelNames.map((name, i) =>
                createIssue({ number: i + 1, title: name, labels: [{ name }] })
            );
            const report = service.generateReport(openIssues, [], [], [], 'day');
            // suggestedNextSteps is capped at 5; first 5 should be p0/critical/urgent tier
            const topTitles = report.suggestedNextSteps.map(i => i.title);
            for (const t of topTitles) {
                assert.ok(['p0', 'priority:critical', 'urgent'].includes(t) || 
                           ['p1', 'priority:high', 'high'].includes(t),
                           `Expected high-priority issue, got: ${t}`);
            }
        });

        test('issues with multiple labels use first matching priority', () => {
            const openIssues = [
                createIssue({ number: 1, title: 'MultiLabel', labels: [{ name: 'enhancement' }, { name: 'p1' }, { name: 'p3' }] }),
            ];
            const report = service.generateReport(openIssues, [], [], [], 'day');
            // Should be included and treated as p1 (first matching)
            assert.strictEqual(report.suggestedNextSteps.length, 1);
        });
    });

    // ─── Edge Cases: Blocking Labels ───────────────────────────────────────

    suite('Edge Cases — blocking labels', () => {
        test('all four blocking labels are recognized', () => {
            const openIssues = BLOCKING_LABEL_VARIANTS.map((name, i) =>
                createIssue({ number: i + 1, labels: [{ name }] })
            );
            const report = service.generateReport(openIssues, [], [], [], 'day');
            assert.strictEqual(report.blockingIssues.length, 4);
        });

        test('impediment label is case-insensitive', () => {
            const openIssues = [createIssue({ number: 1, labels: [{ name: 'IMPEDIMENT' }] })];
            const report = service.generateReport(openIssues, [], [], [], 'day');
            assert.strictEqual(report.blockingIssues.length, 1);
        });
    });

    // ─── Edge Cases: Large Datasets ────────────────────────────────────────

    suite('Edge Cases — large datasets', () => {
        test('handles 500 open issues without errors', () => {
            const openIssues = Array.from({ length: 500 }, (_, i) =>
                createIssue({ number: i + 1, title: `Issue ${i + 1}`, createdAt: new Date().toISOString() })
            );
            const report = service.generateReport(openIssues, [], [], [], 'day');
            assert.strictEqual(report.summary.newCount, 500);
            assert.strictEqual(report.suggestedNextSteps.length, 5);
        });

        test('handles 500 closed issues without errors', () => {
            const closedIssues = Array.from({ length: 500 }, (_, i) =>
                createIssue({ number: i + 1, closedAt: new Date().toISOString() })
            );
            const report = service.generateReport([], closedIssues, [], [], 'day');
            assert.strictEqual(report.summary.closedCount, 500);
        });
    });

    // ─── formatAsMarkdown() — additional coverage ──────────────────────────

    suite('formatAsMarkdown() — edge cases', () => {
        test('empty report omits blockers and decisions sections', () => {
            const report: StandupReport = {
                period: 'day',
                summary: { closedCount: 0, newCount: 0, blockingCount: 0,
                    periodStart: new Date(), periodEnd: new Date() },
                closedIssues: [],
                newIssues: [],
                blockingIssues: [],
                recentDecisions: [],
                suggestedNextSteps: [],
                recentLogs: [],
            };
            const md = service.formatAsMarkdown(report);
            assert.ok(!md.includes('## 🚫 Blockers'), 'Blockers section should be absent');
            assert.ok(!md.includes('## 📌 Recent Decisions'), 'Decisions section should be absent');
        });

        test('issue without assignee has no @ mention', () => {
            const report: StandupReport = {
                period: 'day',
                summary: { closedCount: 0, newCount: 0, blockingCount: 0,
                    periodStart: new Date(), periodEnd: new Date() },
                closedIssues: [],
                newIssues: [],
                blockingIssues: [],
                recentDecisions: [],
                suggestedNextSteps: [createIssue({ number: 1, title: 'No assignee', assignee: undefined })],
                recentLogs: [],
            };
            const md = service.formatAsMarkdown(report);
            assert.ok(md.includes('No assignee'));
            assert.ok(!md.includes('@undefined'));
        });

        test('decision without author has no parenthetical', () => {
            const report: StandupReport = {
                period: 'day',
                summary: { closedCount: 0, newCount: 0, blockingCount: 0,
                    periodStart: new Date(), periodEnd: new Date() },
                closedIssues: [],
                newIssues: [],
                blockingIssues: [],
                recentDecisions: [createDecision({ title: 'Anonymous Decision', author: undefined })],
                suggestedNextSteps: [],
                recentLogs: [],
            };
            const md = service.formatAsMarkdown(report);
            assert.ok(md.includes('Anonymous Decision'));
            assert.ok(!md.includes('(undefined)'));
        });

        test('blocker labels are listed in markdown', () => {
            const report: StandupReport = {
                period: 'day',
                summary: { closedCount: 0, newCount: 0, blockingCount: 1,
                    periodStart: new Date(), periodEnd: new Date() },
                closedIssues: [],
                newIssues: [],
                blockingIssues: [createIssue({ number: 99, title: 'Stuck', labels: [{ name: 'blocked' }, { name: 'p0' }] })],
                recentDecisions: [],
                suggestedNextSteps: [],
                recentLogs: [],
            };
            const md = service.formatAsMarkdown(report);
            assert.ok(md.includes('blocked, p0'));
        });
    });
});

const BLOCKING_LABEL_VARIANTS = ['blocked', 'blocker', 'blocking', 'impediment'];
