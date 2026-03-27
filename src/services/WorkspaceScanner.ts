/**
 * Scans VS Code workspace folders for squad-enabled workspaces.
 * Detects multi-root workspaces with `.ai-team/` or `.squad/` directories.
 */

import * as fs from 'fs';
import * as path from 'path';
import { detectSquadFolder, hasSquadTeam } from '../utils/squadFolderDetection';

/**
 * Describes a detected squad workspace within a multi-root setup.
 */
export interface WorkspaceInfo {
    /** Display name of the workspace (folder name) */
    name: string;
    /** Absolute path to the workspace root */
    rootPath: string;
    /** Which squad folder convention this workspace uses */
    squadFolder: '.squad' | '.ai-team';
    /** Whether a team.md file exists (team is initialized) */
    hasTeam: boolean;
}

/**
 * Scans workspace folders for squad-enabled directories.
 * Used to support multi-root workspace scenarios where multiple
 * repositories each have their own `.ai-team/` or `.squad/` folder.
 */
export class WorkspaceScanner {
    /**
     * Scans the given workspace folder paths for squad-enabled workspaces.
     * A workspace is "squad-enabled" if it contains a `.squad/` or `.ai-team/` directory.
     *
     * @param folderPaths - Array of absolute paths to workspace folders
     * @returns Array of WorkspaceInfo for folders that have squad configuration
     */
    scanWorkspaces(folderPaths: string[]): WorkspaceInfo[] {
        const workspaces: WorkspaceInfo[] = [];

        for (const folderPath of folderPaths) {
            const squadFolder = detectSquadFolder(folderPath);
            const squadDir = path.join(folderPath, squadFolder);

            if (!fs.existsSync(squadDir)) {
                continue;
            }

            workspaces.push({
                name: path.basename(folderPath),
                rootPath: folderPath,
                squadFolder,
                hasTeam: hasSquadTeam(folderPath, squadFolder),
            });
        }

        return workspaces;
    }

    /**
     * Returns true if multiple squad-enabled workspaces are available.
     */
    isMultiWorkspace(workspaces: WorkspaceInfo[]): boolean {
        return workspaces.length > 1;
    }
}
