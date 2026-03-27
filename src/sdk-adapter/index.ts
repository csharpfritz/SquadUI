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
