/**
 * Mock SquadDataProvider for testing tree and webview components.
 */

import { SquadMember, Task, WorkDetails } from '../../models';

export interface MockSquadDataProviderOptions {
    members?: SquadMember[];
    tasks?: Task[];
    workDetails?: Map<string, WorkDetails>;
}

export class MockSquadDataProvider {
    private members: SquadMember[];
    private tasks: Task[];
    private workDetails: Map<string, WorkDetails>;
    private refreshCalled = false;

    constructor(options: MockSquadDataProviderOptions = {}) {
        this.members = options.members ?? [];
        this.tasks = options.tasks ?? [];
        this.workDetails = options.workDetails ?? new Map();
    }

    async getSquadMembers(): Promise<SquadMember[]> {
        return this.members;
    }

    async getTasksForMember(memberId: string): Promise<Task[]> {
        return this.tasks.filter((t) => t.assignee === memberId);
    }

    async getWorkDetails(taskId: string): Promise<WorkDetails | undefined> {
        return this.workDetails.get(taskId);
    }

    refresh(): void {
        this.refreshCalled = true;
    }

    wasRefreshCalled(): boolean {
        return this.refreshCalled;
    }

    resetRefreshFlag(): void {
        this.refreshCalled = false;
    }
}

export function createMockMembers(): SquadMember[] {
    return [
        {
            name: 'Danny',
            role: 'Lead',
            status: 'working',
            currentTask: {
                id: 'task-1',
                title: 'Plan the heist',
                status: 'in_progress',
                assignee: 'Danny',
                startedAt: new Date('2024-01-15T10:00:00Z'),
            },
        },
        {
            name: 'Rusty',
            role: 'Backend Dev',
            status: 'idle',
        },
        {
            name: 'Linus',
            role: 'Extension Dev',
            status: 'working',
            currentTask: {
                id: 'task-2',
                title: 'Build the UI',
                status: 'in_progress',
                assignee: 'Linus',
            },
        },
    ];
}

export function createMockTasks(): Task[] {
    return [
        {
            id: 'task-1',
            title: 'Plan the heist',
            description: 'Create the master plan',
            status: 'in_progress',
            assignee: 'Danny',
            startedAt: new Date('2024-01-15T10:00:00Z'),
        },
        {
            id: 'task-2',
            title: 'Build the UI',
            description: 'Create extension components',
            status: 'in_progress',
            assignee: 'Linus',
        },
        {
            id: 'task-3',
            title: 'Review code',
            status: 'pending',
            assignee: 'Rusty',
        },
        {
            id: 'task-4',
            title: 'Setup database',
            status: 'completed',
            assignee: 'Rusty',
            startedAt: new Date('2024-01-14T09:00:00Z'),
            completedAt: new Date('2024-01-14T17:00:00Z'),
        },
    ];
}

export function createMockWorkDetails(): Map<string, WorkDetails> {
    const members = createMockMembers();
    const tasks = createMockTasks();
    const details = new Map<string, WorkDetails>();

    for (const task of tasks) {
        const member = members.find((m) => m.name === task.assignee);
        if (member) {
            details.set(task.id, { task, member });
        }
    }

    return details;
}
