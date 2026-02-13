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
