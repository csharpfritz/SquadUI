# Livingston — History

## Project Context

- **Project:** SquadUI — VS Code extension for visualizing Squad team members and their tasks
- **Owner:** Jeffrey T. Fritz (csharpfritz@users.noreply.github.com)
- **Stack:** TypeScript, VS Code Extension API, npm
- **Repository:** github.com/csharpfritz/SquadUI

## Learnings

<!-- Append learnings below this line -->

### 2025-01-XX — GitHub Actions CI Pipeline (#22)

- **CI workflow location:** `.github/workflows/ci.yml`
- **Triggers:** Push to `main`, PRs targeting `main`
- **Pipeline stages:** `npm ci` → `npm run lint` → `npm run compile` → `npm test`
- **Node version:** 18.x (stable LTS, per team decision)
- **Artifacts:** Test results uploaded with 30-day retention
- **Pattern:** Used `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4`
- **Concurrency:** Added `concurrency` group with `cancel-in-progress: true` to avoid duplicate runs on the same branch
- **VS Code test runner:** Uses `xvfb-run -a npm test` because `@vscode/test-electron` needs a display server on Linux CI
- **ESLint config:** `.eslintrc.json` with `@typescript-eslint/parser` — lint step runs via `npm run lint` which calls `eslint src --ext ts`
- **Pre-existing workflow:** A ci.yml existed with Node 20; updated to Node 18 per team decision and added concurrency control

### 2025-07-19 — Release Pipeline

- **Release workflow location:** `.github/workflows/release.yml`
- **Trigger:** Tag push matching `v*`
- **Pipeline:** Self-contained — duplicates CI steps (lint, compile, test) rather than calling `ci.yml`, ensuring independence
- **VSIX packaging:** Installs `@vscode/vsce` globally, runs `vsce package`; output filename pattern is `squadui-{version}.vsix`
- **Version gate:** Extracts version from tag (strips `v` prefix), compares against `package.json` version — fails fast on mismatch
- **GitHub Release:** Uses `softprops/action-gh-release@v2` with auto-generated release notes; pre-release flag for major version < 1
- **Marketplace publish:** `vsce publish -p ${{ secrets.VSCE_PAT }}` — requires `VSCE_PAT` repository secret
- **Permissions:** `contents: write` for release creation
- **Key decision:** Self-contained CI steps in release workflow avoids coupling to `ci.yml` changes; release always gets a full quality gate

### 2026-02-13: Team Update — Issues Service & Closed Issues Support

📌 **Team decision merged (2026-02-13):** GitHubIssuesService uses Node.js `https` module with optional auth token and 5-minute cache. Closed issues use separate cache, 50-issue limit (no pagination), case-insensitive member matching. — decided by Linus
### 2026-02-14: Team Update — Release Pipeline Architecture (Decision Merged)

📌 **Team decision captured:** Release pipeline is self-contained with full CI gates (lint/compile/test). Version verification fails fast if tag doesn't match package.json. Separate workflows prevent coupling. Pre-release flag for versions < 1.0.0. — decided by Livingston

### 2026-02-15: Team Update — VS 2026 Extension CI/CD Separation Requirement

📌 **Team update (2026-02-15):** VS 2026 extension must have separate build and publish CI processes from the VS Code extension. Different languages (C#/.NET vs TypeScript), different package formats (VSIX vs .vsix), different marketplaces (VS Marketplace vs VS Code Marketplace). Independent pipelines prevent coupling and allow independent release cadences. Plan for separate `.github/workflows/` files for VS 2026 extension build/release. — decided by Jeffrey T. Fritz (via Copilot)

📌 Team update (2026-02-16): Test hardening conventions established — command registration tests use triple-guard pattern (extension/isActive/workspace); tree provider tests must await getChildren(); temp directories use test-fixtures/temp-{name}-${Date.now()} with teardown; private methods accessed via (instance as any).method.bind(instance) — decided by Basher

📌 Team update (2026-02-17): engines.vscode Version Alignment — engines.vscode must always be >= @types/vscode version. VSCE enforces this at package time. v0.7.2 release failed due to mismatch (^1.85.0 vs ^1.109.0); bumped engines.vscode to ^1.109.0 to match @types/vscode. — decided by Rusty

### 2026-02-16: Release v0.7.1 — Agents Folder Scanning Fallback

**Release process executed successfully:**
- Bumped version: `0.7.0` → `0.7.1` in `package.json`
- Updated `CHANGELOG.md`: Added v0.7.1 section with agents folder scanning feature, 9 new tests, 3-level fallback chain
- Committed: `chore: release v0.7.1` (commit 5300f24)
- Tagged: `git tag v0.7.1` and pushed with `git push origin main --tags`
- CI workflow (databaseId 22076469158): Queued → In Progress → **Success** ✅
- Release workflow (databaseId 22076469044): Automatically triggered by tag push → **Success** ✅
- GitHub Release: Auto-created by Release workflow with VSIX artifact (`squadui-0.7.1.vsix`, 2.63 MiB), pre-release flag set (version < 1.0.0)
- Release notes: Auto-generated with compare URL to v0.7.0

**Key observations:**
- Release workflow executed in parallel with CI, both completed successfully
- github-actions[bot] created the release automatically per release.yml `softprops/action-gh-release@v2` configuration
- VSIX packaging and marketplace publish appears successful (release shows artifact with SHA256)
- No manual release creation needed — release.yml workflow handled it end-to-end

### 2026-02-17: Release v0.7.2 — Cross-Platform EOL + Dual Folder Support

**Release process executed:**
- Deleted 6 stale remote branches: `squad/bugfix-sensei-team-detection`, `copilot/add-sample-orchestration-logs`, `squad/23-v020-service-tests`, `squad/24-init-command`, `squad/47-decision-markdown-preview`, `squad/51-fix-add-member-agent-mode`
- Kept 2 active branches: `squad/charter-preview-mode`, `squad/fix-decision-scroll-to-heading`
- Bumped version: `0.7.1` → `0.7.2` in `package.json`
- Updated `CHANGELOG.md`: Added v0.7.2 section with cross-platform EOL fix and dual folder structure support
- Committed: `chore: release v0.7.2` (commit 9ea8a70)
- Tagged: `git tag v0.7.2` and pushed to origin
- Release workflow expected to trigger automatically via tag push (`v*` pattern)

**Branch cleanup conventions established:**
- Use `git push origin --delete` for batch remote branch deletion
- Keep branches that have open/unmerged PRs or no PR yet
- Delete branches whose PRs are merged or closed
- Verify with `git ls-remote --tags` after pushing tags
