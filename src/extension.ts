import * as vscode from 'vscode';
import { SquadDataProvider, FileWatcherService } from './services';
import { SquadTreeProvider, WorkDetailsWebview } from './views';

let fileWatcher: FileWatcherService | undefined;
let webview: WorkDetailsWebview | undefined;

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
    const treeView = vscode.window.createTreeView('squadMembers', {
        treeDataProvider: treeProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView);

    // Create webview for work details
    webview = new WorkDetailsWebview(context.extensionUri);
    context.subscriptions.push({ dispose: () => webview?.dispose() });

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
        vscode.commands.registerCommand('squadui.openIssue', (url: string) => {
            if (url) {
                vscode.env.openExternal(vscode.Uri.parse(url));
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
}
