---
name: jade:tasks
description: List tasks with filtering - by status, project, milestone, or blocked state
argument-hint: "[--blocked | --project <name> | --milestone <name> | --status <status>]"
allowed-tools: [Read, Bash, Glob, Grep]
---

# Task Listing

Display and filter tasks across the jadecli ecosystem. Reads from local `.claude/tasks/tasks.json` files.

## Usage

```bash
/jade:tasks [options]
```

## Options

| Flag | Description |
|------|-------------|
| (none) | Show all tasks grouped by project |
| `--blocked` | Show only blocked tasks |
| `--project <name>` | Filter by project name or alias |
| `--milestone <name>` | Filter by milestone |
| `--status <status>` | Filter by status (pending, in_progress, completed) |
| `--mine` | Show tasks assigned to current user |
| `--priority` | Sort by priority score (highest first) |
| `--json` | Output as JSON |
| `--count` | Show counts only, no details |

## Examples

### All Tasks

```bash
/jade:tasks
```

Reads tasks from all projects:

```bash
for project in $(jq -r '.projects[].name' ~/.jade/projects.json); do
  task_file=~/projects/$project/.claude/tasks/tasks.json
  if [ -f "$task_file" ]; then
    echo "=== $project ==="
    jq -r '.tasks[] | "[\(.status)] \(.id): \(.title)"' "$task_file"
  fi
done
```

### Blocked Tasks Only

```bash
/jade:tasks --blocked
```

Shows tasks with `blocked_by` populated or `status: "blocked"`:

```bash
for project in $(jq -r '.projects[].name' ~/.jade/projects.json); do
  task_file=~/projects/$project/.claude/tasks/tasks.json
  if [ -f "$task_file" ]; then
    jq -r '.tasks[] | select(.blocked_by != null and (.blocked_by | length) > 0) | "[\(.id)] \(.title) (blocked by: \(.blocked_by | join(", ")))"' "$task_file"
  fi
done
```

### Filter by Project

```bash
/jade:tasks --project jade-cli
```

Or using alias:
```bash
/jade:tasks --project cli
```

```bash
jq -r '.tasks[] | "[\(.status)] \(.id): \(.title)"' ~/projects/jade-cli/.claude/tasks/tasks.json
```

### Filter by Milestone

```bash
/jade:tasks --milestone "Orchestrator MVP"
```

```bash
for project in $(jq -r '.projects[].name' ~/.jade/projects.json); do
  task_file=~/projects/$project/.claude/tasks/tasks.json
  if [ -f "$task_file" ]; then
    jq -r '.tasks[] | select(.milestone == "Orchestrator MVP") | "[\(.status)] \(.id): \(.title)"' "$task_file"
  fi
done
```

### Filter by Status

```bash
/jade:tasks --status pending
/jade:tasks --status in_progress
/jade:tasks --status completed
```

### Priority Sorted

```bash
/jade:tasks --priority
```

Uses the scorer to compute priority and sorts descending:

```bash
node -e "
const {scanTasks} = require('~/projects/jade-dev-assist/lib/scanner');
const {scoreTasks} = require('~/projects/jade-dev-assist/lib/scorer');
const tasks = scoreTasks(scanTasks());
tasks.sort((a, b) => b.score - a.score);
tasks.forEach(t => console.log(\`[\${t.score.toFixed(1)}] \${t.project}/\${t.id}: \${t.title}\`));
"
```

### Task Counts

```bash
/jade:tasks --count
```

Output:
```
Task Counts
===========
jade-index:      3 pending, 0 in_progress, 8 completed
jade-cli:        2 pending, 1 in_progress, 5 completed
jade-dev-assist: 1 pending, 0 in_progress, 6 completed
---
Total:           6 pending, 1 in_progress, 19 completed
```

## Output Format

### Default (Grouped by Project)

```
Tasks
=====

jade-index (3 pending, 0 in_progress)
  [pending]     implement-batch-api: Implement batch embedding API
  [pending]     add-redis-cache: Add Redis caching layer
  [pending]     gpu-memory-opt: Optimize GPU memory usage

jade-cli (2 pending, 1 in_progress)
  [in_progress] fix-node-build: Fix Node 22 build issues
  [pending]     add-telemetry: Add usage telemetry
  [pending]     improve-ux: Improve command output formatting

jade-dev-assist (1 pending)
  [pending]     implement-dispatcher: Implement worker dispatcher
```

### JSON Output

```bash
/jade:tasks --json
```

```json
{
  "projects": {
    "jade-index": {
      "pending": 3,
      "in_progress": 0,
      "completed": 8,
      "tasks": [...]
    }
  },
  "totals": {
    "pending": 6,
    "in_progress": 1,
    "completed": 19
  }
}
```

## Task File Format

Each project's `.claude/tasks/tasks.json`:
```json
{
  "tasks": [
    {
      "id": "implement-scanner",
      "title": "Implement lib/scanner.js",
      "description": "Read and merge tasks from all projects",
      "status": "completed",
      "milestone": "Orchestrator MVP",
      "priority": "high",
      "blocked_by": [],
      "created": "2026-01-15",
      "completed": "2026-01-20"
    }
  ]
}
```

## Related Commands

- `/jade:orchestrate` - Prioritize and dispatch tasks
- `/jade:sync` - Sync with GitHub Projects
- `/jade:status` - Show ecosystem health
