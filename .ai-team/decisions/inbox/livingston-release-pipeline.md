# Decision: Release Pipeline

**Author:** Livingston (DevOps/CI)  
**Date:** 2025-07-19  
**Status:** Proposed

## Context

The project needs an automated release pipeline to package the SquadUI VS Code extension as a `.vsix`, create GitHub Releases with attached artifacts, and publish to the VS Code Marketplace — all triggered by pushing a version tag.

## Decision

Created `.github/workflows/release.yml` with the following design:

1. **Trigger:** Push of tags matching `v*` (e.g., `v0.1.0`, `v1.0.0`)
2. **Self-contained CI:** Duplicates lint → compile → test steps from `ci.yml` rather than calling the existing workflow, ensuring the release pipeline is independent and always runs the full gate
3. **Version verification:** Fails fast if the tag version (stripped `v` prefix) doesn't match `package.json` version — prevents accidental mismatches
4. **VSIX packaging:** Installs `@vscode/vsce` globally and runs `vsce package`
5. **GitHub Release:** Uses `softprops/action-gh-release@v2` with auto-generated release notes; marks versions < 1.0.0 as pre-release
6. **Marketplace publish:** Runs `vsce publish` using the `VSCE_PAT` repository secret; only runs if all prior steps succeed
7. **Permissions:** `contents: write` for creating releases

## Rationale

- Self-contained workflow avoids coupling to CI workflow changes and ensures release always has a full quality gate
- Tag-based trigger is the standard pattern for VS Code extension releases
- Pre-release flag for < 1.0.0 communicates stability expectations to users
- Version match check prevents shipping a VSIX with mismatched metadata

## Action Required

- Repository secret `VSCE_PAT` must be configured with a VS Code Marketplace Personal Access Token before the first release
- Publisher `csharpfritz` must be registered on the VS Code Marketplace

## Location

`.github/workflows/release.yml`
