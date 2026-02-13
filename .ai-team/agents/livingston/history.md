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
