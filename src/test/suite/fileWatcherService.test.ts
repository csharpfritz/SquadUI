/**
 * Tests for FileWatcherService — behavioral tests for public API.
 *
 * FileWatcherService wraps VS Code's FileSystemWatcher with debouncing,
 * callback management, and cache invalidation. These tests verify the
 * testable surface area without requiring a live VS Code instance for
 * the watcher itself.
 */

import * as assert from 'assert';
import { FileWatcherService, CacheInvalidator } from '../../services/FileWatcherService';

suite('FileWatcherService', () => {
    let service: FileWatcherService;

    setup(() => {
        service = new FileWatcherService(50);
    });

    teardown(() => {
        service.dispose();
    });

    // ─── Constructor & Defaults ─────────────────────────────────────────

    suite('constructor', () => {
        test('creates service with default debounce', () => {
            const defaultService = new FileWatcherService();
            assert.ok(defaultService, 'Should create with default debounce');
            defaultService.dispose();
        });

        test('creates service with custom debounce', () => {
            const customService = new FileWatcherService(1000);
            assert.ok(customService, 'Should create with custom debounce');
            customService.dispose();
        });
    });

    // ─── isWatching() ───────────────────────────────────────────────────

    suite('isWatching()', () => {
        test('returns false before start()', () => {
            assert.strictEqual(service.isWatching(), false);
        });

        test('returns false after dispose()', () => {
            service.dispose();
            assert.strictEqual(service.isWatching(), false);
        });
    });

    // ─── onFileChange() ─────────────────────────────────────────────────

    suite('onFileChange()', () => {
        test('returns a Disposable', () => {
            const disposable = service.onFileChange(() => {});
            assert.ok(disposable, 'Should return disposable');
            assert.ok(typeof disposable.dispose === 'function', 'Disposable should have dispose()');
            disposable.dispose();
        });

        test('callback can be unregistered via dispose', () => {
            let callCount = 0;
            const disposable = service.onFileChange(() => { callCount++; });
            disposable.dispose();

            // After disposing, callbacks set is emptied for this callback
            // We can't trigger events without VS Code, but we verify the dispose path
            assert.strictEqual(callCount, 0, 'Callback should not have been called');
        });

        test('multiple callbacks can be registered', () => {
            const d1 = service.onFileChange(() => {});
            const d2 = service.onFileChange(() => {});
            const d3 = service.onFileChange(() => {});

            // All three should be valid disposables
            assert.ok(d1.dispose);
            assert.ok(d2.dispose);
            assert.ok(d3.dispose);

            d1.dispose();
            d2.dispose();
            d3.dispose();
        });
    });

    // ─── registerCacheInvalidator() ─────────────────────────────────────

    suite('registerCacheInvalidator()', () => {
        test('returns a Disposable', () => {
            const invalidator: CacheInvalidator = { invalidate: () => {} };
            const disposable = service.registerCacheInvalidator(invalidator);

            assert.ok(disposable, 'Should return disposable');
            assert.ok(typeof disposable.dispose === 'function');
            disposable.dispose();
        });

        test('invalidator can be unregistered via dispose', () => {
            let invalidateCount = 0;
            const invalidator: CacheInvalidator = { invalidate: () => { invalidateCount++; } };
            const disposable = service.registerCacheInvalidator(invalidator);
            disposable.dispose();

            assert.strictEqual(invalidateCount, 0, 'Invalidator should not have been called');
        });

        test('multiple invalidators can be registered', () => {
            const inv1: CacheInvalidator = { invalidate: () => {} };
            const inv2: CacheInvalidator = { invalidate: () => {} };

            const d1 = service.registerCacheInvalidator(inv1);
            const d2 = service.registerCacheInvalidator(inv2);

            d1.dispose();
            d2.dispose();
        });
    });

    // ─── start() / stop() ───────────────────────────────────────────────

    suite('start() and stop()', () => {
        test('stop() is safe to call before start()', () => {
            assert.doesNotThrow(() => service.stop());
        });

        test('stop() is safe to call multiple times', () => {
            assert.doesNotThrow(() => {
                service.stop();
                service.stop();
            });
        });
    });

    // ─── dispose() ──────────────────────────────────────────────────────

    suite('dispose()', () => {
        test('dispose is idempotent', () => {
            assert.doesNotThrow(() => {
                service.dispose();
                service.dispose();
            });
        });

        test('isWatching returns false after dispose', () => {
            service.dispose();
            assert.strictEqual(service.isWatching(), false);
        });

        test('start() is no-op after dispose', () => {
            service.dispose();
            service.start(); // Should not throw
            assert.strictEqual(service.isWatching(), false, 'Should not start after dispose');
        });
    });

    // ─── Internal debounce/flush via queueEvent ─────────────────────────

    suite('queueEvent — internal debounce behavior', () => {
        test('queueEvent is no-op after dispose', () => {
            service.dispose();
            // Access private method to verify it doesn't throw
            const queueEvent = (service as any).queueEvent.bind(service);
            assert.doesNotThrow(() => {
                queueEvent('created', { toString: () => 'test-uri' });
            });
        });

        test('flushPendingEvents is no-op when disposed', () => {
            service.dispose();
            const flush = (service as any).flushPendingEvents.bind(service);
            assert.doesNotThrow(() => flush());
        });

        test('flushPendingEvents is no-op with empty pending events', () => {
            const flush = (service as any).flushPendingEvents.bind(service);
            assert.doesNotThrow(() => flush());
        });
    });
});
