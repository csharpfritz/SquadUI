/**
 * Tests for WorkDetailsWebview.
 * Verifies HTML generation and content rendering.
 */

import * as assert from 'assert';
import { WorkDetails, Task, SquadMember } from '../../models';

/**
 * Test helper: Extract the getHtmlContent method logic for testing.
 * Since WorkDetailsWebview is tightly coupled to vscode.WebviewPanel,
 * we test the HTML generation logic directly.
 */
class TestableWebviewContent {
    getStatusBadge(status: 'pending' | 'in_progress' | 'completed'): { label: string; class: string } {
        switch (status) {
            case 'pending':
                return { label: 'Pending', class: 'badge-pending' };
            case 'in_progress':
                return { label: 'In Progress', class: 'badge-in-progress' };
            case 'completed':
                return { label: 'Completed', class: 'badge-completed' };
        }
    }

    getMemberStatusBadge(status: 'working' | 'idle'): { label: string; class: string } {
        switch (status) {
            case 'working':
                return { label: 'Working', class: 'badge-working' };
            case 'idle':
                return { label: 'Idle', class: 'badge-idle' };
        }
    }

    getInitials(name: string): string {
        return name
            .split(' ')
            .map(part => part.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('');
    }

    escapeHtml(text: string): string {
        const map: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        };
        return text.replace(/[&<>"']/g, char => map[char]);
    }

    renderMarkdown(text: string): string {
        const lines = text.split('\n');
        const result: string[] = [];
        let i = 0;

        while (i < lines.length) {
            if (lines[i].trim().startsWith('|')) {
                const tableLines: string[] = [];
                while (i < lines.length && lines[i].trim().startsWith('|')) {
                    tableLines.push(lines[i]);
                    i++;
                }
                result.push(this.renderTable(tableLines));
            } else {
                result.push(this.renderInline(this.escapeHtml(lines[i])));
                i++;
            }
        }

        return result.join('<br>');
    }

    renderTable(lines: string[]): string {
        if (lines.length === 0) { return ''; }

        const parseCells = (line: string): string[] => {
            return line.trim()
                .replace(/^\|/, '').replace(/\|$/, '')
                .split('|')
                .map(cell => cell.trim());
        };

        const isSeparator = (line: string): boolean => {
            const trimmed = line.trim();
            return /^\|[\s\-:|]+\|$/.test(trimmed) && /-/.test(trimmed);
        };

        const hasSeparator = lines.length >= 2 && isSeparator(lines[1]);
        const headerCells = parseCells(lines[0]);

        let html = '<table class="md-table">';

        if (hasSeparator) {
            html += '<thead><tr>';
            for (const cell of headerCells) {
                html += `<th>${this.renderInline(this.escapeHtml(cell))}</th>`;
            }
            html += '</tr></thead><tbody>';

            for (let j = 2; j < lines.length; j++) {
                if (isSeparator(lines[j])) { continue; }
                const cells = parseCells(lines[j]);
                html += '<tr>';
                for (let k = 0; k < headerCells.length; k++) {
                    html += `<td>${this.renderInline(this.escapeHtml(cells[k] ?? ''))}</td>`;
                }
                html += '</tr>';
            }
            html += '</tbody>';
        } else {
            html += '<tbody>';
            for (const line of lines) {
                const cells = parseCells(line);
                html += '<tr>';
                for (const cell of cells) {
                    html += `<td>${this.renderInline(this.escapeHtml(cell))}</td>`;
                }
                html += '</tr>';
            }
            html += '</tbody>';
        }

        html += '</table>';
        return html;
    }

    renderInline(escaped: string): string {
        escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        escaped = escaped.replace(/`(.+?)`/g, '<code>$1</code>');
        return escaped;
    }

    generateHtml(workDetails: WorkDetails): string {
        const { task, member } = workDetails;
        const statusBadge = this.getStatusBadge(task.status);
        const memberStatusBadge = this.getMemberStatusBadge(member.status);
        const startedAt = task.startedAt ? task.startedAt.toLocaleString() : 'Not started';
        const completedAt = task.completedAt ? task.completedAt.toLocaleString() : '—';

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Work Details</title>
</head>
<body>
    <div class="section">
        <h1>${this.escapeHtml(task.title)}</h1>
        <span class="badge ${statusBadge.class}">${statusBadge.label}</span>
    </div>
    <div class="section">
        <div class="section-title">Description</div>
        ${task.description 
            ? `<div class="description">${this.renderMarkdown(task.description)}</div>`
            : `<div class="no-description">No description provided</div>`
        }
    </div>
    <div class="section">
        <div class="section-title">Timestamps</div>
        <span class="info-value">${startedAt}</span>
        <span class="info-value">${completedAt}</span>
    </div>
    <div class="section">
        <div class="section-title">Assigned To</div>
        <div class="member-avatar">${this.getInitials(member.name)}</div>
        <div class="member-name">${this.escapeHtml(member.name)}</div>
        <div class="member-role">${this.escapeHtml(member.role)}</div>
        <span class="badge ${memberStatusBadge.class}">${memberStatusBadge.label}</span>
    </div>
</body>
</html>`;
    }
}

suite('WorkDetailsWebview Test Suite', () => {
    let webviewContent: TestableWebviewContent;

    setup(() => {
        webviewContent = new TestableWebviewContent();
    });

    suite('getStatusBadge', () => {
        test('returns Pending badge for pending status', () => {
            const badge = webviewContent.getStatusBadge('pending');
            assert.strictEqual(badge.label, 'Pending');
            assert.strictEqual(badge.class, 'badge-pending');
        });

        test('returns In Progress badge for in_progress status', () => {
            const badge = webviewContent.getStatusBadge('in_progress');
            assert.strictEqual(badge.label, 'In Progress');
            assert.strictEqual(badge.class, 'badge-in-progress');
        });

        test('returns Completed badge for completed status', () => {
            const badge = webviewContent.getStatusBadge('completed');
            assert.strictEqual(badge.label, 'Completed');
            assert.strictEqual(badge.class, 'badge-completed');
        });
    });

    suite('getMemberStatusBadge', () => {
        test('returns Working badge for working status', () => {
            const badge = webviewContent.getMemberStatusBadge('working');
            assert.strictEqual(badge.label, 'Working');
            assert.strictEqual(badge.class, 'badge-working');
        });

        test('returns Idle badge for idle status', () => {
            const badge = webviewContent.getMemberStatusBadge('idle');
            assert.strictEqual(badge.label, 'Idle');
            assert.strictEqual(badge.class, 'badge-idle');
        });
    });

    suite('getInitials', () => {
        test('returns initials from two-word name', () => {
            assert.strictEqual(webviewContent.getInitials('Danny Ocean'), 'DO');
        });

        test('returns single initial from single-word name', () => {
            assert.strictEqual(webviewContent.getInitials('Rusty'), 'R');
        });

        test('returns max two initials from long name', () => {
            assert.strictEqual(webviewContent.getInitials('John Paul Jones Smith'), 'JP');
        });

        test('handles empty string', () => {
            assert.strictEqual(webviewContent.getInitials(''), '');
        });
    });

    suite('escapeHtml', () => {
        test('escapes ampersands', () => {
            assert.strictEqual(webviewContent.escapeHtml('A & B'), 'A &amp; B');
        });

        test('escapes less than', () => {
            assert.strictEqual(webviewContent.escapeHtml('<script>'), '&lt;script&gt;');
        });

        test('escapes quotes', () => {
            assert.strictEqual(webviewContent.escapeHtml('"quoted"'), '&quot;quoted&quot;');
        });

        test('escapes single quotes', () => {
            assert.strictEqual(webviewContent.escapeHtml("it's"), "it&#039;s");
        });

        test('handles multiple special characters', () => {
            assert.strictEqual(
                webviewContent.escapeHtml('<a href="test">Link</a>'),
                '&lt;a href=&quot;test&quot;&gt;Link&lt;/a&gt;'
            );
        });

        test('returns unchanged string with no special chars', () => {
            assert.strictEqual(webviewContent.escapeHtml('Hello World'), 'Hello World');
        });
    });

    suite('generateHtml', () => {
        const createTestWorkDetails = (overrides?: Partial<{ task: Partial<Task>; member: Partial<SquadMember> }>): WorkDetails => {
            const task: Task = {
                id: 'task-1',
                title: 'Test Task',
                description: 'Test description',
                status: 'in_progress',
                assignee: 'Danny',
                startedAt: new Date('2024-01-15T10:00:00Z'),
                ...overrides?.task,
            };
            const member: SquadMember = {
                name: 'Danny Ocean',
                role: 'Lead',
                status: 'working',
                ...overrides?.member,
            };
            return { task, member };
        };

        test('includes task title in output', () => {
            const workDetails = createTestWorkDetails();
            const html = webviewContent.generateHtml(workDetails);

            assert.ok(html.includes('<h1>Test Task</h1>'));
        });

        test('includes task status badge', () => {
            const workDetails = createTestWorkDetails();
            const html = webviewContent.generateHtml(workDetails);

            assert.ok(html.includes('badge-in-progress'));
            assert.ok(html.includes('In Progress'));
        });

        test('includes task description when present', () => {
            const workDetails = createTestWorkDetails();
            const html = webviewContent.generateHtml(workDetails);

            assert.ok(html.includes('Test description'));
            assert.ok(html.includes('class="description"'));
        });

        test('shows no description message when description is absent', () => {
            const workDetails = createTestWorkDetails({ task: { description: undefined } });
            const html = webviewContent.generateHtml(workDetails);

            assert.ok(html.includes('No description provided'));
            assert.ok(html.includes('no-description'));
        });

        test('includes member name', () => {
            const workDetails = createTestWorkDetails();
            const html = webviewContent.generateHtml(workDetails);

            assert.ok(html.includes('Danny Ocean'));
        });

        test('includes member role', () => {
            const workDetails = createTestWorkDetails();
            const html = webviewContent.generateHtml(workDetails);

            assert.ok(html.includes('Lead'));
        });

        test('includes member initials', () => {
            const workDetails = createTestWorkDetails();
            const html = webviewContent.generateHtml(workDetails);

            assert.ok(html.includes('>DO<'));
        });

        test('includes member status badge', () => {
            const workDetails = createTestWorkDetails();
            const html = webviewContent.generateHtml(workDetails);

            assert.ok(html.includes('badge-working'));
            assert.ok(html.includes('Working'));
        });

        test('escapes HTML in task title', () => {
            const workDetails = createTestWorkDetails({ task: { title: '<script>alert("xss")</script>' } });
            const html = webviewContent.generateHtml(workDetails);

            assert.ok(!html.includes('<script>'));
            assert.ok(html.includes('&lt;script&gt;'));
        });

        test('shows Not started when startedAt is undefined', () => {
            const workDetails = createTestWorkDetails({ task: { startedAt: undefined } });
            const html = webviewContent.generateHtml(workDetails);

            assert.ok(html.includes('Not started'));
        });

        test('shows em dash when completedAt is undefined', () => {
            const workDetails = createTestWorkDetails({ task: { completedAt: undefined } });
            const html = webviewContent.generateHtml(workDetails);

            assert.ok(html.includes('>—<'));
        });

        test('includes correct HTML structure', () => {
            const workDetails = createTestWorkDetails();
            const html = webviewContent.generateHtml(workDetails);

            assert.ok(html.includes('<!DOCTYPE html>'));
            assert.ok(html.includes('<html lang="en">'));
            assert.ok(html.includes('<body>'));
            assert.ok(html.includes('</body>'));
            assert.ok(html.includes('</html>'));
        });

        test('renders pending status correctly', () => {
            const workDetails = createTestWorkDetails({ task: { status: 'pending' } });
            const html = webviewContent.generateHtml(workDetails);

            assert.ok(html.includes('badge-pending'));
            assert.ok(html.includes('Pending'));
        });

        test('renders completed status correctly', () => {
            const workDetails = createTestWorkDetails({ task: { status: 'completed' } });
            const html = webviewContent.generateHtml(workDetails);

            assert.ok(html.includes('badge-completed'));
            assert.ok(html.includes('Completed'));
        });

        test('renders idle member status correctly', () => {
            const workDetails = createTestWorkDetails({ member: { status: 'idle' } });
            const html = webviewContent.generateHtml(workDetails);

            assert.ok(html.includes('badge-idle'));
            assert.ok(html.includes('Idle'));
        });
    });

    suite('renderMarkdown', () => {
        test('converts markdown table to HTML table', () => {
            const md = '| Name | Role |\n|------|------|\n| Danny | Lead |';
            const html = webviewContent.renderMarkdown(md);

            assert.ok(html.includes('<table class="md-table">'));
            assert.ok(html.includes('<thead>'));
            assert.ok(html.includes('<th>Name</th>'));
            assert.ok(html.includes('<th>Role</th>'));
            assert.ok(html.includes('<tbody>'));
            assert.ok(html.includes('<td>Danny</td>'));
            assert.ok(html.includes('<td>Lead</td>'));
            assert.ok(html.includes('</table>'));
        });

        test('converts bold text', () => {
            const html = webviewContent.renderMarkdown('This is **bold** text');
            assert.ok(html.includes('<strong>bold</strong>'));
        });

        test('converts inline code', () => {
            const html = webviewContent.renderMarkdown('Use `npm install` here');
            assert.ok(html.includes('<code>npm install</code>'));
        });

        test('converts newlines to br for non-table text', () => {
            const html = webviewContent.renderMarkdown('Line one\nLine two');
            assert.ok(html.includes('Line one<br>Line two'));
        });

        test('escapes HTML in table cells', () => {
            const md = '| Header |\n|--------|\n| <script> |';
            const html = webviewContent.renderMarkdown(md);

            assert.ok(!html.includes('<script>'));
            assert.ok(html.includes('&lt;script&gt;'));
        });

        test('handles table with no header separator', () => {
            const md = '| A | B |\n| C | D |';
            const html = webviewContent.renderMarkdown(md);

            assert.ok(html.includes('<table class="md-table">'));
            assert.ok(!html.includes('<thead>'));
            assert.ok(html.includes('<td>A</td>'));
            assert.ok(html.includes('<td>D</td>'));
        });

        test('handles empty cells', () => {
            const md = '| A | |\n|---|---|\n| | B |';
            const html = webviewContent.renderMarkdown(md);

            assert.ok(html.includes('<th>A</th>'));
            assert.ok(html.includes('<td>B</td>'));
        });

        test('handles single-column table', () => {
            const md = '| Solo |\n|------|\n| Val |';
            const html = webviewContent.renderMarkdown(md);

            assert.ok(html.includes('<th>Solo</th>'));
            assert.ok(html.includes('<td>Val</td>'));
        });

        test('handles mixed table and text', () => {
            const md = 'Before table\n| H1 |\n|----|\n| V1 |\nAfter table';
            const html = webviewContent.renderMarkdown(md);

            assert.ok(html.includes('Before table'));
            assert.ok(html.includes('<table class="md-table">'));
            assert.ok(html.includes('After table'));
        });

        test('plain text returns escaped with no extra tags', () => {
            const html = webviewContent.renderMarkdown('Just plain text');
            assert.strictEqual(html, 'Just plain text');
        });
    });
});
