### 2026-02-17: engines.vscode must match @types/vscode
**By:** Rusty
**What:** engines.vscode must always be >= @types/vscode version. VSCE enforces this at package time.
**Why:** Release v0.7.2 failed because engines.vscode was ^1.85.0 but @types/vscode was ^1.109.0. VSCE refuses to package when types exceed engine version.
