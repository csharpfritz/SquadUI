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
});
