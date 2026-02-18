# Dashboard Hardening — 2026-02-18

**Requested by:** Jeffrey T. Fritz

## Team Participants

- **Danny** — Reviewed dashboard loading and decisions panel architecture
- **Linus** — Investigated the data pipeline for decisions content loading  
- **Basher** — Wrote 9 new edge case tests for DecisionService and tree provider

## Fixes Implemented

1. **Panel null-guard after awaits** — SquadDashboardWebview.updateContent() now re-checks `this.panel` before setting HTML
2. **Try/catch in DecisionsTreeProvider** — Graceful error handling for tree provider operations
3. **Try/catch around readdirSync** — DecisionService no longer crashes on missing directories (TOCTOU race)
4. **UTC date fix in DecisionService** — Consistent timestamp handling

## Test Results

- **959 tests passing** (was 950)
- 9 new edge case tests added

## Commit

- Commit: `bc80644`
- Pushed to: `main`
