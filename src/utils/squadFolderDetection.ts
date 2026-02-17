/**
 * Utility for detecting Squad folder location.
 * Supports both the new `.squad/` and legacy `.ai-team/` folder structures.
 * 
 * The extension detects the folder once at initialization and passes it as a parameter
 * to services. This avoids constantly checking the filesystem.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Detects which squad folder structure exists in the workspace.
 * Checks for `.squad/` first (new structure), then falls back to `.ai-team/` (legacy).
 * 
 * This should be called once at extension initialization and the result cached.
 * 
 * @param workspaceRoot - Root directory of the workspace
 * @returns '.squad' if new structure exists, '.ai-team' if legacy exists, or '.squad' as default
 */
export function detectSquadFolder(workspaceRoot: string): '.squad' | '.ai-team' {
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
    
    // Default to new structure for new installations
    return '.squad';
}

/**
 * Checks if a squad team exists (team.md file present).
 * 
 * @param workspaceRoot - Root directory of the workspace
 * @param squadFolder - The squad folder name ('.squad' or '.ai-team')
 * @returns true if team.md exists
 */
export function hasSquadTeam(workspaceRoot: string, squadFolder: '.squad' | '.ai-team'): boolean {
    const teamMdPath = path.join(workspaceRoot, squadFolder, 'team.md');
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
