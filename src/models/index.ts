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
