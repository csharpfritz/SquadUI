---
name: "YAML Frontmatter Parsing"
description: "Lightweight YAML frontmatter extraction from markdown files without external dependencies"
domain: "parsing"
confidence: "low"
source: "earned"
---

## Context
Markdown files often use YAML frontmatter (delimited by `---` lines) for metadata. Full YAML parsers like `js-yaml` are overkill when you only need simple `key: value` or `key: "value"` pairs. This pattern extracts frontmatter fields with zero dependencies.

## Patterns

### Detect and Extract Frontmatter Block
Check if line 0 is `---`, then find the closing `---`. Lines between are frontmatter; everything after is body content.

```typescript
const lines = content.split('\n');
let bodyStartIndex = 0;
const metadata: Record<string, string> = {};

if (lines[0]?.trim() === '---') {
    const closingIndex = lines.indexOf('---', 1);
    if (closingIndex > 0) {
        bodyStartIndex = closingIndex + 1;
        for (let i = 1; i < closingIndex; i++) {
            const match = /^(\w+):\s*"?([^"]*)"?\s*$/.exec(lines[i]);
            if (match) {
                metadata[match[1].toLowerCase()] = match[2].trim();
            }
        }
    }
}
```

### Fall Back Gracefully
Always provide a fallback for files without frontmatter. Check headings or use filename as the default:

```typescript
let name = metadata.name || dirName;
if (name === dirName) {
    const headingMatch = /^#\s+(.+)/.exec(lines[bodyStartIndex] ?? '');
    if (headingMatch) { name = headingMatch[1].trim(); }
}
```

### Body Content Starts After Frontmatter
When extracting description or body text, start scanning from `bodyStartIndex` (after the closing `---`), not from line 0 or line 1.

## Anti-Patterns
- **Parsing from line 1 when frontmatter exists** — will read YAML keys as body text.
- **Using full YAML parser for simple key-value frontmatter** — unnecessary dependency; `js-yaml` is 50KB+ and handles features you don't need.
- **Assuming frontmatter always exists** — always code the no-frontmatter path first, then add frontmatter as an enhancement.
- **Modifying the raw `content` to strip frontmatter** — keep the original content intact; use `bodyStartIndex` for display-layer parsing only.

## Limitations
- Only handles flat `key: value` and `key: "value"` pairs — no nested YAML, arrays, or multiline values.
- Does not validate YAML syntax — malformed lines are silently skipped.
- The closing `---` must be an exact match on its own line.
