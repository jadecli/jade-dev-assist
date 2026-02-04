---
name: jade:tasks
description: Smart task list with filtering, sorting, and detailed views
argument-hint: "[list | show <id> | filter <query>] [--status <status>] [--project <name>]"
allowed-tools: [Read, Write, Bash, Glob, Grep]
---

# Smart Task List

View and filter tasks across the jadecli ecosystem with smart sorting, filtering, and detailed task views. Integrates with the orchestrator's scanner and scorer modules.

## Usage

```bash
/jade:tasks [command] [options]
```

## Commands

| Command | Description |
|---------|-------------|
| `list` | (Default) Show ranked task list |
| `show <id>` | Show detailed view of a specific task |
| `filter <query>` | Filter tasks by text search |
| `next` | Show the highest priority actionable task |

## Options

| Option | Description |
|--------|-------------|
| `--status <status>` | Filter by status (pending, in_progress, completed, blocked) |
| `--project <name>` | Filter by project name |
| `--complexity <level>` | Filter by complexity (S, M, L, XL) |
| `--milestone <name>` | Filter by milestone |
| `--limit <n>` | Limit results (default: 20) |
| `--all` | Show all tasks (no limit) |

## Examples

### List All Tasks (Ranked)

```bash
/jade:tasks
```

Output:
```
=== Task List (6 pending, 2 in progress) ===

  #  Score  Project       Task                            Status
  1   92.3  jade-cli      fix-node-build                  in_progress
  2   87.5  jade-cli      add-task-create                 pending
  3   84.2  jade-index    add-semantic-search             pending
  4   78.9  jade-dev-assist implement-status-updater      pending
  5   72.1  claude-objects add-mcp-server                 pending
  6   68.4  jade-ide      fix-extension-host              blocked

Showing 6 of 8 tasks. Use --all to see all.
```

### Show Task Details

```bash
/jade:tasks show jade-cli/fix-node-build
```

Output:
```
=== Task: jade-cli/fix-node-build ===

Title: Fix Node.js build configuration
Status: in_progress
Priority Score: 92.3

Project: jade-cli
  Status: near-buildable
  Language: TypeScript

Complexity: M
Milestone: Core Commands (2026-03-15)

Description:
  Node.js build failing due to ESM/CJS compatibility issues.
  Need to update tsconfig.json and package.json exports.

Blocked By: (none)
Unlocks:
  - jade-cli/add-task-create
  - jade-cli/implement-auto-complete

Relevant Files:
  - tsconfig.json
  - package.json
  - src/index.ts

GitHub Issue: #38
  https://github.com/jadecli/jade-cli/issues/38

Created: 2026-01-28
```

### Filter by Status

```bash
/jade:tasks --status pending
```

Shows only pending tasks.

```bash
/jade:tasks --status in_progress
```

Shows tasks currently being worked on.

### Filter by Project

```bash
/jade:tasks --project jade-cli
```

Output:
```
=== jade-cli Tasks (3 total) ===

  #  Score  Task                   Status        Complexity
  1   92.3  fix-node-build         in_progress   M
  2   87.5  add-task-create        pending       L
  3   65.2  implement-auto-complete pending      M
```

### Search Tasks

```bash
/jade:tasks filter "build"
```

Searches task titles and descriptions:

```
=== Search Results for "build" ===

1. jade-cli/fix-node-build (92.3)
   "Fix Node.js build configuration"

2. jade-ide/fix-extension-build (45.2)
   "Fix extension host build pipeline"
```

### Get Next Task

```bash
/jade:tasks next
```

Returns the highest priority actionable task (pending, not blocked):

```
=== Next Task ===

jade-cli/add-task-create (Score: 87.5)

This is your highest priority actionable task.

Title: Add task create command
Complexity: L (Large)
Unlocks: 2 downstream tasks

Ready to start? Run:
  /jade:orchestrate dispatch jade-cli/add-task-create
```

### Filter by Complexity

```bash
/jade:tasks --complexity S
```

Shows only small tasks (quick wins):

```
=== Small Tasks (Quick Wins) ===

1. jade-dev-assist/update-readme (Score: 45.2)
2. jadecli-infra/add-healthcheck (Score: 42.1)
3. jade-swarm/fix-typo (Score: 38.9)
```

### Filter by Milestone

```bash
/jade:tasks --milestone "Core Commands"
```

Shows tasks for the specified milestone.

## Priority Scoring

Tasks are ranked by the scorer module using these factors:

| Factor | Weight | Description |
|--------|--------|-------------|
| Unlocks | 30% | How many tasks does this unblock? |
| Project Status | 25% | Is the project near-buildable? |
| Complexity | 20% | Smaller tasks score higher |
| Age | 15% | Older pending tasks score higher |
| Milestone | 10% | Is the milestone deadline near? |

## Integration

Uses `lib/scanner.js` and `lib/scorer.js`:

```javascript
const { scanTasks } = require('../lib/scanner');
const { scoreTasks } = require('../lib/scorer');
const { presentTasks } = require('../lib/presenter');

// Get scored task list
const { tasks } = scanTasks();
const scored = scoreTasks(tasks);
presentTasks(scored, { limit: 20 });
```

## Task Status Flow

```
pending -> in_progress -> completed
              |
              v
           blocked
```

### Status Definitions

| Status | Description |
|--------|-------------|
| `pending` | Ready to work on |
| `in_progress` | Currently being worked on |
| `completed` | Done and verified |
| `blocked` | Waiting on dependencies |

## Configuration

```json
{
  "tasks": {
    "defaultLimit": 20,
    "showCompleted": false,
    "sortBy": "score",
    "groupBy": null
  }
}
```

## Output Formats

### Table (Default)

```bash
/jade:tasks --format table
```

### JSON

```bash
/jade:tasks --format json
```

Useful for piping to other tools.

### Markdown

```bash
/jade:tasks --format markdown
```

For copying to documentation.

## Related Commands

- `/jade:orchestrate` - Task orchestration and dispatch
- `/jade:sync` - Sync with GitHub Projects
- `/jade:status tasks` - Quick task summary
