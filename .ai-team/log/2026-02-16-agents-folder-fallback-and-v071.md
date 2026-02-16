# Session: 2026-02-16 - Agents Folder Fallback and v0.7.1

**Requested by:** Jeffrey T. Fritz

## Participants & Work

- **Linus** — Added agents folder scanning fallback to SquadDataProvider. Detection chain now: team.md → agents folder → log participants. Scans `.ai-team/agents/` subdirectories, reads `charter.md` to extract role, skips `_alumni` and `scribe` folders.
- **Basher** — Wrote 9 tests for the new detection path.
- **Livingston** — Shipped patch release v0.7.1: tag created, GitHub release published, Marketplace updated.

## Outcomes

- CI workflows green.
- Release workflows green.
- v0.7.1 live on Marketplace.
