/**
 * Utility for detecting Squad folder location.
 * Supports both the new `.squad/` and legacy `.ai-team/` folder structures.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Detects which squad folder structure exists in the workspace.
 * Checks for `.squad/` first (new structure), then falls back to `.ai-team/` (legacy).
 * 
 * @param workspaceRoot - Root directory of the workspace
 * @returns '.squad' if new structure exists, '.ai-team' if legacy exists, or null if neither exists
 */
export function detectSquadFolder(workspaceRoot: string): '.squad' | '.ai-team' | null {
    const newFolder = path.join(workspaceRoot, '.squad');
    const legacyFolder = path.join(workspaceRoot, '.ai-team');
    
    // Prefer new structure if it exists
    if (fs.existsSync(newFolder)) {
        return '.squad';
    }
    
    // Fall back to legacy structure
    if (fs.existsSync(legacyFolder)) {
        return '.ai-team';
    }
    
    return null;
}

/**
 * Returns the squad folder name to use for the workspace.
 * If neither folder exists, returns the new folder name '.squad' by default.
 * 
 * @param workspaceRoot - Root directory of the workspace
 * @returns '.squad' or '.ai-team'
 */
export function getSquadFolderName(workspaceRoot: string): '.squad' | '.ai-team' {
    return detectSquadFolder(workspaceRoot) ?? '.squad';
}

/**
 * Constructs a path within the squad folder (either .squad or .ai-team).
 * Automatically detects which folder structure is in use.
 * 
 * @param workspaceRoot - Root directory of the workspace
 * @param relativePath - Path relative to the squad folder (e.g., 'team.md', 'agents/rusty/charter.md')
 * @returns Full path to the file/directory
 */
export function getSquadPath(workspaceRoot: string, relativePath: string): string {
    const folderName = getSquadFolderName(workspaceRoot);
    return path.join(workspaceRoot, folderName, relativePath);
}

/**
 * Checks if a squad team exists (team.md file present).
 * Works with both .squad and .ai-team folder structures.
 * 
 * @param workspaceRoot - Root directory of the workspace
 * @returns true if team.md exists in either folder structure
 */
export function hasSquadTeam(workspaceRoot: string): boolean {
    const teamMdPath = getSquadPath(workspaceRoot, 'team.md');
    return fs.existsSync(teamMdPath);
}

/**
 * Gets the file system watcher pattern for squad files.
 * Watches both .squad and .ai-team folders to support migration scenarios.
 * 
 * @returns Glob pattern for watching squad files
 */
export function getSquadWatchPattern(): string {
    // Watch both folders to handle migration scenarios where both might exist temporarily
    return '**/{.squad,.ai-team}/**/*.md';
}
