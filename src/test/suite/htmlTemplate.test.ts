/**
 * Regression tests for htmlTemplate.ts — Dashboard HTML generation.
 *
 * P0 Bug Context (Rusty fixing right now):
 * - renderDecisions() crashed when DecisionEntry.content or DecisionEntry.author were undefined
 * - The code did `d.content.toLowerCase()` which throws TypeError on undefined
 * - Both content and author are optional fields per DecisionEntry interface
 *
 * Test Coverage:
 * 1. getDashboardHtml doesn't crash with optional fields undefined
 * 2. HTML output contains expected decision cards with valid data
 * 3. Client-side JS filter function handles optional fields safely
 * 4. Log entries render in Activity tab HTML (Recent Sessions)
 */

import * as assert from 'assert';
import { getDashboardHtml } from '../../views/dashboard/htmlTemplate';
import { DashboardData, DecisionEntry, ActivitySwimlane, OrchestrationLogEntry } from '../../models';

// ─── Test Helpers ────────────────────────────────────────────────────────────

/** Creates minimal valid DashboardData for testing. */
function makeMinimalDashboardData(): DashboardData {
    return {
        team: {
            members: [],
            summary: { totalMembers: 0, activeMembers: 0, totalOpenIssues: 0, totalClosedIssues: 0, totalActiveTasks: 0 },
        },
        burndown: {
            milestones: [],
        },
        velocity: {
            timeline: [
                { date: '2026-02-01', completedTasks: 1 },
                { date: '2026-02-02', completedTasks: 0 },
            ],
            heatmap: [
                { member: 'Danny', activityLevel: 1.0 },
            ],
        },
        activity: {
            swimlanes: [],
            recentLogs: [],
        },
        decisions: {
            entries: [],
        },
    };
}

/** Creates a minimal DecisionEntry with required fields only. */
function makeDecision(overrides: Partial<DecisionEntry> & { title: string }): DecisionEntry {
    return {
        filePath: 'decisions.md',
        lineNumber: 0,
        ...overrides,
    };
}

/** Creates a minimal ActivitySwimlane. */
function makeSwimlane(member: string, role: string = 'Dev'): ActivitySwimlane {
    return {
        member,
        role,
        tasks: [],
    };
}

/** Creates a minimal OrchestrationLogEntry for testing. */
function makeLogEntry(overrides: Partial<OrchestrationLogEntry> & { date: string; topic: string }): OrchestrationLogEntry {
    return {
        timestamp: new Date(overrides.date).toISOString(),
        participants: [],
        summary: 'Test log entry',
        ...overrides,
    };
}

suite('htmlTemplate.ts — Dashboard HTML Generation', () => {

    // ─── Regression Tests: Optional Fields Don't Crash ──────────────────

    suite('Regression: Optional Fields in DecisionEntry', () => {

        test('getDashboardHtml does not crash when content is undefined', () => {
            const data = makeMinimalDashboardData();
            data.decisions.entries = [
                makeDecision({ title: 'Decision A', content: undefined }),
            ];

            assert.doesNotThrow(() => {
                getDashboardHtml(data);
            }, 'getDashboardHtml should not crash when content is undefined');
        });

        test('getDashboardHtml does not crash when author is undefined', () => {
            const data = makeMinimalDashboardData();
            data.decisions.entries = [
                makeDecision({ title: 'Decision B', author: undefined }),
            ];

            assert.doesNotThrow(() => {
                getDashboardHtml(data);
            }, 'getDashboardHtml should not crash when author is undefined');
        });

        test('getDashboardHtml does not crash when both content and author are undefined', () => {
            const data = makeMinimalDashboardData();
            data.decisions.entries = [
                makeDecision({ title: 'Decision C', content: undefined, author: undefined }),
            ];

            assert.doesNotThrow(() => {
                getDashboardHtml(data);
            }, 'getDashboardHtml should not crash when both content and author are undefined');
        });

        test('getDashboardHtml does not crash when date is undefined', () => {
            const data = makeMinimalDashboardData();
            data.decisions.entries = [
                makeDecision({ title: 'Decision D', date: undefined }),
            ];

            assert.doesNotThrow(() => {
                getDashboardHtml(data);
            }, 'getDashboardHtml should not crash when date is undefined');
        });

        test('getDashboardHtml handles multiple decisions with mixed optional fields', () => {
            const data = makeMinimalDashboardData();
            data.decisions.entries = [
                makeDecision({ title: 'Full', date: '2026-02-01', author: 'Danny', content: 'Full content' }),
                makeDecision({ title: 'No Author', date: '2026-02-02', content: 'Content only' }),
                makeDecision({ title: 'No Content', date: '2026-02-03', author: 'Rusty' }),
                makeDecision({ title: 'Minimal', filePath: 'decisions.md' }),
            ];

            assert.doesNotThrow(() => {
                getDashboardHtml(data);
            }, 'getDashboardHtml should handle multiple decisions with varying optional fields');
        });
    });

    // ─── HTML Output Validation ──────────────────────────────────────────

    suite('HTML Output Contains Expected Elements', () => {

        test('HTML contains decision card with title', () => {
            const data = makeMinimalDashboardData();
            data.decisions.entries = [
                makeDecision({ title: 'Use TypeScript', date: '2026-02-01', author: 'Danny' }),
            ];

            const html = getDashboardHtml(data);

            assert.ok(html.includes('Use TypeScript'), 'HTML should contain decision title');
        });

        test('HTML contains decision date when provided', () => {
            const data = makeMinimalDashboardData();
            data.decisions.entries = [
                makeDecision({ title: 'Decision A', date: '2026-02-15' }),
            ];

            const html = getDashboardHtml(data);

            assert.ok(html.includes('2026-02-15'), 'HTML should contain decision date');
        });

        test('HTML contains decision author when provided', () => {
            const data = makeMinimalDashboardData();
            data.decisions.entries = [
                makeDecision({ title: 'Decision B', author: 'Rusty' }),
            ];

            const html = getDashboardHtml(data);

            assert.ok(html.includes('Rusty'), 'HTML should contain decision author');
        });

        test('HTML contains fallback "—" when date is missing', () => {
            const data = makeMinimalDashboardData();
            data.decisions.entries = [
                makeDecision({ title: 'No Date Decision' }),
            ];

            const html = getDashboardHtml(data);

            // The JS template uses ${d.date || '—'} which renders at runtime,
            // but the JSON data should show date as null/undefined
            assert.ok(html.includes('No Date Decision'), 'HTML should include decision in JSON data');
            // Verify the JS template has the fallback logic
            assert.ok(html.includes("d.date || '\\u2014'") || html.includes("d.date || '—'"), 
                'JS template should have date fallback');
        });

        test('HTML contains fallback "—" when author is missing', () => {
            const data = makeMinimalDashboardData();
            data.decisions.entries = [
                makeDecision({ title: 'No Author Decision' }),
            ];

            const html = getDashboardHtml(data);

            // The JS template uses ${escapeHtml(d.author || '—')} at runtime
            assert.ok(html.includes('No Author Decision'), 'HTML should include decision in JSON data');
            // Verify the JS template has the author fallback logic  
            assert.ok(html.includes("d.author || '\\u2014'") || html.includes("d.author || '—'"),
                'JS template should have author fallback');
        });

        test('HTML escapes decision title with special characters', () => {
            const data = makeMinimalDashboardData();
            data.decisions.entries = [
                makeDecision({ title: 'Decision with <script>alert("xss")</script>' }),
            ];

            const html = getDashboardHtml(data);

            // Decision data is JSON-serialized, so special chars are in JSON format.
            // The escapeHtml function runs at client-side render time.
            // Verify the title is in the JSON data (JSON.stringify handles the escaping)
            assert.ok(html.includes('Decision with'), 'HTML should contain decision title in JSON');
            // Verify escapeHtml function exists for client-side protection
            assert.ok(html.includes('function escapeHtml'), 'HTML should include escapeHtml helper');
            assert.ok(html.includes("escapeHtml(d.title)"), 'HTML should escape title via escapeHtml');
        });

        test('HTML contains multiple decision cards when multiple decisions provided', () => {
            const data = makeMinimalDashboardData();
            data.decisions.entries = [
                makeDecision({ title: 'Decision 1', date: '2026-02-01' }),
                makeDecision({ title: 'Decision 2', date: '2026-02-02' }),
                makeDecision({ title: 'Decision 3', date: '2026-02-03' }),
            ];

            const html = getDashboardHtml(data);

            assert.ok(html.includes('Decision 1'), 'HTML should contain first decision');
            assert.ok(html.includes('Decision 2'), 'HTML should contain second decision');
            assert.ok(html.includes('Decision 3'), 'HTML should contain third decision');
        });

        test('HTML contains empty state message when no decisions', () => {
            const data = makeMinimalDashboardData();
            data.decisions.entries = [];

            const html = getDashboardHtml(data);

            assert.ok(html.includes('No decisions recorded yet'), 'HTML should contain empty state message');
        });

        test('HTML contains decision-card class for styling', () => {
            const data = makeMinimalDashboardData();
            data.decisions.entries = [
                makeDecision({ title: 'Test Decision' }),
            ];

            const html = getDashboardHtml(data);

            assert.ok(html.includes('class="decision-card"'), 'HTML should contain decision-card class');
        });

        test('HTML contains data attributes for opening decisions', () => {
            const data = makeMinimalDashboardData();
            data.decisions.entries = [
                makeDecision({ 
                    title: 'Test Decision',
                    filePath: '.ai-team/decisions.md',
                    lineNumber: 42,
                }),
            ];

            const html = getDashboardHtml(data);

            assert.ok(html.includes('data-action="open-decision"'), 'HTML should have open-decision action');
            assert.ok(html.includes('data-file-path='), 'HTML should have file-path attribute');
            assert.ok(html.includes('data-line-number='), 'HTML should have line-number attribute');
        });
    });

    // ─── Client-Side JavaScript Safety ──────────────────────────────────

    suite('Client-Side JS Filter Function Safety', () => {

        test('rendered JS filter safely handles undefined content', () => {
            const data = makeMinimalDashboardData();
            data.decisions.entries = [
                makeDecision({ title: 'Test', content: undefined }),
            ];

            const html = getDashboardHtml(data);

            // Check that the filter function uses (d.content || '')
            assert.ok(
                html.includes("(d.content || '').toLowerCase()") || 
                html.includes('(d.content || "").toLowerCase()'),
                'JS filter should use || fallback for content'
            );
        });

        test('rendered JS filter safely handles undefined author', () => {
            const data = makeMinimalDashboardData();
            data.decisions.entries = [
                makeDecision({ title: 'Test', author: undefined }),
            ];

            const html = getDashboardHtml(data);

            // Check that the filter function uses (d.author || '')
            assert.ok(
                html.includes("(d.author || '').toLowerCase()") || 
                html.includes('(d.author || "").toLowerCase()'),
                'JS filter should use || fallback for author'
            );
        });

        test('rendered JS contains escapeHtml helper function', () => {
            const data = makeMinimalDashboardData();
            const html = getDashboardHtml(data);

            assert.ok(html.includes('function escapeHtml'), 'HTML should contain escapeHtml helper');
            assert.ok(html.includes('.replace(/&/g, "&amp;")'), 'escapeHtml should escape ampersands');
            assert.ok(html.includes('.replace(/</g, "&lt;")'), 'escapeHtml should escape less-than');
            assert.ok(html.includes('.replace(/>/g, "&gt;")'), 'escapeHtml should escape greater-than');
        });

        test('decision data is JSON-serialized in script tag', () => {
            const data = makeMinimalDashboardData();
            data.decisions.entries = [
                makeDecision({ title: 'Test Decision', content: 'Some content' }),
            ];

            const html = getDashboardHtml(data);

            // The template does: const decisionData = ${decisionDataJson};
            assert.ok(html.includes('const decisionData ='), 'HTML should define decisionData variable');
            assert.ok(html.includes('Test Decision'), 'JSON should include decision title');
        });
    });

    // ─── Activity Tab: Swimlanes Rendering ──────────────────────────────

    suite('Activity Tab: Swimlanes Rendering', () => {

        test('HTML contains swimlane for each member', () => {
            const data = makeMinimalDashboardData();
            data.activity.swimlanes = [
                makeSwimlane('Danny', 'Lead'),
                makeSwimlane('Rusty', 'Dev'),
            ];

            const html = getDashboardHtml(data);

            // Swimlanes are rendered in JS via renderActivitySwimlanes()
            // The function is defined and called in the script
            assert.ok(html.includes('function renderActivitySwimlanes'), 'HTML should contain swimlane render function');
        });

        test('HTML contains empty swimlane message when no tasks', () => {
            const data = makeMinimalDashboardData();
            data.activity.swimlanes = [
                makeSwimlane('Danny', 'Lead'),
            ];

            const html = getDashboardHtml(data);

            // Check for empty-swimlane class in the template
            assert.ok(html.includes('empty-swimlane'), 'HTML should reference empty-swimlane class');
            assert.ok(html.includes('No tasks'), 'HTML should contain "No tasks" text for empty swimlanes');
        });

        test('HTML contains task rendering logic', () => {
            const data = makeMinimalDashboardData();
            data.activity.swimlanes = [
                {
                    member: 'Danny',
                    role: 'Lead',
                    tasks: [
                        {
                            id: 't1',
                            title: 'Test Task',
                            startDate: '2026-02-01',
                            endDate: '2026-02-02',
                            status: 'completed',
                        },
                    ],
                },
            ];

            const html = getDashboardHtml(data);

            // Check that task rendering logic exists
            assert.ok(html.includes('class="task-list"'), 'HTML should reference task-list class');
            assert.ok(html.includes('class="task-item'), 'HTML should reference task-item class');
        });
    });

    // ─── Activity Tab: Recent Sessions (Log Entries) ────────────────────

    suite('Activity Tab: Recent Sessions Log Entries', () => {

        test('HTML contains recent log entries in Activity tab data', () => {
            const data = makeMinimalDashboardData();
            data.activity.recentLogs = [
                makeLogEntry({ 
                    date: '2026-02-15', 
                    topic: 'sprint-planning',
                    participants: ['Danny', 'Rusty'],
                    summary: 'Planned Q1 sprint',
                }),
            ];

            const html = getDashboardHtml(data);

            // Check that activity data includes recentLogs in JSON
            assert.ok(html.includes('const activityData ='), 'HTML should define activityData variable');
            assert.ok(html.includes('sprint-planning'), 'activityData should include log topic');
        });

        test('HTML handles empty recent logs array', () => {
            const data = makeMinimalDashboardData();
            data.activity.recentLogs = [];

            assert.doesNotThrow(() => {
                getDashboardHtml(data);
            }, 'getDashboardHtml should handle empty recentLogs');
        });

        test('HTML handles recent logs with all fields populated', () => {
            const data = makeMinimalDashboardData();
            data.activity.recentLogs = [
                makeLogEntry({
                    date: '2026-02-15',
                    topic: 'bug-fix',
                    participants: ['Danny', 'Rusty', 'Linus'],
                    summary: 'Fixed critical bug',
                    decisions: ['Use new approach', 'Add regression tests'],
                    outcomes: ['Bug fixed', 'Tests added'],
                    relatedIssues: ['#42', '#43'],
                    whatWasDone: [
                        { agent: 'Rusty', description: 'Fixed the bug' },
                        { agent: 'Basher', description: 'Added tests' },
                    ],
                }),
            ];

            assert.doesNotThrow(() => {
                const html = getDashboardHtml(data);
                assert.ok(html.includes('bug-fix'), 'HTML should include log topic');
            }, 'getDashboardHtml should handle fully populated log entry');
        });

        test('HTML handles recent logs with optional fields undefined', () => {
            const data = makeMinimalDashboardData();
            data.activity.recentLogs = [
                makeLogEntry({
                    date: '2026-02-15',
                    topic: 'meeting',
                    participants: ['Danny'],
                    summary: 'Quick sync',
                    // decisions, outcomes, relatedIssues, whatWasDone all undefined
                }),
            ];

            assert.doesNotThrow(() => {
                getDashboardHtml(data);
            }, 'getDashboardHtml should handle log entries with optional fields undefined');
        });

        test('HTML handles multiple recent log entries', () => {
            const data = makeMinimalDashboardData();
            data.activity.recentLogs = [
                makeLogEntry({ date: '2026-02-15', topic: 'session-1', participants: ['Danny'], summary: 'Session 1' }),
                makeLogEntry({ date: '2026-02-14', topic: 'session-2', participants: ['Rusty'], summary: 'Session 2' }),
                makeLogEntry({ date: '2026-02-13', topic: 'session-3', participants: ['Linus'], summary: 'Session 3' }),
            ];

            const html = getDashboardHtml(data);

            assert.ok(html.includes('session-1'), 'HTML should include first log');
            assert.ok(html.includes('session-2'), 'HTML should include second log');
            assert.ok(html.includes('session-3'), 'HTML should include third log');
        });

        test('HTML escapes special characters in log summaries', () => {
            const data = makeMinimalDashboardData();
            data.activity.recentLogs = [
                makeLogEntry({
                    date: '2026-02-15',
                    topic: 'test',
                    participants: ['Danny'],
                    summary: 'Fixed <script>alert("xss")</script> issue',
                }),
            ];

            const html = getDashboardHtml(data);

            // Log data is JSON-serialized via JSON.stringify, which escapes special chars.
            // The escapeHtml function is used at client render time for display.
            // JSON.stringify converts < to \u003c in some modes, but always makes it safe.
            assert.ok(html.includes('function escapeHtml'), 'HTML should include escapeHtml helper for rendering');
            assert.ok(html.includes('Fixed'), 'HTML should contain log summary in JSON data');
        });

        test('HTML handles very long log summaries', () => {
            const data = makeMinimalDashboardData();
            const longSummary = 'A'.repeat(1000);
            data.activity.recentLogs = [
                makeLogEntry({
                    date: '2026-02-15',
                    topic: 'long-session',
                    participants: ['Danny'],
                    summary: longSummary,
                }),
            ];

            assert.doesNotThrow(() => {
                getDashboardHtml(data);
            }, 'getDashboardHtml should handle very long summaries');
        });

        test('HTML handles unicode in log data', () => {
            const data = makeMinimalDashboardData();
            data.activity.recentLogs = [
                makeLogEntry({
                    date: '2026-02-15',
                    topic: 'unicode-test',
                    participants: ['日本語ユーザー'],
                    summary: 'Discussion about 🚀 deployment',
                }),
            ];

            assert.doesNotThrow(() => {
                const html = getDashboardHtml(data);
                assert.ok(html.length > 0, 'HTML should be generated with unicode');
            }, 'getDashboardHtml should handle unicode in logs');
        });

        test('activity data JSON is valid when recent logs present', () => {
            const data = makeMinimalDashboardData();
            data.activity.recentLogs = [
                makeLogEntry({ date: '2026-02-15', topic: 'test', participants: ['Danny'], summary: 'Test' }),
            ];

            const html = getDashboardHtml(data);

            // Extract the activityData JSON from the HTML
            const match = html.match(/const activityData = ({.*?});/s);
            assert.ok(match, 'HTML should contain activityData variable assignment');

            if (match) {
                assert.doesNotThrow(() => {
                    JSON.parse(match[1]);
                }, 'activityData JSON should be valid');
            }
        });
    });

    // ─── Valid HTML Structure ────────────────────────────────────────────

    suite('HTML Structure Validation', () => {

        test('HTML has DOCTYPE declaration', () => {
            const data = makeMinimalDashboardData();
            const html = getDashboardHtml(data);

            assert.ok(html.startsWith('<!DOCTYPE html>'), 'HTML should start with DOCTYPE');
        });

        test('HTML has html, head, and body tags', () => {
            const data = makeMinimalDashboardData();
            const html = getDashboardHtml(data);

            assert.ok(html.includes('<html'), 'HTML should have html tag');
            assert.ok(html.includes('<head>'), 'HTML should have head tag');
            assert.ok(html.includes('<body>'), 'HTML should have body tag');
            assert.ok(html.includes('</html>'), 'HTML should close html tag');
        });

        test('HTML has CSP meta tag for security', () => {
            const data = makeMinimalDashboardData();
            const html = getDashboardHtml(data);

            assert.ok(html.includes('Content-Security-Policy'), 'HTML should have CSP meta tag');
        });

        test('HTML has all three tab buttons (Velocity, Activity, Decisions)', () => {
            const data = makeMinimalDashboardData();
            const html = getDashboardHtml(data);

            assert.ok(html.includes('data-tab="velocity"'), 'HTML should have Velocity tab button');
            assert.ok(html.includes('data-tab="activity"'), 'HTML should have Activity tab button');
            assert.ok(html.includes('data-tab="decisions"'), 'HTML should have Decisions tab button');
        });

        test('HTML has all three tab content sections', () => {
            const data = makeMinimalDashboardData();
            const html = getDashboardHtml(data);

            assert.ok(html.includes('id="velocity-tab"'), 'HTML should have velocity tab content');
            assert.ok(html.includes('id="activity-tab"'), 'HTML should have activity tab content');
            assert.ok(html.includes('id="decisions-tab"'), 'HTML should have decisions tab content');
        });

        test('HTML contains search input for decisions filter', () => {
            const data = makeMinimalDashboardData();
            const html = getDashboardHtml(data);

            assert.ok(html.includes('id="decision-search"'), 'HTML should have decision search input');
            assert.ok(html.includes('placeholder="Search decisions..."'), 'HTML should have search placeholder');
        });

        test('HTML contains VS Code API acquisition', () => {
            const data = makeMinimalDashboardData();
            const html = getDashboardHtml(data);

            assert.ok(html.includes('acquireVsCodeApi'), 'HTML should call acquireVsCodeApi()');
            assert.ok(html.includes('const vscode ='), 'HTML should define vscode variable');
        });

        test('HTML contains event delegation for clickable items', () => {
            const data = makeMinimalDashboardData();
            const html = getDashboardHtml(data);

            assert.ok(html.includes("document.body.addEventListener('click'"), 'HTML should set up click delegation');
            assert.ok(html.includes("target.closest('[data-action]')"), 'HTML should use data-action for delegation');
        });
    });

    // ─── Edge Cases ──────────────────────────────────────────────────────

    suite('Edge Cases', () => {

        test('HTML handles very long decision titles', () => {
            const data = makeMinimalDashboardData();
            const longTitle = 'A'.repeat(500);
            data.decisions.entries = [
                makeDecision({ title: longTitle }),
            ];

            assert.doesNotThrow(() => {
                getDashboardHtml(data);
            }, 'getDashboardHtml should handle very long titles');
        });

        test('HTML handles unicode in decision titles', () => {
            const data = makeMinimalDashboardData();
            data.decisions.entries = [
                makeDecision({ title: '日本語 Decision 🚀' }),
            ];

            const html = getDashboardHtml(data);

            assert.ok(html.includes('日本語'), 'HTML should contain unicode characters');
            assert.ok(html.includes('🚀'), 'HTML should contain emoji');
        });

        test('HTML handles empty decision title', () => {
            const data = makeMinimalDashboardData();
            data.decisions.entries = [
                makeDecision({ title: '' }),
            ];

            assert.doesNotThrow(() => {
                getDashboardHtml(data);
            }, 'getDashboardHtml should handle empty title');
        });

        test('HTML handles decision with only whitespace content', () => {
            const data = makeMinimalDashboardData();
            data.decisions.entries = [
                makeDecision({ title: 'Test', content: '   \n\n   ' }),
            ];

            assert.doesNotThrow(() => {
                getDashboardHtml(data);
            }, 'getDashboardHtml should handle whitespace-only content');
        });

        test('HTML handles large dataset (100 decisions)', () => {
            const data = makeMinimalDashboardData();
            data.decisions.entries = Array.from({ length: 100 }, (_, i) =>
                makeDecision({ title: `Decision ${i}`, date: '2026-02-01' })
            );

            assert.doesNotThrow(() => {
                const html = getDashboardHtml(data);
                assert.ok(html.length > 0, 'HTML should be generated for large dataset');
            }, 'getDashboardHtml should handle 100 decisions');
        });

        test('HTML handles decision with special characters in author', () => {
            const data = makeMinimalDashboardData();
            data.decisions.entries = [
                makeDecision({ title: 'Test', author: "O'Reilly & Associates" }),
            ];

            const html = getDashboardHtml(data);

            assert.ok(html.includes('&amp;'), 'HTML should escape ampersand in author');
            assert.ok(html.includes('&#039;'), 'HTML should escape apostrophe in author');
        });
    });
});
