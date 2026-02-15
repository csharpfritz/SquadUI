/**
 * Transforms orchestration logs and squad data into dashboard visualizations.
 * Builds data for velocity charts, activity timelines, and decision browser.
 */

import { OrchestrationLogEntry, Task, SquadMember, DashboardData, VelocityDataPoint, ActivityHeatmapPoint, ActivitySwimlane, TimelineTask, DecisionEntry } from '../../models';

export class DashboardDataBuilder {
    /**
     * Builds complete dashboard data from logs and member roster.
     */
    buildDashboardData(
        logEntries: OrchestrationLogEntry[],
        members: SquadMember[],
        tasks: Task[],
        decisions: DecisionEntry[]
    ): DashboardData {
        return {
            velocity: {
                timeline: this.buildVelocityTimeline(tasks),
                heatmap: this.buildActivityHeatmap(members, logEntries),
            },
            activity: {
                swimlanes: this.buildActivitySwimlanes(members, tasks),
            },
            decisions: {
                entries: decisions,
            },
        };
    }

    /**
     * Builds velocity timeline: completed tasks per day over the last 30 days.
     */
    private buildVelocityTimeline(tasks: Task[]): VelocityDataPoint[] {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Group completed tasks by date
        const tasksByDate = new Map<string, number>();

        for (const task of tasks) {
            if (task.status !== 'completed' || !task.completedAt) {
                continue;
            }

            const completedDate = task.completedAt instanceof Date ? task.completedAt : new Date(task.completedAt);
            if (completedDate < thirtyDaysAgo) {
                continue;
            }

            const dateKey = completedDate.toISOString().split('T')[0];
            tasksByDate.set(dateKey, (tasksByDate.get(dateKey) ?? 0) + 1);
        }

        // Fill in missing dates with 0 counts
        const timeline: VelocityDataPoint[] = [];
        for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
            const dateKey = d.toISOString().split('T')[0];
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
            const entryDate = new Date(entry.date);
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
            ? (task.startedAt instanceof Date ? task.startedAt : new Date(task.startedAt))
            : new Date();

        const endDate = task.completedAt
            ? (task.completedAt instanceof Date ? task.completedAt : new Date(task.completedAt))
            : null;

        return {
            id: task.id,
            title: task.title,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate ? endDate.toISOString().split('T')[0] : null,
            status: task.status,
        };
    }
}
