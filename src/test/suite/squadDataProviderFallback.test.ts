/**
 * Focused tests for SquadDataProvider fallback behavior.
 * Validates the team.md → log participant fallback chain.
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { SquadDataProvider } from '../../services/SquadDataProvider';

const TEST_FIXTURES_ROOT = path.resolve(__dirname, '../../../test-fixtures');

suite('SquadDataProvider — Fallback Behavior', () => {
    let tempDir: string;

    setup(() => {
        tempDir = path.join(TEST_FIXTURES_ROOT, 'temp-fallback-tests');
    });

    teardown(async () => {
        try {
            await fs.promises.rm(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    suite('Primary path: team.md present', () => {
        test('uses team.md as authoritative roster', async () => {
            const dir = path.join(tempDir, 'team-primary');
            const aiTeamDir = path.join(dir, '.ai-team');
            await fs.promises.mkdir(aiTeamDir, { recursive: true });
            await fs.promises.writeFile(path.join(aiTeamDir, 'team.md'), [
                '# Team',
                '',
                '## Members',
                '',
                '| Name | Role | Status |',
                '|------|------|--------|',
                '| Alpha | Lead | ✅ Active |',
                '| Beta | Engineer | ✅ Active |',
                '| Gamma | QA | ✅ Active |',
            ].join('\n'));

            const provider = new SquadDataProvider(dir, '.ai-team');
            const members = await provider.getSquadMembers();

            assert.strictEqual(members.length, 3);
            const names = members.map(m => m.name).sort();
            assert.deepStrictEqual(names, ['Alpha', 'Beta', 'Gamma']);
        });

        test('overlays working status from orchestration logs', async () => {
            const dir = path.join(tempDir, 'team-with-logs');
            const aiTeamDir = path.join(dir, '.ai-team');
            const logDir = path.join(aiTeamDir, 'orchestration-log');
            await fs.promises.mkdir(logDir, { recursive: true });

            // Write team.md
            await fs.promises.writeFile(path.join(aiTeamDir, 'team.md'), [
                '# Team',
                '',
                '## Members',
                '',
                '| Name | Role | Status |',
                '|------|------|--------|',
                '| Alpha | Lead | ✅ Active |',
                '| Beta | Engineer | ✅ Active |',
            ].join('\n'));

            // Write a log that marks Alpha as active
            await fs.promises.writeFile(path.join(logDir, '2026-03-01-session.md'), [
                '# Session',
                '',
                '**Date:** 2026-03-01',
                '**Participants:** Alpha',
                '',
                '## Summary',
                'Alpha is working on something.',
            ].join('\n'));

            const provider = new SquadDataProvider(dir, '.ai-team');
            const members = await provider.getSquadMembers();

            const alpha = members.find(m => m.name === 'Alpha');
            const beta = members.find(m => m.name === 'Beta');

            assert.ok(alpha);
            assert.ok(beta);
            assert.strictEqual(alpha!.status, 'working', 'Alpha should be working (in most recent log)');
            assert.strictEqual(beta!.status, 'idle', 'Beta should be idle (not in log)');
        });

        test('preserves roles from team.md even when log has participants', async () => {
            const dir = path.join(tempDir, 'roles-preserved');
            const aiTeamDir = path.join(dir, '.ai-team');
            const logDir = path.join(aiTeamDir, 'orchestration-log');
            await fs.promises.mkdir(logDir, { recursive: true });

            await fs.promises.writeFile(path.join(aiTeamDir, 'team.md'), [
                '# Team',
                '',
                '## Members',
                '',
                '| Name | Role | Status |',
                '|------|------|--------|',
                '| Alpha | Architect | ✅ Active |',
            ].join('\n'));

            await fs.promises.writeFile(path.join(logDir, '2026-03-01-work.md'), [
                '# Work',
                '',
                '**Participants:** Alpha',
                '',
                '## Summary',
                'Alpha architected stuff.',
            ].join('\n'));

            const provider = new SquadDataProvider(dir, '.ai-team');
            const members = await provider.getSquadMembers();

            assert.strictEqual(members[0].role, 'Architect', 'Role should come from team.md, not logs');
        });
    });

    suite('Fallback path: team.md missing', () => {
        test('derives members from log participants', async () => {
            const dir = path.join(tempDir, 'logs-only');
            const logDir = path.join(dir, '.ai-team', 'orchestration-log');
            await fs.promises.mkdir(logDir, { recursive: true });

            await fs.promises.writeFile(path.join(logDir, '2026-03-01-session.md'), [
                '# Session',
                '',
                '**Participants:** Xander, Yolanda',
                '',
                '## Summary',
                'Working together.',
            ].join('\n'));

            const provider = new SquadDataProvider(dir, '.ai-team');
            const members = await provider.getSquadMembers();

            assert.strictEqual(members.length, 2);
            assert.ok(members.find(m => m.name === 'Xander'));
            assert.ok(members.find(m => m.name === 'Yolanda'));
        });

        test('assigns generic role in fallback mode', async () => {
            const dir = path.join(tempDir, 'generic-roles');
            const logDir = path.join(dir, '.ai-team', 'orchestration-log');
            await fs.promises.mkdir(logDir, { recursive: true });

            await fs.promises.writeFile(path.join(logDir, '2026-03-01-session.md'), [
                '# Session',
                '',
                '**Participants:** Zoe',
                '',
                '## Summary',
                'Solo work.',
            ].join('\n'));

            const provider = new SquadDataProvider(dir, '.ai-team');
            const members = await provider.getSquadMembers();

            assert.strictEqual(members[0].role, 'Squad Member');
        });

        test('deduplicates members across multiple log files', async () => {
            const dir = path.join(tempDir, 'dedup-logs');
            const logDir = path.join(dir, '.ai-team', 'orchestration-log');
            await fs.promises.mkdir(logDir, { recursive: true });

            await fs.promises.writeFile(path.join(logDir, '2026-03-01-session1.md'), [
                '# Session 1',
                '',
                '**Participants:** Alice, Bob',
                '',
                '## Summary',
                'Session 1.',
            ].join('\n'));

            await fs.promises.writeFile(path.join(logDir, '2026-03-02-session2.md'), [
                '# Session 2',
                '',
                '**Participants:** Alice, Charlie',
                '',
                '## Summary',
                'Session 2.',
            ].join('\n'));

            const provider = new SquadDataProvider(dir, '.ai-team');
            const members = await provider.getSquadMembers();

            // Alice should appear once, not twice
            const aliceCount = members.filter(m => m.name === 'Alice').length;
            assert.strictEqual(aliceCount, 1, 'Alice should appear only once');
            assert.strictEqual(members.length, 3, 'Should have 3 unique members');
        });
    });

    suite('Edge case: both missing', () => {
        test('returns empty array when no team.md and no logs', async () => {
            const dir = path.join(tempDir, 'empty-project');
            await fs.promises.mkdir(dir, { recursive: true });

            const provider = new SquadDataProvider(dir, '.ai-team');
            const members = await provider.getSquadMembers();

            assert.deepStrictEqual(members, []);
        });

        test('returns empty tasks when no data sources exist', async () => {
            const dir = path.join(tempDir, 'empty-tasks');
            await fs.promises.mkdir(dir, { recursive: true });

            const provider = new SquadDataProvider(dir, '.ai-team');
            const tasks = await provider.getTasksForMember('Anyone');

            assert.deepStrictEqual(tasks, []);
        });
    });

    suite('Integration: tree with team.md-only data', () => {
        test('full flow: team.md → SquadDataProvider → members', async () => {
            const dir = path.join(tempDir, 'integration-team-only');
            const aiTeamDir = path.join(dir, '.ai-team');
            await fs.promises.mkdir(aiTeamDir, { recursive: true });

            await fs.promises.writeFile(path.join(aiTeamDir, 'team.md'), [
                '# SquadUI Team',
                '',
                '## Project Context',
                '',
                '**Owner:** TestOwner',
                '**Repository:** testorg/testrepo',
                '',
                '## Members',
                '',
                '| Name | Role | Charter | Status |',
                '|------|------|---------|--------|',
                '| Danny | Lead | `.ai-team/agents/danny/charter.md` | ✅ Active |',
                '| Rusty | Extension Dev | `.ai-team/agents/rusty/charter.md` | ✅ Active |',
                '| Linus | Backend Dev | `.ai-team/agents/linus/charter.md` | ✅ Active |',
                '| Basher | Tester | `.ai-team/agents/basher/charter.md` | ✅ Active |',
                '| Livingston | DevOps/CI | `.ai-team/agents/livingston/charter.md` | 📋 Silent |',
            ].join('\n'));

            const provider = new SquadDataProvider(dir, '.ai-team');
            const members = await provider.getSquadMembers();

            // All 5 members should be present
            assert.strictEqual(members.length, 5, 'Should have all 5 members from team.md');

            // All should be idle (no orchestration logs)
            for (const member of members) {
                assert.strictEqual(member.status, 'idle', `${member.name} should be idle`);
            }

            // Roles should be preserved
            const danny = members.find(m => m.name === 'Danny');
            assert.ok(danny);
            assert.strictEqual(danny!.role, 'Lead');

            const livingston = members.find(m => m.name === 'Livingston');
            assert.ok(livingston);
            assert.strictEqual(livingston!.role, 'DevOps/CI');
        });

        test('team.md-only: getTasksForMember returns empty', async () => {
            const dir = path.join(tempDir, 'integration-no-tasks');
            const aiTeamDir = path.join(dir, '.ai-team');
            await fs.promises.mkdir(aiTeamDir, { recursive: true });

            await fs.promises.writeFile(path.join(aiTeamDir, 'team.md'), [
                '# Team',
                '',
                '## Members',
                '',
                '| Name | Role | Status |',
                '|------|------|--------|',
                '| Alice | Engineer | ✅ Active |',
            ].join('\n'));

            const provider = new SquadDataProvider(dir, '.ai-team');
            const tasks = await provider.getTasksForMember('Alice');

            assert.deepStrictEqual(tasks, [], 'No tasks should exist with only team.md');
        });

        test('team.md-only: getWorkDetails returns undefined', async () => {
            const dir = path.join(tempDir, 'integration-no-details');
            const aiTeamDir = path.join(dir, '.ai-team');
            await fs.promises.mkdir(aiTeamDir, { recursive: true });

            await fs.promises.writeFile(path.join(aiTeamDir, 'team.md'), [
                '# Team',
                '',
                '## Members',
                '',
                '| Name | Role | Status |',
                '|------|------|--------|',
                '| Alice | Engineer | ✅ Active |',
            ].join('\n'));

            const provider = new SquadDataProvider(dir, '.ai-team');
            const details = await provider.getWorkDetails('any-task');

            assert.strictEqual(details, undefined);
        });

        test('team.md-only: no currentTask on any member', async () => {
            const dir = path.join(tempDir, 'integration-no-current-task');
            const aiTeamDir = path.join(dir, '.ai-team');
            await fs.promises.mkdir(aiTeamDir, { recursive: true });

            await fs.promises.writeFile(path.join(aiTeamDir, 'team.md'), [
                '# Team',
                '',
                '## Members',
                '',
                '| Name | Role | Status |',
                '|------|------|--------|',
                '| Alice | Engineer | ✅ Active |',
                '| Bob | Designer | ✅ Active |',
            ].join('\n'));

            const provider = new SquadDataProvider(dir, '.ai-team');
            const members = await provider.getSquadMembers();

            for (const member of members) {
                assert.strictEqual(member.currentTask, undefined,
                    `${member.name} should have no currentTask`);
            }
        });

        test('refresh allows re-reading updated team.md', async () => {
            const dir = path.join(tempDir, 'integration-refresh');
            const aiTeamDir = path.join(dir, '.ai-team');
            await fs.promises.mkdir(aiTeamDir, { recursive: true });

            // Initial team.md with 1 member
            await fs.promises.writeFile(path.join(aiTeamDir, 'team.md'), [
                '# Team',
                '',
                '## Members',
                '',
                '| Name | Role | Status |',
                '|------|------|--------|',
                '| Alice | Engineer | ✅ Active |',
            ].join('\n'));

            const provider = new SquadDataProvider(dir, '.ai-team');
            const members1 = await provider.getSquadMembers();
            assert.strictEqual(members1.length, 1);

            // Update team.md with 2 members
            await fs.promises.writeFile(path.join(aiTeamDir, 'team.md'), [
                '# Team',
                '',
                '## Members',
                '',
                '| Name | Role | Status |',
                '|------|------|--------|',
                '| Alice | Engineer | ✅ Active |',
                '| Bob | Designer | ✅ Active |',
            ].join('\n'));

            provider.refresh();
            const members2 = await provider.getSquadMembers();
            assert.strictEqual(members2.length, 2, 'Should re-read updated team.md after refresh');
        });
    });
});
