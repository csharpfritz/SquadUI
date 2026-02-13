import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { GitHubIssue } from './models';
import { SquadDataProvider, FileWatcherService, GitHubIssuesService } from './services';
import { SquadTreeProvider, WorkDetailsWebview, IssueDetailWebview } from './views';
import { registerInitSquadCommand, registerAddMemberCommand, registerRemoveMemberCommand, registerAddSkillCommand } from './commands';

let fileWatcher: FileWatcherService | undefined;
let webview: WorkDetailsWebview | undefined;
let issueWebview: IssueDetailWebview | undefined;

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

    // Create tree view provider
    const treeProvider = new SquadTreeProvider(dataProvider);

    // Wire up GitHub Issues service
    const issuesService = new GitHubIssuesService();
    treeProvider.setIssuesService(issuesService);

    const treeView = vscode.window.createTreeView('squadMembers', {
        treeDataProvider: treeProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView);

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
            treeProvider.refresh();
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
            const doc = await vscode.workspace.openTextDocument(charterPath);
            await vscode.window.showTextDocument(doc, { preview: true });
        })
    );

    // Register squad init command
    context.subscriptions.push(
        registerInitSquadCommand(context, () => {
            dataProvider.refresh();
            treeProvider.refresh();
        })
    );

    // Register add member command
    context.subscriptions.push(
        registerAddMemberCommand(context, () => {
            dataProvider.refresh();
            treeProvider.refresh();
        })
    );

    // Register remove member command
    context.subscriptions.push(
        registerRemoveMemberCommand(context, () => {
            dataProvider.refresh();
            treeProvider.refresh();
        })
    );

    // Register add skill command
    context.subscriptions.push(
        registerAddSkillCommand(context, () => {
            treeProvider.refresh();
        })
    );

    // Register view skill command — opens SKILL.md in editor
    context.subscriptions.push(
        vscode.commands.registerCommand('squadui.viewSkill', async (skillName: string) => {
            if (!skillName) {
                vscode.window.showWarningMessage('No skill selected');
                return;
            }
            const slug = skillName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            const skillPath = path.join(workspaceRoot, '.ai-team', 'skills', slug, 'SKILL.md');
            if (!fs.existsSync(skillPath)) {
                vscode.window.showWarningMessage(`Skill file not found for ${skillName}`);
                return;
            }
            const doc = await vscode.workspace.openTextDocument(skillPath);
            await vscode.window.showTextDocument(doc, { preview: true });
        })
    );

    // Register remove skill command — deletes skill directory
    context.subscriptions.push(
        vscode.commands.registerCommand('squadui.removeSkill', async (skillName: string) => {
            if (!skillName) {
                vscode.window.showWarningMessage('No skill selected');
                return;
            }
            const confirm = await vscode.window.showWarningMessage(
                `Remove skill "${skillName}"?`, { modal: true }, 'Remove'
            );
            if (confirm !== 'Remove') {
                return;
            }
            const slug = skillName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            const skillDir = path.join(workspaceRoot, '.ai-team', 'skills', slug);
            if (fs.existsSync(skillDir)) {
                fs.rmSync(skillDir, { recursive: true });
                vscode.window.showInformationMessage(`Removed skill: ${skillName}`);
                treeProvider.refresh();
            }
        })
    );

    // Connect file watcher to tree refresh
    fileWatcher.onFileChange(() => {
        treeProvider.refresh();
    });
}

export function deactivate(): void {
    fileWatcher?.dispose();
    webview?.dispose();
    issueWebview?.dispose();
}
