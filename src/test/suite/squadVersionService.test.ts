/**
 * Tests for SquadVersionService — version check, caching, and error handling.
 *
 * SquadVersionService:
 *   - checkForUpgrade() → cached UpgradeCheckResult after first call
 *   - forceCheck() → always re-fetches (bypasses cache)
 *   - resetCache() → clears cache so next checkForUpgrade() re-fetches
 *   - Private: isNewer(), normalizeVersion(), getLatestVersion(), getInstalledVersion()
 *
 * We test internal methods via (service as any) for pure logic (isNewer, normalizeVersion),
 * and test checkForUpgrade()/forceCheck() by stubbing the network+exec internals.
 */

import * as assert from 'assert';
import { SquadVersionService } from '../../services/SquadVersionService';

suite('SquadVersionService', () => {
    let service: SquadVersionService;

    setup(() => {
        service = new SquadVersionService();
    });

    // ─── Version Comparison (isNewer) ──────────────────────────────────────

    suite('isNewer() — semver comparison', () => {
        let isNewer: (latest: string, current: string) => boolean;

        setup(() => {
            isNewer = (service as any).isNewer.bind(service);
        });

        test('returns false when versions are identical', () => {
            assert.strictEqual(isNewer('1.2.3', '1.2.3'), false);
        });

        test('returns true when latest major is greater', () => {
            assert.strictEqual(isNewer('2.0.0', '1.0.0'), true);
        });

        test('returns true when latest minor is greater', () => {
            assert.strictEqual(isNewer('1.3.0', '1.2.0'), true);
        });

        test('returns true when latest patch is greater', () => {
            assert.strictEqual(isNewer('1.2.4', '1.2.3'), true);
        });

        test('returns false when current is ahead (major)', () => {
            assert.strictEqual(isNewer('1.0.0', '2.0.0'), false);
        });

        test('returns false when current is ahead (minor)', () => {
            assert.strictEqual(isNewer('1.2.0', '1.3.0'), false);
        });

        test('returns false when current is ahead (patch)', () => {
            assert.strictEqual(isNewer('1.2.3', '1.2.4'), false);
        });

        test('handles versions with different segment counts (1.0 vs 1.0.0)', () => {
            // Missing segment treated as 0
            assert.strictEqual(isNewer('1.0', '1.0.0'), false);
            assert.strictEqual(isNewer('1.0.0', '1.0'), false);
        });

        test('handles single-segment versions', () => {
            assert.strictEqual(isNewer('2', '1'), true);
            assert.strictEqual(isNewer('1', '2'), false);
            assert.strictEqual(isNewer('1', '1'), false);
        });

        test('handles four-segment versions', () => {
            assert.strictEqual(isNewer('1.0.0.1', '1.0.0.0'), true);
            assert.strictEqual(isNewer('1.0.0.0', '1.0.0.1'), false);
        });

        test('0.x versions compare correctly', () => {
            assert.strictEqual(isNewer('0.2.0', '0.1.0'), true);
            assert.strictEqual(isNewer('0.1.0', '0.2.0'), false);
        });
    });

    // ─── normalizeVersion ──────────────────────────────────────────────────

    suite('normalizeVersion() — v-prefix stripping', () => {
        let normalizeVersion: (version: string) => string;

        setup(() => {
            normalizeVersion = (service as any).normalizeVersion.bind(service);
        });

        test('strips lowercase v prefix', () => {
            assert.strictEqual(normalizeVersion('v1.2.3'), '1.2.3');
        });

        test('strips uppercase V prefix', () => {
            assert.strictEqual(normalizeVersion('V1.2.3'), '1.2.3');
        });

        test('does not strip v from middle of string', () => {
            assert.strictEqual(normalizeVersion('1.v2.3'), '1.v2.3');
        });

        test('handles version without v prefix', () => {
            assert.strictEqual(normalizeVersion('1.2.3'), '1.2.3');
        });

        test('trims whitespace but v-strip requires v at start', () => {
            // Leading spaces prevent ^v match, so v stays after trim
            assert.strictEqual(normalizeVersion('  v1.2.3  '), 'v1.2.3');
            // But v at actual start with trailing space works
            assert.strictEqual(normalizeVersion('v1.2.3  '), '1.2.3');
        });
    });

    // ─── Caching Behavior ─────────────────────────────────────────────────

    suite('Caching', () => {
        test('checkForUpgrade() returns cached result on second call', async () => {
            let fetchCount = 0;

            // Stub both internal methods to track calls
            (service as any).getLatestVersion = async () => {
                fetchCount++;
                return '2.0.0';
            };
            (service as any).getInstalledVersion = async () => '1.0.0';

            const first = await service.checkForUpgrade();
            assert.strictEqual(first.available, true);
            assert.strictEqual(fetchCount, 1, 'should fetch on first call');

            const second = await service.checkForUpgrade();
            assert.strictEqual(second.available, true);
            assert.strictEqual(fetchCount, 1, 'should NOT fetch on second call (cached)');

            // Results should be the same object reference
            assert.strictEqual(first, second, 'cached result should be same reference');
        });

        test('checkForUpgrade() returns cached false result too', async () => {
            let fetchCount = 0;

            (service as any).getLatestVersion = async () => {
                fetchCount++;
                return '1.0.0';
            };
            (service as any).getInstalledVersion = async () => '1.0.0';

            const first = await service.checkForUpgrade();
            assert.strictEqual(first.available, false, 'same version → no upgrade');

            await service.checkForUpgrade();
            assert.strictEqual(fetchCount, 1, 'should NOT re-fetch for cached false result');
        });

        test('resetCache() causes next checkForUpgrade() to re-fetch', async () => {
            let fetchCount = 0;

            (service as any).getLatestVersion = async () => {
                fetchCount++;
                return '2.0.0';
            };
            (service as any).getInstalledVersion = async () => '1.0.0';

            await service.checkForUpgrade();
            assert.strictEqual(fetchCount, 1);

            service.resetCache();
            await service.checkForUpgrade();
            assert.strictEqual(fetchCount, 2, 'should re-fetch after resetCache()');
        });
    });

    // ─── forceCheck() ─────────────────────────────────────────────────────

    suite('forceCheck() — bypass cache', () => {
        test('forceCheck() always re-fetches even when cached', async () => {
            let fetchCount = 0;

            (service as any).getLatestVersion = async () => {
                fetchCount++;
                return '2.0.0';
            };
            (service as any).getInstalledVersion = async () => '1.0.0';

            await service.checkForUpgrade();
            assert.strictEqual(fetchCount, 1);

            await service.forceCheck();
            assert.strictEqual(fetchCount, 2, 'forceCheck should fetch again');

            await service.forceCheck();
            assert.strictEqual(fetchCount, 3, 'forceCheck should ALWAYS fetch');
        });

        test('forceCheck() updates cached result for subsequent checkForUpgrade()', async () => {
            let latestVersion = '1.0.0';

            (service as any).getLatestVersion = async () => latestVersion;
            (service as any).getInstalledVersion = async () => '1.0.0';

            const first = await service.checkForUpgrade();
            assert.strictEqual(first.available, false, 'initially no upgrade');

            // Simulate new release
            latestVersion = '2.0.0';
            const forced = await service.forceCheck();
            assert.strictEqual(forced.available, true, 'forceCheck picks up new version');

            // Subsequent cached call should return the updated result
            const cached = await service.checkForUpgrade();
            assert.strictEqual(cached.available, true, 'cached result updated by forceCheck');
        });
    });

    // ─── Graceful Error Handling ──────────────────────────────────────────

    suite('Error handling — always returns { available: false }', () => {
        test('returns { available: false } when GitHub API fails', async () => {
            (service as any).getLatestVersion = async (): Promise<string | undefined> => undefined;
            (service as any).getInstalledVersion = async () => '1.0.0';

            const result = await service.checkForUpgrade();
            assert.strictEqual(result.available, false);
        });

        test('returns { available: false } when CLI is not installed', async () => {
            (service as any).getLatestVersion = async () => '2.0.0';
            (service as any).getInstalledVersion = async (): Promise<string | undefined> => undefined;

            const result = await service.checkForUpgrade();
            assert.strictEqual(result.available, false);
        });

        test('returns { available: false } when both fail', async () => {
            (service as any).getLatestVersion = async (): Promise<string | undefined> => undefined;
            (service as any).getInstalledVersion = async (): Promise<string | undefined> => undefined;

            const result = await service.checkForUpgrade();
            assert.strictEqual(result.available, false);
        });

        test('returns { available: false } when getLatestVersion throws', async () => {
            (service as any).getLatestVersion = async () => { throw new Error('network timeout'); };
            (service as any).getInstalledVersion = async () => '1.0.0';

            const result = await service.checkForUpgrade();
            assert.strictEqual(result.available, false);
        });

        test('returns { available: false } when getInstalledVersion throws', async () => {
            (service as any).getLatestVersion = async () => '2.0.0';
            (service as any).getInstalledVersion = async () => { throw new Error('exec failed'); };

            const result = await service.checkForUpgrade();
            assert.strictEqual(result.available, false);
        });

        test('returns { available: false } when both throw', async () => {
            (service as any).getLatestVersion = async () => { throw new Error('boom'); };
            (service as any).getInstalledVersion = async () => { throw new Error('crash'); };

            const result = await service.checkForUpgrade();
            assert.strictEqual(result.available, false);
        });

        test('includes version info when only one side fails', async () => {
            (service as any).getLatestVersion = async () => '2.0.0';
            (service as any).getInstalledVersion = async (): Promise<string | undefined> => undefined;

            const result = await service.checkForUpgrade();
            assert.strictEqual(result.available, false);
            assert.strictEqual(result.latestVersion, '2.0.0');
            assert.strictEqual(result.currentVersion, undefined);
        });
    });

    // ─── Result Shape ────────────────────────────────────────────────────

    suite('UpgradeCheckResult shape', () => {
        test('includes currentVersion and latestVersion when upgrade available', async () => {
            (service as any).getLatestVersion = async () => '2.0.0';
            (service as any).getInstalledVersion = async () => '1.5.0';

            const result = await service.checkForUpgrade();
            assert.strictEqual(result.available, true);
            assert.strictEqual(result.currentVersion, '1.5.0');
            assert.strictEqual(result.latestVersion, '2.0.0');
        });

        test('includes versions when no upgrade available', async () => {
            (service as any).getLatestVersion = async () => '1.0.0';
            (service as any).getInstalledVersion = async () => '1.0.0';

            const result = await service.checkForUpgrade();
            assert.strictEqual(result.available, false);
            assert.strictEqual(result.currentVersion, '1.0.0');
            assert.strictEqual(result.latestVersion, '1.0.0');
        });
    });

    // ─── package.json Validation ──────────────────────────────────────────

    suite('package.json configuration', () => {
        let packageJson: any;

        setup(() => {
            const fs = require('fs');
            const path = require('path');
            const pkgPath = path.resolve(__dirname, '../../../package.json');
            packageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        });

        test('squadui.checkForUpdates command is declared with category "Squad"', () => {
            const commands: any[] = packageJson.contributes.commands;
            const cmd = commands.find((c: any) => c.command === 'squadui.checkForUpdates');
            assert.ok(cmd, 'squadui.checkForUpdates should be declared in package.json');
            assert.strictEqual(cmd.category, 'Squad', 'category should be "Squad"');
        });

        test('upgrade button when-clause includes squadui.upgradeAvailable', () => {
            const menus = packageJson.contributes.menus;
            const titleMenus: any[] = menus['view/title'];
            const upgradeMenu = titleMenus.find(
                (m: any) => m.command === 'squadui.upgradeSquad'
            );
            assert.ok(upgradeMenu, 'upgradeSquad should be in view/title menus');
            assert.ok(
                upgradeMenu.when.includes('squadui.upgradeAvailable'),
                `when clause should include squadui.upgradeAvailable, got: "${upgradeMenu.when}"`
            );
        });
    });
});
