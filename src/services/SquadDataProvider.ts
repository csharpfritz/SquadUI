/**
 * Service for aggregating and providing squad data to the UI layer.
 * Caches parsed data internally and exposes a clean API for the webview.
 */

import { SquadMember, Task, WorkDetails, OrchestrationLogEntry } from '../models';
import { OrchestrationLogService } from './OrchestrationLogService';

/**
 * Provides squad data to the UI layer.
 * Aggregates data from OrchestrationLogService with caching.
 */
export class SquadDataProvider {
    private orchestrationService: OrchestrationLogService;
    private teamRoot: string;

    // Cached data
    private cachedLogEntries: OrchestrationLogEntry[] | null = null;
    private cachedMembers: SquadMember[] | null = null;
    private cachedTasks: Task[] | null = null;

    constructor(teamRoot: string) {
        this.teamRoot = teamRoot;
        this.orchestrationService = new OrchestrationLogService();
    }

    /**
     * Returns all squad members with their current status.
     * Data is cached after first call until refresh() is invoked.
     */
    async getSquadMembers(): Promise<SquadMember[]> {
        if (this.cachedMembers) {
            return this.cachedMembers;
        }

        const entries = await this.getLogEntries();
        const memberStates = this.orchestrationService.getMemberStates(entries);
        const tasks = await this.getTasks();

        // Build member list from all participants across log entries
        const members: SquadMember[] = [];
        const memberNames = new Set<string>();

        for (const entry of entries) {
            for (const participant of entry.participants) {
                memberNames.add(participant);
            }
        }

        for (const name of memberNames) {
            const status = memberStates.get(name) ?? 'idle';
            const currentTask = tasks.find(t => t.assignee === name && t.status === 'in_progress');

            members.push({
                name,
                role: 'Squad Member', // Role info would come from team.md parsing
                status,
                currentTask,
            });
        }

        this.cachedMembers = members;
        return members;
    }

    /**
     * Returns all tasks assigned to a specific member.
     * @param memberId - The name of the member to get tasks for
     */
    async getTasksForMember(memberId: string): Promise<Task[]> {
        const tasks = await this.getTasks();
        return tasks.filter(task => task.assignee === memberId);
    }

    /**
     * Returns full details for displaying a task in the webview.
     * @param taskId - The ID of the task to get details for
     */
    async getWorkDetails(taskId: string): Promise<WorkDetails | undefined> {
        const tasks = await this.getTasks();
        const task = tasks.find(t => t.id === taskId);

        if (!task) {
            return undefined;
        }

        const members = await this.getSquadMembers();
        const member = members.find(m => m.name === task.assignee);

        if (!member) {
            return undefined;
        }

        // Find related log entries for this task
        const entries = await this.getLogEntries();
        const relatedEntries = entries.filter(entry => 
            entry.relatedIssues?.some(issue => issue.includes(taskId))
        );

        return {
            task,
            member,
            logEntries: relatedEntries.length > 0 ? relatedEntries : undefined,
        };
    }

    /**
     * Invalidates all cached data.
     * FileWatcherService should call this when underlying files change.
     */
    refresh(): void {
        this.cachedLogEntries = null;
        this.cachedMembers = null;
        this.cachedTasks = null;
    }

    // ─── Private Methods ───────────────────────────────────────────────────

    private async getLogEntries(): Promise<OrchestrationLogEntry[]> {
        if (this.cachedLogEntries) {
            return this.cachedLogEntries;
        }

        this.cachedLogEntries = await this.orchestrationService.parseAllLogs(this.teamRoot);
        return this.cachedLogEntries;
    }

    private async getTasks(): Promise<Task[]> {
        if (this.cachedTasks) {
            return this.cachedTasks;
        }

        const entries = await this.getLogEntries();
        this.cachedTasks = this.orchestrationService.getActiveTasks(entries);
        return this.cachedTasks;
    }
}
