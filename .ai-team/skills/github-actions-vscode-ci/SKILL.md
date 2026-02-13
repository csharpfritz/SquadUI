---
name: "github-actions-vscode-ci"
description: "CI pipeline patterns for VS Code extensions using GitHub Actions"
domain: "devops"
confidence: "low"
source: "earned"
---

## Context
VS Code extensions have unique CI requirements compared to standard Node.js projects. The test runner (`@vscode/test-electron`) launches a real VS Code instance, which needs a display server on Linux CI runners.

## Patterns

### xvfb-run for VS Code Extension Tests
VS Code extension tests using `@vscode/test-electron` require a virtual framebuffer on headless Linux CI. Wrap the test command with `xvfb-run -a` to provide a virtual X display:
```yaml
- name: Run tests
  run: xvfb-run -a npm test
```
The `-a` flag auto-selects a free display number, avoiding conflicts.

### Concurrency Control for PR Builds
Add a concurrency group keyed to `github.ref` so duplicate runs on the same branch cancel in-progress jobs:
```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```
This saves CI minutes when pushing multiple commits to a PR in quick succession.

### npm ci Over npm install
Always use `npm ci` in CI pipelines. It installs from `package-lock.json` exactly, is faster, and ensures reproducible builds. It also removes `node_modules` first, preventing stale dependency issues.

### Fail-Fast Pipeline Ordering
Order CI steps from fastest to slowest: lint → compile → test. Lint catches style issues in seconds; no point compiling if lint fails. Compilation catches type errors; no point running tests if types are broken.

## Anti-Patterns
- **Using `npm install` in CI** — non-deterministic; may resolve different versions than lockfile.
- **Running VS Code tests without xvfb** — will fail silently or crash on headless Linux.
- **`continue-on-error: true` on test steps** — hides real failures; use `if: always()` on artifact upload instead.
- **Missing concurrency control** — wastes CI minutes running duplicate builds on rapid pushes.

## Examples

```yaml
# Complete VS Code extension CI workflow
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run compile
      - name: Run tests
        run: xvfb-run -a npm test
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: out/test/
          if-no-files-found: ignore
          retention-days: 30
```
