---
name: jade:pin
description: Pin files or sections to session context for persistent reference
argument-hint: "[add | remove | list | clear] <file-or-pattern>"
allowed-tools: [Read, Write, Bash, Glob, Grep]
---

# Context Pinning

Pin files or specific sections to keep them in Claude's context throughout the session. Pinned content is automatically included in prompts, ensuring important context is never lost during long conversations.

## Usage

```bash
/jade:pin [command] [target]
```

## Commands

| Command | Description |
|---------|-------------|
| `add` | Pin a file or section to context |
| `remove` | Unpin a file or section |
| `list` | Show all pinned content |
| `clear` | Remove all pins |

## Examples

### Pin a File

```bash
/jade:pin add lib/scanner.js
```

Output:
```
Pinned: lib/scanner.js (304 lines, 8.8KB)

Current pins:
  1. lib/scanner.js (8.8KB)

Context budget: 8.8KB / 50KB (17.6%)
```

### Pin Multiple Files

```bash
/jade:pin add "lib/*.js"
```

Pins all JavaScript files in lib/:

```
Pinned 4 files:
  lib/scanner.js (8.8KB)
  lib/scorer.js (8.7KB)
  lib/presenter.js (6.3KB)
  lib/dispatcher.js (12KB)

Context budget: 35.8KB / 50KB (71.6%)
```

### Pin a Section

```bash
/jade:pin add CLAUDE.md#conventions
```

Pins only the "Conventions" section from CLAUDE.md:

```
Pinned: CLAUDE.md (section: Conventions)
  Lines 40-52 (425 bytes)

Context budget: 0.4KB / 50KB (0.8%)
```

### Pin with Label

```bash
/jade:pin add lib/scanner.js --label "Task Scanner Module"
```

Adds a descriptive label for the pin.

### List Pinned Content

```bash
/jade:pin list
```

Output:
```
=== Pinned Context ===

1. lib/scanner.js (8.8KB)
   Label: Task Scanner Module
   Pinned: 5 minutes ago

2. CLAUDE.md#conventions (425B)
   Label: Project Conventions
   Pinned: 2 minutes ago

3. tests/fixtures/jade-cli-tasks.json (1.8KB)
   Pinned: 1 minute ago

Total: 11.0KB / 50KB (22%)
Budget remaining: 39KB
```

### Remove a Pin

```bash
/jade:pin remove lib/scanner.js
```

Or by number:

```bash
/jade:pin remove 1
```

### Clear All Pins

```bash
/jade:pin clear
```

Output:
```
Cleared 3 pins (11.0KB freed)
```

## Pin Patterns

### File Patterns (Glob)

```bash
/jade:pin add "src/**/*.ts"      # All TypeScript files in src
/jade:pin add "*.md"             # All markdown in current dir
/jade:pin add "tests/test-*.js"  # All test files
```

### Section Patterns

Use `#` to pin specific sections:

```bash
/jade:pin add CLAUDE.md#conventions     # Section by heading
/jade:pin add lib/scanner.js:10-50      # Lines 10-50
/jade:pin add lib/scanner.js:scanTasks  # Function by name
```

### Smart Pinning

```bash
/jade:pin add --smart lib/scanner.js
```

Automatically extracts and pins:
- Module exports
- JSDoc comments
- Function signatures

Without the full implementation details.

## Context Budget

Pinned content counts against your context budget:

| Budget Size | Description |
|-------------|-------------|
| 50KB | Default pin budget |
| 100KB | Extended (use sparingly) |

When budget is exceeded:
```
Warning: Pin budget exceeded (52KB / 50KB)

Suggestions:
  - Remove: lib/dispatcher.js (12KB, least recently used)
  - Use section pin: lib/scanner.js:scanTasks instead of full file
```

## Auto-Pinning

Configure files to auto-pin when entering a project:

```json
{
  "pin": {
    "auto": [
      "CLAUDE.md",
      ".claude/tasks/tasks.json",
      "package.json#scripts"
    ],
    "budget": 50000
  }
}
```

## Integration

Pins are stored in session state and automatically included in prompts:

```javascript
// lib/context-pinner.js
const { getPinnedContent, addPin, removePin } = require('../lib/context-pinner');

// Add a pin
addPin({
  path: 'lib/scanner.js',
  label: 'Scanner Module',
  section: null, // full file
});

// Get all pinned content for prompt
const context = getPinnedContent();
```

## Persistence

Pins are session-scoped by default. For persistent pins:

```bash
/jade:pin add CLAUDE.md --persist
```

Persistent pins are saved to `.claude/pins.json` and restored on session start.

## Best Practices

### Do Pin

- `CLAUDE.md` - Project instructions
- Key interfaces and types
- Test fixtures for reference
- API documentation sections

### Don't Pin

- Large generated files
- Full test suites
- `node_modules` or vendor code
- Binary files

### Optimize Pins

```bash
# Instead of full file
/jade:pin add lib/scanner.js

# Pin just the interface
/jade:pin add lib/scanner.js --smart

# Or specific functions
/jade:pin add lib/scanner.js:scanTasks,loadRegistry
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Budget exceeded | Remove old pins or use sections |
| File not found | Check path is relative to project root |
| Section not found | Verify heading/line numbers exist |
| Pins lost | Use `--persist` for important pins |

## Related Commands

- `/jade:context-sync` - Sync context with project state
- `/jade:learn` - Add knowledge to context
- `/jade:config` - Configure auto-pins
