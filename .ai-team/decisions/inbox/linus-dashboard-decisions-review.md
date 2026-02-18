# Decision: Always pass squadFolder through tree providers and webviews

**Date:** 2026-02-18
**Author:** Linus
**By:** Linus (Backend Dev)

## Context

Deep investigation of the dashboard and decisions pipelines revealed four places where the configurable squad folder name (`.squad` vs `.ai-team`) was hardcoded to `.ai-team` instead of using the runtime-detected value. This caused silent failures for any workspace using `.squad`.

## Decision

All service constructors, tree providers, and webview classes that need to resolve paths under the squad folder MUST receive `squadFolder` as a parameter — never hardcode `.ai-team`. Added `getSquadFolder()` to `SquadDataProvider` so downstream consumers (like `SquadDashboardWebview`) can access it without constructor changes.

## Rationale

- The extension supports both `.squad` and `.ai-team` folder names via `detectSquadFolder()`
- Four bugs silently broke features for `.squad` users: agent folder discovery, log entry opening, decisions tree, and team tree log parsing
- A public getter on `SquadDataProvider` is the cleanest way to propagate the value without adding constructor parameters to every consumer
