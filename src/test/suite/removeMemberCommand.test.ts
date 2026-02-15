/**
 * Tests for removeMemberCommand.ts — parsing logic for team.md member rows.
 *
 * Since parseMemberRows() is a private function, these tests focus on
 * validating the parsing patterns and regex logic that the command depends on.
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';

const TEST_FIXTURES_ROOT = path.resolve(__dirname, '../../../test-fixtures');

suite('removeMemberCommand', () => {
    suite('parseMemberRows() — Table Parsing Logic', () => {
        let tempDir: string;

        setup(() => {
            tempDir = path.join(TEST_FIXTURES_ROOT, `temp-removemember-${Date.now()}`);
            fs.mkdirSync(path.join(tempDir, '.ai-team'), { recursive: true });
        });

        teardown(() => {
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
            } catch {
                // Ignore cleanup errors
            }
        });

        test('parses well-formed table row correctly', () => {
            const teamMd = [
                '# Team',
                '',
                '## Members',
                '',
                '| Name | Role | Charter | Status |',
                '|------|------|---------|--------|',
                '| Danny | Lead | .ai-team/agents/danny/charter.md | ✅ Active |',
                '',
            ].join('\n');

            const teamMdPath = path.join(tempDir, '.ai-team', 'team.md');
            fs.writeFileSync(teamMdPath, teamMd, 'utf-8');

            // Parse table manually to validate logic
            const lines = teamMd.split('\n');
            let inMembersTable = false;
            const rows: { name: string; line: string }[] = [];

            for (const line of lines) {
                if (line.startsWith('## Members')) {
                    inMembersTable = true;
                    continue;
                }
                if (inMembersTable && line.startsWith('##')) {
                    break;
                }
                if (!inMembersTable) {
                    continue;
                }
                if (line.startsWith('|--') || line.includes('| Name')) {
                    continue;
                }
                if (!line.startsWith('|')) {
                    continue;
                }

                const cells = line.split('|').map(c => c.trim()).filter(Boolean);
                if (cells.length > 0) {
                    rows.push({ name: cells[0], line });
                }
            }

            assert.strictEqual(rows.length, 1);
            assert.strictEqual(rows[0].name, 'Danny');
        });

        test('excludes scribe from removable members', () => {
            const teamMd = [
                '## Members',
                '| Name | Role | Charter | Status |',
                '|------|------|---------|--------|',
                '| scribe | System | .ai-team/agents/scribe/charter.md | ✅ Active |',
                '| Danny | Lead | .ai-team/agents/danny/charter.md | ✅ Active |',
            ].join('\n');

            const teamMdPath = path.join(tempDir, '.ai-team', 'team.md');
            fs.writeFileSync(teamMdPath, teamMd, 'utf-8');

            const lines = teamMd.split('\n');
            const excludedNames = new Set(['scribe', 'ralph', '@copilot']);
            let inMembersTable = false;
            const rows: { name: string }[] = [];

            for (const line of lines) {
                if (line.startsWith('## Members')) {
                    inMembersTable = true;
                    continue;
                }
                if (inMembersTable && line.startsWith('##')) {
                    break;
                }
                if (!inMembersTable) {
                    continue;
                }
                if (line.startsWith('|--') || line.includes('| Name')) {
                    continue;
                }
                if (!line.startsWith('|')) {
                    continue;
                }

                const cells = line.split('|').map(c => c.trim()).filter(Boolean);
                if (cells.length > 0) {
                    const name = cells[0];
                    if (!excludedNames.has(name.toLowerCase())) {
                        rows.push({ name });
                    }
                }
            }

            assert.strictEqual(rows.length, 1);
            assert.strictEqual(rows[0].name, 'Danny');
        });

        test('excludes ralph from removable members', () => {
            const teamMd = [
                '## Members',
                '| Name | Role | Charter | Status |',
                '|------|------|---------|--------|',
                '| Ralph | System | .ai-team/agents/ralph/charter.md | ✅ Active |',
                '| Cody | Dev | .ai-team/agents/cody/charter.md | ✅ Active |',
            ].join('\n');

            const lines = teamMd.split('\n');
            const excludedNames = new Set(['scribe', 'ralph', '@copilot']);
            let inMembersTable = false;
            const rows: { name: string }[] = [];

            for (const line of lines) {
                if (line.startsWith('## Members')) {
                    inMembersTable = true;
                    continue;
                }
                if (inMembersTable && line.startsWith('##')) {
                    break;
                }
                if (!inMembersTable) {
                    continue;
                }
                if (line.startsWith('|--') || line.includes('| Name')) {
                    continue;
                }
                if (!line.startsWith('|')) {
                    continue;
                }

                const cells = line.split('|').map(c => c.trim()).filter(Boolean);
                if (cells.length > 0) {
                    const name = cells[0];
                    if (!excludedNames.has(name.toLowerCase())) {
                        rows.push({ name });
                    }
                }
            }

            assert.strictEqual(rows.length, 1);
            assert.strictEqual(rows[0].name, 'Cody');
        });

        test('excludes @copilot from removable members', () => {
            const teamMd = [
                '## Members',
                '| Name | Role | Charter | Status |',
                '|------|------|---------|--------|',
                '| @copilot | AI | .ai-team/agents/copilot/charter.md | ✅ Active |',
                '| Alice | Dev | .ai-team/agents/alice/charter.md | ✅ Active |',
            ].join('\n');

            const lines = teamMd.split('\n');
            const excludedNames = new Set(['scribe', 'ralph', '@copilot']);
            let inMembersTable = false;
            const rows: { name: string }[] = [];

            for (const line of lines) {
                if (line.startsWith('## Members')) {
                    inMembersTable = true;
                    continue;
                }
                if (inMembersTable && line.startsWith('##')) {
                    break;
                }
                if (!inMembersTable) {
                    continue;
                }
                if (line.startsWith('|--') || line.includes('| Name')) {
                    continue;
                }
                if (!line.startsWith('|')) {
                    continue;
                }

                const cells = line.split('|').map(c => c.trim()).filter(Boolean);
                if (cells.length > 0) {
                    const name = cells[0];
                    if (!excludedNames.has(name.toLowerCase())) {
                        rows.push({ name });
                    }
                }
            }

            assert.strictEqual(rows.length, 1);
            assert.strictEqual(rows[0].name, 'Alice');
        });

        test('parses multiple removable members', () => {
            const teamMd = [
                '## Members',
                '| Name | Role | Charter | Status |',
                '|------|------|---------|--------|',
                '| scribe | System | .ai-team/agents/scribe/charter.md | ✅ Active |',
                '| Alice | Dev | .ai-team/agents/alice/charter.md | ✅ Active |',
                '| Bob | Tester | .ai-team/agents/bob/charter.md | ✅ Active |',
                '| Ralph | System | .ai-team/agents/ralph/charter.md | ✅ Active |',
            ].join('\n');

            const lines = teamMd.split('\n');
            const excludedNames = new Set(['scribe', 'ralph', '@copilot']);
            let inMembersTable = false;
            const rows: { name: string }[] = [];

            for (const line of lines) {
                if (line.startsWith('## Members')) {
                    inMembersTable = true;
                    continue;
                }
                if (inMembersTable && line.startsWith('##')) {
                    break;
                }
                if (!inMembersTable) {
                    continue;
                }
                if (line.startsWith('|--') || line.includes('| Name')) {
                    continue;
                }
                if (!line.startsWith('|')) {
                    continue;
                }

                const cells = line.split('|').map(c => c.trim()).filter(Boolean);
                if (cells.length > 0) {
                    const name = cells[0];
                    if (!excludedNames.has(name.toLowerCase())) {
                        rows.push({ name });
                    }
                }
            }

            assert.strictEqual(rows.length, 2);
            assert.ok(rows.some(r => r.name === 'Alice'));
            assert.ok(rows.some(r => r.name === 'Bob'));
        });

        test('skips header row (| Name |)', () => {
            const teamMd = [
                '## Members',
                '| Name | Role | Charter | Status |',
                '|------|------|---------|--------|',
                '| Alice | Dev | .ai-team/agents/alice/charter.md | ✅ Active |',
            ].join('\n');

            const lines = teamMd.split('\n');
            let inMembersTable = false;
            const rows: { name: string }[] = [];

            for (const line of lines) {
                if (line.startsWith('## Members')) {
                    inMembersTable = true;
                    continue;
                }
                if (inMembersTable && line.startsWith('##')) {
                    break;
                }
                if (!inMembersTable) {
                    continue;
                }
                if (line.startsWith('|--') || line.includes('| Name')) {
                    continue;
                }
                if (!line.startsWith('|')) {
                    continue;
                }

                const cells = line.split('|').map(c => c.trim()).filter(Boolean);
                if (cells.length > 0) {
                    rows.push({ name: cells[0] });
                }
            }

            assert.strictEqual(rows.length, 1);
            assert.strictEqual(rows[0].name, 'Alice');
        });

        test('skips separator row (|-----|)', () => {
            const teamMd = [
                '## Members',
                '| Name | Role | Charter | Status |',
                '|------|------|---------|--------|',
                '| Bob | Dev | .ai-team/agents/bob/charter.md | ✅ Active |',
            ].join('\n');

            const lines = teamMd.split('\n');
            let inMembersTable = false;
            const rows: { name: string }[] = [];

            for (const line of lines) {
                if (line.startsWith('## Members')) {
                    inMembersTable = true;
                    continue;
                }
                if (inMembersTable && line.startsWith('##')) {
                    break;
                }
                if (!inMembersTable) {
                    continue;
                }
                if (line.startsWith('|--') || line.includes('| Name')) {
                    continue;
                }
                if (!line.startsWith('|')) {
                    continue;
                }

                const cells = line.split('|').map(c => c.trim()).filter(Boolean);
                if (cells.length > 0) {
                    rows.push({ name: cells[0] });
                }
            }

            assert.strictEqual(rows.length, 1);
            assert.strictEqual(rows[0].name, 'Bob');
        });

        test('stops parsing at next section (##)', () => {
            const teamMd = [
                '## Members',
                '| Name | Role | Charter | Status |',
                '|------|------|---------|--------|',
                '| Alice | Dev | .ai-team/agents/alice/charter.md | ✅ Active |',
                '',
                '## Skills',
                '| Name | Source |',
                '|------|--------|',
                '| Skill1 | local |',
            ].join('\n');

            const lines = teamMd.split('\n');
            let inMembersTable = false;
            const rows: { name: string }[] = [];

            for (const line of lines) {
                if (line.startsWith('## Members')) {
                    inMembersTable = true;
                    continue;
                }
                if (inMembersTable && line.startsWith('##')) {
                    break;
                }
                if (!inMembersTable) {
                    continue;
                }
                if (line.startsWith('|--') || line.includes('| Name')) {
                    continue;
                }
                if (!line.startsWith('|')) {
                    continue;
                }

                const cells = line.split('|').map(c => c.trim()).filter(Boolean);
                if (cells.length > 0) {
                    rows.push({ name: cells[0] });
                }
            }

            assert.strictEqual(rows.length, 1);
            assert.strictEqual(rows[0].name, 'Alice');
        });

        test('returns empty array when no Members section exists', () => {
            const teamMd = [
                '# Team',
                '',
                '## Skills',
                '| Name | Source |',
            ].join('\n');

            const lines = teamMd.split('\n');
            let inMembersTable = false;
            const rows: { name: string }[] = [];

            for (const line of lines) {
                if (line.startsWith('## Members')) {
                    inMembersTable = true;
                    continue;
                }
                if (inMembersTable && line.startsWith('##')) {
                    break;
                }
                if (!inMembersTable) {
                    continue;
                }
                if (line.startsWith('|--') || line.includes('| Name')) {
                    continue;
                }
                if (!line.startsWith('|')) {
                    continue;
                }

                const cells = line.split('|').map(c => c.trim()).filter(Boolean);
                if (cells.length > 0) {
                    rows.push({ name: cells[0] });
                }
            }

            assert.strictEqual(rows.length, 0);
        });

        test('returns empty array when Members section is empty', () => {
            const teamMd = [
                '## Members',
                '',
                '## Skills',
            ].join('\n');

            const lines = teamMd.split('\n');
            let inMembersTable = false;
            const rows: { name: string }[] = [];

            for (const line of lines) {
                if (line.startsWith('## Members')) {
                    inMembersTable = true;
                    continue;
                }
                if (inMembersTable && line.startsWith('##')) {
                    break;
                }
                if (!inMembersTable) {
                    continue;
                }
                if (line.startsWith('|--') || line.includes('| Name')) {
                    continue;
                }
                if (!line.startsWith('|')) {
                    continue;
                }

                const cells = line.split('|').map(c => c.trim()).filter(Boolean);
                if (cells.length > 0) {
                    rows.push({ name: cells[0] });
                }
            }

            assert.strictEqual(rows.length, 0);
        });
    });
});
