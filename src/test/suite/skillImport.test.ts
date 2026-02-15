/**
 * Tests for the skill import feature (GitHub issue #39).
 *
 * Covers:
 * - SkillCatalogService.parseInstalledSkill() — SKILL.md parsing
 * - SkillCatalogService.getInstalledSkills() — listing installed skills
 * - Edge cases: malformed SKILL.md, empty directory, missing fields
 * - Deduplication logic
 * - Command registration: squadui.addSkill
 * - Skill tree node rendering
 *
 * Follows repo conventions:
 * - Mocha TDD style with suite() and test()
 * - Temp dirs in test-fixtures/temp-*
 * - Command tests use this.skip() guard
 * - VS Code API stubs use `as any` casts
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { SkillCatalogService } from '../../services/SkillCatalogService';
import { Skill } from '../../models';
import { SkillsTreeProvider } from '../../views/SquadTreeProvider';
import {
    MockSquadDataProvider,
    createMockMembers,
    createMockTasks,
} from '../mocks/squadDataProvider';

const TEST_FIXTURES_ROOT = path.resolve(__dirname, '../../../test-fixtures');

suite('Skill Import Feature (Issue #39)', () => {
    let service: SkillCatalogService;

    setup(() => {
        service = new SkillCatalogService();
    });

    // ─── parseInstalledSkill() Tests ─────────────────────────────────────

    suite('parseInstalledSkill()', () => {
        test('parses skill name from first H1 heading', () => {
            const content = '# Code Review Expert\n\nHelps with code reviews.\n';
            const skill = (service as any).parseInstalledSkill('code-review', content);

            assert.strictEqual(skill.name, 'Code Review Expert');
        });

        test('uses directory name as fallback when no heading present', () => {
            const content = 'No heading here, just content.\n';
            const skill = (service as any).parseInstalledSkill('fallback-skill', content);

            assert.strictEqual(skill.name, 'fallback-skill');
        });

        test('strips "Skill: " prefix from name (case-insensitive)', () => {
            const content = '# Skill: Documentation Writer\n\nWrites docs.\n';
            const skill = (service as any).parseInstalledSkill('doc-writer', content);

            assert.strictEqual(skill.name, 'Documentation Writer');
        });

        test('parses description from first paragraph', () => {
            const content = '# Test Skill\n\nThis is the description paragraph.\n\n## Details\n\nMore content.\n';
            const skill = (service as any).parseInstalledSkill('test', content);

            assert.strictEqual(skill.description, 'This is the description paragraph.');
        });

        test('falls back to name as description when no paragraph found', () => {
            const content = '# My Skill\n\n## Heading Only\n';
            const skill = (service as any).parseInstalledSkill('my-skill', content);

            assert.strictEqual(skill.description, 'My Skill');
        });

        test('skips blockquotes when extracting description', () => {
            const content = '# Skill Name\n\n> This is a quote\n\nThis is the description.\n';
            const skill = (service as any).parseInstalledSkill('skill', content);

            assert.strictEqual(skill.description, 'This is the description.');
        });

        test('skips "**Source:**" lines when extracting description', () => {
            const content = '# Skill Name\n\n**Source:** [awesome-copilot](url)\n\nActual description.\n';
            const skill = (service as any).parseInstalledSkill('skill', content);

            assert.strictEqual(skill.description, 'Actual description.');
        });

        test('parses YAML frontmatter for name', () => {
            const content = `---
name: "YAML Name"
description: "YAML Description"
---

# Markdown Heading

Body text.
`;
            const skill = (service as any).parseInstalledSkill('dir-name', content);

            assert.strictEqual(skill.name, 'YAML Name');
            assert.strictEqual(skill.description, 'YAML Description');
        });

        test('YAML frontmatter overrides markdown heading', () => {
            const content = `---
name: "Frontmatter Name"
---

# Markdown Name

Description text.
`;
            const skill = (service as any).parseInstalledSkill('dir', content);

            assert.strictEqual(skill.name, 'Frontmatter Name');
        });

        test('parses confidence from YAML frontmatter', () => {
            const content = `---
name: "Test Skill"
confidence: high
---

Body.
`;
            const skill = (service as any).parseInstalledSkill('test', content);

            assert.strictEqual(skill.confidence, 'high');
        });

        test('ignores invalid confidence values in frontmatter', () => {
            const content = `---
name: "Test Skill"
confidence: invalid
---

Body.
`;
            const skill = (service as any).parseInstalledSkill('test', content);

            assert.strictEqual(skill.confidence, undefined);
        });

        test('sets source to "local" for installed skills', () => {
            const content = '# Skill\n\nDescription.\n';
            const skill = (service as any).parseInstalledSkill('skill', content);

            assert.strictEqual(skill.source, 'local');
        });

        test('includes raw content in returned Skill object', () => {
            const content = '# Test Skill\n\nSome content.\n';
            const skill = (service as any).parseInstalledSkill('test', content);

            assert.strictEqual(skill.content, content);
        });

        test('includes directory slug in returned Skill object', () => {
            const content = '# Test Skill\n\nContent.\n';
            const skill = (service as any).parseInstalledSkill('test-slug', content);

            assert.strictEqual(skill.slug, 'test-slug');
        });

        test('handles empty content gracefully', () => {
            const content = '';
            const skill = (service as any).parseInstalledSkill('empty', content);

            assert.strictEqual(skill.name, 'empty');
            assert.strictEqual(skill.description, 'empty');
        });

        test('handles malformed YAML frontmatter gracefully', () => {
            const content = `---
broken yaml: [unclosed
---

# Skill Name

Description.
`;
            const skill = (service as any).parseInstalledSkill('skill', content);

            // Should fall back to markdown parsing
            assert.strictEqual(skill.name, 'Skill Name');
            assert.strictEqual(skill.description, 'Description.');
        });

        test('handles single-line content', () => {
            const content = '# Only Heading';
            const skill = (service as any).parseInstalledSkill('single', content);

            assert.strictEqual(skill.name, 'Only Heading');
            assert.strictEqual(skill.description, 'Only Heading');
        });

        test('handles content with only whitespace', () => {
            const content = '   \n\n   \n';
            const skill = (service as any).parseInstalledSkill('whitespace', content);

            assert.strictEqual(skill.name, 'whitespace');
            assert.strictEqual(skill.description, 'whitespace');
        });
    });

    // ─── getInstalledSkills() Tests ──────────────────────────────────────

    suite('getInstalledSkills()', () => {
        let tempDir: string;

        setup(() => {
            tempDir = path.join(TEST_FIXTURES_ROOT, `temp-skill-import-${Date.now()}`);
        });

        teardown(() => {
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
            } catch {
                // Ignore cleanup errors
            }
        });

        test('returns empty array when .ai-team/skills/ does not exist', () => {
            const skills = service.getInstalledSkills(tempDir);

            assert.deepStrictEqual(skills, []);
        });

        test('returns empty array when skills directory is empty', () => {
            const skillsDir = path.join(tempDir, '.ai-team', 'skills');
            fs.mkdirSync(skillsDir, { recursive: true });

            const skills = service.getInstalledSkills(tempDir);

            assert.deepStrictEqual(skills, []);
        });

        test('reads all skill directories with SKILL.md', () => {
            const skillsDir = path.join(tempDir, '.ai-team', 'skills');
            fs.mkdirSync(path.join(skillsDir, 'skill1'), { recursive: true });
            fs.mkdirSync(path.join(skillsDir, 'skill2'), { recursive: true });
            fs.writeFileSync(path.join(skillsDir, 'skill1', 'SKILL.md'), '# Skill 1\n\nFirst skill.\n');
            fs.writeFileSync(path.join(skillsDir, 'skill2', 'SKILL.md'), '# Skill 2\n\nSecond skill.\n');

            const skills = service.getInstalledSkills(tempDir);

            assert.strictEqual(skills.length, 2);
            const names = skills.map(s => s.name);
            assert.ok(names.includes('Skill 1'));
            assert.ok(names.includes('Skill 2'));
        });

        test('skips directories without SKILL.md', () => {
            const skillsDir = path.join(tempDir, '.ai-team', 'skills');
            fs.mkdirSync(path.join(skillsDir, 'valid-skill'), { recursive: true });
            fs.mkdirSync(path.join(skillsDir, 'invalid-skill'), { recursive: true });
            fs.writeFileSync(path.join(skillsDir, 'valid-skill', 'SKILL.md'), '# Valid\n\nContent.\n');
            fs.writeFileSync(path.join(skillsDir, 'invalid-skill', 'README.md'), 'No SKILL.md here');

            const skills = service.getInstalledSkills(tempDir);

            assert.strictEqual(skills.length, 1);
            assert.strictEqual(skills[0].name, 'Valid');
        });

        test('skips files in skills directory (only processes directories)', () => {
            const skillsDir = path.join(tempDir, '.ai-team', 'skills');
            fs.mkdirSync(skillsDir, { recursive: true });
            fs.writeFileSync(path.join(skillsDir, 'file.txt'), 'Not a directory');
            fs.mkdirSync(path.join(skillsDir, 'valid-skill'), { recursive: true });
            fs.writeFileSync(path.join(skillsDir, 'valid-skill', 'SKILL.md'), '# Valid\n\nContent.\n');

            const skills = service.getInstalledSkills(tempDir);

            assert.strictEqual(skills.length, 1);
            assert.strictEqual(skills[0].name, 'Valid');
        });

        test('handles skill directories with complex names', () => {
            const skillsDir = path.join(tempDir, '.ai-team', 'skills');
            fs.mkdirSync(path.join(skillsDir, 'complex-skill-name-123'), { recursive: true });
            fs.writeFileSync(
                path.join(skillsDir, 'complex-skill-name-123', 'SKILL.md'),
                '# Complex Skill\n\nContent.\n'
            );

            const skills = service.getInstalledSkills(tempDir);

            assert.strictEqual(skills.length, 1);
            assert.strictEqual(skills[0].name, 'Complex Skill');
            assert.strictEqual(skills[0].slug, 'complex-skill-name-123');
        });

        test('all installed skills have source "local"', () => {
            const skillsDir = path.join(tempDir, '.ai-team', 'skills');
            fs.mkdirSync(path.join(skillsDir, 'skill1'), { recursive: true });
            fs.mkdirSync(path.join(skillsDir, 'skill2'), { recursive: true });
            fs.writeFileSync(path.join(skillsDir, 'skill1', 'SKILL.md'), '# Skill 1\n');
            fs.writeFileSync(path.join(skillsDir, 'skill2', 'SKILL.md'), '# Skill 2\n');

            const skills = service.getInstalledSkills(tempDir);

            assert.strictEqual(skills.length, 2);
            skills.forEach(skill => {
                assert.strictEqual(skill.source, 'local', `${skill.name} should have source "local"`);
            });
        });

        test('all installed skills include raw content', () => {
            const skillsDir = path.join(tempDir, '.ai-team', 'skills');
            fs.mkdirSync(path.join(skillsDir, 'skill1'), { recursive: true });
            fs.writeFileSync(path.join(skillsDir, 'skill1', 'SKILL.md'), '# Skill 1\n\nContent here.\n');

            const skills = service.getInstalledSkills(tempDir);

            assert.strictEqual(skills.length, 1);
            assert.ok(skills[0].content);
            assert.ok(skills[0].content!.includes('Skill 1'));
            assert.ok(skills[0].content!.includes('Content here'));
        });

        test('handles malformed SKILL.md files gracefully', () => {
            const skillsDir = path.join(tempDir, '.ai-team', 'skills');
            fs.mkdirSync(path.join(skillsDir, 'malformed'), { recursive: true });
            fs.writeFileSync(path.join(skillsDir, 'malformed', 'SKILL.md'), 'Random text no heading');

            const skills = service.getInstalledSkills(tempDir);

            assert.strictEqual(skills.length, 1);
            assert.strictEqual(skills[0].name, 'malformed'); // Falls back to dir name
        });

        test('handles empty SKILL.md files', () => {
            const skillsDir = path.join(tempDir, '.ai-team', 'skills');
            fs.mkdirSync(path.join(skillsDir, 'empty'), { recursive: true });
            fs.writeFileSync(path.join(skillsDir, 'empty', 'SKILL.md'), '');

            const skills = service.getInstalledSkills(tempDir);

            assert.strictEqual(skills.length, 1);
            assert.strictEqual(skills[0].name, 'empty');
            assert.strictEqual(skills[0].description, 'empty');
        });

        test('handles SKILL.md with only frontmatter', () => {
            const skillsDir = path.join(tempDir, '.ai-team', 'skills');
            fs.mkdirSync(path.join(skillsDir, 'frontmatter-only'), { recursive: true });
            fs.writeFileSync(
                path.join(skillsDir, 'frontmatter-only', 'SKILL.md'),
                '---\nname: "FM Skill"\ndescription: "FM Description"\n---\n'
            );

            const skills = service.getInstalledSkills(tempDir);

            assert.strictEqual(skills.length, 1);
            assert.strictEqual(skills[0].name, 'FM Skill');
            assert.strictEqual(skills[0].description, 'FM Description');
        });
    });

    // ─── Deduplication Tests ─────────────────────────────────────────────

    suite('Deduplication Logic', () => {
        test('deduplicateSkills() prefers awesome-copilot over skills.sh', () => {
            const skills: Skill[] = [
                {
                    name: 'Code Review',
                    description: 'From skills.sh',
                    source: 'skills.sh',
                },
                {
                    name: 'Code Review',
                    description: 'From awesome-copilot',
                    source: 'awesome-copilot',
                },
            ];

            const deduplicated = (service as any).deduplicateSkills(skills);

            assert.strictEqual(deduplicated.length, 1);
            assert.strictEqual(deduplicated[0].source, 'awesome-copilot');
            assert.strictEqual(deduplicated[0].description, 'From awesome-copilot');
        });

        test('deduplicates based on case-insensitive name matching', () => {
            const skills: Skill[] = [
                { name: 'Code Review', description: 'First', source: 'awesome-copilot' },
                { name: 'code review', description: 'Second', source: 'skills.sh' },
                { name: 'CODE REVIEW', description: 'Third', source: 'skills.sh' },
            ];

            const deduplicated = (service as any).deduplicateSkills(skills);

            assert.strictEqual(deduplicated.length, 1);
        });

        test('keeps first occurrence when sources are the same', () => {
            const skills: Skill[] = [
                { name: 'Skill A', description: 'First', source: 'awesome-copilot' },
                { name: 'Skill A', description: 'Second', source: 'awesome-copilot' },
            ];

            const deduplicated = (service as any).deduplicateSkills(skills);

            assert.strictEqual(deduplicated.length, 1);
            assert.strictEqual(deduplicated[0].description, 'First');
        });

        test('does not merge when names differ', () => {
            const skills: Skill[] = [
                { name: 'Code Review', description: 'First', source: 'awesome-copilot' },
                { name: 'Code Reviewer', description: 'Second', source: 'skills.sh' },
            ];

            const deduplicated = (service as any).deduplicateSkills(skills);

            assert.strictEqual(deduplicated.length, 2);
        });

        test('handles empty skills array', () => {
            const deduplicated = (service as any).deduplicateSkills([]);

            assert.strictEqual(deduplicated.length, 0);
        });

        test('handles single skill', () => {
            const skills: Skill[] = [
                { name: 'Single Skill', description: 'Only one', source: 'awesome-copilot' },
            ];

            const deduplicated = (service as any).deduplicateSkills(skills);

            assert.strictEqual(deduplicated.length, 1);
        });
    });

    // ─── Error Handling Tests ────────────────────────────────────────────

    suite('Error Handling', () => {
        test('getInstalledSkills() handles nonexistent workspace root gracefully', () => {
            const skills = service.getInstalledSkills('/nonexistent/path/nowhere');

            assert.deepStrictEqual(skills, []);
        });

        test('getInstalledSkills() handles read errors gracefully', () => {
            // Pass a file path instead of directory path to trigger read error
            const filePath = path.join(TEST_FIXTURES_ROOT, 'package.json');
            if (fs.existsSync(filePath)) {
                const skills = service.getInstalledSkills(filePath);
                assert.deepStrictEqual(skills, []);
            }
        });

        test('parseInstalledSkill() handles null characters in content', () => {
            const content = '# Skill\n\nDescription with \x00 null char.\n';
            const skill = (service as any).parseInstalledSkill('skill', content);

            assert.ok(skill.name);
            assert.ok(skill.description);
        });

        test('parseInstalledSkill() handles very long content', () => {
            const longContent = '# Long Skill\n\n' + 'A'.repeat(100000) + '\n';
            const skill = (service as any).parseInstalledSkill('long', longContent);

            assert.strictEqual(skill.name, 'Long Skill');
            assert.ok(skill.content!.length > 100000);
        });
    });

    // ─── Command Registration Tests ──────────────────────────────────────

    suite('Command Registration', () => {
        test('squadui.addSkill command is registered', async function () {
            const extension = vscode.extensions.getExtension('csharpfritz.squadui');
            if (!extension || !extension.isActive || !vscode.workspace.workspaceFolders?.length) {
                this.skip();
                return;
            }

            const commands = await vscode.commands.getCommands(true);
            assert.ok(
                commands.includes('squadui.addSkill'),
                'squadui.addSkill command should be registered'
            );
        });

        test('squadui.addSkill is declared in package.json', async () => {
            const extension = vscode.extensions.getExtension('csharpfritz.squadui');
            if (extension) {
                const packageJson = extension.packageJSON;
                const cmds = packageJson?.contributes?.commands || [];
                const hasCmd = cmds.some(
                    (c: { command: string }) => c.command === 'squadui.addSkill'
                );
                assert.ok(hasCmd, 'addSkill should be declared in package.json commands');
            }
        });
    });

    // ─── Skill Tree Node Tests ───────────────────────────────────────────

    suite('Skill Tree Nodes', () => {
        let provider: SkillsTreeProvider;
        let mockDataProvider: MockSquadDataProvider;

        setup(() => {
            const members = createMockMembers();
            const tasks = createMockTasks();
            mockDataProvider = new MockSquadDataProvider({ members, tasks });
            provider = new SkillsTreeProvider(mockDataProvider as any);
        });

        test('getChildren() returns skill items at root level', async () => {
            const children = await provider.getChildren();

            assert.ok(children.length > 0, 'Should have at least one skill');
            children.forEach(child => {
                assert.strictEqual(child.itemType, 'skill', 'All root items should be skills');
            });
        });

        test('skill items have correct labels', async () => {
            const children = await provider.getChildren();

            children.forEach(child => {
                assert.ok(child.label, 'Skill should have a label');
                assert.ok(typeof child.label === 'string', 'Label should be a string');
            });
        });

        test('skill items have description field', async () => {
            const children = await provider.getChildren();

            if (children.length > 0) {
                const firstSkill = children[0];
                assert.ok(
                    firstSkill.description !== undefined,
                    'Skill should have a description'
                );
            }
        });

        test('skill items are not collapsible', async () => {
            const children = await provider.getChildren();

            children.forEach(child => {
                assert.strictEqual(
                    child.collapsibleState,
                    vscode.TreeItemCollapsibleState.None,
                    'Skills should not be collapsible'
                );
            });
        });

        test('skill items include icon path', async () => {
            const children = await provider.getChildren();

            if (children.length > 0) {
                const firstSkill = children[0];
                // Icon path is optional, but if present should be valid
                if (firstSkill.iconPath) {
                    assert.ok(
                        typeof firstSkill.iconPath === 'string' ||
                        (typeof firstSkill.iconPath === 'object' && 'light' in firstSkill.iconPath),
                        'Icon path should be string or ThemeIcon object'
                    );
                }
            }
        });

        test('getChildren() for skill item returns empty array', async () => {
            const children = await provider.getChildren();

            if (children.length > 0) {
                const skillChildren = await provider.getChildren(children[0]);
                assert.strictEqual(
                    skillChildren.length,
                    0,
                    'Skill items should have no children'
                );
            }
        });

        test('skill items have contextValue for command binding', async () => {
            const children = await provider.getChildren();

            if (children.length > 0) {
                const firstSkill = children[0];
                assert.ok(
                    firstSkill.contextValue,
                    'Skill should have contextValue for context menu'
                );
            }
        });
    });

    // ─── Edge Case Tests ─────────────────────────────────────────────────

    suite('Edge Cases', () => {
        test('handles skill name with unicode characters', () => {
            const content = '# 日本語スキル 🎯\n\nUnicode description.\n';
            const skill = (service as any).parseInstalledSkill('unicode', content);

            assert.strictEqual(skill.name, '日本語スキル 🎯');
            assert.strictEqual(skill.description, 'Unicode description.');
        });

        test('handles SKILL.md with Windows line endings (CRLF)', () => {
            const content = '# Windows Skill\r\n\r\nDescription line.\r\n';
            const skill = (service as any).parseInstalledSkill('windows', content);

            assert.strictEqual(skill.name, 'Windows Skill');
            assert.strictEqual(skill.description, 'Description line.');
        });

        test('handles SKILL.md with mixed line endings', () => {
            const content = '# Mixed Endings\r\n\nDescription.\r\nMore text.\n';
            const skill = (service as any).parseInstalledSkill('mixed', content);

            assert.strictEqual(skill.name, 'Mixed Endings');
        });

        test('handles skill with only heading (no body)', () => {
            const content = '# Heading Only Skill';
            const skill = (service as any).parseInstalledSkill('heading-only', content);

            assert.strictEqual(skill.name, 'Heading Only Skill');
            assert.strictEqual(skill.description, 'Heading Only Skill');
        });

        test('handles multiple H1 headings (uses first)', () => {
            const content = '# First Heading\n\nDescription.\n\n# Second Heading\n\nMore.\n';
            const skill = (service as any).parseInstalledSkill('multi', content);

            assert.strictEqual(skill.name, 'First Heading');
        });

        test('handles YAML frontmatter with quotes and special chars', () => {
            const content = `---
name: "Skill with \\"quotes\\""
description: "Description with 'apostrophes' and: colons"
---

Body.
`;
            const skill = (service as any).parseInstalledSkill('quotes', content);

            assert.ok(skill.name.includes('quotes'));
            assert.ok(skill.description.includes('apostrophes'));
        });

        test('handles frontmatter without closing delimiter', () => {
            const content = `---
name: "Incomplete Frontmatter"

# Heading

Description.
`;
            const skill = (service as any).parseInstalledSkill('incomplete', content);

            // Should parse frontmatter correctly (closing delimiter is on line with "# Heading" or beyond)
            assert.ok(skill.name);
        });

        test('handles content with multiple consecutive blank lines', () => {
            const content = '# Skill Name\n\n\n\n\nDescription after blanks.\n';
            const skill = (service as any).parseInstalledSkill('blanks', content);

            assert.strictEqual(skill.name, 'Skill Name');
            assert.strictEqual(skill.description, 'Description after blanks.');
        });
    });
});
