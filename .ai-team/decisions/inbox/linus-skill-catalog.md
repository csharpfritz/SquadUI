### 2026-02-14: SkillCatalogService uses graceful degradation and no external dependencies
**By:** Linus
**What:** `SkillCatalogService` fetches from two external sources (awesome-copilot GitHub README, skills.sh HTML page) using Node's built-in `https` module. All public methods swallow network errors and return empty arrays — the UI layer never sees exceptions from catalog operations. Deduplication favors the awesome-copilot version when skills appear in both sources.
**Why:** Follows the existing pattern set by `GitHubIssuesService` — no npm dependencies, no `vscode` imports, graceful degradation on failure. The service must work offline (installed skills still readable) and must not crash the extension if an external source is down.
