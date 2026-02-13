# Orchestration Log Test Fixtures

Sample log files for development and testing of the SquadUI extension.

## Log Format

Orchestration logs are Markdown files stored in `.ai-team/log/` with the naming convention:

```
{YYYY-MM-DD}-{topic}.md
```

### Structure

Each log file follows this structure:

```markdown
# Session Log: {YYYY-MM-DD} — {topic}

## Metadata
- **Date:** {YYYY-MM-DD}
- **Topic:** {topic-slug}
- **Timestamp:** {ISO 8601 timestamp}

## Who Worked
- {Member name}
- {Member name}

## What Was Done
{Description of work accomplished}

## Decisions Made
- {Decision 1}
- {Decision 2}

## Key Outcomes
- {Outcome 1}
- {Outcome 2}

## Related Issues
- #{issue-number}
```

### Required Sections

| Section | Required | Description |
|---------|----------|-------------|
| Metadata | Yes | Date, topic, and timestamp |
| Who Worked | Yes | List of participating squad members |
| What Was Done | Yes | Summary of work (can be empty) |
| Decisions Made | No | Bullet list of decisions |
| Key Outcomes | No | Artifacts or results produced |
| Related Issues | No | GitHub issue references |

## Fixture Files

| File | Description | Use Case |
|------|-------------|----------|
| `2026-02-13-member-working.md` | Active session with Rusty working | Test "working" status display |
| `2026-02-13-member-idle.md` | Completed session (Danny is now idle) | Test "idle" status transition |
| `2026-02-12-multiple-tasks.md` | Session with multiple members and outcomes | Test multi-participant parsing |
| `2026-02-11-empty.md` | Log with all sections but no content | Test empty state handling |
| `2026-02-10-minimal.md` | Only required sections populated | Test minimal valid log parsing |

## TypeScript Interface

These logs map to `OrchestrationLogEntry` in `src/models/index.ts`:

```typescript
interface OrchestrationLogEntry {
    timestamp: string;      // from Metadata.Timestamp
    date: string;           // from Metadata.Date
    topic: string;          // from Metadata.Topic
    participants: string[]; // from Who Worked
    summary: string;        // from What Was Done
    decisions?: string[];   // from Decisions Made
    outcomes?: string[];    // from Key Outcomes
    relatedIssues?: string[]; // from Related Issues
}
```

## Usage

### In Tests (Basher)

```typescript
import * as fs from 'fs';
import * as path from 'path';

const fixturePath = path.join(__dirname, '../../test-fixtures/orchestration-logs');
const logContent = fs.readFileSync(
    path.join(fixturePath, '2026-02-13-member-working.md'),
    'utf-8'
);
```

### During Development

Copy fixtures to `.ai-team/log/` to simulate squad activity:

```powershell
Copy-Item test-fixtures\orchestration-logs\*.md .ai-team\log\
```
