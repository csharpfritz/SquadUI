# E2E Validation Test Strategy

**Author:** Basher (Tester)
**Date:** 2026-02-14
**Issue:** #14

## Decision

The E2E MVP validation tests (`src/test/suite/e2e-validation.test.ts`) use a **TestableWebviewRenderer** pattern to test webview HTML output without requiring a live `vscode.WebviewPanel`. This mirrors the approach already used in `webview.test.ts` and allows full HTML validation (table rendering, XSS escaping, bold text conversion) in the test electron host without opening actual webview panels.

The tests are organized by acceptance criterion (AC-1 through AC-6) to provide direct traceability between test results and the issue's acceptance criteria.

## Rationale

- Webview panels cannot be reliably created in the test electron host without a visible window
- The HTML generation logic is the critical code path; the panel lifecycle is VS Code boilerplate
- Organizing by AC makes it trivial to verify which criteria pass/fail in CI output
- Manual test plan (`docs/manual-test-plan.md`) covers the visual/interactive aspects that automated tests cannot reach

## Impact

All future acceptance testing should follow this pattern: automated tests for data flow and HTML generation, manual checklist for visual/interactive behavior. The manual test plan should be updated for each release milestone.
