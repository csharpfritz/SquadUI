/**
 * Transforms orchestration logs and squad data into dashboard visualizations.
 * Builds data for velocity charts, activity timelines, and decision browser.
 */

import { OrchestrationLogEntry, Task, SquadMember, DashboardData, VelocityDataPoint, ActivityHeatmapPoint, ActivitySwimlane, TimelineTask, DecisionEntry, TeamMemberOverview, TeamSummary, MemberIssueMap, GitHubIssue, MilestoneBurndown, BurndownDataPoint } from '../../models';
import { parseDateAsLocal, toLocalDateKey } from '../../utils/dateUtils';

export class DashboardDataBuilder {
    /**
     * Builds complete dashboard data from logs and member roster.
     */
    buildDashboardData(
        logEntries: OrchestrationLogEntry[],
        members: SquadMember[],
        tasks: Task[],
        decisions: DecisionEntry[],
        openIssues?: MemberIssueMap,
        closedIssues?: MemberIssueMap,
        milestoneBurndowns?: MilestoneBurndown[],
        allClosedIssues?: GitHubIssue[],
        velocityTasks?: Task[]
    ): DashboardData {
        return {
            team: this.buildTeamOverview(members, tasks, logEntries, openIssues, closedIssues),
            burndown: {
                milestones: milestoneBurndowns ?? [],
            },
            velocity: {
                timeline: this.buildVelocityTimeline(velocityTasks ?? tasks, closedIssues, allClosedIssues),
                heatmap: this.buildActivityHeatmap(members, logEntries),
            },
            activity: {
                swimlanes: this.buildActivitySwimlanes(members, tasks),
                recentLogs: logEntries.slice(0, 10),
            },
            decisions: {
                entries: decisions,
            },
        };
    }

    /**
     * Builds velocity timeline: completed tasks per day over the last 30 days.
     * Combines both orchestration-log tasks and closed GitHub issues.
     */
    private buildVelocityTimeline(tasks: Task[], closedIssues?: MemberIssueMap, allClosedIssues?: GitHubIssue[]): VelocityDataPoint[] {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Group completed tasks by date
        const tasksByDate = new Map<string, number>();

        for (const task of tasks) {
            if (task.status !== 'completed' || !task.completedAt) {
                continue;
            }

            const completedDate = task.completedAt instanceof Date ? task.completedAt : parseDateAsLocal(String(task.completedAt));
            if (completedDate < thirtyDaysAgo) {
                continue;
            }

            const dateKey = toLocalDateKey(completedDate);
            tasksByDate.set(dateKey, (tasksByDate.get(dateKey) ?? 0) + 1);
        }

        // Count ALL closed GitHub issues for velocity (not just member-matched)
        const seenIssues = new Set<number>();
        if (allClosedIssues) {
            for (const issue of allClosedIssues) {
                if (seenIssues.has(issue.number)) { continue; }
                seenIssues.add(issue.number);
                if (issue.closedAt) {
                    const closedDate = new Date(issue.closedAt);
                    if (closedDate >= thirtyDaysAgo) {
                        const dateKey = toLocalDateKey(closedDate);
                        tasksByDate.set(dateKey, (tasksByDate.get(dateKey) ?? 0) + 1);
                    }
                }
            }
        } else if (closedIssues) {
            // Fallback: use member-matched issues if allClosedIssues not provided
            for (const issues of closedIssues.values()) {
                for (const issue of issues) {
                    if (seenIssues.has(issue.number)) { continue; }
                    seenIssues.add(issue.number);
                    if (issue.closedAt) {
                        const closedDate = new Date(issue.closedAt);
                        if (closedDate >= thirtyDaysAgo) {
                            const dateKey = toLocalDateKey(closedDate);
                            tasksByDate.set(dateKey, (tasksByDate.get(dateKey) ?? 0) + 1);
                        }
                    }
                }
            }
        }

        // Fill in missing dates with 0 counts
        const timeline: VelocityDataPoint[] = [];
        for (let d = new Date(thirtyDaysAgo); d <= now; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
            const dateKey = toLocalDateKey(d);
            timeline.push({
                date: dateKey,
                completedTasks: tasksByDate.get(dateKey) ?? 0,
            });
        }

        return timeline;
    }

    /**
     * Builds activity heatmap: activity level per member (0.0 = idle, 1.0 = active).
     * Activity is based on participation in recent log entries (last 7 days).
     */
    private buildActivityHeatmap(members: SquadMember[], logEntries: OrchestrationLogEntry[]): ActivityHeatmapPoint[] {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Count participation in recent entries
        const participationCount = new Map<string, number>();
        let maxParticipation = 0;

        for (const entry of logEntries) {
            const entryDate = parseDateAsLocal(entry.date);
            if (entryDate < sevenDaysAgo) {
                continue;
            }

            for (const participant of entry.participants) {
                const count = (participationCount.get(participant) ?? 0) + 1;
                participationCount.set(participant, count);
                maxParticipation = Math.max(maxParticipation, count);
            }
        }

        // Normalize to 0.0-1.0 scale
        const heatmap: ActivityHeatmapPoint[] = [];
        for (const member of members) {
            const count = participationCount.get(member.name) ?? 0;
            const activityLevel = maxParticipation > 0 ? count / maxParticipation : 0;
            heatmap.push({
                member: member.name,
                activityLevel,
            });
        }

        return heatmap;
    }

    /**
     * Builds activity swimlanes: one swimlane per member with their tasks.
     */
    private buildActivitySwimlanes(members: SquadMember[], tasks: Task[]): ActivitySwimlane[] {
        const swimlanes: ActivitySwimlane[] = [];

        for (const member of members) {
            const memberTasks = tasks
                .filter(task => task.assignee === member.name)
                .map(task => this.taskToTimelineTask(task))
                .sort((a, b) => a.startDate.localeCompare(b.startDate));

            swimlanes.push({
                member: member.name,
                role: member.role,
                tasks: memberTasks,
            });
        }

        return swimlanes;
    }

    /**
     * Converts a Task to a TimelineTask.
     */
    private taskToTimelineTask(task: Task): TimelineTask {
        const startDate = task.startedAt 
            ? (task.startedAt instanceof Date ? task.startedAt : parseDateAsLocal(String(task.startedAt)))
            : new Date();

        const endDate = task.completedAt
            ? (task.completedAt instanceof Date ? task.completedAt : parseDateAsLocal(String(task.completedAt)))
            : null;

        return {
            id: task.id,
            title: task.title,
            startDate: toLocalDateKey(startDate),
            endDate: endDate ? toLocalDateKey(endDate) : null,
            status: task.status,
        };
    }

    /**
     * Builds the Team overview: per-member cards and aggregate summary.
     */
    private buildTeamOverview(
        members: SquadMember[],
        tasks: Task[],
        logEntries: OrchestrationLogEntry[],
        openIssues?: MemberIssueMap,
        closedIssues?: MemberIssueMap
    ): { members: TeamMemberOverview[]; summary: TeamSummary } {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Count recent log participation per member
        const recentParticipation = new Map<string, number>();
        for (const entry of logEntries) {
            const entryDate = parseDateAsLocal(entry.date);
            if (entryDate < sevenDaysAgo) { continue; }
            for (const p of entry.participants) {
                recentParticipation.set(p, (recentParticipation.get(p) ?? 0) + 1);
            }
        }

        let totalOpenIssues = 0;
        let totalClosedIssues = 0;
        let totalActiveTasks = 0;
        let activeMembers = 0;

        const memberOverviews: TeamMemberOverview[] = members.map(member => {
            const lowerName = member.name.toLowerCase();
            const iconType = lowerName === 'scribe' ? 'scribe' as const
                : lowerName === 'ralph' ? 'ralph' as const
                : (lowerName === '@copilot' || lowerName === 'copilot') ? 'copilot' as const
                : undefined;

            const memberOpenIssues = openIssues?.get(lowerName) ?? [];
            const memberClosedIssues = closedIssues?.get(lowerName) ?? [];
            const memberTasks = tasks.filter(t => t.assignee === member.name && t.status === 'in_progress');

            totalOpenIssues += memberOpenIssues.length;
            totalClosedIssues += memberClosedIssues.length;
            totalActiveTasks += memberTasks.length;
            if (member.status === 'working') { activeMembers++; }

            return {
                name: member.name,
                role: member.role,
                status: member.status,
                iconType,
                openIssueCount: memberOpenIssues.length,
                closedIssueCount: memberClosedIssues.length,
                activeTaskCount: memberTasks.length,
                recentActivityCount: recentParticipation.get(member.name) ?? 0,
            };
        });

        const summary: TeamSummary = {
            totalMembers: members.length,
            activeMembers,
            totalOpenIssues,
            totalClosedIssues,
            totalActiveTasks,
        };

        return { members: memberOverviews, summary };
    }

    // Stable color palette for member-colored chart areas
    private static readonly MEMBER_COLORS = [
        '#3794ff', '#89d185', '#d18616', '#c586c0',
        '#4ec9b0', '#ce9178', '#569cd6', '#dcdcaa',
        '#6a9955', '#f44747', '#b5cea8', '#9cdcfe',
    ];

    /**
     * Builds burndown data for a single milestone from its issues.
     * The burndown shows how many issues remain open over time,
     * with stacked areas colored by assigned squad member.
     */
    buildMilestoneBurndown(
        milestoneTitle: string,
        milestoneNumber: number,
        issues: GitHubIssue[],
        dueDate?: string
    ): MilestoneBurndown {
        if (issues.length === 0) {
            return {
                title: milestoneTitle, number: milestoneNumber,
                totalIssues: 0, memberNames: [], memberColors: [],
                dataPoints: [], dueDate,
            };
        }

        // Determine member for each issue (from squad: label, falling back to 'unassigned')
        const SQUAD_PREFIX = 'squad:';
        const issueMemberMap = new Map<number, string>();
        const memberSet = new Set<string>();

        for (const issue of issues) {
            const squadLabel = issue.labels.find(l => l.name.toLowerCase().startsWith(SQUAD_PREFIX));
            const member = squadLabel
                ? squadLabel.name.substring(SQUAD_PREFIX.length).toLowerCase()
                : (issue.assignee?.toLowerCase() ?? 'unassigned');
            issueMemberMap.set(issue.number, member);
            memberSet.add(member);
        }

        // Stable sort: alphabetical, 'unassigned' last
        const memberNames = Array.from(memberSet).sort((a, b) => {
            if (a === 'unassigned') { return 1; }
            if (b === 'unassigned') { return -1; }
            return a.localeCompare(b);
        });
        const memberColors = memberNames.map(
            (_, i) => DashboardDataBuilder.MEMBER_COLORS[i % DashboardDataBuilder.MEMBER_COLORS.length]
        );

        // Determine date range: milestone start = earliest created issue, end = today or due date
        const createdDates = issues.map(i => new Date(i.createdAt).getTime());
        const startDate = new Date(Math.min(...createdDates));
        startDate.setHours(0, 0, 0, 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // For closed milestones, end at the last issue close date (not today)
        const allClosed = issues.every(i => !!i.closedAt);
        let effectiveEnd: Date;
        if (allClosed) {
            const lastClose = new Date(Math.max(...issues.map(i => new Date(i.closedAt!).getTime())));
            lastClose.setHours(0, 0, 0, 0);
            const dueDateObj = dueDate ? parseDateAsLocal(dueDate) : undefined;
            effectiveEnd = dueDateObj
                ? new Date(Math.max(lastClose.getTime(), dueDateObj.getTime()))
                : lastClose;
        } else {
            const dueDateObj = dueDate ? parseDateAsLocal(dueDate) : undefined;
            effectiveEnd = dueDateObj
                ? new Date(Math.max(today.getTime(), dueDateObj.getTime()))
                : today;
        }
        const endDateObj = effectiveEnd;

        // Build daily close events: date → set of issue numbers closed on that date
        const closeEvents = new Map<string, Set<number>>();
        for (const issue of issues) {
            if (issue.closedAt) {
                const closedDate = toLocalDateKey(new Date(issue.closedAt));
                const existing = closeEvents.get(closedDate) ?? new Set<number>();
                existing.add(issue.number);
                closeEvents.set(closedDate, existing);
            }
        }

        // Walk day-by-day and compute remaining open issues
        const dataPoints: BurndownDataPoint[] = [];
        const closedSoFar = new Set<number>();

        for (let d = new Date(startDate); d <= endDateObj; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
            const dateKey = toLocalDateKey(d);

            // Apply any closes on this date
            const todayCloses = closeEvents.get(dateKey);
            if (todayCloses) {
                for (const num of todayCloses) { closedSoFar.add(num); }
            }

            // Count remaining open by member
            const byMember: Record<string, number> = {};
            for (const name of memberNames) { byMember[name] = 0; }

            let remaining = 0;
            for (const issue of issues) {
                // Only count issues that were created on or before this date
                const createdDate = toLocalDateKey(new Date(issue.createdAt));
                if (createdDate > dateKey) { continue; }

                if (!closedSoFar.has(issue.number)) {
                    remaining++;
                    const member = issueMemberMap.get(issue.number) ?? 'unassigned';
                    byMember[member] = (byMember[member] ?? 0) + 1;
                }
            }

            dataPoints.push({ date: dateKey, remaining, byMember });
        }

        return {
            title: milestoneTitle,
            number: milestoneNumber,
            totalIssues: issues.length,
            memberNames,
            memberColors,
            dataPoints,
            dueDate,
        };
    }
}
