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
- **Node version:** 18.x (stable LTS, matches typical VS Code extension dev)
- **Artifacts:** Test results uploaded with 30-day retention
- **Pattern:** Used `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4` for consistency with existing workflows
