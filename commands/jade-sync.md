---
name: jade:sync
description: Sync GitHub Projects to local tasks.json files
argument-hint: "[pull | push | status] [--project <name>]"
allowed-tools: [Read, Write, Bash, Glob, Grep]
---

# GitHub Projects Sync

Synchronize tasks between local `.claude/tasks/tasks.json` files and GitHub Projects. Supports bidirectional sync to keep tasks in sync across local development and GitHub project boards.

## Usage

```bash
/jade:sync [command] [options]
```

## Commands

| Command | Description |
|---------|-------------|
| `pull` | Pull tasks from GitHub Projects to local tasks.json |
| `push` | Push local tasks.json changes to GitHub Projects |
| `status` | Show sync status without making changes |

## Options

| Option | Description |
|--------|-------------|
| `--project <name>` | Sync specific project only |
| `--dry-run` | Show what would change without applying |
| `--force` | Override conflicts (use with caution) |

## Examples

### Check Sync Status

```bash
/jade:sync status
```

Output:
```
=== GitHub Sync Status ===

jade-cli:
  Local: 8 tasks
  GitHub: 10 tasks
  Status: 2 tasks behind

jade-index:
  Local: 5 tasks
  GitHub: 5 tasks
  Status: In sync

claude-objects:
  Local: 12 tasks
  GitHub: 11 tasks
  Status: 1 task ahead (unpushed)

Overall: 2 projects need sync
```

### Pull from GitHub

```bash
/jade:sync pull
```

Downloads tasks from GitHub Projects and updates local tasks.json:

```
Pulling from GitHub Projects...

jade-cli:
  + Added: implement-auto-complete (#42)
  + Added: fix-stdin-handling (#43)
  = Updated: add-task-create (status: pending -> in_progress)

jade-dev-assist:
  = Updated: implement-scanner (status: in_progress -> completed)

Sync complete: 3 tasks added, 2 updated
```

### Push to GitHub

```bash
/jade:sync push
```

Creates/updates GitHub issues from local tasks:

```
Pushing to GitHub Projects...

jade-cli:
  + Created: add-cli-colors -> Issue #44
  = Updated: fix-node-build -> Issue #38

jade-index:
  No changes

Sync complete: 1 issue created, 1 updated
```

### Sync Specific Project

```bash
/jade:sync pull --project jade-cli
```

Only syncs the specified project.

### Dry Run

```bash
/jade:sync push --dry-run
```

Shows what would be pushed without making changes.

## Task Mapping

Tasks are mapped between local and GitHub using these fields:

| Local Field | GitHub Field |
|-------------|--------------|
| `id` | Issue number (via `github_issue` field) |
| `title` | Issue title |
| `description` | Issue body |
| `status` | Project board column |
| `labels` | Issue labels |
| `milestone` | Project milestone |
| `blocked_by` | Linked issues |

### Status Mapping

| Local Status | GitHub Column |
|--------------|---------------|
| `pending` | Todo |
| `in_progress` | In Progress |
| `completed` | Done |
| `blocked` | Blocked |

## Integration

This command uses `lib/github-sync.js`:

```javascript
const { syncFromGitHub, syncToGitHub, getSyncStatus } = require('../lib/github-sync');

// Check status
const status = await getSyncStatus();
console.log(status);

// Pull from GitHub
await syncFromGitHub({ project: 'jade-cli' });

// Push to GitHub
await syncToGitHub({ dryRun: true });
```

## GitHub Configuration

Requires GitHub CLI (`gh`) to be authenticated:

```bash
gh auth login
```

Projects are configured in `~/.jade/projects.json`:

```json
{
  "projects": [
    {
      "name": "jade-cli",
      "path": "jade-cli",
      "github_repo": "jadecli/jade-cli",
      "github_project": 7
    }
  ]
}
```

## Conflict Resolution

When the same task has been modified both locally and on GitHub:

1. **Pull**: GitHub version wins (local changes overwritten)
2. **Push**: Local version wins (GitHub changes overwritten)
3. **Use `--dry-run`**: See conflicts before applying

For safe resolution:
```bash
# Check for conflicts first
/jade:sync status

# Review what would change
/jade:sync pull --dry-run

# Apply if looks correct
/jade:sync pull
```

## Automation

Run sync automatically with hooks:

```json
{
  "hooks": {
    "post-checkout": {
      "run": ["jade:sync pull"]
    },
    "pre-push": {
      "run": ["jade:sync push"]
    }
  }
}
```

## Configuration

```json
{
  "sync": {
    "autoSync": false,
    "syncOnCheckout": true,
    "defaultDirection": "pull",
    "conflictResolution": "ask"
  }
}
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Auth failed | Run `gh auth login` |
| Project not found | Check `github_project` ID in projects.json |
| Sync conflicts | Use `--dry-run` to preview changes |
| Rate limited | Wait or use `--project` for single project |

## Related Commands

- `/jade:tasks` - View local task list
- `/jade:status github` - Quick GitHub status check
- `/jade:orchestrate` - Task orchestration
