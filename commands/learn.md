---
name: jade:learn
description: Invest in your CLAUDE.md - after every correction, add rules so Claude doesn't repeat mistakes
argument-hint: "[<lesson> | --notes | --analyze | --optimize]"
allowed-tools: [Read, Write, Bash]
---

# CLAUDE.md Learning System

> "Invest in your CLAUDE.md. After every correction, end with: 'Update your CLAUDE.md so you don't make that mistake again.' Claude is eerily good at writing rules for itself." — Boris Cherny

## Usage

```bash
/jade:learn [options]
```

## Commands

| Command | Description |
|---------|-------------|
| `<lesson>` | Add a lesson learned to CLAUDE.md |
| `--notes` | Sync notes directory after PR |
| `--analyze` | Show CLAUDE.md token usage and stats |
| `--optimize` | Suggest optimizations for CLAUDE.md |
| `--history` | Show what Claude has learned over time |

## The Golden Rule

After every mistake Claude makes, say:

```
Update your CLAUDE.md so you don't make that mistake again.
```

Claude will write the rule itself — it's eerily good at this.

## Examples

### Learn from Mistake

```bash
/jade:learn "Always use async/await instead of .then() chains"
```

Appends to CLAUDE.md:
```markdown
## Lessons Learned

### Code Style
- Always use async/await instead of .then() chains
```

### Let Claude Write the Rule

After Claude makes a mistake:

```
You forgot to add error handling. Update your CLAUDE.md so you don't make that mistake again.
```

Claude responds:
```
I'll add this to CLAUDE.md:

## Error Handling Rules
- Always wrap async operations in try/catch
- Always provide meaningful error messages
- Never silently swallow errors
```

### Analyze CLAUDE.md

```bash
/jade:learn --analyze
```

Output:
```
📊 CLAUDE.md Analysis

Memory files · /memory
├─ ~/.claude/CLAUDE.md: 76 tokens
└─ CLAUDE.md: 4k tokens

📈 Statistics
   Total rules: 47
   Categories: 8
   Last updated: 2 hours ago
   
🏷️ Categories
   Code Style: 12 rules
   Error Handling: 8 rules
   Testing: 7 rules
   Architecture: 6 rules
   Git: 5 rules
   Performance: 4 rules
   Documentation: 3 rules
   Security: 2 rules

💡 Tip: Keep iterating until Claude's mistake rate drops
```

### Sync Notes Directory

```bash
/jade:learn --notes
```

> One engineer maintains a /notes directory for every task/project, updated after every PR. CLAUDE.md points to it.

```
📝 Notes Sync

Scanning /notes directory...

Found:
   /notes/auth-refactor.md (updated today)
   /notes/api-v2-migration.md (updated yesterday)
   /notes/performance-fixes.md (updated 3 days ago)

Updating CLAUDE.md reference:
   Added: "See /notes for project-specific context"

✅ Notes synced
```

## Notes Directory Pattern

### Setup

```markdown
# In CLAUDE.md

## Project Notes
For detailed context on specific tasks, see the `/notes` directory:
- Each task/project has its own notes file
- Updated after every PR
- Contains lessons, decisions, and context
```

### Directory Structure

```
/notes/
├── auth-implementation.md
├── api-v2-design.md
├── database-migration.md
└── performance-optimization.md
```

### Auto-Update After PR

```bash
# Add to git hooks or CI
/jade:learn --notes
```

## Best Practices

### 1. Ruthlessly Edit Over Time

Don't just add — also remove and refine:
- Remove outdated rules
- Consolidate similar rules
- Make rules more specific

### 2. Track Mistake Rate

Keep iterating until Claude's mistake rate measurably drops.

```bash
/jade:learn --history
```

Shows:
- When rules were added
- Which mistakes triggered them
- Whether mistakes recurred

### 3. Categorize Rules

Group related rules:
```markdown
## Code Style
- Use async/await
- Prefer named exports

## Testing  
- Write tests first
- Mock external services
```

### 4. Be Specific

❌ Vague: "Write good code"
✅ Specific: "Always add JSDoc comments to exported functions"

## Memory File Strategy

Boris Cherny's setup:
```
Memory files · /memory
├─ ~/.claude/CLAUDE.md: 76 tokens   # Global, minimal
└─ CLAUDE.md: 4k tokens             # Project-specific, detailed
```

### Global (~/.claude/CLAUDE.md)
Keep lightweight (< 100 tokens):
- Universal preferences
- Language choices
- Communication style

### Project (CLAUDE.md)
Be detailed (1-5k tokens):
- Project-specific rules
- Tech stack context
- Past mistakes
- Notes directory reference

## CLAUDE.md Template

```markdown
# Project: [Name]

## Context
[Brief project description]

## Tech Stack
- [Language/Framework]
- [Database]
- [Key tools]

## Code Style Rules
- [Rule 1]
- [Rule 2]

## Lessons Learned
<!-- Added automatically by /jade:learn -->

## Notes
See /notes directory for detailed task context.
```

## Configuration

```json
{
  "learn": {
    "autoPrompt": true,
    "notesDirectory": "/notes",
    "syncOnPR": true,
    "maxTokens": 5000,
    "categories": [
      "Code Style",
      "Error Handling", 
      "Testing",
      "Architecture",
      "Git",
      "Performance",
      "Documentation",
      "Security"
    ]
  }
}
```

## Related Commands

- `/jade:plan` - Uses CLAUDE.md context for planning
- `/jade:techdebt` - May suggest CLAUDE.md updates
- `/jade:review` - Checks against CLAUDE.md rules
