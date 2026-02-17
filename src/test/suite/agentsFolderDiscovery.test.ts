/**
 * Tests for agents folder scanning fallback in SquadDataProvider.
 * Validates the second-level fallback: when team.md has no Members table,
 * SquadDataProvider discovers members by scanning .ai-team/agents/ directories.
 *
 * Detection chain:
 *   1. team.md Members/Roster table (primary)
 *   2. Agents folder scan (NEW — these tests)
 *   3. Orchestration log participants (legacy fallback)
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { SquadDataProvider } from '../../services/SquadDataProvider';

const TEST_FIXTURES_ROOT = path.resolve(__dirname, '../../../test-fixtures');

suite('SquadDataProvider — Agents Folder Discovery', () => {
    let tempDir: string;

    setup(() => {
        tempDir = path.join(TEST_FIXTURES_ROOT, `temp-agents-${Date.now()}`);
    });

    teardown(async () => {
        try {
            await fs.promises.rm(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    suite('Agents folder with charter files', () => {
        test('discovers members from agent directories with charter.md', async () => {
            const dir = path.join(tempDir, 'charter-agents');
            const aiTeamDir = path.join(dir, '.ai-team');
            const agentsDir = path.join(aiTeamDir, 'agents');

            // Create agent directories with charter files
            const dannyDir = path.join(agentsDir, 'danny');
            const rustyDir = path.join(agentsDir, 'rusty');
            fs.mkdirSync(dannyDir, { recursive: true });
            fs.mkdirSync(rustyDir, { recursive: true });

            fs.writeFileSync(path.join(dannyDir, 'charter.md'), [
                '# Danny — Lead',
                '',
                '## Identity',
                '',
                '- **Name:** Danny',
                '- **Role:** Lead',
                '- **Expertise:** Project management',
            ].join('\n'));

            fs.writeFileSync(path.join(rustyDir, 'charter.md'), [
                '# Rusty — Extension Dev',
                '',
                '## Identity',
                '',
                '- **Name:** Rusty',
                '- **Role:** Extension Dev',
                '- **Expertise:** VS Code extensions',
            ].join('\n'));

            // Empty team.md — no Members table
            fs.writeFileSync(path.join(aiTeamDir, 'team.md'), [
                '# Team',
                '',
                '## Project Context',
                '',
                '**Owner:** TestOwner',
            ].join('\n'));

            const provider = new SquadDataProvider(dir, '.ai-team', 0);
            const members = await provider.getSquadMembers();

            assert.ok(members.length >= 2, `Should find at least 2 members, got ${members.length}`);
            const danny = members.find(m => m.name.toLowerCase() === 'danny');
            const rusty = members.find(m => m.name.toLowerCase() === 'rusty');
            assert.ok(danny, 'Should find Danny');
            assert.ok(rusty, 'Should find Rusty');
            assert.strictEqual(danny!.role, 'Lead', 'Danny role should be extracted from charter');
            assert.strictEqual(rusty!.role, 'Extension Dev', 'Rusty role should be extracted from charter');
        });
    });

    suite('Agents folder without charter files', () => {
        test('discovers members with default role when no charter.md exists', async () => {
            const dir = path.join(tempDir, 'no-charter');
            const aiTeamDir = path.join(dir, '.ai-team');
            const agentsDir = path.join(aiTeamDir, 'agents');

            // Create agent directories without charter files
            fs.mkdirSync(path.join(agentsDir, 'alice'), { recursive: true });
            fs.mkdirSync(path.join(agentsDir, 'bob'), { recursive: true });

            // Empty team.md — no Members table
            fs.writeFileSync(path.join(aiTeamDir, 'team.md'), [
                '# Team',
                '',
                '## Project Context',
                '',
                '**Owner:** TestOwner',
            ].join('\n'));

            const provider = new SquadDataProvider(dir, '.ai-team', 0);
            const members = await provider.getSquadMembers();

            assert.ok(members.length >= 2, `Should find at least 2 members, got ${members.length}`);
            const alice = members.find(m => m.name === 'Alice');
            const bob = members.find(m => m.name === 'Bob');
            assert.ok(alice, 'Should find Alice (capitalized from folder name)');
            assert.ok(bob, 'Should find Bob (capitalized from folder name)');
            assert.strictEqual(alice!.role, 'Squad Member', 'Default role should be Squad Member');
            assert.strictEqual(bob!.role, 'Squad Member', 'Default role should be Squad Member');
        });
    });

    suite('Skips excluded directories', () => {
        test('skips _alumni and scribe directories', async () => {
            const dir = path.join(tempDir, 'excluded-dirs');
            const aiTeamDir = path.join(dir, '.ai-team');
            const agentsDir = path.join(aiTeamDir, 'agents');

            // Create normal agent directories
            fs.mkdirSync(path.join(agentsDir, 'linus'), { recursive: true });
            fs.mkdirSync(path.join(agentsDir, 'basher'), { recursive: true });

            // Create excluded directories
            fs.mkdirSync(path.join(agentsDir, '_alumni', 'old-member'), { recursive: true });
            fs.mkdirSync(path.join(agentsDir, 'scribe'), { recursive: true });

            // Empty team.md — no Members table
            fs.writeFileSync(path.join(aiTeamDir, 'team.md'), [
                '# Team',
                '',
                '## Project Context',
                '',
                '**Owner:** TestOwner',
            ].join('\n'));

            const provider = new SquadDataProvider(dir, '.ai-team', 0);
            const members = await provider.getSquadMembers();

            const names = members.map(m => m.name.toLowerCase());
            assert.ok(names.includes('linus'), 'Should include linus');
            assert.ok(names.includes('basher'), 'Should include basher');
            assert.ok(!names.includes('_alumni'), 'Should NOT include _alumni');
            assert.ok(!names.includes('old-member'), 'Should NOT include old-member');
            assert.ok(!names.includes('scribe'), 'Should NOT include scribe');
        });
    });

    suite('Empty agents folder', () => {
        test('returns empty array when agents folder has no subdirectories', async () => {
            const dir = path.join(tempDir, 'empty-agents');
            const aiTeamDir = path.join(dir, '.ai-team');
            const agentsDir = path.join(aiTeamDir, 'agents');

            // Create empty agents directory
            fs.mkdirSync(agentsDir, { recursive: true });

            // Empty team.md — no Members table
            fs.writeFileSync(path.join(aiTeamDir, 'team.md'), [
                '# Team',
                '',
                '## Project Context',
                '',
                '**Owner:** TestOwner',
            ].join('\n'));

            const provider = new SquadDataProvider(dir, '.ai-team', 0);
            const members = await provider.getSquadMembers();

            assert.deepStrictEqual(members, [], 'Empty agents folder should yield empty members array');
        });
    });

    suite('No agents folder', () => {
        test('returns empty array when agents directory does not exist', async () => {
            const dir = path.join(tempDir, 'no-agents-dir');
            const aiTeamDir = path.join(dir, '.ai-team');

            // Create .ai-team but no agents/ subdirectory
            fs.mkdirSync(aiTeamDir, { recursive: true });

            // Empty team.md — no Members table
            fs.writeFileSync(path.join(aiTeamDir, 'team.md'), [
                '# Team',
                '',
                '## Project Context',
                '',
                '**Owner:** TestOwner',
            ].join('\n'));

            const provider = new SquadDataProvider(dir, '.ai-team', 0);
            const members = await provider.getSquadMembers();

            assert.deepStrictEqual(members, [], 'No agents folder should yield empty members array');
        });
    });

    suite('team.md takes priority over agents folder', () => {
        test('uses team.md members when valid Members table exists', async () => {
            const dir = path.join(tempDir, 'team-priority');
            const aiTeamDir = path.join(dir, '.ai-team');
            const agentsDir = path.join(aiTeamDir, 'agents');

            // Create agents folder with different members
            fs.mkdirSync(path.join(agentsDir, 'agent-x'), { recursive: true });
            fs.mkdirSync(path.join(agentsDir, 'agent-y'), { recursive: true });

            // team.md with valid Members table (should take priority)
            fs.writeFileSync(path.join(aiTeamDir, 'team.md'), [
                '# Team',
                '',
                '## Members',
                '',
                '| Name | Role | Status |',
                '|------|------|--------|',
                '| Alpha | Lead | ✅ Active |',
                '| Beta | Engineer | ✅ Active |',
            ].join('\n'));

            const provider = new SquadDataProvider(dir, '.ai-team', 0);
            const members = await provider.getSquadMembers();

            assert.strictEqual(members.length, 2, 'Should return exactly 2 members from team.md');
            const names = members.map(m => m.name).sort();
            assert.deepStrictEqual(names, ['Alpha', 'Beta'], 'Members should come from team.md, not agents folder');

            // Agents folder names should NOT appear
            assert.ok(!members.find(m => m.name.toLowerCase().includes('agent')),
                'Agent folder members should not appear when team.md has valid roster');
        });
    });

    suite('Role extraction from charter', () => {
        test('extracts role from "- **Role:** Backend Dev" format', async () => {
            const dir = path.join(tempDir, 'role-extraction');
            const aiTeamDir = path.join(dir, '.ai-team');
            const agentsDir = path.join(aiTeamDir, 'agents');
            const linusDir = path.join(agentsDir, 'linus');

            fs.mkdirSync(linusDir, { recursive: true });

            fs.writeFileSync(path.join(linusDir, 'charter.md'), [
                '# Linus — Backend Dev',
                '',
                '## Identity',
                '',
                '- **Name:** Linus',
                '- **Role:** Backend Dev',
                '- **Expertise:** TypeScript services',
            ].join('\n'));

            // Empty team.md — no Members table
            fs.writeFileSync(path.join(aiTeamDir, 'team.md'), [
                '# Team',
                '',
                '## Project Context',
                '',
                '**Owner:** TestOwner',
            ].join('\n'));

            const provider = new SquadDataProvider(dir, '.ai-team', 0);
            const members = await provider.getSquadMembers();

            const linus = members.find(m => m.name.toLowerCase() === 'linus');
            assert.ok(linus, 'Should find Linus');
            assert.strictEqual(linus!.role, 'Backend Dev', 'Role should be extracted as "Backend Dev"');
        });

        test('uses default role when charter has no Identity section', async () => {
            const dir = path.join(tempDir, 'no-identity');
            const aiTeamDir = path.join(dir, '.ai-team');
            const agentsDir = path.join(aiTeamDir, 'agents');
            const memberDir = path.join(agentsDir, 'mystery');

            fs.mkdirSync(memberDir, { recursive: true });

            fs.writeFileSync(path.join(memberDir, 'charter.md'), [
                '# Mystery Agent',
                '',
                '## Goals',
                '',
                '- Do mysterious things',
            ].join('\n'));

            // Empty team.md
            fs.writeFileSync(path.join(aiTeamDir, 'team.md'), [
                '# Team',
                '',
                '## Project Context',
                '',
                '**Owner:** TestOwner',
            ].join('\n'));

            const provider = new SquadDataProvider(dir, '.ai-team', 0);
            const members = await provider.getSquadMembers();

            const mystery = members.find(m => m.name.toLowerCase() === 'mystery');
            assert.ok(mystery, 'Should find Mystery');
            assert.strictEqual(mystery!.role, 'Squad Member', 'Should use default role when no Identity section');
        });

        test('uses default role when charter has Identity section but no Role line', async () => {
            const dir = path.join(tempDir, 'no-role-line');
            const aiTeamDir = path.join(dir, '.ai-team');
            const agentsDir = path.join(aiTeamDir, 'agents');
            const memberDir = path.join(agentsDir, 'enigma');

            fs.mkdirSync(memberDir, { recursive: true });

            fs.writeFileSync(path.join(memberDir, 'charter.md'), [
                '# Enigma',
                '',
                '## Identity',
                '',
                '- **Name:** Enigma',
                '- **Expertise:** Puzzles',
            ].join('\n'));

            // Empty team.md
            fs.writeFileSync(path.join(aiTeamDir, 'team.md'), [
                '# Team',
                '',
                '## Project Context',
                '',
                '**Owner:** TestOwner',
            ].join('\n'));

            const provider = new SquadDataProvider(dir, '.ai-team', 0);
            const members = await provider.getSquadMembers();

            const enigma = members.find(m => m.name.toLowerCase() === 'enigma');
            assert.ok(enigma, 'Should find Enigma');
            assert.strictEqual(enigma!.role, 'Squad Member', 'Should use default role when Role line is missing');
        });
    });
});
