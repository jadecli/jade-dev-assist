---
name: jade:pin
description: Pin files or context to session - store in ~/.jade/pinned-context.json
argument-hint: "[add <path>] [remove <path>] [list] [clear]"
allowed-tools: [Read, Write, Bash, Glob]
---

# Pin Context

Pin important files or snippets to persist across Claude sessions. Pinned context is loaded automatically on session start.

## Usage

```bash
/jade:pin <command> [options]
```

## Commands

| Command | Description |
|---------|-------------|
| `add <path>` | Pin a file or directory to context |
| `remove <path>` | Unpin a file or directory |
| `list` | Show all pinned items |
| `clear` | Remove all pinned items |
| `show` | Display content of pinned items |
| `snippet <name>` | Pin a named text snippet |

## Examples

### Pin a File

```bash
/jade:pin add ~/projects/jade-dev-assist/CLAUDE.md
```

Adds to `~/.jade/pinned-context.json`:
```json
{
  "pins": [
    {
      "path": "~/projects/jade-dev-assist/CLAUDE.md",
      "type": "file",
      "added": "2026-02-04T14:30:00Z",
      "project": "jade-dev-assist"
    }
  ]
}
```

### Pin a Directory

```bash
/jade:pin add ~/projects/jade-dev-assist/lib/
```

Pins all files in the directory (non-recursive by default):
```bash
# Store in pinned-context.json
jq '.pins += [{"path": "~/projects/jade-dev-assist/lib/", "type": "directory", "added": "'$(date -Iseconds)'"}]' \
  ~/.jade/pinned-context.json > tmp && mv tmp ~/.jade/pinned-context.json
```

### Pin with Glob Pattern

```bash
/jade:pin add "~/projects/jade-dev-assist/lib/*.js"
```

### List Pinned Items

```bash
/jade:pin list
```

Output:
```
Pinned Context
==============

Files (3)
  1. ~/projects/jade-dev-assist/CLAUDE.md (2.2KB)
  2. ~/projects/jade-dev-assist/lib/scanner.js (1.8KB)
  3. ~/docs/plans/jade-dev-assist-orchestrator-design.md (45KB)

Snippets (1)
  1. "project-registry" (42 bytes)

Total: 4 items, ~49KB
```

### Show Pinned Content

```bash
/jade:pin show
```

Displays the actual content of all pinned items (useful for verification).

### Remove a Pin

```bash
/jade:pin remove ~/projects/jade-dev-assist/CLAUDE.md
```

```bash
jq 'del(.pins[] | select(.path == "~/projects/jade-dev-assist/CLAUDE.md"))' \
  ~/.jade/pinned-context.json > tmp && mv tmp ~/.jade/pinned-context.json
```

### Clear All Pins

```bash
/jade:pin clear
```

```bash
echo '{"pins": [], "snippets": []}' > ~/.jade/pinned-context.json
```

### Pin a Snippet

```bash
/jade:pin snippet project-registry
# Then paste or type the snippet content
```

Stores named text snippets:
```json
{
  "snippets": [
    {
      "name": "project-registry",
      "content": "Projects: jade-index, jade-cli, jade-dev-assist...",
      "added": "2026-02-04T14:30:00Z"
    }
  ]
}
```

## Storage Format

`~/.jade/pinned-context.json`:
```json
{
  "version": 1,
  "pins": [
    {
      "path": "~/projects/jade-dev-assist/CLAUDE.md",
      "type": "file",
      "added": "2026-02-04T14:30:00Z",
      "project": "jade-dev-assist",
      "description": "Project instructions"
    }
  ],
  "snippets": [
    {
      "name": "architecture-notes",
      "content": "Key decisions...",
      "added": "2026-02-04T14:35:00Z"
    }
  ]
}
```

## Auto-Load Behavior

Pinned context can be loaded in new sessions:

1. **Manual load**: `/jade:context` loads pinned items
2. **Shell hook**: `~/.jade/shell-hook.sh` can display reminder
3. **Session start**: jade-start can inject pinned context

## Size Limits

| Limit | Value |
|-------|-------|
| Max pins | 20 files |
| Max file size | 100KB per file |
| Max total size | 500KB |
| Max snippets | 10 |

## Related Commands

- `/jade:context` - Load ecosystem context
- `/jade:init` - Initialize project with pinned defaults
- `/jade:config` - Configure pin behavior
