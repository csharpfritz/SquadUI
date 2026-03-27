/**
 * SDK Adapter — single integration point for @bradygaster/squad-sdk.
 *
 * All SquadUI code imports SDK functionality through this module.
 * No other file should import directly from '@bradygaster/squad-sdk'.
 *
 * ## Architecture
 *
 * This module provides:
 * 1. **SDK Type Mirrors** — local interfaces matching SDK exports to avoid ESM/CJS
 *    type resolution issues at compile time.
 * 2. **Parser Wrappers** — async functions that lazy-load SDK modules and delegate
 *    to SDK parsing functions (parseTeamMarkdown, parseDecisionsMarkdown).
 * 3. **Resolution Wrappers** — squad folder detection via SDK walk-up algorithm.
 * 4. **Mapping Functions** — transform SDK types to SquadUI types with gap-filling
 *    for metadata the SDK doesn't extract.
 * 5. **Bulk Mapping Helpers** — convenience functions for mapping arrays.
 * 6. **High-Level Integration** — `getSquadMetadata()` aggregates all SDK data
 *    into a single SquadUI-ready bundle.
 *
 * ## ESM/CJS Interop
 *
 * The SDK is ESM-only ("type": "module") while SquadUI compiles to CommonJS.
 * TypeScript's `module: "commonjs"` transforms `import()` → `require()`, which
 * can't load ESM packages. We use `new Function('specifier', 'return import(specifier)')`
 * to bypass the transform and invoke Node.js's native ESM dynamic import.
 *
 * ## Type Mapping Reference
 *
 * | SDK Type (ParsedAgent) | SquadUI Type (SquadMember) | Mapping                              |
 * |------------------------|---------------------------|--------------------------------------|
 * | name (string)          | name (string)             | Capitalized (kebab→proper noun)      |
 * | role (string)          | role (string)             | Direct pass-through                  |
 * | status? (string)       | status (MemberStatus)     | Derived: "working"/🔨 → 'working', else 'idle' |
 * | skills (string[])      | —                         | Lossy: not in SquadMember model      |
 * | model? (string)        | —                         | Lossy: not in SquadMember model      |
 * | aliases? (string[])    | —                         | Lossy: not in SquadMember model      |
 * | autoAssign? (boolean)  | —                         | Lossy: not in SquadMember model      |
 * | —                      | activityContext?           | Defaulted: undefined (runtime-only)  |
 * | —                      | currentTask?              | Defaulted: undefined (runtime-only)  |
 *
 * | SDK Type (ParsedDecision) | SquadUI Type (DecisionEntry) | Mapping                          |
 * |--------------------------|-------------------------------|----------------------------------|
 * | title (string)           | title (string)                | Direct pass-through              |
 * | body (string)            | content? (string)             | Renamed: body → content          |
 * | date? (string)           | date? (string)                | Direct or extracted from body    |
 * | author? (string)         | author? (string)              | Direct or extracted from body    |
 * | configRelevant (boolean) | —                             | Lossy: not in DecisionEntry      |
 * | headingLevel? (number)   | —                             | Lossy: not in DecisionEntry      |
 * | —                        | filePath (string)             | Caller-supplied (SDK doesn't track) |
 * | —                        | lineNumber? (number)          | Caller-supplied (optional)       |
 */

import { SquadMember, DecisionEntry, MemberStatus } from '../models';

// ─── SDK Type Mirrors ──────────────────────────────────────────────────────
// Defined locally to avoid ESM/CJS type resolution issues at compile time.
// These match the SDK's exported interfaces from @bradygaster/squad-sdk/parsers.

/**
 * Agent parsed from team.md by the SDK.
 *
 * SDK extracts agents from the Members/Roster table in team.md.
 * Names are lowercased to kebab-case by the SDK (e.g., "Danny" → "danny").
 *
 * **Fields not present in SquadUI's SquadMember:**
 * - `skills` — SquadUI doesn't display agent skills (lossy)
 * - `model` — AI model designation, not relevant to UI display (lossy)
 * - `aliases` — used for issue matching, handled at IssueSourceConfig level (lossy)
 * - `autoAssign` — SDK-specific routing config (lossy)
 */
export interface ParsedAgent {
    name: string;
    role: string;
    skills: string[];
    model?: string;
    status?: string;
    aliases?: string[];
    autoAssign?: boolean;
}

/**
 * Decision parsed from decisions.md by the SDK.
 *
 * SDK extracts decisions from H2/H3 headings with date prefixes and **By:** lines.
 * SquadUI also parses **Date:** and **Author:** metadata lines that the SDK misses.
 *
 * **Fields not present in SquadUI's DecisionEntry:**
 * - `configRelevant` — SDK flag for config-affecting decisions (lossy)
 * - `headingLevel` — markdown heading depth, not used by SquadUI (lossy)
 */
export interface ParsedDecision {
    title: string;
    body: string;
    configRelevant: boolean;
    date?: string;
    author?: string;
    headingLevel?: number;
}

/** Options for agent-to-member mapping. */
export interface AdaptAgentOptions {
    /** Override the derived MemberStatus instead of auto-detecting from agent.status */
    defaultStatus?: MemberStatus;
}

/** Options for decision-to-entry mapping. */
export interface AdaptDecisionOptions {
    /** Default file path when caller doesn't provide one */
    defaultFilePath?: string;
    /** Starting line number offset (e.g., when parsing a subset of a file) */
    lineNumberOffset?: number;
}

/**
 * Aggregated Squad metadata returned by {@link getSquadMetadata}.
 * A single call returns everything SquadUI needs about a Squad workspace.
 */
export interface SquadMetadata {
    /** Team roster adapted to SquadUI SquadMember[] */
    members: SquadMember[];
    /** Decisions adapted to SquadUI DecisionEntry[] */
    decisions: DecisionEntry[];
    /** SDK configuration status (null if SDK unavailable) */
    config: SdkConfigLoadResult | null;
    /** SDK version string (null if unavailable) */
    sdkVersion: string | null;
    /** Detected squad folder name ('.squad' or '.ai-team'), or null */
    squadFolder: '.squad' | '.ai-team' | null;
    /** Warnings from SDK parsing (team.md + decisions.md combined) */
    warnings: string[];
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
 * ## Field Mapping
 * - **name**: Capitalized from SDK kebab-case (e.g., "danny" → "Danny").
 *   Names starting with `@` (e.g., "@copilot") are preserved as-is.
 * - **role**: Direct pass-through from `agent.role`.
 * - **status**: Derived from `agent.status` free-form string:
 *   - Contains "working" or "🔨" → `'working'`
 *   - Otherwise → `'idle'` (or `options.defaultStatus` if provided)
 *
 * ## Lossy Conversions (SDK data SquadUI ignores)
 * - `skills[]` — SquadUI doesn't display agent skills
 * - `model` — AI model designation, not relevant to UI
 * - `aliases[]` — handled at IssueSourceConfig level, not SquadMember
 * - `autoAssign` — SDK-specific routing config
 *
 * ## SquadUI Fields Not in SDK
 * - `activityContext` — derived at runtime from orchestration logs
 * - `currentTask` — derived at runtime from active work markers
 *
 * @param agent - SDK parsed agent from `parseTeamMarkdown()`
 * @param options - Optional mapping overrides
 * @returns SquadMember with name, role, and derived status
 */
export function adaptParsedAgentToSquadMember(agent: ParsedAgent, options?: AdaptAgentOptions): SquadMember {
    // SDK status is a free-form string (e.g. "Active", "Silent", "Working").
    // Map to SquadUI's MemberStatus: 'working' only if explicitly working.
    const statusText = (agent.status ?? '').toLowerCase();
    const isWorking = statusText.includes('working') || statusText.includes('🔨');
    const status: MemberStatus = isWorking
        ? 'working'
        : (options?.defaultStatus ?? 'idle');

    return {
        name: capitalizeAgentName(agent.name),
        role: agent.role,
        status,
    };
}

/**
 * Bulk mapping: converts an array of SDK ParsedAgents to SquadUI SquadMembers.
 *
 * Convenience wrapper around {@link adaptParsedAgentToSquadMember} for
 * mapping entire team rosters in one call.
 *
 * @param agents - Array of SDK parsed agents
 * @param options - Optional mapping overrides applied to all agents
 * @returns Array of SquadMember in the same order as input
 */
export function adaptAgentsToMembers(agents: ParsedAgent[], options?: AdaptAgentOptions): SquadMember[] {
    return agents.map(agent => adaptParsedAgentToSquadMember(agent, options));
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
 * ## Field Mapping
 * - **title**: Direct pass-through from `decision.title`.
 * - **content**: Renamed from `decision.body`.
 * - **date**: Uses SDK-provided date first. If absent, extracts from
 *   `**Date:** YYYY-MM-DD` in the decision body. SDK only extracts dates
 *   from heading prefixes (e.g., "## 2026-02-14: Title").
 * - **author**: Uses SDK-provided author first. If absent, extracts from
 *   `**Author:**` or `**By:**` lines in the body. SDK only looks for `**By:**`.
 * - **filePath**: Caller-supplied — the SDK doesn't track file origins.
 * - **lineNumber**: Optional caller-supplied line offset.
 *
 * ## Lossy Conversions (SDK data SquadUI ignores)
 * - `configRelevant` — SDK flag for config-affecting decisions
 * - `headingLevel` — markdown heading depth
 *
 * @param decision - SDK parsed decision from `parseDecisionsMarkdown()`
 * @param filePath - Source file path (the SDK doesn't track this)
 * @param lineNumber - Optional line number in the source file
 * @param options - Optional mapping overrides
 * @returns DecisionEntry with gap-filled metadata
 */
export function adaptParsedDecisionToDecisionEntry(
    decision: ParsedDecision,
    filePath: string,
    lineNumber?: number,
    options?: AdaptDecisionOptions,
): DecisionEntry {
    let { date, author } = decision;
    const effectiveFilePath = filePath || options?.defaultFilePath || '';
    const effectiveLineNumber = lineNumber !== undefined
        ? lineNumber + (options?.lineNumberOffset ?? 0)
        : undefined;

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
        filePath: effectiveFilePath,
        lineNumber: effectiveLineNumber,
    };
}

/**
 * Bulk mapping: converts an array of SDK ParsedDecisions to SquadUI DecisionEntries.
 *
 * Convenience wrapper around {@link adaptParsedDecisionToDecisionEntry} for
 * mapping entire decision sets in one call.
 *
 * @param decisions - Array of SDK parsed decisions
 * @param filePath - Source file path applied to all entries
 * @param options - Optional mapping overrides applied to all decisions
 * @returns Array of DecisionEntry in the same order as input
 */
export function adaptDecisionsToEntries(
    decisions: ParsedDecision[],
    filePath: string,
    options?: AdaptDecisionOptions,
): DecisionEntry[] {
    return decisions.map((decision, index) =>
        adaptParsedDecisionToDecisionEntry(decision, filePath, index, options),
    );
}

// ─── High-Level Integration ────────────────────────────────────────────────

/**
 * Aggregates all SDK-powered Squad data for a workspace into a single bundle.
 *
 * This is the recommended entry point for services that need a complete picture
 * of a Squad workspace. It:
 * 1. Detects the squad folder (`.squad` or `.ai-team`) via SDK resolution
 * 2. Reads and parses `team.md` → adapted SquadMember[]
 * 3. Reads and parses `decisions.md` → adapted DecisionEntry[]
 * 4. Loads SDK configuration status
 * 5. Retrieves SDK version
 *
 * All operations are parallel where possible and individually fault-tolerant.
 * If any step fails, its result is empty/null — the rest still populate.
 *
 * @param workspaceRoot - Absolute path to the workspace root
 * @returns SquadMetadata with all available data, never throws
 */
export async function getSquadMetadata(workspaceRoot: string): Promise<SquadMetadata> {
    const fs = await import('fs');
    const path = await import('path');

    const metadata: SquadMetadata = {
        members: [],
        decisions: [],
        config: null,
        sdkVersion: null,
        squadFolder: null,
        warnings: [],
    };

    // Step 1: Detect squad folder
    let squadFolderPath: string | null = null;
    try {
        squadFolderPath = await resolveSquadPath(workspaceRoot);
        if (squadFolderPath) {
            const folderName = path.basename(squadFolderPath);
            if (folderName === '.squad' || folderName === '.ai-team') {
                metadata.squadFolder = folderName as '.squad' | '.ai-team';
            }
        }
    } catch {
        // SDK resolution unavailable — squadFolder stays null
    }

    // Fall back to filesystem detection if SDK resolution failed
    if (!metadata.squadFolder) {
        if (fs.existsSync(path.join(workspaceRoot, '.squad'))) {
            metadata.squadFolder = '.squad';
            squadFolderPath = path.join(workspaceRoot, '.squad');
        } else if (fs.existsSync(path.join(workspaceRoot, '.ai-team'))) {
            metadata.squadFolder = '.ai-team';
            squadFolderPath = path.join(workspaceRoot, '.ai-team');
        }
    }

    // Steps 2-5: Parallel data loading
    const teamMdPath = squadFolderPath
        ? path.join(squadFolderPath, 'team.md')
        : path.join(workspaceRoot, metadata.squadFolder ?? '.squad', 'team.md');
    const decisionsMdPath = squadFolderPath
        ? path.join(squadFolderPath, 'decisions.md')
        : path.join(workspaceRoot, metadata.squadFolder ?? '.squad', 'decisions.md');

    const [teamResult, decisionsResult, configResult, versionResult] = await Promise.allSettled([
        // Parse team.md
        (async () => {
            if (!fs.existsSync(teamMdPath)) { return null; }
            const content = fs.readFileSync(teamMdPath, 'utf-8');
            return parseTeamMarkdown(content);
        })(),
        // Parse decisions.md
        (async () => {
            if (!fs.existsSync(decisionsMdPath)) { return null; }
            const content = fs.readFileSync(decisionsMdPath, 'utf-8');
            return parseDecisionsMarkdown(content);
        })(),
        // Load config
        loadSquadConfig(workspaceRoot),
        // Get SDK version
        getSquadSdkVersion(),
    ]);

    // Unpack team results
    if (teamResult.status === 'fulfilled' && teamResult.value) {
        metadata.members = adaptAgentsToMembers(teamResult.value.agents);
        metadata.warnings.push(...teamResult.value.warnings);
    }

    // Unpack decision results
    if (decisionsResult.status === 'fulfilled' && decisionsResult.value) {
        metadata.decisions = adaptDecisionsToEntries(
            decisionsResult.value.decisions,
            decisionsMdPath,
        );
        metadata.warnings.push(...decisionsResult.value.warnings);
    }

    // Unpack config
    if (configResult.status === 'fulfilled') {
        metadata.config = configResult.value;
    }

    // Unpack version
    if (versionResult.status === 'fulfilled') {
        metadata.sdkVersion = versionResult.value;
    }

    return metadata;
}
