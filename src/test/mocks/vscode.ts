/**
 * Mock implementations for VS Code API used in tests.
 */

export class MockEventEmitter<T> {
    private listeners: Array<(e: T) => void> = [];

    event = (listener: (e: T) => void): { dispose: () => void } => {
        this.listeners.push(listener);
        return {
            dispose: () => {
                const index = this.listeners.indexOf(listener);
                if (index >= 0) {
                    this.listeners.splice(index, 1);
                }
            },
        };
    };

    fire(data: T): void {
        this.listeners.forEach((listener) => listener(data));
    }

    dispose(): void {
        this.listeners = [];
    }
}

export class MockUri {
    constructor(
        public readonly scheme: string,
        public readonly path: string,
        public readonly fsPath: string = path
    ) {}

    static file(path: string): MockUri {
        return new MockUri('file', path, path);
    }
}

export class MockTreeItem {
    public label: string;
    public collapsibleState: number;
    public contextValue?: string;
    public iconPath?: MockThemeIcon;
    public description?: string;
    public tooltip?: MockMarkdownString;
    public command?: MockCommand;

    constructor(
        label: string,
        collapsibleState: number
    ) {
        this.label = label;
        this.collapsibleState = collapsibleState;
    }
}

export class MockThemeIcon {
    constructor(public readonly id: string) {}
}

export class MockMarkdownString {
    private content = '';

    appendMarkdown(value: string): MockMarkdownString {
        this.content += value;
        return this;
    }

    toString(): string {
        return this.content;
    }
}

export interface MockCommand {
    command: string;
    title: string;
    arguments?: unknown[];
}

export const TreeItemCollapsibleState = {
    None: 0,
    Collapsed: 1,
    Expanded: 2,
};

export const ViewColumn = {
    One: 1,
    Two: 2,
};

export class MockWebviewPanel {
    public title = '';
    public webview = {
        html: '',
    };
    private disposeCallback?: () => void;

    constructor(
        public readonly viewType: string,
        _title: string,
        _viewColumn: number,
        _options: unknown
    ) {}

    reveal(_viewColumn?: number): void {
        // Mock reveal
    }

    onDidDispose(callback: () => void): void {
        this.disposeCallback = callback;
    }

    dispose(): void {
        this.disposeCallback?.();
    }
}

export const mockWindow = {
    createWebviewPanel: (
        viewType: string,
        title: string,
        viewColumn: number,
        options: unknown
    ): MockWebviewPanel => {
        return new MockWebviewPanel(viewType, title, viewColumn, options);
    },
    showInformationMessage: (_message: string): void => {},
    showWarningMessage: (_message: string): void => {},
};

export const mockCommands = {
    registeredCommands: new Map<string, (...args: unknown[]) => unknown>(),
    registerCommand: (
        command: string,
        callback: (...args: unknown[]) => unknown
    ): { dispose: () => void } => {
        mockCommands.registeredCommands.set(command, callback);
        return {
            dispose: () => {
                mockCommands.registeredCommands.delete(command);
            },
        };
    },
    executeCommand: async (command: string, ...args: unknown[]): Promise<unknown> => {
        const handler = mockCommands.registeredCommands.get(command);
        if (handler) {
            return handler(...args);
        }
        return undefined;
    },
};
