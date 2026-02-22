/**
 * Service for generating standup summary reports.
 * Aggregates closed issues, newly opened issues, blocking issues,
 * and suggested next steps for daily or weekly standups.
 */

import { GitHubIssue, DecisionEntry, OrchestrationLogEntry } from '../models';

/** Time period for the standup report */
export type StandupPeriod = 'day' | 'week';

/**
 * Summary statistics for the standup report
 */
export interface StandupSummary {
    /** Total issues closed in the period */
    closedCount: number;
    /** Total new issues opened in the period */
    newCount: number;
    /** Total blocking issues currently open */
    blockingCount: number;
    /** Period start date */
    periodStart: Date;
    /** Period end date (now) */
    periodEnd: Date;
}

/**
 * Complete standup report data
 */
export interface StandupReport {
    /** Report period type */
    period: StandupPeriod;
    /** Summary statistics */
    summary: StandupSummary;
    /** Issues closed in the period */
    closedIssues: GitHubIssue[];
    /** New issues opened in the period */
    newIssues: GitHubIssue[];
    /** Currently blocking issues */
    blockingIssues: GitHubIssue[];
    /** Recent decisions made */
    recentDecisions: DecisionEntry[];
    /** Suggested next steps (from open issues, sorted by priority) */
    suggestedNextSteps: GitHubIssue[];
    /** Log entries in the period */
    recentLogs: OrchestrationLogEntry[];
}

/**
 * Labels that indicate a blocking issue
 */
const BLOCKING_LABELS = ['blocked', 'blocker', 'blocking', 'impediment'];

/**
 * Labels that indicate priority (for sorting next steps)
 */
const PRIORITY_ORDER: Record<string, number> = {
    'p0': 0,
    'priority:critical': 0,
    'urgent': 0,
    'p1': 1,
    'priority:high': 1,
    'high': 1,
    'p2': 2,
    'priority:medium': 2,
    'medium': 2,
    'p3': 3,
    'priority:low': 3,
    'low': 3,
};

export class StandupReportService {
    /**
     * Generates a standup report for the given period.
     * 
     * @param openIssues - Currently open issues
     * @param closedIssues - Recently closed issues
     * @param decisions - Team decisions
     * @param logEntries - Orchestration log entries
     * @param period - 'day' or 'week'
     */
    generateReport(
        openIssues: GitHubIssue[],
        closedIssues: GitHubIssue[],
        decisions: DecisionEntry[],
        logEntries: OrchestrationLogEntry[],
        period: StandupPeriod = 'day'
    ): StandupReport {
        const now = new Date();
        const periodMs = period === 'day' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
        const periodStart = new Date(now.getTime() - periodMs);

        // Filter closed issues to the period
        const closedInPeriod = closedIssues.filter(issue => {
            if (!issue.closedAt) { return false; }
            const closedDate = new Date(issue.closedAt);
            return closedDate >= periodStart && closedDate <= now;
        });

        // Find new issues opened in the period
        const newInPeriod = openIssues.filter(issue => {
            const createdDate = new Date(issue.createdAt);
            return createdDate >= periodStart && createdDate <= now;
        });

        // Find blocking issues
        const blockingIssues = openIssues.filter(issue => 
            issue.labels.some(label => 
                BLOCKING_LABELS.includes(label.name.toLowerCase())
            )
        );

        // Filter decisions to the period
        const recentDecisions = decisions.filter(decision => {
            if (!decision.date) { return false; }
            const decisionDate = this.parseDate(decision.date);
            return decisionDate && decisionDate >= periodStart;
        });

        // Filter log entries to the period
        const recentLogs = logEntries.filter(entry => {
            const entryDate = this.parseDate(entry.date);
            return entryDate && entryDate >= periodStart;
        });

        // Suggested next steps: open issues sorted by priority, excluding blockers
        const suggestedNextSteps = openIssues
            .filter(issue => !this.isBlocking(issue))
            .sort((a, b) => this.getPriority(a) - this.getPriority(b))
            .slice(0, 5);

        return {
            period,
            summary: {
                closedCount: closedInPeriod.length,
                newCount: newInPeriod.length,
                blockingCount: blockingIssues.length,
                periodStart,
                periodEnd: now,
            },
            closedIssues: closedInPeriod,
            newIssues: newInPeriod,
            blockingIssues,
            recentDecisions,
            suggestedNextSteps,
            recentLogs,
        };
    }

    /**
     * Formats the report as markdown for display
     */
    formatAsMarkdown(report: StandupReport): string {
        const lines: string[] = [];
        const periodLabel = report.period === 'day' ? 'Daily' : 'Weekly';
        
        lines.push(`# ${periodLabel} Standup Report`);
        lines.push('');
        lines.push(`**Period:** ${this.formatDate(report.summary.periodStart)} – ${this.formatDate(report.summary.periodEnd)}`);
        lines.push('');

        // Summary
        lines.push('## Summary');
        lines.push('');
        lines.push(`| Metric | Count |`);
        lines.push(`|--------|-------|`);
        lines.push(`| ✅ Issues Closed | ${report.summary.closedCount} |`);
        lines.push(`| 📋 New Issues | ${report.summary.newCount} |`);
        lines.push(`| 🚫 Blockers | ${report.summary.blockingCount} |`);
        lines.push('');

        // Closed Issues
        if (report.closedIssues.length > 0) {
            lines.push('## ✅ Closed Issues');
            lines.push('');
            for (const issue of report.closedIssues) {
                lines.push(`- **#${issue.number}**: ${issue.title}`);
            }
            lines.push('');
        }

        // New Issues
        if (report.newIssues.length > 0) {
            lines.push('## 📋 New Issues');
            lines.push('');
            for (const issue of report.newIssues) {
                lines.push(`- **#${issue.number}**: ${issue.title}`);
            }
            lines.push('');
        }

        // Blockers
        if (report.blockingIssues.length > 0) {
            lines.push('## 🚫 Blockers');
            lines.push('');
            for (const issue of report.blockingIssues) {
                const labels = issue.labels.map(l => l.name).join(', ');
                lines.push(`- **#${issue.number}**: ${issue.title} (${labels})`);
            }
            lines.push('');
        }

        // Suggested Next Steps
        if (report.suggestedNextSteps.length > 0) {
            lines.push('## 🎯 Suggested Next Steps');
            lines.push('');
            for (const issue of report.suggestedNextSteps) {
                const assignee = issue.assignee ? ` @${issue.assignee}` : '';
                lines.push(`- **#${issue.number}**: ${issue.title}${assignee}`);
            }
            lines.push('');
        }

        // Recent Decisions
        if (report.recentDecisions.length > 0) {
            lines.push('## 📌 Recent Decisions');
            lines.push('');
            for (const decision of report.recentDecisions) {
                const author = decision.author ? ` (${decision.author})` : '';
                lines.push(`- **${decision.title}**${author}`);
            }
            lines.push('');
        }

        return lines.join('\n');
    }

    private isBlocking(issue: GitHubIssue): boolean {
        return issue.labels.some(label => 
            BLOCKING_LABELS.includes(label.name.toLowerCase())
        );
    }

    private getPriority(issue: GitHubIssue): number {
        for (const label of issue.labels) {
            const priority = PRIORITY_ORDER[label.name.toLowerCase()];
            if (priority !== undefined) {
                return priority;
            }
        }
        return 99; // Default low priority
    }

    private parseDate(dateStr: string): Date | null {
        // Handle YYYY-MM-DD format
        const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
            return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        }
        // Try ISO format
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date;
    }

    private formatDate(date: Date): string {
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    }
}
