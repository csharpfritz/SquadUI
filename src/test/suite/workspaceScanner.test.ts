/**
 * Tests for WorkspaceScanner service.
 * Validates multi-workspace detection and scanning.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { WorkspaceScanner } from '../../services/WorkspaceScanner';

suite('WorkspaceScanner', () => {
    let tempDirs: string[] = [];

    function createTempWorkspace(name: string, squadFolder: '.squad' | '.ai-team', withTeam: boolean): string {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), `squadui-test-${name}-`));
        tempDirs.push(dir);
        const squadDir = path.join(dir, squadFolder);
        fs.mkdirSync(squadDir, { recursive: true });
        if (withTeam) {
            fs.writeFileSync(path.join(squadDir, 'team.md'), '# Team\n| Member | Role |\n|---|---|\n| Alice | Dev |');
        }
        return dir;
    }

    teardown(() => {
        for (const dir of tempDirs) {
            try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
        }
        tempDirs = [];
    });

    suite('scanWorkspaces', () => {
        test('returns empty array when no folders have squad directories', () => {
            const scanner = new WorkspaceScanner();
            const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'squadui-test-empty-'));
            tempDirs.push(emptyDir);
            const result = scanner.scanWorkspaces([emptyDir]);
            assert.strictEqual(result.length, 0);
        });

        test('detects single workspace with .ai-team folder', () => {
            const scanner = new WorkspaceScanner();
            const dir = createTempWorkspace('alpha', '.ai-team', true);
            const result = scanner.scanWorkspaces([dir]);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].squadFolder, '.ai-team');
            assert.strictEqual(result[0].hasTeam, true);
            assert.strictEqual(result[0].rootPath, dir);
        });

        test('detects single workspace with .squad folder', () => {
            const scanner = new WorkspaceScanner();
            const dir = createTempWorkspace('beta', '.squad', false);
            const result = scanner.scanWorkspaces([dir]);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].squadFolder, '.squad');
            assert.strictEqual(result[0].hasTeam, false);
        });

        test('detects multiple workspaces across folder paths', () => {
            const scanner = new WorkspaceScanner();
            const dir1 = createTempWorkspace('ws1', '.ai-team', true);
            const dir2 = createTempWorkspace('ws2', '.squad', true);
            const dir3 = createTempWorkspace('ws3', '.ai-team', false);
            const result = scanner.scanWorkspaces([dir1, dir2, dir3]);
            assert.strictEqual(result.length, 3);
        });

        test('skips folders without squad directories', () => {
            const scanner = new WorkspaceScanner();
            const squadDir = createTempWorkspace('squad', '.ai-team', true);
            const plainDir = fs.mkdtempSync(path.join(os.tmpdir(), 'squadui-test-plain-'));
            tempDirs.push(plainDir);
            const result = scanner.scanWorkspaces([squadDir, plainDir]);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].rootPath, squadDir);
        });

        test('uses folder basename as workspace name', () => {
            const scanner = new WorkspaceScanner();
            const dir = createTempWorkspace('my-project', '.ai-team', true);
            const result = scanner.scanWorkspaces([dir]);
            assert.ok(result[0].name.startsWith('squadui-test-my-project-'));
        });
    });

    suite('isMultiWorkspace', () => {
        test('returns false for empty array', () => {
            const scanner = new WorkspaceScanner();
            assert.strictEqual(scanner.isMultiWorkspace([]), false);
        });

        test('returns false for single workspace', () => {
            const scanner = new WorkspaceScanner();
            const dir = createTempWorkspace('solo', '.ai-team', true);
            const workspaces = scanner.scanWorkspaces([dir]);
            assert.strictEqual(scanner.isMultiWorkspace(workspaces), false);
        });

        test('returns true for multiple workspaces', () => {
            const scanner = new WorkspaceScanner();
            const dir1 = createTempWorkspace('multi1', '.ai-team', true);
            const dir2 = createTempWorkspace('multi2', '.squad', true);
            const workspaces = scanner.scanWorkspaces([dir1, dir2]);
            assert.strictEqual(scanner.isMultiWorkspace(workspaces), true);
        });
    });
});
