/**
 * Tests for squadFolderDetection utility.
 * Verifies support for both .squad and .ai-team folder structures.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { detectSquadFolder, getSquadFolderName, getSquadPath, hasSquadTeam, getSquadWatchPattern } from '../../utils/squadFolderDetection';

suite('squadFolderDetection', () => {
    let tempDir: string;

    setup(() => {
        // Create a unique temp directory for each test
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'squadui-test-'));
    });

    teardown(() => {
        // Clean up temp directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    suite('detectSquadFolder', () => {
        test('returns null when neither folder exists', () => {
            const result = detectSquadFolder(tempDir);
            assert.strictEqual(result, null);
        });

        test('returns .ai-team when only legacy folder exists', () => {
            const legacyDir = path.join(tempDir, '.ai-team');
            fs.mkdirSync(legacyDir);
            
            const result = detectSquadFolder(tempDir);
            assert.strictEqual(result, '.ai-team');
        });

        test('returns .squad when only new folder exists', () => {
            const newDir = path.join(tempDir, '.squad');
            fs.mkdirSync(newDir);
            
            const result = detectSquadFolder(tempDir);
            assert.strictEqual(result, '.squad');
        });

        test('returns .squad when both folders exist (prefers new)', () => {
            const legacyDir = path.join(tempDir, '.ai-team');
            const newDir = path.join(tempDir, '.squad');
            fs.mkdirSync(legacyDir);
            fs.mkdirSync(newDir);
            
            const result = detectSquadFolder(tempDir);
            assert.strictEqual(result, '.squad');
        });
    });

    suite('getSquadFolderName', () => {
        test('returns .squad when neither folder exists (defaults to new)', () => {
            const result = getSquadFolderName(tempDir);
            assert.strictEqual(result, '.squad');
        });

        test('returns .ai-team when only legacy folder exists', () => {
            const legacyDir = path.join(tempDir, '.ai-team');
            fs.mkdirSync(legacyDir);
            
            const result = getSquadFolderName(tempDir);
            assert.strictEqual(result, '.ai-team');
        });

        test('returns .squad when only new folder exists', () => {
            const newDir = path.join(tempDir, '.squad');
            fs.mkdirSync(newDir);
            
            const result = getSquadFolderName(tempDir);
            assert.strictEqual(result, '.squad');
        });

        test('returns .squad when both folders exist', () => {
            const legacyDir = path.join(tempDir, '.ai-team');
            const newDir = path.join(tempDir, '.squad');
            fs.mkdirSync(legacyDir);
            fs.mkdirSync(newDir);
            
            const result = getSquadFolderName(tempDir);
            assert.strictEqual(result, '.squad');
        });
    });

    suite('getSquadPath', () => {
        test('constructs path with .squad when new folder exists', () => {
            const newDir = path.join(tempDir, '.squad');
            fs.mkdirSync(newDir);
            
            const result = getSquadPath(tempDir, 'team.md');
            const expected = path.join(tempDir, '.squad', 'team.md');
            assert.strictEqual(result, expected);
        });

        test('constructs path with .ai-team when only legacy folder exists', () => {
            const legacyDir = path.join(tempDir, '.ai-team');
            fs.mkdirSync(legacyDir);
            
            const result = getSquadPath(tempDir, 'team.md');
            const expected = path.join(tempDir, '.ai-team', 'team.md');
            assert.strictEqual(result, expected);
        });

        test('constructs nested paths correctly', () => {
            const newDir = path.join(tempDir, '.squad');
            fs.mkdirSync(newDir);
            
            const result = getSquadPath(tempDir, path.join('agents', 'rusty', 'charter.md'));
            const expected = path.join(tempDir, '.squad', 'agents', 'rusty', 'charter.md');
            assert.strictEqual(result, expected);
        });

        test('handles empty relative path', () => {
            const newDir = path.join(tempDir, '.squad');
            fs.mkdirSync(newDir);
            
            const result = getSquadPath(tempDir, '');
            const expected = path.join(tempDir, '.squad');
            assert.strictEqual(result, expected);
        });

        test('defaults to .squad when neither folder exists', () => {
            const result = getSquadPath(tempDir, 'team.md');
            const expected = path.join(tempDir, '.squad', 'team.md');
            assert.strictEqual(result, expected);
        });
    });

    suite('hasSquadTeam', () => {
        test('returns false when no squad folder exists', () => {
            const result = hasSquadTeam(tempDir);
            assert.strictEqual(result, false);
        });

        test('returns false when squad folder exists but no team.md', () => {
            const newDir = path.join(tempDir, '.squad');
            fs.mkdirSync(newDir);
            
            const result = hasSquadTeam(tempDir);
            assert.strictEqual(result, false);
        });

        test('returns true when team.md exists in .squad', () => {
            const newDir = path.join(tempDir, '.squad');
            fs.mkdirSync(newDir);
            fs.writeFileSync(path.join(newDir, 'team.md'), '# Team');
            
            const result = hasSquadTeam(tempDir);
            assert.strictEqual(result, true);
        });

        test('returns true when team.md exists in .ai-team', () => {
            const legacyDir = path.join(tempDir, '.ai-team');
            fs.mkdirSync(legacyDir);
            fs.writeFileSync(path.join(legacyDir, 'team.md'), '# Team');
            
            const result = hasSquadTeam(tempDir);
            assert.strictEqual(result, true);
        });

        test('returns true when team.md exists in both folders (prefers .squad)', () => {
            const legacyDir = path.join(tempDir, '.ai-team');
            const newDir = path.join(tempDir, '.squad');
            fs.mkdirSync(legacyDir);
            fs.mkdirSync(newDir);
            fs.writeFileSync(path.join(legacyDir, 'team.md'), '# Legacy Team');
            fs.writeFileSync(path.join(newDir, 'team.md'), '# New Team');
            
            const result = hasSquadTeam(tempDir);
            assert.strictEqual(result, true);
        });

        test('returns false when .squad exists but only .ai-team has team.md', () => {
            const legacyDir = path.join(tempDir, '.ai-team');
            const newDir = path.join(tempDir, '.squad');
            fs.mkdirSync(legacyDir);
            fs.mkdirSync(newDir);
            fs.writeFileSync(path.join(legacyDir, 'team.md'), '# Team');
            
            const result = hasSquadTeam(tempDir);
            assert.strictEqual(result, false); // prefers .squad, which has no team.md
        });
    });

    suite('getSquadWatchPattern', () => {
        test('returns pattern that watches both folders', () => {
            const pattern = getSquadWatchPattern();
            assert.strictEqual(pattern, '**/{.squad,.ai-team}/**/*.md');
        });
    });

    suite('Migration scenario', () => {
        test('seamlessly handles transition from .ai-team to .squad', () => {
            // Start with legacy folder
            const legacyDir = path.join(tempDir, '.ai-team');
            fs.mkdirSync(legacyDir);
            fs.writeFileSync(path.join(legacyDir, 'team.md'), '# Team');
            
            assert.strictEqual(detectSquadFolder(tempDir), '.ai-team');
            assert.strictEqual(hasSquadTeam(tempDir), true);
            
            // Create new folder (migration in progress)
            const newDir = path.join(tempDir, '.squad');
            fs.mkdirSync(newDir);
            fs.writeFileSync(path.join(newDir, 'team.md'), '# Team');
            
            // Now prefers new folder
            assert.strictEqual(detectSquadFolder(tempDir), '.squad');
            assert.strictEqual(hasSquadTeam(tempDir), true);
            
            // Remove legacy folder (migration complete)
            fs.rmSync(legacyDir, { recursive: true });
            
            assert.strictEqual(detectSquadFolder(tempDir), '.squad');
            assert.strictEqual(hasSquadTeam(tempDir), true);
        });
    });
});
