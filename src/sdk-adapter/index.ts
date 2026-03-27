/**
 * SDK Adapter — single integration point for @bradygaster/squad-sdk.
 *
 * All SquadUI code imports SDK functionality through this module.
 * No other file should import directly from '@bradygaster/squad-sdk'.
 *
 * ESM/CJS interop: The SDK is ESM-only ("type": "module") while SquadUI
 * compiles to CommonJS. TypeScript's `module: "commonjs"` transforms
 * dynamic import() into require(), which can't load ESM packages.
 * We use `new Function('specifier', 'return import(specifier)')` to
 * bypass the transform and invoke Node.js's native ESM dynamic import.
 */

import { SquadMember, DecisionEntry } from '../models';

// ─── SDK Type Mirrors ──────────────────────────────────────────────────────
// Defined locally to avoid ESM/CJS type resolution issues at compile time.
// These match the SDK's exported interfaces from @bradygaster/squad-sdk/parsers.

/** Agent parsed from team.md by the SDK. */
export interface ParsedAgent {
    name: string;
    role: string;
    skills: string[];
    model?: string;
    status?: string;
    aliases?: string[];
    autoAssign?: boolean;
}

/** Decision parsed from decisions.md by the SDK. */
export interface ParsedDecision {
    title: string;
    body: string;
    configRelevant: boolean;
    date?: string;
    author?: string;
    headingLevel?: number;
}

// ─── Dynamic Import Helper ─────────────────────────────────────────────────
// Bypasses TypeScript's import() → require() transform for CommonJS output.
// Node.js natively supports dynamic import() from CJS modules since v12.

// eslint-disable-next-line @typescript-eslint/no-implied-eval
const dynamicImport = new Function('specifier', 'return import(specifier)') as
    (specifier: string) => Promise<any>;

// Lazy-loaded SDK module caches
let _parsers: any = null;
let _resolution: any = null;

async function loadParsers(): Promise<any> {
    if (!_parsers) {
        _parsers = await dynamicImport('@bradygaster/squad-sdk/parsers');
    }
    return _parsers;
}

async function loadResolution(): Promise<any> {
    if (!_resolution) {
        _resolution = await dynamicImport('@bradygaster/squad-sdk/resolution');
    }
    return _resolution;
}

// ─── Parser Wrappers ───────────────────────────────────────────────────────

/**
 * Parses team.md content into agent configurations using the SDK.
 * Wraps SDK's parseTeamMarkdown from @bradygaster/squad-sdk/parsers.
 */
export async function parseTeamMarkdown(content: string): Promise<{
    agents: ParsedAgent[];
    warnings: string[];
}> {
    const parsers = await loadParsers();
    return parsers.parseTeamMarkdown(content);
}

/**
 * Parses decisions.md content into decision entries using the SDK.
 * Wraps SDK's parseDecisionsMarkdown from @bradygaster/squad-sdk/parsers.
 */
export async function parseDecisionsMarkdown(content: string): Promise<{
    decisions: ParsedDecision[];
    warnings: string[];
}> {
    const parsers = await loadParsers();
    return parsers.parseDecisionsMarkdown(content);
}

// ─── Resolution Wrapper ────────────────────────────────────────────────────

/**
 * Resolves the squad folder path by walking up from the given directory.
 * Wraps SDK's resolveSquad from @bradygaster/squad-sdk/resolution.
 *
 * @param workspaceRoot - Directory to start searching from
 * @returns Absolute path to .squad/ directory, or null if not found
 */
export async function resolveSquadPath(workspaceRoot: string): Promise<string | null> {
    const resolution = await loadResolution();
    return resolution.resolveSquad(workspaceRoot);
}

// ─── SDK Main Module (VERSION, loadConfig) ─────────────────────────────────

let _sdkMain: any = null;

async function loadSdkMain(): Promise<any> {
    if (!_sdkMain) {
        _sdkMain = await dynamicImport('@bradygaster/squad-sdk');
    }
    return _sdkMain;
}

/**
 * Returns the Squad SDK version string.
 * Falls back to reading the SDK's package.json if the VERSION export is unavailable.
 */
export async function getSquadSdkVersion(): Promise<string | null> {
    try {
        const sdk = await loadSdkMain();
        if (sdk.VERSION) {
            return sdk.VERSION;
        }
    } catch {
        // SDK main module unavailable — try package.json fallback
    }

    try {
        const fs = await import('fs');
        const path = await import('path');
        // Resolve from node_modules relative to this file
        const pkgPath = path.join(__dirname, '..', 'node_modules', '@bradygaster', 'squad-sdk', 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        return pkg.version ?? null;
    } catch {
        return null;
    }
}

/** Result of loading Squad configuration via the SDK. */
export interface SdkConfigLoadResult {
    /** The loaded configuration object */
    config: any;
    /** Source file path (if found) */
    source?: string;
    /** Whether the default config was used (no config file found) */
    isDefault: boolean;
}

/**
 * Loads and validates Squad configuration using the SDK's loadConfig().
 * Discovers squad.config.ts/.js/.json or .squad/config.json.
 *
 * @param workspaceRoot - Working directory to search for config files
 * @returns Config load result, or null if SDK is unavailable
 */
export async function loadSquadConfig(workspaceRoot: string): Promise<SdkConfigLoadResult | null> {
    try {
        const sdk = await loadSdkMain();
        const result = await sdk.loadConfig(workspaceRoot);
        return {
            config: result.config,
            source: result.source,
            isDefault: result.isDefault,
        };
    } catch {
        return null;
    }
}

/**
 * Scans multiple workspace roots for Squad folders using the SDK's resolveSquad().
 * Returns a map of workspace root → detected folder name.
 *
 * @param workspaceRoots - Array of workspace root directories to scan
 * @returns Map from workspace root to detected squad folder ('.squad' or '.ai-team')
 */
export async function scanWorkspacesForSquad(
    workspaceRoots: string[],
): Promise<Map<string, '.squad' | '.ai-team'>> {
    const path = await import('path');
    const results = new Map<string, '.squad' | '.ai-team'>();

    const settled = await Promise.allSettled(
        workspaceRoots.map(async (root) => {
            const resolved = await resolveSquadPath(root);
            if (resolved) {
                const folderName = path.basename(resolved) as '.squad' | '.ai-team';
                if (folderName === '.squad' || folderName === '.ai-team') {
                    return { root, folderName };
                }
            }
            return { root, folderName: null };
        }),
    );

    for (const result of settled) {
        if (result.status === 'fulfilled' && result.value.folderName) {
            results.set(result.value.root, result.value.folderName);
        }
    }

    return results;
}

// ─── Adapter / Mapping Functions ───────────────────────────────────────────

/**
 * Maps an SDK ParsedAgent to SquadUI's SquadMember model.
 *
 * The SDK's ParsedAgent has a flat status string; SquadUI uses typed MemberStatus.
 * Team.md defines configuration status — all members start as 'idle' until
 * orchestration logs or active-work markers show them working at runtime.
 *
 * Note: The SDK lowercases agent names to kebab-case for config use.
 * We capitalize the first letter for display since team.md names are proper nouns.
 */
export function adaptParsedAgentToSquadMember(agent: ParsedAgent): SquadMember {
    // SDK status is a free-form string (e.g. "Active", "Silent", "Working").
    // Map to SquadUI's MemberStatus: 'working' only if explicitly working.
    const statusText = (agent.status ?? '').toLowerCase();
    const status = (statusText.includes('working') || statusText.includes('🔨'))
        ? 'working' as const
        : 'idle' as const;

    return {
        name: capitalizeAgentName(agent.name),
        role: agent.role,
        status,
    };
}

/**
 * Capitalizes an SDK agent name for display.
 * SDK returns kebab-case (e.g. "danny" → "Danny", "carol" → "Carol").
 * Names starting with @ (e.g. "@copilot") are left as-is.
 */
function capitalizeAgentName(name: string): string {
    if (!name || name.startsWith('@')) {
        return name;
    }
    return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Maps an SDK ParsedDecision to SquadUI's DecisionEntry model.
 *
 * The SDK's parseDecisionsMarkdown only extracts dates from heading prefixes
 * (e.g. "## 2026-02-14: Title") and author from **By:** lines.
 * SquadUI also expects **Date:** and **Author:** metadata lines to be parsed.
 * This adapter fills in the gaps by scanning the body for metadata the SDK missed.
 *
 * @param decision - SDK parsed decision
 * @param filePath - Source file path (the SDK doesn't track this)
 * @param lineNumber - Optional line number in the source file
 */
export function adaptParsedDecisionToDecisionEntry(
    decision: ParsedDecision,
    filePath: string,
    lineNumber?: number,
): DecisionEntry {
    let { date, author } = decision;

    // SDK doesn't extract **Date:** metadata lines — do it here
    if (!date && decision.body) {
        const dateMatch = decision.body.match(/\*\*Date:\*\*\s*(.+)/);
        if (dateMatch) {
            const isoMatch = dateMatch[1].trim().match(/(\d{4}-\d{2}-\d{2})/);
            if (isoMatch) { date = isoMatch[1]; }
        }
    }

    // SDK only extracts **By:** for author — also check **Author:**
    if (!author && decision.body) {
        const authorMatch = decision.body.match(/\*\*(?:Author|By):\*\*\s*(.+)/);
        if (authorMatch) { author = authorMatch[1].trim(); }
    }

    return {
        title: decision.title,
        date,
        author,
        content: decision.body,
        filePath,
        lineNumber,
    };
}
