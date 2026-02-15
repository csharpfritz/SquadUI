/**
 * Service for watching .ai-team file changes (team roster, charters, decisions,
 * orchestration logs, skills). Uses VS Code's FileSystemWatcher API internally
 * but exposes a testable interface.
 */

import * as vscode from 'vscode';

/** Event types emitted by the file watcher */
export type FileWatcherEventType = 'created' | 'changed' | 'deleted';

/** Event emitted when a watched file changes */
export interface FileWatcherEvent {
    type: FileWatcherEventType;
    uri: vscode.Uri;
    timestamp: Date;
}

/** Callback for file watcher events */
export type FileWatcherCallback = (event: FileWatcherEvent) => void;

/** Interface for cache invalidation integration */
export interface CacheInvalidator {
    invalidate(): void;
}

/**
 * Watches the .ai-team directory for file changes (team.md, charters,
 * decisions, orchestration logs, skills). Debounces rapid changes to
 * prevent thrashing.
 */
export class FileWatcherService implements vscode.Disposable {
    private static readonly DEFAULT_DEBOUNCE_MS = 300;
    private static readonly WATCH_PATTERN = '**/.ai-team/**/*.md';

    private watcher: vscode.FileSystemWatcher | undefined;
    private debounceTimer: NodeJS.Timeout | undefined;
    private pendingEvents: Map<string, FileWatcherEvent> = new Map();
    private callbacks: Set<FileWatcherCallback> = new Set();
    private cacheInvalidators: Set<CacheInvalidator> = new Set();
    private readonly debounceMs: number;
    private disposed = false;

    /**
     * Creates a new FileWatcherService.
     * @param debounceMs - Debounce delay in milliseconds (default: 300ms)
     */
    constructor(debounceMs: number = FileWatcherService.DEFAULT_DEBOUNCE_MS) {
        this.debounceMs = debounceMs;
    }

    /**
     * Starts watching for .ai-team file changes.
     * Safe to call multiple times; subsequent calls are no-ops.
     */
    start(): void {
        if (this.watcher || this.disposed) {
            return;
        }

        this.watcher = vscode.workspace.createFileSystemWatcher(
            FileWatcherService.WATCH_PATTERN,
            false, // Don't ignore creates
            false, // Don't ignore changes
            false  // Don't ignore deletes
        );

        this.watcher.onDidCreate(uri => this.queueEvent('created', uri));
        this.watcher.onDidChange(uri => this.queueEvent('changed', uri));
        this.watcher.onDidDelete(uri => this.queueEvent('deleted', uri));
    }

    /**
     * Stops watching and cleans up resources.
     */
    stop(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = undefined;
        }
        this.pendingEvents.clear();
        
        if (this.watcher) {
            this.watcher.dispose();
            this.watcher = undefined;
        }
    }

    /**
     * Registers a callback to receive file change events.
     * @param callback - Function called when files change (after debouncing)
     * @returns Disposable to unregister the callback
     */
    onFileChange(callback: FileWatcherCallback): vscode.Disposable {
        this.callbacks.add(callback);
        return {
            dispose: () => {
                this.callbacks.delete(callback);
            }
        };
    }

    /**
     * Registers a cache invalidator to be notified on file changes.
     * @param invalidator - Object with invalidate() method
     * @returns Disposable to unregister the invalidator
     */
    registerCacheInvalidator(invalidator: CacheInvalidator): vscode.Disposable {
        this.cacheInvalidators.add(invalidator);
        return {
            dispose: () => {
                this.cacheInvalidators.delete(invalidator);
            }
        };
    }

    /**
     * Returns whether the watcher is currently active.
     */
    isWatching(): boolean {
        return this.watcher !== undefined && !this.disposed;
    }

    /**
     * Disposes the service and all resources.
     * Required for VS Code extension deactivation cleanup.
     */
    dispose(): void {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.stop();
        this.callbacks.clear();
        this.cacheInvalidators.clear();
    }

    // ─── Private Methods ───────────────────────────────────────────────────

    private queueEvent(type: FileWatcherEventType, uri: vscode.Uri): void {
        if (this.disposed) {
            return;
        }

        const event: FileWatcherEvent = {
            type,
            uri,
            timestamp: new Date()
        };

        // Use URI string as key to coalesce multiple events for same file
        this.pendingEvents.set(uri.toString(), event);
        this.scheduleDebouncedFlush();
    }

    private scheduleDebouncedFlush(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this.flushPendingEvents();
        }, this.debounceMs);
    }

    private flushPendingEvents(): void {
        if (this.disposed || this.pendingEvents.size === 0) {
            return;
        }

        const events = Array.from(this.pendingEvents.values());
        this.pendingEvents.clear();
        this.debounceTimer = undefined;

        // Notify all cache invalidators
        for (const invalidator of this.cacheInvalidators) {
            try {
                invalidator.invalidate();
            } catch (error) {
                console.warn('Cache invalidator threw error:', error);
            }
        }

        // Notify all callbacks
        for (const event of events) {
            for (const callback of this.callbacks) {
                try {
                    callback(event);
                } catch (error) {
                    console.warn('File watcher callback threw error:', error);
                }
            }
        }
    }
}
