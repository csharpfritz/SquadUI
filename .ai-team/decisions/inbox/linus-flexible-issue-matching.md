### 2026-02-14: Default issue matching uses labels + assignees

**By:** Linus
**What:** When no `Matching` config is present in team.md's Issue Source section, `GitHubIssuesService` defaults to `['labels', 'assignees']` strategies rather than labels-only.
**Why:** Most repositories won't have `squad:{member}` labels set up. Adding assignee matching as a default fallback means issues show up for squad members as soon as `Member Aliases` maps their names to GitHub usernames — no custom label setup required. The `any-label` strategy is opt-in only because it can produce false-positive matches (e.g., a label named "enhancement" matching a hypothetical member named Enhancement).

### 2026-02-14: Member Aliases live in team.md under Issue Source

**By:** Linus
**What:** The `Member Aliases` table (mapping squad member names → GitHub usernames) is parsed as a `### Member Aliases` subsection within team.md, near the Issue Source section.
**Why:** Keeps all issue-related configuration co-located. The aliases are needed by the issue matching service, not by the general team roster, so placing them near the Issue Source section makes semantic sense. They're also parseable by `TeamMdService` without adding a separate config file.
