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
 * Represents a single decision parsed from decisions.md.
 */
export interface DecisionEntry {
    /** Decision title/heading */
    title: string;
    /** Date of the decision */
    date?: string;
    /** Who made the decision */
    author?: string;
    /** File path to the decisions file for opening */
    filePath: string;
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
}
