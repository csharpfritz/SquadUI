/**
 * Service for fetching and caching GitHub issues from the connected repository.
 * Reads repo info from team.md's Issue Source section, fetches open issues
 * with squad labels, and maps them to squad members via squad:{member} labels.
 *
 * Decoupled from VS Code — uses Node's built-in https module.
 * Auth token is optional; unauthenticated requests have lower rate limits.
 */

import * as https from 'https';
import { GitHubIssue, GitHubLabel, GitHubMilestone, IssueSourceConfig } from '../models';
import { TeamMdService } from './TeamMdService';

/** Default cache TTL: 5 minutes */
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

/** Squad label prefix used to assign issues to members */
const SQUAD_LABEL_PREFIX = 'squad:';

/** Maximum pages to fetch for closed issues to avoid runaway requests */
const MAX_CLOSED_PAGES = 5;

/**
 * Custom error for GitHub API failures, includes HTTP status code.
 */
class GitHubApiError extends Error {
    constructor(public readonly statusCode: number, message: string) {
        super(message);
        this.name = 'GitHubApiError';
    }
}

/**
 * Cached issue data with expiry tracking.
 */
interface IssueCache {
    issues: GitHubIssue[];
    fetchedAt: number;
}

/**
 * Options for configuring the GitHubIssuesService.
 */
export interface GitHubIssuesServiceOptions {
    /** Cache TTL in milliseconds (default: 5 minutes) */
    cacheTtlMs?: number;

    /** GitHub personal access token for authenticated requests */
    token?: string;

    /** GitHub API base URL (default: https://api.github.com) */
    apiBaseUrl?: string;
}

/**
 * Service for fetching GitHub issues and mapping them to squad members.
 */
export class GitHubIssuesService {
    private teamMdService: TeamMdService;
    private cacheTtlMs: number;
    private token?: string;
    private apiBaseUrl: string;

    private cache: IssueCache | null = null;
    private closedCache: IssueCache | null = null;
    private issueSourceCache: IssueSourceConfig | null = null;

    constructor(options: GitHubIssuesServiceOptions = {}) {
        this.teamMdService = new TeamMdService();
        this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
        this.token = options.token;
        this.apiBaseUrl = (options.apiBaseUrl ?? 'https://api.github.com').replace(/\/+$/, '');
    }

    /**
     * Reads the Issue Source section from team.md and returns parsed config.
     * Returns null if team.md is missing or has no Issue Source.
     */
    async getIssueSource(workspaceRoot: string): Promise<IssueSourceConfig | null> {
        if (this.issueSourceCache) {
            return this.issueSourceCache;
        }

        const roster = await this.teamMdService.parseTeamMd(workspaceRoot);
        if (!roster?.repository) {
            return null;
        }

        const repo = roster.repository;
        const parts = repo.split('/');
        if (parts.length < 2) {
            return null;
        }

        // Handle "owner/repo" or "github.com/owner/repo" formats
        const owner = parts.length === 2 ? parts[0] : parts[parts.length - 2];
        const repoName = parts[parts.length - 1];

        this.issueSourceCache = {
            repository: `${owner}/${repoName}`,
            owner,
            repo: repoName,
            matching: roster.issueMatching,
            memberAliases: roster.memberAliases,
        };

        return this.issueSourceCache;
    }

    /**
     * Fetches open issues from the connected repository.
     * Results are cached; subsequent calls within TTL return cached data.
     *
     * @param workspaceRoot - Root directory containing .ai-team/team.md
     * @param forceRefresh - Bypass cache and fetch fresh data
     * @returns Array of GitHub issues, or empty array if no Issue Source configured
     */
    async getIssues(workspaceRoot: string, forceRefresh = false): Promise<GitHubIssue[]> {
        if (!forceRefresh && this.cache && !this.isCacheExpired()) {
            return this.cache.issues;
        }

        const config = await this.getIssueSource(workspaceRoot);
        if (!config) {
            return [];
        }

        try {
            const issues = await this.fetchIssuesFromApi(config);
            this.cache = { issues, fetchedAt: Date.now() };
            return issues;
        } catch (error) {
            if (error instanceof GitHubApiError && error.statusCode === 403) {
                console.warn('GitHub API rate limit hit, returning cached data');
                return this.cache?.issues ?? [];
            }
            throw error;
        }
    }

    /**
     * Returns issues assigned to a specific squad member via squad:{name} labels.
     *
     * @param workspaceRoot - Root directory containing .ai-team/team.md
     * @param memberName - Squad member name (case-insensitive match against label)
     */
    async getIssuesForMember(workspaceRoot: string, memberName: string): Promise<GitHubIssue[]> {
        const issues = await this.getIssues(workspaceRoot);
        const normalizedName = memberName.toLowerCase();
        return issues.filter(issue =>
            (issue.labels ?? []).some(label =>
                label.name.toLowerCase().startsWith(SQUAD_LABEL_PREFIX) &&
                label.name.substring(SQUAD_LABEL_PREFIX.length).toLowerCase() === normalizedName
            )
        );
    }

    /**
     * Returns a map of member name → assigned issues.
     * Uses configured matching strategies (labels, assignees, any-label).
     * Results from all active strategies are combined (union, deduplicated).
     * Only includes members with at least one issue.
     */
    async getIssuesByMember(workspaceRoot: string): Promise<Map<string, GitHubIssue[]>> {
        const issues = await this.getIssues(workspaceRoot);
        const config = await this.getIssueSource(workspaceRoot);
        const strategies = this.resolveStrategies(config?.matching);
        const aliases = config?.memberAliases;

        // Build reverse alias map: GitHub username → squad member name
        const usernameToMember = new Map<string, string>();
        if (aliases) {
            for (const [memberName, ghUsername] of aliases) {
                usernameToMember.set(ghUsername.toLowerCase(), memberName.toLowerCase());
            }
        }

        const byMember = new Map<string, GitHubIssue[]>();
        const seen = new Map<string, Set<number>>(); // member → set of issue numbers

        for (const issue of issues) {
            // Strategy: squad:{member} labels
            if (strategies.includes('labels')) {
                for (const label of (issue.labels ?? [])) {
                    if (label.name.toLowerCase().startsWith(SQUAD_LABEL_PREFIX)) {
                        const member = label.name.substring(SQUAD_LABEL_PREFIX.length).toLowerCase();
                        this.addIssueToBucket(byMember, seen, member, issue);
                    }
                }
            }

            // Strategy: assignee matching via memberAliases
            if (strategies.includes('assignees') && issue.assignee) {
                const assigneeLower = issue.assignee.toLowerCase();
                const memberName = usernameToMember.get(assigneeLower);
                if (memberName) {
                    this.addIssueToBucket(byMember, seen, memberName, issue);
                }
            }

            // Strategy: any label matching a member name (case-insensitive)
            if (strategies.includes('any-label')) {
                for (const label of (issue.labels ?? [])) {
                    const labelLower = label.name.toLowerCase();
                    // Skip squad: prefixed labels — those are handled by the labels strategy
                    if (!labelLower.startsWith(SQUAD_LABEL_PREFIX)) {
                        this.addIssueToBucket(byMember, seen, labelLower, issue);
                    }
                }
            }
        }

        return byMember;
    }

    /**
     * Fetches recently closed issues from the connected repository.
     * Limited to 50 most recently updated for performance.
     * Results are cached separately from open issues.
     *
     * @param workspaceRoot - Root directory containing .ai-team/team.md
     * @param forceRefresh - Bypass cache and fetch fresh data
     * @returns Array of closed GitHub issues, or empty array if no Issue Source configured
     */
    async getClosedIssues(workspaceRoot: string, forceRefresh = false): Promise<GitHubIssue[]> {
        if (!forceRefresh && this.closedCache && !this.isClosedCacheExpired()) {
            return this.closedCache.issues;
        }

        const config = await this.getIssueSource(workspaceRoot);
        if (!config) {
            return [];
        }

        try {
            const issues = await this.fetchClosedIssuesFromApi(config);
            this.closedCache = { issues, fetchedAt: Date.now() };
            return issues;
        } catch (error) {
            if (error instanceof GitHubApiError && error.statusCode === 403) {
                console.warn('GitHub API rate limit hit, returning cached closed data');
                return this.closedCache?.issues ?? [];
            }
            throw error;
        }
    }

    /**
     * Returns recently closed issues mapped to squad members.
     * Uses configured matching strategies (labels, assignees, any-label).
     * Only includes members with at least one closed issue.
     */
    async getClosedIssuesByMember(workspaceRoot: string): Promise<Map<string, GitHubIssue[]>> {
        const issues = await this.getClosedIssues(workspaceRoot);
        const config = await this.getIssueSource(workspaceRoot);
        const strategies = this.resolveStrategies(config?.matching);
        const aliases = config?.memberAliases;

        const usernameToMember = new Map<string, string>();
        if (aliases) {
            for (const [memberName, ghUsername] of aliases) {
                usernameToMember.set(ghUsername.toLowerCase(), memberName.toLowerCase());
            }
        }

        const byMember = new Map<string, GitHubIssue[]>();
        const seen = new Map<string, Set<number>>();

        for (const issue of issues) {
            if (strategies.includes('labels')) {
                for (const label of (issue.labels ?? [])) {
                    if (label.name.toLowerCase().startsWith(SQUAD_LABEL_PREFIX)) {
                        const member = label.name.substring(SQUAD_LABEL_PREFIX.length).toLowerCase();
                        this.addIssueToBucket(byMember, seen, member, issue);
                    }
                }
            }

            if (strategies.includes('assignees') && issue.assignee) {
                const assigneeLower = issue.assignee.toLowerCase();
                const memberName = usernameToMember.get(assigneeLower);
                if (memberName) {
                    this.addIssueToBucket(byMember, seen, memberName, issue);
                }
            }

            if (strategies.includes('any-label')) {
                for (const label of (issue.labels ?? [])) {
                    const labelLower = label.name.toLowerCase();
                    if (!labelLower.startsWith(SQUAD_LABEL_PREFIX)) {
                        this.addIssueToBucket(byMember, seen, labelLower, issue);
                    }
                }
            }
        }

        return byMember;
    }

    /**
     * Invalidates the issue cache, forcing a fresh fetch on next access.
     */
    invalidateCache(): void {
        this.cache = null;
        this.closedCache = null;
    }

    /**
     * Fetches all issues (open + closed) for a specific milestone.
     * Used to build burndown charts.
     */
    async getMilestoneIssues(workspaceRoot: string, milestoneNumber: number): Promise<GitHubIssue[]> {
        const config = await this.getIssueSource(workspaceRoot);
        if (!config) { return []; }

        const allIssues: GitHubIssue[] = [];
        let page = 1;
        const perPage = 100;

        for (const state of ['open', 'closed'] as const) {
            page = 1;
            // eslint-disable-next-line no-constant-condition
            while (true) {
                const apiPath = `/repos/${config.owner}/${config.repo}/issues?state=${state}&milestone=${milestoneNumber}&per_page=${perPage}&page=${page}`;
                try {
                    const raw = await this.apiGet<GitHubApiIssue[]>(apiPath);
                    for (const item of raw) {
                        if (item.pull_request) { continue; }
                        allIssues.push(this.mapApiIssue(item));
                    }
                    if (raw.length < perPage) { break; }
                    page++;
                } catch {
                    break;
                }
            }
        }

        return allIssues;
    }

    /**
     * Fetches available milestones from the repository.
     * Returns all milestones (open and closed) sorted by most recently created.
     */
    async getMilestones(workspaceRoot: string): Promise<GitHubMilestone[]> {
        const config = await this.getIssueSource(workspaceRoot);
        if (!config) { return []; }

        try {
            const apiPath = `/repos/${config.owner}/${config.repo}/milestones?state=all&sort=created&direction=desc&per_page=10`;
            const raw = await this.apiGet<Array<{
                number: number; title: string; state: string;
                open_issues: number; closed_issues: number;
                due_on: string | null; created_at: string;
            }>>(apiPath);

            return raw.map(m => ({
                number: m.number,
                title: m.title,
                state: m.state as 'open' | 'closed',
                openIssues: m.open_issues,
                closedIssues: m.closed_issues,
                dueOn: m.due_on ?? undefined,
                createdAt: m.created_at,
            }));
        } catch {
            return [];
        }
    }

    /**
     * Invalidates both issue and issue-source caches.
     * Use when team.md changes.
     */
    invalidateAll(): void {
        this.cache = null;
        this.closedCache = null;
        this.issueSourceCache = null;
    }

    /**
     * Updates the auth token at runtime (e.g., after VS Code auth flow).
     */
    setToken(token: string | undefined): void {
        this.token = token;
        // Token change means cached data might include different results
        this.invalidateCache();
    }

    // ─── Private Methods ───────────────────────────────────────────────────

    /**
     * Resolves which matching strategies to use.
     * If config specifies strategies, use those. Otherwise default to labels + assignees
     * for backward compatibility with repos that have squad labels, plus assignee
     * matching as a fallback for repos that don't.
     */
    private resolveStrategies(matching?: string[]): string[] {
        if (matching && matching.length > 0) {
            return matching;
        }
        return ['labels', 'assignees'];
    }

    /**
     * Adds an issue to a member's bucket, deduplicating by issue number.
     */
    private addIssueToBucket(
        byMember: Map<string, GitHubIssue[]>,
        seen: Map<string, Set<number>>,
        member: string,
        issue: GitHubIssue
    ): void {
        let memberSeen = seen.get(member);
        if (!memberSeen) {
            memberSeen = new Set<number>();
            seen.set(member, memberSeen);
        }
        if (memberSeen.has(issue.number)) {
            return;
        }
        memberSeen.add(issue.number);

        const existing = byMember.get(member) ?? [];
        existing.push(issue);
        byMember.set(member, existing);
    }

    private isCacheExpired(): boolean {
        if (!this.cache) {
            return true;
        }
        return Date.now() - this.cache.fetchedAt > this.cacheTtlMs;
    }

    private isClosedCacheExpired(): boolean {
        if (!this.closedCache) {
            return true;
        }
        return Date.now() - this.closedCache.fetchedAt > this.cacheTtlMs;
    }

    /**
     * Fetches issues from the GitHub REST API.
     * Paginates automatically to retrieve all matching issues.
     */
    private async fetchIssuesFromApi(config: IssueSourceConfig): Promise<GitHubIssue[]> {
        const allIssues: GitHubIssue[] = [];
        let page = 1;
        const perPage = 100;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const path = `/repos/${config.owner}/${config.repo}/issues?state=open&per_page=${perPage}&page=${page}`;
            let raw: GitHubApiIssue[];

            try {
                raw = await this.apiGet<GitHubApiIssue[]>(path);
            } catch (error) {
                // On API error, return what we have so far rather than losing everything
                if (allIssues.length > 0) {
                    console.warn(`GitHub API error on page ${page}, returning ${allIssues.length} issues fetched so far:`, error);
                    break;
                }
                throw error;
            }

            for (const item of raw) {
                // GitHub's issues endpoint also returns pull requests; skip them
                if (item.pull_request) {
                    continue;
                }
                allIssues.push(this.mapApiIssue(item));
            }

            if (raw.length < perPage) {
                break;
            }
            page++;
        }

        return allIssues;
    }

    /**
     * Fetches recently closed issues from the GitHub REST API.
     * Paginates up to MAX_CLOSED_PAGES pages (500 issues) sorted by most recently updated.
     */
    private async fetchClosedIssuesFromApi(config: IssueSourceConfig): Promise<GitHubIssue[]> {
        const allIssues: GitHubIssue[] = [];
        let page = 1;
        const perPage = 100;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const path = `/repos/${config.owner}/${config.repo}/issues?state=closed&sort=updated&direction=desc&per_page=${perPage}&page=${page}`;
            let raw: GitHubApiIssue[];

            try {
                raw = await this.apiGet<GitHubApiIssue[]>(path);
            } catch (error) {
                if (allIssues.length > 0) {
                    console.warn(`GitHub API error on closed issues page ${page}, returning ${allIssues.length} issues fetched so far:`, error);
                    break;
                }
                throw error;
            }

            for (const item of raw) {
                if (item.pull_request) {
                    continue;
                }
                allIssues.push(this.mapApiIssue(item));
            }

            if (raw.length < perPage || page >= MAX_CLOSED_PAGES) {
                break;
            }
            page++;
        }

        return allIssues;
    }

    /**
     * Maps a raw GitHub API issue response to our GitHubIssue interface.
     */
    private mapApiIssue(raw: GitHubApiIssue): GitHubIssue {
        const milestone: GitHubMilestone | undefined = raw.milestone ? {
            number: raw.milestone.number,
            title: raw.milestone.title,
            state: raw.milestone.state as 'open' | 'closed',
            openIssues: raw.milestone.open_issues,
            closedIssues: raw.milestone.closed_issues,
            dueOn: raw.milestone.due_on ?? undefined,
            createdAt: raw.milestone.created_at,
        } : undefined;

        return {
            number: raw.number,
            title: raw.title,
            body: raw.body ?? undefined,
            state: raw.state as 'open' | 'closed',
            labels: (raw.labels ?? []).map((label): GitHubLabel => {
                if (typeof label === 'string') {
                    return { name: label };
                }
                return { name: label.name ?? '', color: label.color ?? undefined };
            }),
            assignee: raw.assignee?.login ?? undefined,
            htmlUrl: raw.html_url,
            createdAt: raw.created_at,
            updatedAt: raw.updated_at,
            closedAt: raw.closed_at ?? undefined,
            milestone,
        };
    }

    /**
     * Makes an authenticated GET request to the GitHub API.
     */
    private apiGet<T>(path: string): Promise<T> {
        return new Promise((resolve, reject) => {
            const url = new URL(path, this.apiBaseUrl);
            const headers: Record<string, string> = {
                'User-Agent': 'SquadUI-VSCode-Extension',
                'Accept': 'application/vnd.github.v3+json',
            };

            if (this.token) {
                headers['Authorization'] = `Bearer ${this.token}`;
            }

            const options: https.RequestOptions = {
                hostname: url.hostname,
                path: url.pathname + url.search,
                method: 'GET',
                headers,
            };

            const req = https.request(options, (res) => {
                const chunks: Buffer[] = [];
                res.on('data', (chunk: Buffer) => chunks.push(chunk));
                res.on('end', () => {
                    const body = Buffer.concat(chunks).toString('utf-8');

                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve(JSON.parse(body) as T);
                        } catch (parseError) {
                            reject(new Error(`Failed to parse GitHub API response: ${parseError}`));
                        }
                    } else {
                        reject(new GitHubApiError(
                            res.statusCode ?? 0,
                            `GitHub API returned ${res.statusCode}: ${body.substring(0, 200)}`
                        ));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`GitHub API request failed: ${error.message}`));
            });

            req.end();
        });
    }
}

// ─── GitHub API Response Types (internal) ──────────────────────────────────

/** Raw label from GitHub API (can be string or object) */
interface GitHubApiLabel {
    name?: string;
    color?: string;
}

/** Raw issue from GitHub API */
interface GitHubApiIssue {
    number: number;
    title: string;
    body: string | null;
    state: string;
    labels: (string | GitHubApiLabel)[];
    assignee: { login: string } | null;
    html_url: string;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
    milestone: {
        number: number;
        title: string;
        state: string;
        open_issues: number;
        closed_issues: number;
        due_on: string | null;
        created_at: string;
    } | null;
    pull_request?: unknown;
}
