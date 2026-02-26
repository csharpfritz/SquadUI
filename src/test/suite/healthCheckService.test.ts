/**
 * Tests for HealthCheckService.
 * Validates each diagnostic check against test fixtures and edge cases.
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { HealthCheckService, HealthCheckResult } from '../../services/HealthCheckService';

const TEST_FIXTURES_ROOT = path.resolve(__dirname, '../../../test-fixtures');

suite('HealthCheckService', () => {
    let service: HealthCheckService;

    setup(() => {
        service = new HealthCheckService();
    });

    suite('checkTeamMd()', () => {
        test('passes when team.md exists and has members', async () => {
            const result = await service.checkTeamMd('.ai-team', TEST_FIXTURES_ROOT);
            assert.strictEqual(result.status, 'pass');
            assert.ok(result.message.includes('member(s) found'));
        });

        test('fails when squad folder does not exist', async () => {
            const result = await service.checkTeamMd('.ai-team', '/nonexistent/path');
            assert.strictEqual(result.status, 'fail');
            assert.ok(result.message.includes('not found'));
            assert.ok(result.fix);
        });

        test('fails when team.md is missing', async () => {
            // Use a directory that exists but has no team.md
            const tempDir = path.join(TEST_FIXTURES_ROOT, `temp-health-${Date.now()}`);
            const squadDir = path.join(tempDir, '.ai-team');
            fs.mkdirSync(squadDir, { recursive: true });

            try {
                const result = await service.checkTeamMd('.ai-team', tempDir);
                assert.strictEqual(result.status, 'fail');
                assert.ok(result.message.includes('not found'));
            } finally {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        });

        test('warns when team.md parses but has no members', async () => {
            const tempDir = path.join(TEST_FIXTURES_ROOT, `temp-health-${Date.now()}`);
            const squadDir = path.join(tempDir, '.ai-team');
            fs.mkdirSync(squadDir, { recursive: true });
            fs.writeFileSync(path.join(squadDir, 'team.md'), '# My Team\n\nNo table here.\n');

            try {
                const result = await service.checkTeamMd('.ai-team', tempDir);
                assert.strictEqual(result.status, 'warn');
                assert.ok(result.message.includes('no members'));
            } finally {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        });
    });

    suite('checkAgentCharters()', () => {
        test('warns when agents/ directory does not exist', async () => {
            const tempDir = path.join(TEST_FIXTURES_ROOT, `temp-health-${Date.now()}`);
            const squadDir = path.join(tempDir, '.ai-team');
            fs.mkdirSync(squadDir, { recursive: true });

            try {
                const result = await service.checkAgentCharters('.ai-team', tempDir);
                assert.strictEqual(result.status, 'warn');
                assert.ok(result.message.includes('No agents/'));
            } finally {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        });

        test('warns when agents/ is empty', async () => {
            const tempDir = path.join(TEST_FIXTURES_ROOT, `temp-health-${Date.now()}`);
            const agentsDir = path.join(tempDir, '.ai-team', 'agents');
            fs.mkdirSync(agentsDir, { recursive: true });

            try {
                const result = await service.checkAgentCharters('.ai-team', tempDir);
                assert.strictEqual(result.status, 'warn');
                assert.ok(result.message.includes('no agent folders'));
            } finally {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        });

        test('fails when agent folders are missing charter.md', async () => {
            const tempDir = path.join(TEST_FIXTURES_ROOT, `temp-health-${Date.now()}`);
            const agentsDir = path.join(tempDir, '.ai-team', 'agents');
            fs.mkdirSync(path.join(agentsDir, 'danny'), { recursive: true });
            fs.mkdirSync(path.join(agentsDir, 'rusty'), { recursive: true });
            // Only danny gets a charter
            fs.writeFileSync(path.join(agentsDir, 'danny', 'charter.md'), '# Danny\n');

            try {
                const result = await service.checkAgentCharters('.ai-team', tempDir);
                assert.strictEqual(result.status, 'fail');
                assert.ok(result.message.includes('rusty'));
                assert.ok(!result.message.includes('danny'));
            } finally {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        });

        test('passes when all agents have charter.md', async () => {
            const tempDir = path.join(TEST_FIXTURES_ROOT, `temp-health-${Date.now()}`);
            const agentsDir = path.join(tempDir, '.ai-team', 'agents');
            fs.mkdirSync(path.join(agentsDir, 'danny'), { recursive: true });
            fs.mkdirSync(path.join(agentsDir, 'rusty'), { recursive: true });
            fs.writeFileSync(path.join(agentsDir, 'danny', 'charter.md'), '# Danny\n');
            fs.writeFileSync(path.join(agentsDir, 'rusty', 'charter.md'), '# Rusty\n');

            try {
                const result = await service.checkAgentCharters('.ai-team', tempDir);
                assert.strictEqual(result.status, 'pass');
                assert.ok(result.message.includes('2 agent(s)'));
            } finally {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        });

        test('skips directories starting with underscore', async () => {
            const tempDir = path.join(TEST_FIXTURES_ROOT, `temp-health-${Date.now()}`);
            const agentsDir = path.join(tempDir, '.ai-team', 'agents');
            fs.mkdirSync(path.join(agentsDir, 'danny'), { recursive: true });
            fs.mkdirSync(path.join(agentsDir, '_alumni'), { recursive: true });
            fs.writeFileSync(path.join(agentsDir, 'danny', 'charter.md'), '# Danny\n');

            try {
                const result = await service.checkAgentCharters('.ai-team', tempDir);
                assert.strictEqual(result.status, 'pass');
                assert.ok(result.message.includes('1 agent(s)'));
            } finally {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        });
    });

    suite('checkOrchestrationLogs()', () => {
        test('passes when log files parse successfully', async () => {
            const result = await service.checkOrchestrationLogs('.ai-team', TEST_FIXTURES_ROOT);
            // Test fixtures have log files — should parse
            assert.ok(['pass', 'warn'].includes(result.status));
        });

        test('warns when no log files found', async () => {
            const tempDir = path.join(TEST_FIXTURES_ROOT, `temp-health-${Date.now()}`);
            const squadDir = path.join(tempDir, '.ai-team');
            fs.mkdirSync(squadDir, { recursive: true });

            try {
                const result = await service.checkOrchestrationLogs('.ai-team', tempDir);
                assert.strictEqual(result.status, 'warn');
                assert.ok(result.message.includes('No orchestration log'));
            } finally {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        });
    });

    suite('checkGitHubConfig()', () => {
        test('returns pass or warn based on environment', async () => {
            const result = await service.checkGitHubConfig();
            // Can't control env in tests, but result should be valid
            assert.ok(['pass', 'warn'].includes(result.status));
            assert.strictEqual(result.name, 'GitHub Config');
        });
    });

    suite('runAll()', () => {
        test('returns results for all checks', async () => {
            const results = await service.runAll('.ai-team', TEST_FIXTURES_ROOT);
            assert.strictEqual(results.length, 4);
            assert.ok(results.some(r => r.name === 'team.md'));
            assert.ok(results.some(r => r.name === 'Agent Charters'));
            assert.ok(results.some(r => r.name === 'Orchestration Logs'));
            assert.ok(results.some(r => r.name === 'GitHub Config'));
        });

        test('all results have valid status values', async () => {
            const results = await service.runAll('.ai-team', TEST_FIXTURES_ROOT);
            for (const r of results) {
                assert.ok(['pass', 'fail', 'warn'].includes(r.status), `Invalid status: ${r.status}`);
            }
        });
    });

    suite('formatResults()', () => {
        test('formats passing results with checkmark', () => {
            const results: HealthCheckResult[] = [
                { name: 'team.md', status: 'pass', message: 'OK' },
            ];
            const output = service.formatResults(results);
            assert.ok(output.includes('✅'));
            assert.ok(output.includes('1 passed'));
        });

        test('formats failing results with fix suggestions', () => {
            const results: HealthCheckResult[] = [
                { name: 'team.md', status: 'fail', message: 'Missing', fix: 'Create it' },
            ];
            const output = service.formatResults(results);
            assert.ok(output.includes('❌'));
            assert.ok(output.includes('Fix: Create it'));
            assert.ok(output.includes('1 failed'));
        });

        test('formats mixed results with summary counts', () => {
            const results: HealthCheckResult[] = [
                { name: 'A', status: 'pass', message: 'ok' },
                { name: 'B', status: 'warn', message: 'maybe' },
                { name: 'C', status: 'fail', message: 'bad' },
            ];
            const output = service.formatResults(results);
            assert.ok(output.includes('1 passed'));
            assert.ok(output.includes('1 warning(s)'));
            assert.ok(output.includes('1 failed'));
        });
    });
});
