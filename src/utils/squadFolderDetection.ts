/**
 * Utility for detecting Squad folder location.
 * Supports both the new `.squad/` and legacy `.ai-team/` folder structures.
 * 
 * The extension detects the folder once at initialization and passes it as a parameter
 * to services. This avoids constantly checking the filesystem.
 */

import * as fs from 'fs';
import * as path from 'path';
import { resolveSquadPath, scanWorkspacesForSquad } from '../sdk-adapter';

// Cache for SDK-resolved results to avoid repeated async lookups
let _sdkResolvedCache: Map<string, '.squad' | '.ai-team'> = new Map();

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
    // Check sync cache from SDK resolution
    const cached = _sdkResolvedCache.get(workspaceRoot);
    if (cached) {
        return cached;
    }

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
 * Detects the squad folder using the Squad SDK's resolveSquad() walk-up algorithm.
 * Falls back to the built-in detectSquadFolder() if the SDK call fails.
 *
 * The SDK resolves by walking up from the given directory to the .git boundary,
 * supporting worktrees and nested project structures.
 *
 * @param workspaceRoot - Root directory of the workspace
 * @returns '.squad' or '.ai-team'
 */
export async function detectSquadFolderWithSdk(workspaceRoot: string): Promise<'.squad' | '.ai-team'> {
    try {
        const resolved = await resolveSquadPath(workspaceRoot);
        if (resolved) {
            const folderName = path.basename(resolved) as '.squad' | '.ai-team';
            if (folderName === '.squad' || folderName === '.ai-team') {
                _sdkResolvedCache.set(workspaceRoot, folderName);
                return folderName;
            }
        }
    } catch {
        // SDK unavailable — fall through to built-in detection
    }

    return detectSquadFolder(workspaceRoot);
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

/** Result of scanning a single workspace root for Squad configuration. */
export interface WorkspaceScanResult {
    /** Workspace root directory */
    workspaceRoot: string;
    /** Detected squad folder name, or null if none found */
    squadFolder: '.squad' | '.ai-team' | null;
    /** Whether a team.md file was found */
    hasTeam: boolean;
}

/**
 * Scans multiple workspace roots for Squad team configurations using the SDK.
 * Iterates workspace paths and uses the SDK's resolveSquad() for folder detection,
 * falling back to built-in detection if SDK is unavailable.
 *
 * This replaces manual directory scanning with the SDK's walk-up algorithm
 * which handles worktrees, nested projects, and both folder conventions.
 *
 * @param workspaceRoots - Array of workspace root paths to scan
 * @returns Array of scan results for each workspace root
 */
export async function scanWorkspaces(workspaceRoots: string[]): Promise<WorkspaceScanResult[]> {
    // Try SDK batch scan first
    let sdkResults: Map<string, '.squad' | '.ai-team'>;
    try {
        sdkResults = await scanWorkspacesForSquad(workspaceRoots);
    } catch {
        sdkResults = new Map();
    }

    return workspaceRoots.map((root) => {
        // SDK result takes priority
        const sdkFolder = sdkResults.get(root);
        const folder = sdkFolder ?? detectSquadFolder(root);
        const folderExists = sdkFolder
            ? true
            : fs.existsSync(path.join(root, folder));

        return {
            workspaceRoot: root,
            squadFolder: folderExists ? folder : null,
            hasTeam: folderExists ? hasSquadTeam(root, folder) : false,
        };
    });
}
