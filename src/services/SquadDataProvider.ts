/**
 * Service for aggregating and providing squad data to the UI layer.
 * Caches parsed data internally and exposes a clean API for the webview.
 *
 * Member resolution order:
 * 1. team.md (authoritative roster via TeamMdService)
 * 2. Orchestration logs overlay status/tasks on top
 * 3. If team.md is missing, falls back to log-participant discovery
 */

import { SquadMember, Task, WorkDetails, OrchestrationLogEntry } from '../models';
import { OrchestrationLogService } from './OrchestrationLogService';
import { TeamMdService } from './TeamMdService';

/**
 * Provides squad data to the UI layer.
 * Aggregates data from TeamMdService (primary) and OrchestrationLogService (overlay).
 */
export class SquadDataProvider {
    private orchestrationService: OrchestrationLogService;
    private teamMdService: TeamMdService;
    private teamRoot: string;

    // Cached data
    private cachedLogEntries: OrchestrationLogEntry[] | null = null;
    private cachedMembers: SquadMember[] | null = null;
    private cachedTasks: Task[] | null = null;

    constructor(teamRoot: string) {
        this.teamRoot = teamRoot;
        this.orchestrationService = new OrchestrationLogService();
        this.teamMdService = new TeamMdService();
    }

    /**
     * Returns the workspace root path used by this provider.
     */
    getWorkspaceRoot(): string {
        return this.teamRoot;
    }

    /**
     * Returns all squad members with their current status.
     * Always reads from team.md first (authoritative roster), then overlays
     * status and tasks from orchestration logs. Falls back to log-participant
     * discovery if team.md is missing.
     *
     * Data is cached after first call until refresh() is invoked.
     */
    async getSquadMembers(): Promise<SquadMember[]> {
        if (this.cachedMembers) {
            return this.cachedMembers;
        }

        const entries = await this.getLogEntries();
        const memberStates = this.orchestrationService.getMemberStates(entries);
        const tasks = await this.getTasks();

        // Try team.md as authoritative roster first
        const roster = await this.teamMdService.parseTeamMd(this.teamRoot);

        let members: SquadMember[];

        if (roster && roster.members.length > 0) {
            // Primary path: team.md defines the roster, logs overlay status
            members = roster.members.map(member => {
                const logStatus = memberStates.get(member.name) ?? 'idle';
                const currentTask = tasks.find(t => t.assignee === member.name && t.status === 'in_progress');
                // Override 'working' to 'idle' if the member has no in-progress tasks
                // (all their work is completed — they shouldn't show as spinning)
                const status = (logStatus === 'working' && !currentTask) ? 'idle' : logStatus;
                return {
                    name: member.name,
                    role: member.role,
                    status,
                    currentTask,
                };
            });
        } else {
            // Fallback: derive members from log participants (legacy behavior)
            const memberNames = new Set<string>();
            for (const entry of entries) {
                for (const participant of entry.participants) {
                    memberNames.add(participant);
                }
            }

            members = [];
            for (const name of memberNames) {
                const logStatus = memberStates.get(name) ?? 'idle';
                const currentTask = tasks.find(t => t.assignee === name && t.status === 'in_progress');
                const status = (logStatus === 'working' && !currentTask) ? 'idle' : logStatus;
                members.push({
                    name,
                    role: 'Squad Member',
                    status,
                    currentTask,
                });
            }
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
