---
name: jade:orchestrate
description: Central orchestrator - scan all projects, prioritize tasks, display ranked list, dispatch workers
argument-hint: '[list | dispatch <id> | status | milestones]'
allowed-tools: [Read, Write, Bash, Glob, Grep, Teammate]
---

# Orchestrator

Central command for the jadecli ecosystem. Scans tasks across all 8 projects, computes priority scores, and displays a ranked task list.

## Usage

```bash
/jade:orchestrate <command>
```

## Subcommands

| Command         | Description                                                       |
| --------------- | ----------------------------------------------------------------- |
| `list`          | (Default) Scan all projects, compute scores, display ranked table |
| `status`        | Show tasks currently in_progress across all projects              |
| `milestones`    | Show per-project milestone progress (completed/total)             |
| `dispatch <id>` | (Phase 2) Select a task and dispatch a swarm worker               |

## Examples

### List Ranked Tasks

```bash
/jade:orchestrate list
```

Runs the full pipeline: scanner -> scorer -> presenter.

```bash
node -e "const {scanTasks}=require('./lib/scanner');const {scoreTasks}=require('./lib/scorer');const {presentTasks}=require('./lib/presenter');presentTasks(scoreTasks(scanTasks()));"
```

### Show In-Progress Tasks

```bash
/jade:orchestrate status
```

Filters to tasks with `status: "in_progress"` and displays them grouped by project.

### Show Milestone Progress

```bash
/jade:orchestrate milestones
```

Displays per-project progress: completed tasks / total tasks for each milestone.

### Dispatch a Worker (Phase 2)

```bash
/jade:orchestrate dispatch jade-cli/fix-node-build
```

Constructs a worker prompt and dispatches it into the target project directory. Requires `lib/dispatcher.js` (not yet implemented).

## Dependencies

- `lib/scanner.js` -- reads ~/.jade/projects.json and merges tasks from all projects
- `lib/scorer.js` -- computes weighted priority scores (0-100) per task
- `lib/presenter.js` -- renders ranked task table to terminal

## Configuration

The orchestrator reads its project registry from `~/.jade/projects.json`. Each project's tasks live in `{project_path}/.claude/tasks/tasks.json`.

## Related Commands

- `/jade:plan` -- Plan before implementing a dispatched task
- `/jade:review` -- Review work produced by a dispatched worker
- `/jade:fix` -- Fix issues found during orchestration
