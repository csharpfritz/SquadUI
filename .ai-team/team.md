# Team Roster

> VS Code extension for visualizing Squad team members and their tasks

## Coordinator

| Name | Role | Notes |
|------|------|-------|
| Squad | Coordinator | Routes work, enforces handoffs and reviewer gates. Does not generate domain artifacts. |

## Members

| Name | Role | Charter | Status |
|------|------|---------|--------|
| Danny | Lead | `.ai-team/agents/danny/charter.md` | ✅ Active |
| Rusty | Extension Dev | `.ai-team/agents/rusty/charter.md` | ✅ Active |
| Linus | Backend Dev | `.ai-team/agents/linus/charter.md` | ✅ Active |
| Basher | Tester | `.ai-team/agents/basher/charter.md` | ✅ Active |
| Livingston | DevOps / CI | `.ai-team/agents/livingston/charter.md` | ✅ Active |
| Virgil | VS Extension Dev (VS 2026) | `.ai-team/agents/virgil/charter.md` | ✅ Active |
| Turk | VS Extension Dev (VS 2026 UI) | `.ai-team/agents/turk/charter.md` | ✅ Active |
| Scribe | Session Logger | `.ai-team/agents/scribe/charter.md` | 📋 Silent |
| Ralph | Work Monitor | `.ai-team/agents/ralph/charter.md` | 🔄 Monitor |

## Coding Agent

<!-- copilot-auto-assign: false -->

| Name | Role | Charter | Status |
|------|------|---------|--------|
| @copilot | Coding Agent | — | 🤖 Coding Agent |

### Capabilities

**🟢 Good fit — auto-route when enabled:**
- Bug fixes with clear reproduction steps
- Test coverage (adding missing tests, fixing flaky tests)
- Lint/format fixes and code style cleanup
- Dependency updates and version bumps
- Small isolated features with clear specs
- Boilerplate/scaffolding generation
- Documentation fixes and README updates

**🟡 Needs review — route to @copilot but flag for squad member PR review:**
- Medium features with clear specs and acceptance criteria
- Refactoring with existing test coverage
- API endpoint additions following established patterns
- Migration scripts with well-defined schemas

**🔴 Not suitable — route to squad member instead:**
- Architecture decisions and system design
- Multi-system integration requiring coordination
- Ambiguous requirements needing clarification
- Security-critical changes (auth, encryption, access control)
- Performance-critical paths requiring benchmarking
- Changes requiring cross-team discussion

## Issue Source

| Field | Value |
|-------|-------|
| **Repository** | csharpfritz/SquadUI |
| **Connected** | 2026-02-13 |
| **Filters** | all open |

## Project Context

- **Owner:** Jeffrey T. Fritz (csharpfritz@users.noreply.github.com)
- **Stack:** TypeScript, VS Code Extension API, potentially GitHub Copilot integration
- **Description:** VS Code extension to visualize Squad team members and their tasks, potentially integrated with GitHub Copilot
- **Repository:** github.com/csharpfritz/SquadUI
- **Created:** 2026-02-13
