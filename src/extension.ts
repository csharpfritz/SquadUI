import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { GitHubIssue } from './models';
import { SquadDataProvider, FileWatcherService, GitHubIssuesService } from './services';
import { TeamTreeProvider, SkillsTreeProvider, DecisionsTreeProvider, WorkDetailsWebview, IssueDetailWebview, SquadStatusBar, SquadDashboardWebview } from './views';
import { registerInitSquadCommand, registerAddMemberCommand, registerRemoveMemberCommand, registerAddSkillCommand } from './commands';

let fileWatcher: FileWatcherService | undefined;
let webview: WorkDetailsWebview | undefined;
let issueWebview: IssueDetailWebview | undefined;
let dashboardWebview: SquadDashboardWebview | undefined;
let statusBar: SquadStatusBar | undefined;

export function activate(context: vscode.ExtensionContext): void {
    console.log('SquadUI extension is now active');

    // Get workspace root for team data
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showWarningMessage('SquadUI: No workspace folder found');
        return;
    }

    // Create services
    const dataProvider = new SquadDataProvider(workspaceRoot);

    // Create file watcher and connect to data provider
    fileWatcher = new FileWatcherService();
    fileWatcher.registerCacheInvalidator({
        invalidate: () => dataProvider.refresh()
    });
    fileWatcher.start();
    context.subscriptions.push(fileWatcher);

    // Create tree view providers
    const teamProvider = new TeamTreeProvider(dataProvider);
    const skillsProvider = new SkillsTreeProvider(dataProvider);
    const decisionsProvider = new DecisionsTreeProvider(dataProvider);

    // Wire up GitHub Issues service
    const issuesService = new GitHubIssuesService();
    teamProvider.setIssuesService(issuesService);

    // Create dashboard webview
    dashboardWebview = new SquadDashboardWebview(context.extensionUri, dataProvider);
    dashboardWebview.setIssuesService(issuesService);
    context.subscriptions.push({ dispose: () => dashboardWebview?.dispose() });

    const teamView = vscode.window.createTreeView('squadTeam', {
        treeDataProvider: teamProvider,
        showCollapseAll: true
    });
    const skillsView = vscode.window.createTreeView('squadSkills', {
        treeDataProvider: skillsProvider
    });
    const decisionsView = vscode.window.createTreeView('squadDecisions', {
        treeDataProvider: decisionsProvider
    });
    context.subscriptions.push(teamView, skillsView, decisionsView);

    // Create status bar
    statusBar = new SquadStatusBar(dataProvider);
    context.subscriptions.push(statusBar);

    // Create webview for work details
    webview = new WorkDetailsWebview(context.extensionUri);
    context.subscriptions.push({ dispose: () => webview?.dispose() });

    // Create webview for issue details
    issueWebview = new IssueDetailWebview(context.extensionUri);
    context.subscriptions.push({ dispose: () => issueWebview?.dispose() });

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('squadui.showWorkDetails', async (taskId: string) => {
            if (!taskId) {
                vscode.window.showWarningMessage('No task selected');
                return;
            }
            const workDetails = await dataProvider.getWorkDetails(taskId);
            if (workDetails) {
                webview?.show(workDetails);
            } else {
                vscode.window.showWarningMessage(`Task ${taskId} not found`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('squadui.refreshTree', () => {
            teamProvider.refresh();
            skillsProvider.refresh();
            decisionsProvider.refresh();
            statusBar?.update();
            vscode.window.showInformationMessage('Squad tree refreshed');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('squadui.openIssue', (url: string, issue?: GitHubIssue) => {
            if (issue) {
                issueWebview?.show(issue);
            } else if (url) {
                vscode.env.openExternal(vscode.Uri.parse(url));
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('squadui.openDashboard', async () => {
            await dashboardWebview?.show();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('squadui.viewCharter', async (memberName: string) => {
            if (!memberName) {
                vscode.window.showWarningMessage('No member selected');
                return;
            }
            const slug = memberName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            const charterPath = path.join(workspaceRoot, '.ai-team', 'agents', slug, 'charter.md');
            if (!fs.existsSync(charterPath)) {
                vscode.window.showWarningMessage(`Charter not found for ${memberName}`);
                return;
            }
            const uri = vscode.Uri.file(charterPath);
            await vscode.commands.executeCommand('markdown.showPreview', uri);
        })
    );

    // Register squad init command
    context.subscriptions.push(
        registerInitSquadCommand(context, () => {
            dataProvider.refresh();
            teamProvider.refresh();
            skillsProvider.refresh();
            decisionsProvider.refresh();
            statusBar?.update();
        })
    );

    // Register add member command
    context.subscriptions.push(
        registerAddMemberCommand(context, () => {
            dataProvider.refresh();
            teamProvider.refresh();
            statusBar?.update();
        })
    );

    // Register remove member command
    context.subscriptions.push(
        registerRemoveMemberCommand(context, () => {
            dataProvider.refresh();
            teamProvider.refresh();
            statusBar?.update();
        })
    );

    // Register add skill command
    context.subscriptions.push(
        registerAddSkillCommand(context, () => {
            skillsProvider.refresh();
        })
    );

    // Register view skill command — opens SKILL.md in editor
    context.subscriptions.push(
        vscode.commands.registerCommand('squadui.viewSkill', async (skillSlug: string) => {
            if (!skillSlug) {
                vscode.window.showWarningMessage('No skill selected');
                return;
            }
            // skillSlug is the directory name, used directly for lookup
            const skillPath = path.join(workspaceRoot, '.ai-team', 'skills', skillSlug, 'SKILL.md');
            if (!fs.existsSync(skillPath)) {
                vscode.window.showWarningMessage(`Skill file not found for ${skillSlug}`);
                return;
            }
            const doc = await vscode.workspace.openTextDocument(skillPath);
            await vscode.window.showTextDocument(doc, { preview: true });
        })
    );

    // Register open decision command — opens decisions.md in markdown preview, scrolled to heading
    context.subscriptions.push(
        vscode.commands.registerCommand('squadui.openDecision', async (filePath: string, lineNumber: number) => {
            if (!filePath) {
                return;
            }
            const uri = vscode.Uri.file(filePath);
            const line = lineNumber ?? 0;

            // Open in text editor first, positioned at the decision heading
            const doc = await vscode.workspace.openTextDocument(uri);
            const range = new vscode.Range(line, 0, line, 0);
            await vscode.window.showTextDocument(doc, {
                selection: range,
                preview: true
            });

            // Now open markdown preview — it will sync to the editor's scroll position
            await vscode.commands.executeCommand('markdown.showPreview', uri);
        })
    );

    // Register open log entry command — opens orchestration log file
    // Accepts either a direct file path OR (date, topic) pair from tree view
    context.subscriptions.push(
        vscode.commands.registerCommand('squadui.openLogEntry', async (filePathOrDate: string, topic?: string) => {
            if (!filePathOrDate) {
                return;
            }

            let resolvedPath = filePathOrDate;

            // If topic is provided, this is a (date, topic) call from the tree view — resolve the file
            if (topic) {
                const aiTeamDir = path.join(workspaceRoot, '.ai-team');
                const logDirs = ['orchestration-log', 'log'];
                let found = false;

                for (const dir of logDirs) {
                    const logDir = path.join(aiTeamDir, dir);
                    if (!fs.existsSync(logDir)) { continue; }
                    const files = fs.readdirSync(logDir);
                    const match = files.find(f => f.includes(filePathOrDate) && f.includes(topic));
                    if (match) {
                        resolvedPath = path.join(logDir, match);
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    vscode.window.showWarningMessage(`Log file not found for ${filePathOrDate} - ${topic}`);
                    return;
                }
            }

            try {
                const doc = await vscode.workspace.openTextDocument(resolvedPath);
                await vscode.window.showTextDocument(doc, { preview: true });
            } catch (err) {
                vscode.window.showWarningMessage(`Could not open log file: ${resolvedPath}`);
            }
        })
    );

    // Register remove skill command — deletes skill directory
    context.subscriptions.push(
        vscode.commands.registerCommand('squadui.removeSkill', async (skillSlug: string) => {
            if (!skillSlug) {
                vscode.window.showWarningMessage('No skill selected');
                return;
            }
            const confirm = await vscode.window.showWarningMessage(
                `Remove skill "${skillSlug}"?`, { modal: true }, 'Remove'
            );
            if (confirm !== 'Remove') {
                return;
            }
            // skillSlug is the directory name, used directly
            const skillDir = path.join(workspaceRoot, '.ai-team', 'skills', skillSlug);
            if (fs.existsSync(skillDir)) {
                fs.rmSync(skillDir, { recursive: true });
                vscode.window.showInformationMessage(`Removed skill: ${skillSlug}`);
                skillsProvider.refresh();
            }
        })
    );

    // Connect file watcher to tree refresh
    fileWatcher.onFileChange(() => {
        teamProvider.refresh();
        skillsProvider.refresh();
        decisionsProvider.refresh();
        statusBar?.update();
    });
}

export function deactivate(): void {
    fileWatcher?.dispose();
    webview?.dispose();
    issueWebview?.dispose();
    dashboardWebview?.dispose();
    statusBar?.dispose();
}
