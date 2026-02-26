# Decision: HealthCheckService is a pure-TypeScript service

**Date:** 2026-02-23  
**Author:** Linus  
**Issue:** #70  

## Context
The health check command needs to validate team configuration (team.md, agent charters, orchestration logs, GitHub token). This could be implemented directly in the command handler or as a standalone service.

## Decision
Created `HealthCheckService` as a pure TypeScript service with no VS Code API dependencies. Each check method accepts `squadFolder` and `workspaceRoot` as parameters. The command handler in `extension.ts` is minimal — just wires the service to an output channel.

## Rationale
- Testable in isolation (Mocha tests without VS Code test runner complexity)
- Follows existing service patterns (TeamMdService, OrchestrationLogService)
- Keeps service layer decoupled from VS Code UI (Linus/Rusty boundary)
- `HealthCheckResult` interface enables structured consumption by future UI (tree view, dashboard tab)
