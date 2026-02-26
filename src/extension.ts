import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { GitHubIssue } from './models';
import { SquadDataProvider, FileWatcherService, GitHubIssuesService, SquadVersionService, HealthCheckService } from './services';
import { TeamTreeProvider, SkillsTreeProvider, DecisionsTreeProvider, WorkDetailsWebview, IssueDetailWebview, SquadStatusBar, SquadDashboardWebview, StandupReportWebview } from './views';
import { registerInitSquadCommand, registerUpgradeSquadCommand, registerAddMemberCommand, registerRemoveMemberCommand, registerAddSkillCommand } from './commands';
import { detectSquadFolder, hasSquadTeam } from './utils/squadFolderDetection';

let fileWatcher: FileWatcherService | undefined;
let webview: WorkDetailsWebview | undefined;
let issueWebview: IssueDetailWebview | undefined;
let dashboardWebview: SquadDashboardWebview | undefined;
let standupWebview: StandupReportWebview | undefined;
let statusBar: SquadStatusBar | undefined;
let versionService: SquadVersionService | undefined;

// Detect squad folder once at initialization and use throughout the extension
let squadFolderName: '.squad' | '.ai-team';

export function activate(context: vscode.ExtensionContext): void {
    console.log('SquadUI extension is now active');

    // Get workspace root for team data
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showWarningMessage('SquadUI: No workspace folder found');
        return;
    }

    // Detect squad folder once at initialization
    squadFolderName = detectSquadFolder(workspaceRoot);

    // Track the currently active root (may be changed via deep-link API)
    let currentRoot = workspaceRoot;

    // Set initial hasTeam context based on team.md existence
    const hasTeam = hasSquadTeam(workspaceRoot, squadFolderName);
    vscode.commands.executeCommand('setContext', 'squadui.hasTeam', hasTeam);

    // Create version service and check for upgrades if team exists
    versionService = new SquadVersionService();
    if (hasTeam) {
        versionService.checkForUpgrade().then(result => {
            vscode.commands.executeCommand('setContext', 'squadui.upgradeAvailable', result.available);
        });
    }

    // Create services
    const dataProvider = new SquadDataProvider(workspaceRoot, squadFolderName);

    // Helper: switch all providers to a new team root (deep-link API)
    function switchToRoot(newRoot: string): void {
        if (!fs.existsSync(newRoot)) {
            vscode.window.showWarningMessage(`SquadUI: Path does not exist: ${newRoot}`);
            return;
        }
        const newFolder = detectSquadFolder(newRoot);
        dataProvider.setRoot(newRoot, newFolder);
        currentRoot = newRoot;
        squadFolderName = newFolder;
        teamProvider.refresh();
        skillsProvider.refresh();
        decisionsProvider.refresh();
        statusBar?.update();
        const teamExists = hasSquadTeam(currentRoot, squadFolderName);
        vscode.commands.executeCommand('setContext', 'squadui.hasTeam', teamExists);
    }

    // Create file watcher and connect to data provider
    fileWatcher = new FileWatcherService();
    fileWatcher.registerCacheInvalidator({
        invalidate: () => dataProvider.refresh()
    });
    fileWatcher.start();
    context.subscriptions.push(fileWatcher);

    // Create tree view providers
    const teamProvider = new TeamTreeProvider(dataProvider, squadFolderName);
    const skillsProvider = new SkillsTreeProvider(dataProvider, squadFolderName);
    const decisionsProvider = new DecisionsTreeProvider(dataProvider, squadFolderName);

    // Wire up GitHub Issues service
    const issuesService = new GitHubIssuesService({ squadFolder: squadFolderName });
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

    // Create webview for standup reports
    standupWebview = new StandupReportWebview(context.extensionUri, dataProvider);
    standupWebview.setIssuesService(issuesService);
    context.subscriptions.push({ dispose: () => standupWebview?.dispose() });

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
        vscode.commands.registerCommand('squadui.refreshTree', (rawArg?: unknown) => {
            // Tree view buttons pass the tree item as first arg — ignore non-string values
            const teamRoot = typeof rawArg === 'string' ? rawArg : undefined;
            if (teamRoot && teamRoot !== currentRoot) {
                switchToRoot(teamRoot);
            }
            teamProvider.refresh();
            skillsProvider.refresh();
            decisionsProvider.refresh();
            statusBar?.update();
            // During init, don't clear spinner — let finishAllocationIfReady handle it
            if (initInProgress) {
                finishAllocationIfReady();
            } else {
                dataProvider.getSquadMembers().then(members => {
                    if (members.length > 0) {
                        teamView.message = undefined;
                    }
                });
            }
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
        vscode.commands.registerCommand('squadui.openDashboard', async (rawArg?: unknown) => {
            const teamRoot = typeof rawArg === 'string' ? rawArg : undefined;
            if (teamRoot && teamRoot !== currentRoot) {
                switchToRoot(teamRoot);
            }
            await dashboardWebview?.show();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('squadui.generateStandup', async () => {
            // Show period picker
            const period = await vscode.window.showQuickPick(
                [
                    { label: '📅 Daily', description: 'Last 24 hours', value: 'day' as const },
                    { label: '📆 Weekly', description: 'Last 7 days', value: 'week' as const },
                ],
                { placeHolder: 'Select standup report period' }
            );
            if (!period) { return; }
            await standupWebview?.show(period.value);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('squadui.viewCharter', async (rawName?: unknown, rawRoot?: unknown) => {
            // Tree view buttons pass tree item as first arg — extract name if object
            let memberName: string = '';
            if (typeof rawName === 'string') {
                memberName = rawName;
            } else if (typeof rawName === 'object' && rawName !== null) {
                memberName = String((rawName as any).label || (rawName as any).name || '');
            }
            const teamRoot = typeof rawRoot === 'string' ? rawRoot : undefined;
            if (!memberName) {
                vscode.window.showWarningMessage('No member selected');
                return;
            }
            const root = teamRoot || currentRoot;
            const folder = teamRoot ? detectSquadFolder(root) : squadFolderName;
            const slug = memberName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            const charterPath = path.join(root, folder, 'agents', slug, 'charter.md');
            if (!fs.existsSync(charterPath)) {
                vscode.window.showWarningMessage(`Charter not found for ${memberName}`);
                return;
            }
            const uri = vscode.Uri.file(charterPath);
            await vscode.commands.executeCommand('markdown.showPreview', uri);
        })
    );

    // Register edit charter command — opens charter in text editor + markdown preview side-by-side
    context.subscriptions.push(
        vscode.commands.registerCommand('squadui.editCharter', async (rawName?: unknown) => {
            let memberName: string = '';
            if (typeof rawName === 'string') {
                memberName = rawName;
            } else if (typeof rawName === 'object' && rawName !== null) {
                memberName = String((rawName as any).label || (rawName as any).memberId || (rawName as any).name || '');
            }
            if (!memberName) {
                vscode.window.showWarningMessage('No member selected');
                return;
            }
            const slug = memberName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            const charterPath = path.join(currentRoot, squadFolderName, 'agents', slug, 'charter.md');
            if (!fs.existsSync(charterPath)) {
                vscode.window.showWarningMessage(`Charter not found for ${memberName}`);
                return;
            }
            const uri = vscode.Uri.file(charterPath);
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc, { preview: false });
            await vscode.commands.executeCommand('markdown.showPreviewToSide', uri);
        })
    );

    // Register squad init command
    let allocationPollInterval: ReturnType<typeof setInterval> | undefined;
    let initInProgress = false;
    let initTerminalClosed = false;
    let resolveAllocation: (() => void) | undefined;

    const finishAllocationIfReady = () => {
        // Only clear spinner when BOTH conditions are met:
        // 1. Agent folders exist on disk (charters have been written)
        // 2. The terminal has closed (both init + copilot commands finished)
        if (!initInProgress) { return; }
        if (!initTerminalClosed) { return; }
        // Check for agent directories on disk — not just team.md entries
        const agentsDir = path.join(currentRoot, squadFolderName, 'agents');
        const agentFoldersExist = fs.existsSync(agentsDir) && 
            fs.readdirSync(agentsDir).some(entry => {
                const entryPath = path.join(agentsDir, entry);
                return fs.statSync(entryPath).isDirectory() && 
                    !entry.startsWith('_') && entry !== 'scribe';
            });
        dataProvider.getSquadMembers().then(members => {
            if (members.length > 0 && agentFoldersExist) {
                teamView.message = undefined;
                initInProgress = false;
                resolveAllocation?.();
                resolveAllocation = undefined;
                if (allocationPollInterval) {
                    clearInterval(allocationPollInterval);
                    allocationPollInterval = undefined;
                }
                vscode.commands.executeCommand('setContext', 'squadui.hasTeam', true);
                vscode.window.showInformationMessage('Squad team allocated successfully!');
            }
        });
    };

    const stopAllocationProgress = () => {
        // Unconditionally stop the progress bar and polling when terminal closes
        initInProgress = false;
        resolveAllocation?.();
        resolveAllocation = undefined;
        teamView.message = undefined;
        if (allocationPollInterval) {
            clearInterval(allocationPollInterval);
            allocationPollInterval = undefined;
        }
    };

    context.subscriptions.push(
        registerInitSquadCommand(context,
            // onInitStart: spinner begins
            () => {
                initInProgress = true;
                initTerminalClosed = false;
                dataProvider.refresh();
                teamProvider.refresh();
                skillsProvider.refresh();
                decisionsProvider.refresh();
                statusBar?.update();
                vscode.commands.executeCommand('setContext', 'squadui.hasTeam', true);
                teamView.message = 'Allocating team members…';
                // Show built-in progress bar on the team view
                vscode.window.withProgress(
                    { location: { viewId: 'squadTeam' } },
                    () => new Promise<void>(resolve => { resolveAllocation = resolve; })
                );
                // Polling: refresh views every 3s so members appear as they're written
                if (allocationPollInterval) { clearInterval(allocationPollInterval); }
                allocationPollInterval = setInterval(() => {
                    dataProvider.refresh();
                    teamProvider.refresh();
                    skillsProvider.refresh();
                    decisionsProvider.refresh();
                    statusBar?.update();
                    finishAllocationIfReady();
                }, 3000);
            },
            // onTerminalClose: commands finished, stop progress bar
            () => {
                initTerminalClosed = true;
                // Final refresh to pick up any last-second writes
                dataProvider.refresh();
                teamProvider.refresh();
                skillsProvider.refresh();
                decisionsProvider.refresh();
                statusBar?.update();
                // Always stop the progress bar when terminal closes
                stopAllocationProgress();
                // Update hasTeam based on what's actually on disk now
                const teamExists = hasSquadTeam(currentRoot, squadFolderName);
                vscode.commands.executeCommand('setContext', 'squadui.hasTeam', teamExists);
                if (teamExists) {
                    vscode.window.showInformationMessage('Squad team allocated successfully!');
                }
            }
        )
    );

    // Register squad upgrade command
    context.subscriptions.push(
        registerUpgradeSquadCommand(context, () => {
            dataProvider.refresh();
            teamProvider.refresh();
            skillsProvider.refresh();
            decisionsProvider.refresh();
            statusBar?.update();
            vscode.commands.executeCommand('setContext', 'squadui.hasTeam', true);
            // Reset upgrade state and re-check after upgrade
            vscode.commands.executeCommand('setContext', 'squadui.upgradeAvailable', false);
            versionService?.forceCheck().then(result => {
                vscode.commands.executeCommand('setContext', 'squadui.upgradeAvailable', result.available);
            });
        })
    );

    // Register check for updates command
    context.subscriptions.push(
        vscode.commands.registerCommand('squadui.checkForUpdates', async () => {
            if (!versionService) {
                vscode.window.showInformationMessage('Unable to check for Squad CLI updates');
                return;
            }
            const result = await versionService.forceCheck();
            vscode.commands.executeCommand('setContext', 'squadui.upgradeAvailable', result.available);

            if (result.available) {
                const action = await vscode.window.showInformationMessage(
                    `Squad CLI update available: ${result.currentVersion} → ${result.latestVersion}`,
                    'Upgrade Now'
                );
                if (action === 'Upgrade Now') {
                    vscode.commands.executeCommand('squadui.upgradeSquad');
                }
            } else if (result.currentVersion) {
                vscode.window.showInformationMessage(`Squad CLI is up to date (v${result.currentVersion})`);
            } else {
                vscode.window.showInformationMessage('Unable to check for Squad CLI updates');
            }
        })
    );

    // Register add member command
    context.subscriptions.push(
        registerAddMemberCommand(context, () => {
            dataProvider.refresh();
            teamProvider.refresh();
            statusBar?.update();
        }, squadFolderName)
    );

    // Register remove member command
    context.subscriptions.push(
        registerRemoveMemberCommand(context, () => {
            dataProvider.refresh();
            teamProvider.refresh();
            statusBar?.update();
        }, squadFolderName, () => currentRoot)
    );

    // Register add skill command
    context.subscriptions.push(
        registerAddSkillCommand(context, () => {
            skillsProvider.refresh();
        }, squadFolderName, () => currentRoot)
    );

    // Register view skill command — opens SKILL.md in editor
    context.subscriptions.push(
        vscode.commands.registerCommand('squadui.viewSkill', async (skillSlug: string) => {
            if (!skillSlug) {
                vscode.window.showWarningMessage('No skill selected');
                return;
            }
            // skillSlug is the directory name, used directly for lookup
            const skillPath = path.join(currentRoot, squadFolderName, 'skills', skillSlug, 'SKILL.md');
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
                const squadDir = path.join(currentRoot, squadFolderName);
                const logDirs = ['orchestration-log', 'log'];
                let found = false;

                for (const dir of logDirs) {
                    const logDir = path.join(squadDir, dir);
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
            const skillDir = path.join(currentRoot, squadFolderName, 'skills', skillSlug);
            if (fs.existsSync(skillDir)) {
                fs.rmSync(skillDir, { recursive: true });
                vscode.window.showInformationMessage(`Removed skill: ${skillSlug}`);
                skillsProvider.refresh();
            }
        })
    );

    // Register health check command — runs diagnostics and shows results in output channel
    context.subscriptions.push(
        vscode.commands.registerCommand('squadui.healthCheck', async () => {
            const healthService = new HealthCheckService();
            const results = await healthService.runAll(squadFolderName, currentRoot);
            const output = vscode.window.createOutputChannel('Squad Health Check');
            output.clear();
            output.appendLine(healthService.formatResults(results));
            output.show(true);

            const failed = results.filter(r => r.status === 'fail').length;
            if (failed > 0) {
                vscode.window.showWarningMessage(`Squad Health Check: ${failed} issue(s) found. See output for details.`);
            } else {
                vscode.window.showInformationMessage('Squad Health Check: All checks passed.');
            }
        })
    );

    // Connect file watcher to tree refresh and context key update
    fileWatcher.onFileChange(() => {
        teamProvider.refresh();
        skillsProvider.refresh();
        decisionsProvider.refresh();
        statusBar?.update();
        const teamExists = hasSquadTeam(currentRoot, squadFolderName);
        // During init, never reset hasTeam to false — the init wizard already set it true
        if (!initInProgress) {
            vscode.commands.executeCommand('setContext', 'squadui.hasTeam', teamExists);
        }
        // During init, keep refreshing views but let finishAllocationIfReady control spinner
        if (teamExists && initInProgress) {
            finishAllocationIfReady();
        } else if (!teamExists && !initInProgress) {
            teamView.message = undefined;
        }
    });

    // Register URI handler for deep-link API (vscode://csharpfritz.squadui/...)
    const uriHandler: vscode.UriHandler = {
        handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
            const params = new URLSearchParams(uri.query);
            const teamRoot = params.get('path');
            switch (uri.path) {
                case '/dashboard':
                    vscode.commands.executeCommand('squadui.openDashboard', teamRoot || undefined);
                    break;
                case '/charter': {
                    const member = params.get('member');
                    if (member) {
                        vscode.commands.executeCommand('squadui.viewCharter', member, teamRoot || undefined);
                    }
                    break;
                }
            }
        }
    };
    context.subscriptions.push(vscode.window.registerUriHandler(uriHandler));
}

export function deactivate(): void {
    fileWatcher?.dispose();
    webview?.dispose();
    issueWebview?.dispose();
    dashboardWebview?.dispose();
    standupWebview?.dispose();
    statusBar?.dispose();
}
