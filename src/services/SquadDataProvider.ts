/**
 * Service for aggregating and providing squad data to the UI layer.
 * Caches parsed data internally and exposes a clean API for the webview.
 *
 * Member resolution order:
 * 1. team.md Members/Roster table (authoritative roster via TeamMdService)
 * 2. Agents folder scan (.ai-team/agents/ subdirectories with charter.md parsing)
 * 3. Orchestration log participants (legacy fallback)
 * 4. Orchestration logs overlay status/tasks on all paths above
 */

import * as fs from 'fs';
import * as path from 'path';
import { SquadMember, Task, WorkDetails, OrchestrationLogEntry, DecisionEntry } from '../models';
import { OrchestrationLogService } from './OrchestrationLogService';
import { TeamMdService } from './TeamMdService';
import { DecisionService } from './DecisionService';

/**
 * Provides squad data to the UI layer.
 * Aggregates data from TeamMdService (primary) and OrchestrationLogService (overlay).
 */
export class SquadDataProvider {
    private orchestrationService: OrchestrationLogService;
    private teamMdService: TeamMdService;
    private decisionService: DecisionService;
    private teamRoot: string;
    private squadFolder: '.squad' | '.ai-team';

    // Cached data
    private cachedLogEntries: OrchestrationLogEntry[] | null = null;
    private cachedMembers: SquadMember[] | null = null;
    private cachedTasks: Task[] | null = null;
    private cachedDecisions: DecisionEntry[] | null = null;
    private retryDelayMs: number;

    constructor(teamRoot: string, squadFolder: '.squad' | '.ai-team', retryDelayMs: number = 1500) {
        this.teamRoot = teamRoot;
        this.squadFolder = squadFolder;
        this.retryDelayMs = retryDelayMs;
        this.orchestrationService = new OrchestrationLogService(squadFolder);
        this.teamMdService = new TeamMdService(squadFolder);
        this.decisionService = new DecisionService(squadFolder);
    }

    /**
     * Returns the workspace root path used by this provider.
     */
    getWorkspaceRoot(): string {
        return this.teamRoot;
    }

    /**
     * Returns all squad members with their current status.
     * Resolution order:
     * 1. team.md Members/Roster table (authoritative roster)
     * 2. Agents folder scan (.ai-team/agents/ subdirectories)
     * 3. Orchestration log participants (legacy fallback)
     *
     * All paths overlay status and tasks from orchestration logs.
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
        let roster = await this.teamMdService.parseTeamMd(this.teamRoot);

        // If team.md exists but has no members yet, retry once after a delay
        // to handle the race where squad init is still writing the file
        if (roster && roster.members.length === 0) {
            const teamMdPath = path.join(this.teamRoot, this.squadFolder, 'team.md');
            if (fs.existsSync(teamMdPath)) {
                await new Promise(resolve => setTimeout(resolve, this.retryDelayMs));
                this.teamMdService = new TeamMdService(this.squadFolder);
                roster = await this.teamMdService.parseTeamMd(this.teamRoot);
            }
        }

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
            // Fallback 1: discover members from .ai-team/agents/ folders
            const agentMembers = await this.discoverMembersFromAgentsFolder();

            if (agentMembers.length > 0) {
                members = agentMembers.map(member => {
                    const logStatus = memberStates.get(member.name) ?? 'idle';
                    const currentTask = tasks.find(t => t.assignee === member.name && t.status === 'in_progress');
                    const status = (logStatus === 'working' && !currentTask) ? 'idle' : logStatus;
                    return {
                        name: member.name,
                        role: member.role,
                        status,
                        currentTask,
                    };
                });
            } else {
                // Fallback 2: derive members from log participants (legacy behavior)
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
        }

        this.cachedMembers = members;
        return members;
    }

    /**
     * Returns all decisions from the workspace.
     */
    async getDecisions(): Promise<DecisionEntry[]> {
        if (this.cachedDecisions) {
            return this.cachedDecisions;
        }

        this.cachedDecisions = await this.decisionService.getDecisions(this.teamRoot);
        return this.cachedDecisions;
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
        // Case-insensitive member lookup to handle name mismatches between logs and team.md
        const member = members.find(m => m.name.toLowerCase() === task.assignee?.toLowerCase());

        if (!member) {
            // Still return work details with a placeholder member so the task can be viewed
            const placeholderMember = {
                name: task.assignee ?? 'Unknown',
                role: 'Team Member',
            };

            return {
                task,
                member: placeholderMember as any,
            };
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
        this.cachedDecisions = null;
    }

    // ─── Public Data Access Methods ───────────────────────────────────────

    /**
     * Discovers squad members by scanning .ai-team/agents/ subdirectories.
     * Reads charter.md from each folder to extract the member's role.
     * Skips special folders (_alumni, scribe).
     *
     * @returns Array of SquadMember with idle status (no log overlay applied)
     */
    private async discoverMembersFromAgentsFolder(): Promise<SquadMember[]> {
        const agentsDir = path.join(this.teamRoot, '.ai-team', 'agents');
        const skipFolders = new Set(['_alumni', 'scribe']);

        try {
            await fs.promises.access(agentsDir, fs.constants.R_OK);
        } catch {
            return [];
        }

        let dirEntries: fs.Dirent[];
        try {
            dirEntries = await fs.promises.readdir(agentsDir, { withFileTypes: true });
        } catch {
            return [];
        }

        const members: SquadMember[] = [];

        for (const entry of dirEntries) {
            if (!entry.isDirectory() || skipFolders.has(entry.name)) {
                continue;
            }

            const folderName = entry.name;
            const displayName = folderName.charAt(0).toUpperCase() + folderName.slice(1);
            let role = 'Squad Member';

            const charterPath = path.join(agentsDir, folderName, 'charter.md');
            try {
                const charterContent = await fs.promises.readFile(charterPath, 'utf-8');
                const roleMatch = charterContent.match(/-\s*\*\*Role:\*\*\s*(.+)/i);
                if (roleMatch) {
                    role = roleMatch[1].trim();
                }
            } catch {
                // No charter.md or unreadable — use default role
            }

            members.push({
                name: displayName,
                role,
                status: 'idle',
            });
        }

        return members;
    }

    /**
     * Returns all parsed orchestration log entries.
     */
    async getLogEntries(): Promise<OrchestrationLogEntry[]> {
        if (this.cachedLogEntries) {
            return this.cachedLogEntries;
        }

        this.cachedLogEntries = await this.orchestrationService.parseAllLogs(this.teamRoot);
        return this.cachedLogEntries;
    }

    /**
     * Returns all active tasks from orchestration logs.
     */
    async getTasks(): Promise<Task[]> {
        if (this.cachedTasks) {
            return this.cachedTasks;
        }

        const entries = await this.getLogEntries();
        this.cachedTasks = this.orchestrationService.getActiveTasks(entries);
        return this.cachedTasks;
    }
}
