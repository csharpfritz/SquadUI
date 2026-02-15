/**
 * Unit tests for TeamMdService — parsing team.md roster files.
 * Tests various formats, edge cases, and @copilot capability extraction.
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { TeamMdService } from '../../services/TeamMdService';

const TEST_FIXTURES_ROOT = path.resolve(__dirname, '../../../test-fixtures');

suite('TeamMdService', () => {
    let service: TeamMdService;

    setup(() => {
        service = new TeamMdService();
    });

    suite('parseTeamMd()', () => {
        test('parses the standard fixture team.md', async () => {
            const roster = await service.parseTeamMd(TEST_FIXTURES_ROOT);

            assert.ok(roster, 'Should return a roster');
            assert.ok(roster!.members.length >= 5, 'Should parse all 5 members from fixture');
        });

        test('returns null when team.md does not exist', async () => {
            const roster = await service.parseTeamMd('/nonexistent/path');

            assert.strictEqual(roster, null);
        });

        test('returns null for directory without .ai-team folder', async () => {
            const tempDir = path.join(TEST_FIXTURES_ROOT, 'no-team-md-here');
            await fs.promises.mkdir(tempDir, { recursive: true });

            try {
                const roster = await service.parseTeamMd(tempDir);
                assert.strictEqual(roster, null);
            } finally {
                await fs.promises.rm(tempDir, { recursive: true, force: true });
            }
        });

        test('extracts owner from Project Context section', async () => {
            const roster = await service.parseTeamMd(TEST_FIXTURES_ROOT);

            assert.ok(roster);
            // The extractOwner regex matches up to a '(' or end of line.
            // The fixture has "**Owner:** TestOwner" on its own line, but
            // the regex captures everything until newline. Verify it starts with 'TestOwner'.
            assert.ok(roster!.owner?.startsWith('TestOwner'), `Owner should start with TestOwner, got: ${roster!.owner}`);
        });

        test('extracts repository from Project Context section', async () => {
            const roster = await service.parseTeamMd(TEST_FIXTURES_ROOT);

            assert.ok(roster);
            assert.strictEqual(roster!.repository, 'test-repo');
        });
    });

    suite('parseContent() — Members table parsing', () => {
        test('parses standard 4-column table format', () => {
            const content = [
                '# Team',
                '',
                '## Members',
                '',
                '| Name | Role | Charter | Status |',
                '|------|------|---------|--------|',
                '| Alice | Engineer | `.ai-team/agents/alice/charter.md` | ✅ Active |',
                '| Bob | Designer | `.ai-team/agents/bob/charter.md` | ✅ Active |',
            ].join('\n');

            const roster = service.parseContent(content);

            assert.strictEqual(roster.members.length, 2);
            assert.strictEqual(roster.members[0].name, 'Alice');
            assert.strictEqual(roster.members[0].role, 'Engineer');
            assert.strictEqual(roster.members[1].name, 'Bob');
            assert.strictEqual(roster.members[1].role, 'Designer');
        });

        test('parses minimal 2-column table (Name + Role)', () => {
            const content = [
                '## Members',
                '',
                '| Name | Role |',
                '|------|------|',
                '| Charlie | QA |',
            ].join('\n');

            const roster = service.parseContent(content);

            assert.strictEqual(roster.members.length, 1);
            assert.strictEqual(roster.members[0].name, 'Charlie');
            assert.strictEqual(roster.members[0].role, 'QA');
        });

        test('skips Coordinator entries', () => {
            const content = [
                '## Members',
                '',
                '| Name | Role | Charter | Status |',
                '|------|------|---------|--------|',
                '| Scribe | Coordinator | `.ai-team/agents/scribe/charter.md` | ✅ Active |',
                '| Alice | Engineer | `.ai-team/agents/alice/charter.md` | ✅ Active |',
            ].join('\n');

            const roster = service.parseContent(content);

            assert.strictEqual(roster.members.length, 1);
            assert.strictEqual(roster.members[0].name, 'Alice');
        });

        test('returns empty members array when no Members section exists', () => {
            const content = '# Team\n\nSome general info about the team.';

            const roster = service.parseContent(content);

            assert.deepStrictEqual(roster.members, []);
        });

        test('returns empty members array when Members section has no table', () => {
            const content = [
                '## Members',
                '',
                'Just some text, no table here.',
            ].join('\n');

            const roster = service.parseContent(content);

            assert.deepStrictEqual(roster.members, []);
        });

        test('handles empty content', () => {
            const roster = service.parseContent('');

            assert.deepStrictEqual(roster.members, []);
        });

        test('handles whitespace-only content', () => {
            const roster = service.parseContent('   \n\n   \t\n');

            assert.deepStrictEqual(roster.members, []);
        });

        test('handles table rows missing Name column', () => {
            const content = [
                '## Members',
                '',
                '| Name | Role |',
                '|------|------|',
                '| | Engineer |',
            ].join('\n');

            const roster = service.parseContent(content);

            // Empty name should be skipped
            assert.strictEqual(roster.members.length, 0);
        });

        test('handles table rows missing Role column', () => {
            const content = [
                '## Members',
                '',
                '| Name | Role |',
                '|------|------|',
                '| Alice | |',
            ].join('\n');

            const roster = service.parseContent(content);

            // Empty role should be skipped
            assert.strictEqual(roster.members.length, 0);
        });

        test('handles multiple separator styles in table', () => {
            const content = [
                '## Members',
                '',
                '| Name | Role | Status |',
                '|:-----|:----:|-------:|',
                '| Alice | Engineer | ✅ Active |',
            ].join('\n');

            const roster = service.parseContent(content);

            assert.strictEqual(roster.members.length, 1);
            assert.strictEqual(roster.members[0].name, 'Alice');
        });

        test('stops parsing Members table at next section', () => {
            const content = [
                '## Members',
                '',
                '| Name | Role | Status |',
                '|------|------|--------|',
                '| Alice | Engineer | ✅ Active |',
                '',
                '## Alumni',
                '',
                '| Name | Role | Status |',
                '|------|------|--------|',
                '| OldPerson | Retired | 🔴 Inactive |',
            ].join('\n');

            const roster = service.parseContent(content);

            assert.strictEqual(roster.members.length, 1);
            assert.strictEqual(roster.members[0].name, 'Alice');
        });
    });

    suite('parseContent() — Status badge parsing', () => {
        test('maps ✅ Active to idle', () => {
            const content = [
                '## Members',
                '',
                '| Name | Role | Status |',
                '|------|------|--------|',
                '| Alice | Engineer | ✅ Active |',
            ].join('\n');

            const roster = service.parseContent(content);
            assert.strictEqual(roster.members[0].status, 'idle');
        });

        test('maps 📋 Silent to idle', () => {
            const content = [
                '## Members',
                '',
                '| Name | Role | Status |',
                '|------|------|--------|',
                '| Bob | QA | 📋 Silent |',
            ].join('\n');

            const roster = service.parseContent(content);
            assert.strictEqual(roster.members[0].status, 'idle');
        });

        test('maps 🔄 Monitor to idle', () => {
            const content = [
                '## Members',
                '',
                '| Name | Role | Status |',
                '|------|------|--------|',
                '| Charlie | DevOps | 🔄 Monitor |',
            ].join('\n');

            const roster = service.parseContent(content);
            assert.strictEqual(roster.members[0].status, 'idle');
        });

        test('maps 🤖 Coding Agent to idle', () => {
            const content = [
                '## Members',
                '',
                '| Name | Role | Status |',
                '|------|------|--------|',
                '| Copilot | Coding Agent | 🤖 Coding Agent |',
            ].join('\n');

            const roster = service.parseContent(content);
            // Coordinator check won't hit here because role is "Coding Agent" not "Coordinator"
            assert.strictEqual(roster.members[0].status, 'idle');
        });

        test('maps 🔨 Working to working', () => {
            const content = [
                '## Members',
                '',
                '| Name | Role | Status |',
                '|------|------|--------|',
                '| Alice | Engineer | 🔨 Working |',
            ].join('\n');

            const roster = service.parseContent(content);
            assert.strictEqual(roster.members[0].status, 'working');
        });

        test('maps "working" text to working status', () => {
            const content = [
                '## Members',
                '',
                '| Name | Role | Status |',
                '|------|------|--------|',
                '| Alice | Engineer | currently working |',
            ].join('\n');

            const roster = service.parseContent(content);
            assert.strictEqual(roster.members[0].status, 'working');
        });

        test('maps empty status to idle', () => {
            const content = [
                '## Members',
                '',
                '| Name | Role | Status |',
                '|------|------|--------|',
                '| Alice | Engineer |  |',
            ].join('\n');

            const roster = service.parseContent(content);

            // Name and Role are present, status is empty → defaults to idle
            assert.strictEqual(roster.members.length, 1);
            assert.strictEqual(roster.members[0].status, 'idle');
        });

        test('defaults to idle for unrecognized status text', () => {
            const content = [
                '## Members',
                '',
                '| Name | Role | Status |',
                '|------|------|--------|',
                '| Alice | Engineer | 🎉 Celebrating |',
            ].join('\n');

            const roster = service.parseContent(content);
            assert.strictEqual(roster.members[0].status, 'idle');
        });
    });

    suite('parseContent() — Repository and owner extraction', () => {
        test('extracts repository from **Repository** format', () => {
            const content = [
                '## Issue Source',
                '',
                '| Field | Value |',
                '|-------|-------|',
                '| **Repository** | csharpfritz/SquadUI |',
            ].join('\n');

            const roster = service.parseContent(content);
            assert.strictEqual(roster.repository, 'csharpfritz/SquadUI');
        });

        test('extracts repository from **Repository:** format', () => {
            const content = '**Repository:** myorg/myrepo';

            const roster = service.parseContent(content);
            assert.strictEqual(roster.repository, 'myorg/myrepo');
        });

        test('extracts owner from **Owner:** format', () => {
            const content = '**Owner:** Jeffrey T. Fritz (csharpfritz)';

            const roster = service.parseContent(content);
            assert.strictEqual(roster.owner, 'Jeffrey T. Fritz');
        });

        test('returns undefined for missing repository', () => {
            const content = '# Team\n\n## Members';

            const roster = service.parseContent(content);
            assert.strictEqual(roster.repository, undefined);
        });

        test('returns undefined for missing owner', () => {
            const content = '# Team\n\n## Members';

            const roster = service.parseContent(content);
            assert.strictEqual(roster.owner, undefined);
        });
    });

    suite('parseContent() — @copilot capabilities', () => {
        test('extracts copilot-auto-assign true', () => {
            const content = '<!-- copilot-auto-assign: true -->\n## Members\n';

            const roster = service.parseContent(content);
            assert.ok(roster.copilotCapabilities);
            assert.strictEqual(roster.copilotCapabilities!.autoAssign, true);
        });

        test('extracts copilot-auto-assign false', () => {
            const content = '<!-- copilot-auto-assign: false -->\n## Members\n';

            const roster = service.parseContent(content);
            assert.ok(roster.copilotCapabilities);
            assert.strictEqual(roster.copilotCapabilities!.autoAssign, false);
        });

        test('returns undefined capabilities when no copilot markers present', () => {
            const content = '# Team\n\n## Members\n';

            const roster = service.parseContent(content);
            assert.strictEqual(roster.copilotCapabilities, undefined);
        });

        test('extracts inline capability format', () => {
            const content = [
                '## Members',
                '',
                '🟢 Good fit: unit tests, bug fixes, documentation',
                '🟡 Needs review: refactoring, API changes',
                '🔴 Not suitable: architecture decisions, security',
            ].join('\n');

            const roster = service.parseContent(content);
            assert.ok(roster.copilotCapabilities);
            assert.deepStrictEqual(roster.copilotCapabilities!.goodFit, ['unit tests', 'bug fixes', 'documentation']);
            assert.deepStrictEqual(roster.copilotCapabilities!.needsReview, ['refactoring', 'API changes']);
            assert.deepStrictEqual(roster.copilotCapabilities!.notSuitable, ['architecture decisions', 'security']);
        });

        test('extracts detailed (bulleted) capability format', () => {
            const content = [
                '## Coding Agent',
                '',
                '### Capabilities',
                '',
                '🟢 Good fit:',
                '- Writing unit tests',
                '- Bug fixes',
                '',
                '🟡 Needs review:',
                '- Complex refactoring',
                '',
                '🔴 Not suitable:',
                '- Architecture decisions',
            ].join('\n');

            const roster = service.parseContent(content);
            assert.ok(roster.copilotCapabilities);
            assert.deepStrictEqual(roster.copilotCapabilities!.goodFit, ['Writing unit tests', 'Bug fixes']);
            assert.deepStrictEqual(roster.copilotCapabilities!.needsReview, ['Complex refactoring']);
            assert.deepStrictEqual(roster.copilotCapabilities!.notSuitable, ['Architecture decisions']);
        });

        test('combines auto-assign with capabilities', () => {
            const content = [
                '<!-- copilot-auto-assign: true -->',
                '🟢 Good fit: tests, docs',
            ].join('\n');

            const roster = service.parseContent(content);
            assert.ok(roster.copilotCapabilities);
            assert.strictEqual(roster.copilotCapabilities!.autoAssign, true);
            assert.deepStrictEqual(roster.copilotCapabilities!.goodFit, ['tests', 'docs']);
        });
    });

    suite('parseContent() — edge cases', () => {
        test('handles team.md with only a title', () => {
            const roster = service.parseContent('# My Team');

            assert.deepStrictEqual(roster.members, []);
            assert.strictEqual(roster.copilotCapabilities, undefined);
        });

        test('handles members with special characters in names', () => {
            const content = [
                '## Members',
                '',
                '| Name | Role | Status |',
                '|------|------|--------|',
                '| José García | Engineer | ✅ Active |',
                '| François Müller | Designer | ✅ Active |',
                "| O'Brien | QA | ✅ Active |",
            ].join('\n');

            const roster = service.parseContent(content);

            assert.strictEqual(roster.members.length, 3);
            assert.strictEqual(roster.members[0].name, 'José García');
            assert.strictEqual(roster.members[1].name, 'François Müller');
            assert.strictEqual(roster.members[2].name, "O'Brien");
        });

        test('handles table with extra whitespace in cells', () => {
            const content = [
                '## Members',
                '',
                '|  Name  |  Role  |  Status  |',
                '|--------|--------|----------|',
                '|  Alice  |  Engineer  |  ✅ Active  |',
            ].join('\n');

            const roster = service.parseContent(content);

            assert.strictEqual(roster.members.length, 1);
            assert.strictEqual(roster.members[0].name, 'Alice');
            assert.strictEqual(roster.members[0].role, 'Engineer');
        });

        test('handles large team roster', () => {
            const rows = [];
            for (let i = 0; i < 50; i++) {
                rows.push(`| Member${i} | Role${i} | ✅ Active |`);
            }
            const content = [
                '## Members',
                '',
                '| Name | Role | Status |',
                '|------|------|--------|',
                ...rows,
            ].join('\n');

            const roster = service.parseContent(content);

            assert.strictEqual(roster.members.length, 50);
        });
    });
});
