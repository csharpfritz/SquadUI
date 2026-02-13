### 2026-02-13: GitHub Issues Service Architecture

**By:** Linus
**What:** GitHubIssuesService uses Node's built-in `https` module with optional auth token, 5-minute cache TTL, and `squad:{member}` label convention for issue-to-member mapping.
**Why:** Using `https` avoids polyfill complexity for fetch in a CommonJS VS Code extension. Optional auth lets the service work immediately without setup while supporting authenticated flows later. The `squad:` label prefix is a simple, human-readable convention that works with GitHub's existing label system.
