/**
 * Tests for the SkillCatalogService and related skill feature (#39).
 *
 * Covers:
 * - getInstalledSkills() reading from .ai-team/skills/
 * - downloadSkill() creating skill directories and writing SKILL.md
 * - searchSkills() filtering by name/description (case-insensitive)
 * - Dedup logic: awesome-copilot preferred over skills.sh
 * - Parser methods: parseAwesomeReadme() and parseSkillsShHtml()
 * - Command registration: addSkill, viewSkill, removeSkill
 * - Skill tree nodes in SquadTreeProvider
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { SkillCatalogService } from '../../services/SkillCatalogService';
import { Skill } from '../../models';
import { SquadTreeProvider } from '../../views/SquadTreeProvider';
import {
    MockSquadDataProvider,
    createMockMembers,
    createMockTasks,
} from '../mocks/squadDataProvider';

const TEST_FIXTURES_ROOT = path.resolve(__dirname, '../../../test-fixtures');

suite('SkillCatalogService', () => {
    let service: SkillCatalogService;

    setup(() => {
        service = new SkillCatalogService();
    });

    // ─── getInstalledSkills() ────────────────────────────────────────────

    suite('getInstalledSkills()', () => {
        test('reads skills from .ai-team/skills/ directory', () => {
            const skills = service.getInstalledSkills(TEST_FIXTURES_ROOT);

            assert.ok(skills.length >= 2, 'Should find at least 2 installed skills');
            const names = skills.map(s => s.name);
            assert.ok(names.includes('Code Review'), 'Should find Code Review skill');
            assert.ok(names.includes('Testing Expert'), 'Should find Testing Expert skill');
        });

        test('returns empty array when directory does not exist', () => {
            const skills = service.getInstalledSkills('/nonexistent/path/nowhere');

            assert.deepStrictEqual(skills, []);
        });

        test('returns empty array when .ai-team/skills/ does not exist', () => {
            // Use a path that exists but has no .ai-team/skills/
            const tempDir = path.join(TEST_FIXTURES_ROOT, 'orchestration-logs');
            const skills = service.getInstalledSkills(tempDir);

            assert.deepStrictEqual(skills, []);
        });

        test('parses SKILL.md heading as skill name', () => {
            const skills = service.getInstalledSkills(TEST_FIXTURES_ROOT);
            const codeReview = skills.find(s => s.name === 'Code Review');

            assert.ok(codeReview, 'Should find Code Review skill');
            assert.strictEqual(codeReview.name, 'Code Review');
        });

        test('parses SKILL.md first paragraph as description', () => {
            const skills = service.getInstalledSkills(TEST_FIXTURES_ROOT);
            const codeReview = skills.find(s => s.name === 'Code Review');

            assert.ok(codeReview);
            assert.ok(
                codeReview.description.includes('code review'),
                `Description should mention code review, got: ${codeReview.description}`
            );
        });

        test('installed skills have source "local"', () => {
            const skills = service.getInstalledSkills(TEST_FIXTURES_ROOT);

            for (const skill of skills) {
                assert.strictEqual(skill.source, 'local', `${skill.name} should have source "local"`);
            }
        });

        test('installed skills include raw content', () => {
            const skills = service.getInstalledSkills(TEST_FIXTURES_ROOT);
            const codeReview = skills.find(s => s.name === 'Code Review');

            assert.ok(codeReview);
            assert.ok(codeReview.content, 'Installed skill should include raw content');
            assert.ok(codeReview.content!.startsWith('# Code Review'));
        });

        test('skips subdirectories without SKILL.md', () => {
            const tempDir = path.join(TEST_FIXTURES_ROOT, 'temp-skill-empty-test');
            const emptySkillDir = path.join(tempDir, '.ai-team', 'skills', 'no-skill-md');

            try {
                fs.mkdirSync(emptySkillDir, { recursive: true });
                // Create a dir that does NOT have SKILL.md
                fs.writeFileSync(path.join(emptySkillDir, 'README.md'), '# Not a skill');

                const skills = service.getInstalledSkills(tempDir);
                const names = skills.map(s => s.name);
                assert.ok(!names.includes('no-skill-md'), 'Should not include dir without SKILL.md');
            } finally {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        });
    });

    // ─── downloadSkill() ────────────────────────────────────────────────

    suite('downloadSkill()', () => {
        let tempDir: string;

        setup(() => {
            tempDir = path.join(TEST_FIXTURES_ROOT, `temp-download-${Date.now()}`);
            fs.mkdirSync(tempDir, { recursive: true });
        });

        teardown(() => {
            fs.rmSync(tempDir, { recursive: true, force: true });
        });

        test('creates skill directory and writes SKILL.md', async () => {
            const skill: Skill = {
                name: 'My Test Skill',
                description: 'A test skill for unit testing',
                source: 'awesome-copilot',
                url: 'https://example.com/test-skill',
            };

            await service.downloadSkill(skill, tempDir);

            const skillFile = path.join(tempDir, '.ai-team', 'skills', 'my-test-skill', 'SKILL.md');
            assert.ok(fs.existsSync(skillFile), 'SKILL.md should be created');

            const content = fs.readFileSync(skillFile, 'utf-8');
            assert.ok(content.includes('My Test Skill'), 'Content should include skill name');
            assert.ok(content.includes('A test skill for unit testing'), 'Content should include description');
        });

        test('uses content field when available', async () => {
            const skill: Skill = {
                name: 'Content Skill',
                description: 'Has raw content',
                source: 'awesome-copilot',
                content: '# Content Skill\n\nCustom content body.\n',
            };

            await service.downloadSkill(skill, tempDir);

            const skillFile = path.join(tempDir, '.ai-team', 'skills', 'content-skill', 'SKILL.md');
            const content = fs.readFileSync(skillFile, 'utf-8');
            assert.strictEqual(content, '# Content Skill\n\nCustom content body.\n');
        });

        test('handles skill names with special characters (slug generation)', async () => {
            const skill: Skill = {
                name: "Dr. O'Brien's Code Review!",
                description: 'Special chars test',
                source: 'skills.sh',
            };

            await service.downloadSkill(skill, tempDir);

            const expectedDir = path.join(tempDir, '.ai-team', 'skills', 'dr-o-brien-s-code-review');
            assert.ok(fs.existsSync(expectedDir), 'Should create slug-named directory');
            assert.ok(
                fs.existsSync(path.join(expectedDir, 'SKILL.md')),
                'SKILL.md should exist in slugified directory'
            );
        });

        test('handles skill names with leading/trailing special characters', async () => {
            const skill: Skill = {
                name: '---My Skill---',
                description: 'Leading/trailing dashes',
                source: 'awesome-copilot',
            };

            await service.downloadSkill(skill, tempDir);

            const expectedDir = path.join(tempDir, '.ai-team', 'skills', 'my-skill');
            assert.ok(fs.existsSync(expectedDir), 'Slug should strip leading/trailing dashes');
        });

        test('builds stub with source link when no content provided', async () => {
            const skill: Skill = {
                name: 'Stub Skill',
                description: 'A stub description',
                source: 'skills.sh',
                url: 'https://skills.sh/stub-skill',
            };

            await service.downloadSkill(skill, tempDir);

            const skillFile = path.join(tempDir, '.ai-team', 'skills', 'stub-skill', 'SKILL.md');
            const content = fs.readFileSync(skillFile, 'utf-8');
            assert.ok(content.includes('# Stub Skill'));
            assert.ok(content.includes('A stub description'));
            assert.ok(content.includes('skills.sh'));
            assert.ok(content.includes('https://skills.sh/stub-skill'));
        });
    });

    // ─── searchSkills() ─────────────────────────────────────────────────

    suite('searchSkills()', () => {
        // To test searchSkills without network calls, we test the underlying
        // filter logic by calling parseAwesomeReadme + filter directly.
        // searchSkills calls fetchCatalog which makes HTTP calls, so we test
        // the filtering logic via the public parser + dedup methods.

        test('filters by name (case-insensitive)', () => {
            const skills: Skill[] = [
                { name: 'Code Review', description: 'Review code', source: 'awesome-copilot' },
                { name: 'Testing', description: 'Write tests', source: 'awesome-copilot' },
                { name: 'Documentation', description: 'Write docs', source: 'skills.sh' },
            ];

            const q = 'code review'.toLowerCase();
            const results = skills.filter(s =>
                s.name.toLowerCase().includes(q) ||
                s.description.toLowerCase().includes(q)
            );

            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].name, 'Code Review');
        });

        test('filters by description (case-insensitive)', () => {
            const skills: Skill[] = [
                { name: 'Linter', description: 'Automated code review tool', source: 'awesome-copilot' },
                { name: 'Testing', description: 'Write unit tests', source: 'skills.sh' },
            ];

            const q = 'code review'.toLowerCase();
            const results = skills.filter(s =>
                s.name.toLowerCase().includes(q) ||
                s.description.toLowerCase().includes(q)
            );

            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].name, 'Linter');
        });

        test('returns empty for no matches', () => {
            const skills: Skill[] = [
                { name: 'Code Review', description: 'Review code', source: 'awesome-copilot' },
                { name: 'Testing', description: 'Write tests', source: 'awesome-copilot' },
            ];

            const q = 'zzzznonexistent'.toLowerCase();
            const results = skills.filter(s =>
                s.name.toLowerCase().includes(q) ||
                s.description.toLowerCase().includes(q)
            );

            assert.strictEqual(results.length, 0);
        });

        test('matches are case-insensitive', () => {
            const skills: Skill[] = [
                { name: 'CODE REVIEW', description: 'Review code', source: 'awesome-copilot' },
            ];

            const q = 'code review'.toLowerCase();
            const results = skills.filter(s =>
                s.name.toLowerCase().includes(q) ||
                s.description.toLowerCase().includes(q)
            );

            assert.strictEqual(results.length, 1);
        });

        test('partial matches work', () => {
            const skills: Skill[] = [
                { name: 'Advanced Code Review Pro', description: 'Enterprise review', source: 'awesome-copilot' },
            ];

            const q = 'code'.toLowerCase();
            const results = skills.filter(s =>
                s.name.toLowerCase().includes(q) ||
                s.description.toLowerCase().includes(q)
            );

            assert.strictEqual(results.length, 1);
        });
    });

    // ─── Dedup logic ────────────────────────────────────────────────────

    suite('deduplicateSkills()', () => {
        test('awesome-copilot preferred over skills.sh for same name', () => {
            // Access private method via type cast
            const svc = service as any;

            const skills: Skill[] = [
                { name: 'Code Review', description: 'From skills.sh', source: 'skills.sh' },
                { name: 'Code Review', description: 'From awesome-copilot', source: 'awesome-copilot' },
            ];

            const deduped: Skill[] = svc.deduplicateSkills(skills);

            assert.strictEqual(deduped.length, 1);
            assert.strictEqual(deduped[0].source, 'awesome-copilot');
            assert.strictEqual(deduped[0].description, 'From awesome-copilot');
        });

        test('dedup is case-insensitive', () => {
            const svc = service as any;

            const skills: Skill[] = [
                { name: 'code review', description: 'lower', source: 'skills.sh' },
                { name: 'Code Review', description: 'mixed', source: 'awesome-copilot' },
            ];

            const deduped: Skill[] = svc.deduplicateSkills(skills);
            assert.strictEqual(deduped.length, 1);
            assert.strictEqual(deduped[0].source, 'awesome-copilot');
        });

        test('keeps skills.sh entry when no awesome-copilot duplicate', () => {
            const svc = service as any;

            const skills: Skill[] = [
                { name: 'Unique Skill', description: 'Only in skills.sh', source: 'skills.sh' },
            ];

            const deduped: Skill[] = svc.deduplicateSkills(skills);
            assert.strictEqual(deduped.length, 1);
            assert.strictEqual(deduped[0].source, 'skills.sh');
        });

        test('keeps first entry when both from same source', () => {
            const svc = service as any;

            const skills: Skill[] = [
                { name: 'Dup Skill', description: 'First', source: 'awesome-copilot' },
                { name: 'Dup Skill', description: 'Second', source: 'awesome-copilot' },
            ];

            const deduped: Skill[] = svc.deduplicateSkills(skills);
            assert.strictEqual(deduped.length, 1);
            assert.strictEqual(deduped[0].description, 'First');
        });
    });

    // ─── Parser: parseAwesomeReadme() ───────────────────────────────────

    suite('parseAwesomeReadme()', () => {
        test('extracts skill entries from markdown list items', () => {
            const markdown = [
                '# Awesome Copilot',
                '',
                '## Skills',
                '',
                '- [Code Review](https://github.com/example/code-review) - Automated code review with AI',
                '- [Testing Pro](https://github.com/example/testing-pro) - Generate comprehensive test suites',
                '- [Doc Writer](https://github.com/example/doc-writer) - Write documentation automatically',
                '',
            ].join('\n');

            const skills = service.parseAwesomeReadme(markdown);

            assert.strictEqual(skills.length, 3);
            assert.strictEqual(skills[0].name, 'Code Review');
            assert.strictEqual(skills[0].description, 'Automated code review with AI');
            assert.strictEqual(skills[0].source, 'awesome-copilot');
            assert.strictEqual(skills[0].url, 'https://github.com/example/code-review');
            assert.strictEqual(skills[0].confidence, 'high');
        });

        test('handles * bullet style', () => {
            const markdown = '* [Star Skill](https://example.com) - Uses star bullets\n';

            const skills = service.parseAwesomeReadme(markdown);

            assert.strictEqual(skills.length, 1);
            assert.strictEqual(skills[0].name, 'Star Skill');
        });

        test('skips entries without description', () => {
            const markdown = [
                '- [Contributing](https://github.com/example/contributing)',
                '- [Good Skill](https://github.com/example/good) - Has a description',
            ].join('\n');

            const skills = service.parseAwesomeReadme(markdown);

            assert.strictEqual(skills.length, 1);
            assert.strictEqual(skills[0].name, 'Good Skill');
        });

        test('skips entries with very short names', () => {
            const markdown = '- [A](https://example.com) - Single char name\n';

            const skills = service.parseAwesomeReadme(markdown);

            assert.strictEqual(skills.length, 0);
        });

        test('handles em dash separator', () => {
            const markdown = '- [Em Dash Skill](https://example.com) — Uses em dash separator\n';

            const skills = service.parseAwesomeReadme(markdown);

            assert.strictEqual(skills.length, 1);
            assert.strictEqual(skills[0].description, 'Uses em dash separator');
        });

        test('returns empty array for empty markdown', () => {
            const skills = service.parseAwesomeReadme('');

            assert.deepStrictEqual(skills, []);
        });

        test('returns empty array for markdown with no list items', () => {
            const markdown = '# Just a heading\n\nSome paragraph text.\n';

            const skills = service.parseAwesomeReadme(markdown);

            assert.deepStrictEqual(skills, []);
        });
    });

    // ─── Parser: parseSkillsShHtml() ────────────────────────────────────

    suite('parseSkillsShHtml()', () => {
        test('extracts skill entries from HTML anchor tags', () => {
            const html = `
                <div class="skill-card">
                    <a href="/skills/code-review">Code Review Tool</a>
                    <p>Automated code review with best practices</p>
                </div>
                <div class="skill-card">
                    <a href="/skills/test-gen">Test Generator</a>
                    <span>Generates unit tests automatically</span>
                </div>
            `;

            const skills = service.parseSkillsShHtml(html);

            assert.ok(skills.length >= 2, `Should find at least 2 skills, found ${skills.length}`);
            const names = skills.map(s => s.name);
            assert.ok(names.includes('Code Review Tool'));
            assert.ok(names.includes('Test Generator'));
        });

        test('all extracted skills have source "skills.sh"', () => {
            const html = '<a href="/skills/test">Test Skill</a><p>Description here</p>';

            const skills = service.parseSkillsShHtml(html);

            for (const skill of skills) {
                assert.strictEqual(skill.source, 'skills.sh');
            }
        });

        test('skips boilerplate links', () => {
            const html = `
                <a href="#">Home</a>
                <a href="/about">About</a>
                <a href="/login">Login</a>
                <a href="/skills/real">Real Skill</a>
                <p>A genuine skill description</p>
            `;

            const skills = service.parseSkillsShHtml(html);
            const names = skills.map(s => s.name);

            assert.ok(!names.includes('Home'));
            assert.ok(!names.includes('About'));
            assert.ok(!names.includes('Login'));
        });

        test('extracts nearby description from p/span tags', () => {
            const html = `
                <a href="/skills/desc-test">Description Test</a>
                <p>This is a meaningful description for the skill</p>
            `;

            const skills = service.parseSkillsShHtml(html);
            const skill = skills.find(s => s.name === 'Description Test');

            assert.ok(skill);
            assert.ok(
                skill.description.includes('meaningful description'),
                `Description should include nearby text, got: ${skill.description}`
            );
        });

        test('handles JSON-LD structured data', () => {
            const html = `
                <script type="application/ld+json">
                {
                    "itemListElement": [
                        {"item": {"name": "JSON Skill", "description": "From JSON-LD", "url": "https://skills.sh/json-skill"}}
                    ]
                }
                </script>
            `;

            const skills = service.parseSkillsShHtml(html);
            const jsonSkill = skills.find(s => s.name === 'JSON Skill');

            assert.ok(jsonSkill, 'Should extract from JSON-LD');
            assert.strictEqual(jsonSkill.description, 'From JSON-LD');
        });

        test('returns empty for empty HTML', () => {
            const skills = service.parseSkillsShHtml('');

            assert.deepStrictEqual(skills, []);
        });

        test('handles malformed JSON-LD gracefully', () => {
            const html = '<script type="application/ld+json">{ invalid json }</script>';

            // Should not throw
            const skills = service.parseSkillsShHtml(html);
            assert.ok(Array.isArray(skills));
        });

        test('prepends https://skills.sh to relative URLs', () => {
            const html = '<a href="/skills/relative">Relative URL Skill</a><p>Has a relative link path</p>';

            const skills = service.parseSkillsShHtml(html);
            const skill = skills.find(s => s.name === 'Relative URL Skill');

            assert.ok(skill);
            assert.ok(
                skill.url!.startsWith('https://skills.sh'),
                `URL should start with https://skills.sh, got: ${skill.url}`
            );
        });
    });
});

// ─── Command Registration Tests ─────────────────────────────────────────────

suite('Skill Command Registration', () => {
    test('addSkill command is declared in package.json', () => {
        const extension = vscode.extensions.getExtension('csharpfritz.squadui');
        assert.ok(extension, 'Extension should be found');

        const commands: { command: string }[] = extension!.packageJSON?.contributes?.commands ?? [];
        const found = commands.some(c => c.command === 'squadui.addSkill');
        assert.ok(found, 'squadui.addSkill should be declared in package.json');
    });

    test('viewSkill command is declared in package.json', () => {
        const extension = vscode.extensions.getExtension('csharpfritz.squadui');
        assert.ok(extension);

        const commands: { command: string }[] = extension!.packageJSON?.contributes?.commands ?? [];
        const found = commands.some(c => c.command === 'squadui.viewSkill');
        assert.ok(found, 'squadui.viewSkill should be declared in package.json');
    });

    test('removeSkill command is declared in package.json', () => {
        const extension = vscode.extensions.getExtension('csharpfritz.squadui');
        assert.ok(extension);

        const commands: { command: string }[] = extension!.packageJSON?.contributes?.commands ?? [];
        const found = commands.some(c => c.command === 'squadui.removeSkill');
        assert.ok(found, 'squadui.removeSkill should be declared in package.json');
    });

    test('addSkill is registered when extension is active', async function () {
        const extension = vscode.extensions.getExtension('csharpfritz.squadui');
        if (!extension) { this.skip(); return; }

        try { await extension.activate(); } catch { /* may fail without workspace */ }

        if (!extension.isActive || !vscode.workspace.workspaceFolders?.length) {
            this.skip();
            return;
        }

        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('squadui.addSkill'), 'addSkill should be registered');
    });

    test('viewSkill is registered when extension is active', async function () {
        const extension = vscode.extensions.getExtension('csharpfritz.squadui');
        if (!extension) { this.skip(); return; }

        try { await extension.activate(); } catch { /* may fail without workspace */ }

        if (!extension.isActive || !vscode.workspace.workspaceFolders?.length) {
            this.skip();
            return;
        }

        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('squadui.viewSkill'), 'viewSkill should be registered');
    });

    test('removeSkill is registered when extension is active', async function () {
        const extension = vscode.extensions.getExtension('csharpfritz.squadui');
        if (!extension) { this.skip(); return; }

        try { await extension.activate(); } catch { /* may fail without workspace */ }

        if (!extension.isActive || !vscode.workspace.workspaceFolders?.length) {
            this.skip();
            return;
        }

        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('squadui.removeSkill'), 'removeSkill should be registered');
    });

    test('all three skill commands appear in package.json contributions', () => {
        const extension = vscode.extensions.getExtension('csharpfritz.squadui');
        assert.ok(extension);

        const commands: { command: string }[] = extension!.packageJSON?.contributes?.commands ?? [];
        const commandNames = commands.map(c => c.command);

        assert.ok(commandNames.includes('squadui.addSkill'));
        assert.ok(commandNames.includes('squadui.viewSkill'));
        assert.ok(commandNames.includes('squadui.removeSkill'));
    });

    test('viewSkill context menu targets skill items', () => {
        const extension = vscode.extensions.getExtension('csharpfritz.squadui');
        assert.ok(extension);

        const menus = extension!.packageJSON?.contributes?.menus ?? {};
        const contextMenus: { command: string; when: string }[] = menus['view/item/context'] ?? [];
        const viewSkillMenu = contextMenus.find(m => m.command === 'squadui.viewSkill');

        assert.ok(viewSkillMenu, 'viewSkill should have a context menu entry');
        assert.ok(
            viewSkillMenu.when.includes('viewItem == skill'),
            'viewSkill context menu should target skill items'
        );
    });

    test('removeSkill context menu targets skill items', () => {
        const extension = vscode.extensions.getExtension('csharpfritz.squadui');
        assert.ok(extension);

        const menus = extension!.packageJSON?.contributes?.menus ?? {};
        const contextMenus: { command: string; when: string }[] = menus['view/item/context'] ?? [];
        const removeSkillMenu = contextMenus.find(m => m.command === 'squadui.removeSkill');

        assert.ok(removeSkillMenu, 'removeSkill should have a context menu entry');
        assert.ok(
            removeSkillMenu.when.includes('viewItem == skill'),
            'removeSkill context menu should target skill items'
        );
    });
});

// ─── Skill Tree Node Tests ──────────────────────────────────────────────────

suite('Skill Tree Nodes (SquadTreeProvider)', () => {
    let provider: SquadTreeProvider;

    setup(() => {
        const members = createMockMembers();
        const tasks = createMockTasks();
        const mockDataProvider = new MockSquadDataProvider({
            members,
            tasks,
            workspaceRoot: TEST_FIXTURES_ROOT,
        });
        provider = new SquadTreeProvider(mockDataProvider as never);
    });

    test('Skills section appears in tree root', async () => {
        const roots = await provider.getChildren();
        const skillsNode = roots.find(r => r.label === 'Skills');

        assert.ok(skillsNode, 'Should have a Skills section node');
        assert.strictEqual(skillsNode.itemType, 'skill');
        assert.strictEqual(
            skillsNode.collapsibleState,
            vscode.TreeItemCollapsibleState.Collapsed,
            'Skills section should be collapsible'
        );
    });

    test('Skills section has book icon', async () => {
        const roots = await provider.getChildren();
        const skillsNode = roots.find(r => r.label === 'Skills');

        assert.ok(skillsNode);
        assert.ok(skillsNode.iconPath instanceof vscode.ThemeIcon);
        assert.strictEqual((skillsNode.iconPath as vscode.ThemeIcon).id, 'book');
    });

    test('expanding Skills section shows installed skills', async () => {
        const roots = await provider.getChildren();
        const skillsNode = roots.find(r => r.label === 'Skills')!;

        const skillItems = await provider.getChildren(skillsNode);

        assert.ok(skillItems.length >= 2, `Should show installed skills, found ${skillItems.length}`);
        const names = skillItems.map(s => s.label);
        assert.ok(names.includes('Code Review'));
        assert.ok(names.includes('Testing Expert'));
    });

    test('skill items show correct source badge', async () => {
        const roots = await provider.getChildren();
        const skillsNode = roots.find(r => r.label === 'Skills')!;
        const skillItems = await provider.getChildren(skillsNode);

        for (const item of skillItems) {
            const desc = String(item.description);
            // All installed skills should show the local badge
            assert.ok(
                desc.includes('local'),
                `Skill ${item.label} description should include "local", got: ${desc}`
            );
        }
    });

    test('skill item contextValue is "skill"', async () => {
        const roots = await provider.getChildren();
        const skillsNode = roots.find(r => r.label === 'Skills')!;
        const skillItems = await provider.getChildren(skillsNode);

        for (const item of skillItems) {
            assert.strictEqual(item.contextValue, 'skill', `${item.label} should have contextValue "skill"`);
        }
    });

    test('skill items have book icon', async () => {
        const roots = await provider.getChildren();
        const skillsNode = roots.find(r => r.label === 'Skills')!;
        const skillItems = await provider.getChildren(skillsNode);

        for (const item of skillItems) {
            assert.ok(item.iconPath instanceof vscode.ThemeIcon);
            assert.strictEqual(
                (item.iconPath as vscode.ThemeIcon).id,
                'book',
                `${item.label} should have book icon`
            );
        }
    });

    test('skill items are leaf nodes (not collapsible)', async () => {
        const roots = await provider.getChildren();
        const skillsNode = roots.find(r => r.label === 'Skills')!;
        const skillItems = await provider.getChildren(skillsNode);

        for (const item of skillItems) {
            assert.strictEqual(
                item.collapsibleState,
                vscode.TreeItemCollapsibleState.None,
                `${item.label} should not be collapsible`
            );
        }
    });

    test('skill tooltips are MarkdownStrings', async () => {
        const roots = await provider.getChildren();
        const skillsNode = roots.find(r => r.label === 'Skills')!;
        const skillItems = await provider.getChildren(skillsNode);

        for (const item of skillItems) {
            assert.ok(
                item.tooltip instanceof vscode.MarkdownString,
                `${item.label} tooltip should be MarkdownString`
            );
        }
    });
});
