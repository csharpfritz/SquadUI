### 2026-02-14: IGitHubIssuesService interface contract for tree view integration
**By:** Rusty
**What:** Defined `IGitHubIssuesService` interface in `src/models/index.ts` with a single method `getIssuesByMember(workspaceRoot: string): Promise<MemberIssueMap>`. The tree provider depends on this interface, not the concrete `GitHubIssuesService` class.
**Why:** Decouples the tree view from the issues service implementation. Allows the tree to compile and work without the service (graceful degradation). When Linus's #18 lands, the concrete service just needs to implement this interface and be wired via `treeProvider.setIssuesService()`.

### 2026-02-14: Issue icons use $(issues) codicon with ThemeColor tinting
**By:** Rusty
**What:** Issues in the tree view use the `$(issues)` codicon with `charts.green` color for open issues and `charts.purple` for closed. Tasks continue to use `$(tasklist)` with no color override.
**Why:** Makes issues visually distinct from orchestration tasks at a glance. Uses VS Code's built-in theme colors so it adapts to any color theme. The `charts.*` colors are well-established in the VS Code palette.

### 2026-02-14: Squad labels filtered from issue description display
**By:** Rusty
**What:** When rendering issue labels in the tree item description, labels starting with `squad:` are excluded.
**Why:** The `squad:{member}` label is used for routing/mapping issues to members — it's structural, not informational. Showing it in the UI would be redundant since the issue already appears under that member's node.
