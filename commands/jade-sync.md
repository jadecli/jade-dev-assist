---
name: jade:sync
description: Sync tasks between GitHub Projects and local tasks.json files
argument-hint: "[--pull | --push | --status] [--project <name>]"
allowed-tools: [Read, Write, Bash]
---

# GitHub Projects Sync

Synchronizes tasks between GitHub Projects (source of truth for roadmap) and local `.claude/tasks/tasks.json` files (source of truth for Claude agents).

## Usage

```bash
/jade:sync [options]
```

## Options

| Flag | Description |
|------|-------------|
| `--pull` | Pull tasks from GitHub Projects to local tasks.json |
| `--push` | Push local task status updates to GitHub Projects |
| `--status` | (Default) Show sync status without making changes |
| `--project <name>` | Sync specific project only |
| `--dry-run` | Show what would change without applying |
| `--force` | Overwrite local changes (use with --pull) |

## Sync Direction

| Source | Target | Command |
|--------|--------|---------|
| GitHub Projects | tasks.json | `--pull` |
| tasks.json | GitHub Projects | `--push` |

## Examples

### Check Sync Status

```bash
/jade:sync --status
```

Compares GitHub Projects with local tasks:

```bash
# Get project items from GitHub
gh api graphql -f query='
  query {
    organization(login: "jadecli") {
      projectV2(number: 11) {
        items(first: 100) {
          nodes {
            id
            content {
              ... on Issue {
                title
                number
                state
              }
            }
            fieldValues(first: 10) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field { ... on ProjectV2SingleSelectField { name } }
                }
              }
            }
          }
        }
      }
    }
  }
' --jq '.data.organization.projectV2.items.nodes'
```

### Pull from GitHub

```bash
/jade:sync --pull
```

Updates local tasks.json from GitHub Projects:
1. Fetches all items from the project board
2. Maps GitHub status to local status (Todo->pending, In Progress->in_progress, Done->completed)
3. Adds new tasks, updates existing tasks
4. Does NOT delete local tasks not in GitHub

### Push to GitHub

```bash
/jade:sync --push
```

Updates GitHub Projects from local tasks.json:
1. Reads local tasks.json
2. Finds matching GitHub issues by title/ID
3. Updates status field on the project board
4. Creates new issues for tasks without GitHub links

### Sync Single Project

```bash
/jade:sync --pull --project jade-cli
```

Only syncs tasks for jade-cli (project_number: 12).

### Dry Run

```bash
/jade:sync --push --dry-run
```

Shows what would change:
```
Would update GitHub:
  jade-cli #42: Todo -> In Progress
  jade-dev-assist #18: In Progress -> Done

Would create issues:
  jade-index: "Implement batch embedding API"
```

## Status Mapping

| GitHub Projects | tasks.json |
|-----------------|------------|
| Todo | pending |
| In Progress | in_progress |
| Done | completed |
| Blocked | blocked |

## Output Format

```
GitHub Projects Sync
====================

jade-dev-assist (project #11)
  Local: 6 tasks (2 pending, 1 in_progress, 3 completed)
  GitHub: 8 items (3 Todo, 2 In Progress, 3 Done)
  Diff: +2 new items in GitHub

jade-cli (project #12)
  Local: 4 tasks (1 pending, 1 in_progress, 2 completed)
  GitHub: 4 items (1 Todo, 1 In Progress, 2 Done)
  Status: In sync

Summary: 2 projects checked, 1 needs sync
```

## Configuration

Project numbers are stored in `~/.jade/projects.json`:
```json
{
  "projects": [
    {"name": "jade-dev-assist", "project_number": 11},
    {"name": "jade-cli", "project_number": 12}
  ],
  "github_org": "jadecli",
  "ecosystem_project": 4
}
```

## Related Commands

- `/jade:tasks` - View and filter local tasks
- `/jade:status` - Check GitHub rate limits
- `/jade:orchestrate` - Prioritize tasks for dispatch
