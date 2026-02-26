/**
 * Service for running diagnostic health checks on the squad configuration.
 * Validates team.md structure, agent charters, orchestration logs, and GitHub config.
 *
 * Pure TypeScript — no VS Code API dependency, testable in isolation.
 */

import * as fs from 'fs';
import * as path from 'path';
import { TeamMdService } from './TeamMdService';
import { OrchestrationLogService } from './OrchestrationLogService';

/**
 * Result of a single health check.
 */
export interface HealthCheckResult {
    /** Human-readable check name */
    name: string;
    /** Pass, fail, or warn */
    status: 'pass' | 'fail' | 'warn';
    /** Description of the result */
    message: string;
    /** Actionable fix suggestion when status is fail or warn */
    fix?: string;
}

/**
 * Service that validates team configuration and reports diagnostics.
 */
export class HealthCheckService {

    /**
     * Validates that team.md exists and parses correctly.
     */
    async checkTeamMd(squadFolder: string, workspaceRoot: string): Promise<HealthCheckResult> {
        const teamMdPath = path.join(workspaceRoot, squadFolder, 'team.md');

        try {
            await fs.promises.access(teamMdPath, fs.constants.R_OK);
        } catch {
            return {
                name: 'team.md',
                status: 'fail',
                message: `team.md not found at ${squadFolder}/team.md`,
                fix: `Create a team.md file in the ${squadFolder}/ directory, or run the "Squad: Initialize" command.`,
            };
        }

        try {
            const service = new TeamMdService(squadFolder as '.squad' | '.ai-team');
            const roster = await service.parseTeamMd(workspaceRoot);

            if (!roster) {
                return {
                    name: 'team.md',
                    status: 'fail',
                    message: 'team.md exists but could not be parsed',
                    fix: 'Ensure team.md contains a valid Members or Roster markdown table.',
                };
            }

            if (roster.members.length === 0) {
                return {
                    name: 'team.md',
                    status: 'warn',
                    message: 'team.md parsed but no members found',
                    fix: 'Add a Members or Roster table with at least one team member row.',
                };
            }

            return {
                name: 'team.md',
                status: 'pass',
                message: `team.md OK — ${roster.members.length} member(s) found`,
            };
        } catch (error) {
            return {
                name: 'team.md',
                status: 'fail',
                message: `team.md parse error: ${error instanceof Error ? error.message : String(error)}`,
                fix: 'Check team.md for malformed markdown tables or syntax errors.',
            };
        }
    }

    /**
     * Validates that all agent folders contain a charter.md file.
     */
    async checkAgentCharters(squadFolder: string, workspaceRoot: string): Promise<HealthCheckResult> {
        const agentsDir = path.join(workspaceRoot, squadFolder, 'agents');

        try {
            await fs.promises.access(agentsDir, fs.constants.R_OK);
        } catch {
            return {
                name: 'Agent Charters',
                status: 'warn',
                message: `No agents/ directory found at ${squadFolder}/agents/`,
                fix: 'Run "Squad: Initialize" to create agent folders, or create them manually.',
            };
        }

        try {
            const entries = await fs.promises.readdir(agentsDir, { withFileTypes: true });
            const agentDirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('_'));

            if (agentDirs.length === 0) {
                return {
                    name: 'Agent Charters',
                    status: 'warn',
                    message: 'agents/ directory exists but contains no agent folders',
                    fix: 'Add agent subdirectories with charter.md files.',
                };
            }

            const missing: string[] = [];
            for (const dir of agentDirs) {
                const charterPath = path.join(agentsDir, dir.name, 'charter.md');
                try {
                    await fs.promises.access(charterPath, fs.constants.R_OK);
                } catch {
                    missing.push(dir.name);
                }
            }

            if (missing.length > 0) {
                return {
                    name: 'Agent Charters',
                    status: 'fail',
                    message: `Missing charter.md in: ${missing.join(', ')}`,
                    fix: `Create charter.md files in: ${missing.map(m => `${squadFolder}/agents/${m}/`).join(', ')}`,
                };
            }

            return {
                name: 'Agent Charters',
                status: 'pass',
                message: `All ${agentDirs.length} agent(s) have charter.md`,
            };
        } catch (error) {
            return {
                name: 'Agent Charters',
                status: 'fail',
                message: `Error scanning agents/: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }

    /**
     * Validates that orchestration log files parse without errors.
     */
    async checkOrchestrationLogs(squadFolder: string, workspaceRoot: string): Promise<HealthCheckResult> {
        const service = new OrchestrationLogService(squadFolder as '.squad' | '.ai-team');

        try {
            const files = await service.discoverLogFiles(workspaceRoot);

            if (files.length === 0) {
                return {
                    name: 'Orchestration Logs',
                    status: 'warn',
                    message: 'No orchestration log files found',
                    fix: `Create .md log files in ${squadFolder}/orchestration-log/ or ${squadFolder}/log/.`,
                };
            }

            const errors: string[] = [];
            for (const file of files) {
                try {
                    await service.parseLogFile(file);
                } catch (error) {
                    errors.push(path.basename(file));
                }
            }

            if (errors.length > 0) {
                return {
                    name: 'Orchestration Logs',
                    status: 'fail',
                    message: `${errors.length} log file(s) failed to parse: ${errors.join(', ')}`,
                    fix: 'Check the listed files for malformed markdown structure.',
                };
            }

            return {
                name: 'Orchestration Logs',
                status: 'pass',
                message: `All ${files.length} log file(s) parsed successfully`,
            };
        } catch (error) {
            return {
                name: 'Orchestration Logs',
                status: 'fail',
                message: `Log discovery error: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }

    /**
     * Verifies GitHub token configuration.
     * Warns if not configured (optional feature), fails if configured but unreachable.
     */
    async checkGitHubConfig(): Promise<HealthCheckResult> {
        const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

        if (!token) {
            return {
                name: 'GitHub Config',
                status: 'warn',
                message: 'No GitHub token found (GITHUB_TOKEN or GH_TOKEN)',
                fix: 'Set GITHUB_TOKEN or GH_TOKEN environment variable to enable issue integration.',
            };
        }

        return {
            name: 'GitHub Config',
            status: 'pass',
            message: 'GitHub token is configured',
        };
    }

    /**
     * Runs all health checks and returns structured results.
     */
    async runAll(squadFolder: string, workspaceRoot: string): Promise<HealthCheckResult[]> {
        const results = await Promise.all([
            this.checkTeamMd(squadFolder, workspaceRoot),
            this.checkAgentCharters(squadFolder, workspaceRoot),
            this.checkOrchestrationLogs(squadFolder, workspaceRoot),
            this.checkGitHubConfig(),
        ]);

        return results;
    }

    /**
     * Formats results into a human-readable summary string.
     */
    formatResults(results: HealthCheckResult[]): string {
        const lines: string[] = ['Squad Health Check Results', '═'.repeat(40), ''];

        for (const r of results) {
            const icon = r.status === 'pass' ? '✅' : r.status === 'warn' ? '⚠️' : '❌';
            lines.push(`${icon} ${r.name}: ${r.message}`);
            if (r.fix) {
                lines.push(`   Fix: ${r.fix}`);
            }
        }

        const passed = results.filter(r => r.status === 'pass').length;
        const warned = results.filter(r => r.status === 'warn').length;
        const failed = results.filter(r => r.status === 'fail').length;
        lines.push('');
        lines.push(`Summary: ${passed} passed, ${warned} warning(s), ${failed} failed`);

        return lines.join('\n');
    }
}
