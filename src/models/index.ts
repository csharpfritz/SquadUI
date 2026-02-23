/**
 * Data models for SquadUI VS Code extension.
 * These interfaces define the structure for squad members, tasks, and orchestration logs.
 */

/**
 * Status of a squad member in the current session.
 * - 'working': Currently executing a task
 * - 'idle': Available, no active task
 */
export type MemberStatus = 'working' | 'idle';

/**
 * Status of a task in the workflow.
 * - 'pending': Task created but not started
 * - 'in_progress': Task is being worked on
 * - 'completed': Task finished successfully
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

/**
 * Represents a task assigned to a squad member.
 */
export interface Task {
    /** Unique identifier for the task (e.g., issue number, slug) */
    id: string;

    /** Short title describing the task */
    title: string;

    /** Optional detailed description of the task */
    description?: string;

    /** Current status of the task */
    status: TaskStatus;

    /** Name of the squad member assigned to this task */
    assignee: string;

    /** When the task was started (ISO 8601 or Date object) */
    startedAt?: Date;

    /** When the task was completed (ISO 8601 or Date object) */
    completedAt?: Date;
}

/**
 * Represents a squad member from team.md.
 */
export interface SquadMember {
    /** Display name of the member (e.g., "Danny", "Rusty") */
    name: string;

    /** Role in the squad (e.g., "Lead", "Extension Dev", "Backend Dev") */
    role: string;

    /** Current working status */
    status: MemberStatus;

    /** The task currently being worked on, if any */
    currentTask?: Task;
}

/**
 * A single entry in the orchestration log.
 * Logs are stored in `.ai-team/log/{YYYY-MM-DD}-{topic}.md`.
 * This interface captures the structure of session log entries.
 */
export interface OrchestrationLogEntry {
    /** ISO 8601 timestamp of when this entry was logged */
    timestamp: string;

    /** Date of the session (YYYY-MM-DD format) */
    date: string;

    /** Topic/slug for the session (used in filename) */
    topic: string;

    /** List of squad members who worked during this session */
    participants: string[];

    /** Summary of what was accomplished */
    summary: string;

    /** Decisions made during the session */
    decisions?: string[];

    /** Key outcomes or artifacts produced */
    outcomes?: string[];

    /** Related GitHub issue numbers, if any */
    relatedIssues?: string[];

    /** Parsed "What Was Done" items: agent-attributed work descriptions */
    whatWasDone?: { agent: string; description: string }[];
}

/**
 * Combined view model for displaying work details in the webview.
 * Provides all context needed to render a task and its assigned member.
 */
export interface WorkDetails {
    /** The task being displayed */
    task: Task;

    /** The squad member assigned to the task */
    member: SquadMember;

    /** Related orchestration log entries for context */
    logEntries?: OrchestrationLogEntry[];
}

/**
 * Parsed representation of the team roster from team.md.
 * Used by services to load and track team state.
 */
export interface TeamRoster {
    /** All squad members parsed from team.md */
    members: SquadMember[];

    /** Repository info from the Issue Source section */
    repository?: string;

    /** Project owner name */
    owner?: string;
}

// ─── Decision Entry Models ─────────────────────────────────────────────────

/**
 * Represents a single decision parsed from decisions.md or individual decision files.
 */
export interface DecisionEntry {
    /** Decision title/heading */
    title: string;
    /** Date of the decision */
    date?: string;
    /** Who made the decision */
    author?: string;
    /** Full markdown content of the decision section */
    content?: string;
    /** File path to the decisions file for opening */
    filePath: string;
    /** Line number (0-based) of the heading in decisions.md */
    lineNumber?: number;
}

// ─── Skill Catalog Models ──────────────────────────────────────────────────

/**
 * Represents a skill available for import or already installed.
 */
export interface Skill {
    /** Display name of the skill */
    name: string;

    /** Short description of what the skill does */
    description: string;

    /** Where this skill was discovered */
    source: 'awesome-copilot' | 'skills.sh' | 'local';

    /** URL to the skill's source (GitHub repo, skills.sh page, etc.) */
    url?: string;

    /** How confident we are in the parsed data quality */
    confidence?: 'low' | 'medium' | 'high';

    /** Raw skill content (markdown body), populated on download */
    content?: string;

    /** Directory slug used for filesystem lookup (set for installed skills) */
    slug?: string;
}

// ─── GitHub Issues Models ──────────────────────────────────────────────────

/**
 * A GitHub issue label.
 */
export interface GitHubLabel {
    /** Label name (e.g., "squad:linus", "enhancement") */
    name: string;

    /** Hex color code without # prefix */
    color?: string;
}

/**
 * A GitHub milestone.
 */
export interface GitHubMilestone {
    /** Milestone number */
    number: number;
    /** Milestone title (e.g., "v0.7.0") */
    title: string;
    /** Current state */
    state: 'open' | 'closed';
    /** Number of open issues */
    openIssues: number;
    /** Number of closed issues */
    closedIssues: number;
    /** Optional due date (ISO 8601) */
    dueOn?: string;
    /** Creation timestamp (ISO 8601) */
    createdAt: string;
}

/**
 * A GitHub issue fetched from the repository.
 */
export interface GitHubIssue {
    /** Issue number */
    number: number;

    /** Issue title */
    title: string;

    /** Issue body (markdown) */
    body?: string;

    /** Current state: open or closed */
    state: 'open' | 'closed';

    /** Labels attached to the issue */
    labels: GitHubLabel[];

    /** GitHub username of the assignee, if any */
    assignee?: string;

    /** HTML URL to view the issue on GitHub */
    htmlUrl: string;

    /** ISO 8601 creation timestamp */
    createdAt: string;

    /** ISO 8601 last-updated timestamp */
    updatedAt: string;

    /** ISO 8601 closed timestamp, if closed */
    closedAt?: string;

    /** Milestone this issue belongs to, if any */
    milestone?: GitHubMilestone;
}

/**
 * Configuration for the Issue Source, parsed from team.md.
 */
export interface IssueSourceConfig {
    /** Repository in "owner/repo" format */
    repository: string;

    /** Owner portion of the repository */
    owner: string;

    /** Repo name portion */
    repo: string;

    /** Filter string from team.md (e.g., "all open") */
    filters?: string;

    /** Which matching strategies to use (default: all strategies) */
    matching?: string[];

    /** Map of squad member name → GitHub username for assignee matching */
    memberAliases?: Map<string, string>;

    /** Manual upstream repository override from team.md ("owner/repo" format) */
    upstream?: string;
}

// ─── GitHub Issues Service Contract ────────────────────────────────────────

/**
 * Maps squad member names to their assigned GitHub issues.
 * Key is the member name (matching SquadMember.name),
 * value is the array of issues assigned to that member.
 */
export type MemberIssueMap = Map<string, GitHubIssue[]>;

/**
 * Contract for a service that provides GitHub issues mapped to squad members.
 * GitHubIssuesService (#18) implements this interface.
 */
export interface IGitHubIssuesService {
    /**
     * Returns open issues mapped to squad members by label convention (squad:{name}).
     * @param workspaceRoot - Workspace root for reading issue source config
     */
    getIssuesByMember(workspaceRoot: string): Promise<MemberIssueMap>;

    /**
     * Returns recently closed issues mapped to squad members by label convention (squad:{name}).
     * @param workspaceRoot - Workspace root for reading issue source config
     */
    getClosedIssuesByMember(workspaceRoot: string): Promise<MemberIssueMap>;

    /**
     * Fetches all recently closed issues (unfiltered by member).
     * Used for velocity chart to count ALL closed work, not just member-matched.
     */
    getClosedIssues(workspaceRoot: string): Promise<GitHubIssue[]>;

    /**
     * Fetches all issues (open + closed) for a specific milestone.
     * Used to build burndown charts.
     */
    getMilestoneIssues(workspaceRoot: string, milestoneNumber: number): Promise<GitHubIssue[]>;

    /**
     * Fetches available milestones from the repository.
     */
    getMilestones(workspaceRoot: string): Promise<GitHubMilestone[]>;
}

// ─── Dashboard Models ───────────────────────────────────────────────────────

/**
 * A single data point in the velocity timeline chart.
 */
export interface VelocityDataPoint {
    /** Date in YYYY-MM-DD format */
    date: string;
    /** Number of tasks completed on this date */
    completedTasks: number;
}

/**
 * Team health heatmap data for a squad member.
 */
export interface ActivityHeatmapPoint {
    /** Squad member name */
    member: string;
    /** Activity level: 0.0 (idle) to 1.0 (fully active) */
    activityLevel: number;
}

/**
 * A task positioned on the activity timeline.
 */
export interface TimelineTask {
    /** Task ID */
    id: string;
    /** Task title */
    title: string;
    /** Start date in YYYY-MM-DD format */
    startDate: string;
    /** End date in YYYY-MM-DD format, or null if in progress */
    endDate: string | null;
    /** Task status */
    status: TaskStatus;
}

/**
 * A swimlane showing one member's tasks on the activity timeline.
 */
export interface ActivitySwimlane {
    /** Squad member name */
    member: string;
    /** Role of the member */
    role: string;
    /** Tasks for this member, sorted by start date */
    tasks: TimelineTask[];
}

/**
 * Overview data for a single team member on the Team dashboard tab.
 */
export interface TeamMemberOverview {
    /** Display name */
    name: string;
    /** Role in the squad */
    role: string;
    /** Current status */
    status: MemberStatus;
    /** Special icon type (scribe, ralph, copilot, or undefined for regular members) */
    iconType?: 'scribe' | 'ralph' | 'copilot';
    /** Number of open issues assigned */
    openIssueCount: number;
    /** Number of closed issues assigned */
    closedIssueCount: number;
    /** Number of in-progress tasks */
    activeTaskCount: number;
    /** Recent log participation count (last 7 days) */
    recentActivityCount: number;
}

/**
 * Summary statistics for the whole team.
 */
export interface TeamSummary {
    /** Total members on the roster */
    totalMembers: number;
    /** Members currently working */
    activeMembers: number;
    /** Total open issues across all members */
    totalOpenIssues: number;
    /** Total closed issues across all members */
    totalClosedIssues: number;
    /** Total in-progress tasks */
    totalActiveTasks: number;
}

// ─── Burndown Chart Models ──────────────────────────────────────────────────

/**
 * A single data point on the burndown chart.
 * Each point captures the remaining open issues on a given date,
 * broken down by assigned squad member.
 */
export interface BurndownDataPoint {
    /** Date in YYYY-MM-DD format */
    date: string;
    /** Total remaining open issues on this date */
    remaining: number;
    /** Per-member breakdown: member name → open issues count on this date */
    byMember: Record<string, number>;
}

/**
 * Complete burndown data for one milestone.
 */
export interface MilestoneBurndown {
    /** Milestone title */
    title: string;
    /** Milestone number */
    number: number;
    /** Total issues in the milestone */
    totalIssues: number;
    /** Names of members who have issues in this milestone (stable ordering) */
    memberNames: string[];
    /** Hex colors assigned to each member (parallel array with memberNames) */
    memberColors: string[];
    /** Daily burndown data points */
    dataPoints: BurndownDataPoint[];
    /** Due date if set (YYYY-MM-DD) */
    dueDate?: string;
}

/**
 * Complete data bundle for the dashboard webview.
 */
export interface DashboardData {
    /** Team overview tab data */
    team: {
        /** Per-member overview */
        members: TeamMemberOverview[];
        /** Aggregate team stats */
        summary: TeamSummary;
    };
    /** Burndown chart tab data */
    burndown: {
        /** Available milestones with burndown data */
        milestones: MilestoneBurndown[];
    };
    /** Velocity tab data */
    velocity: {
        /** Timeline of completed tasks per day */
        timeline: VelocityDataPoint[];
        /** Current team health heatmap */
        heatmap: ActivityHeatmapPoint[];
    };
    /** Activity timeline tab data */
    activity: {
        /** Swimlanes, one per member */
        swimlanes: ActivitySwimlane[];
        /** Recent orchestration log entries */
        recentLogs: OrchestrationLogEntry[];
    };
    /** Decision browser tab data */
    decisions: {
        /** All parsed decision entries */
        entries: DecisionEntry[];
    };
}
