# Decision: CI Pipeline Configuration

**Author:** Livingston (DevOps/CI)
**Date:** 2025-01
**Issue:** #22

## Decision

The CI pipeline uses Node.js 18.x with the following stages:
1. `npm ci` — clean install dependencies
2. `npm run lint` — ESLint with TypeScript
3. `npm run compile` — TypeScript compilation
4. `npm test` — VS Code extension tests

## Rationale

- Node 18 is stable LTS and widely supported
- `npm ci` ensures reproducible builds from lockfile
- Pipeline fails fast on lint errors before spending time on compilation
- Test artifacts uploaded for debugging failed runs

## Location

`.github/workflows/ci.yml`
