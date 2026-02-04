---
name: jade:branches
description: Branch clone viewer - visualize parallel development branches
argument-hint: "[list | show <branch> | compare <branch1> <branch2>]"
allowed-tools: [Read, Bash, Glob, Grep]
---

# Branch Clone Viewer

Visualize and manage parallel development branches across the jadecli ecosystem. View branch relationships, compare changes, and coordinate multi-branch development workflows.

## Usage

```bash
/jade:branches [command] [options]
```

## Commands

| Command | Description |
|---------|-------------|
| `list` | (Default) List all branches with status |
| `show <branch>` | Show detailed branch information |
| `compare <b1> <b2>` | Compare two branches |
| `graph` | Show branch graph visualization |

## Examples

### List All Branches

```bash
/jade:branches
```

Output:
```
=== Branches ===

Current: feat/add-8-slash-commands

  Branch                        Ahead  Behind  Last Commit
* feat/add-8-slash-commands       3       0    2 hours ago
  feat/refactor-task-utils        5       2    1 day ago
  main                            0       0    3 days ago
  develop                         0       5    1 week ago

Remote branches:
  origin/main
  origin/develop
  origin/feat/github-sync
```

### Show Branch Details

```bash
/jade:branches show feat/add-8-slash-commands
```

Output:
```
=== Branch: feat/add-8-slash-commands ===

Status: Active (current)
Base: main
Created: 2026-02-04 10:30:00

Commits (3):
  abc1234 feat: add health-checker module with tests
  def5678 feat: add quality-gate module with tests
  ghi9012 feat: add 8 new slash command definitions

Files Changed: 12
  + commands/jade-status.md (new)
  + commands/jade-scan.md (new)
  + commands/jade-sync.md (new)
  + commands/jade-metrics.md (new)
  + commands/jade-pin.md (new)
  + commands/jade-tasks.md (new)
  + commands/jade-branches.md (new)
  + commands/jade-validate.md (new)
  + lib/health-checker.js (new)
  + lib/quality-gate.js (new)
  + tests/test-health-checker.js (new)
  + tests/test-quality-gate.js (new)

Insertions: 2,450
Deletions: 0

Ready to merge: Yes (no conflicts with main)
```

### Compare Branches

```bash
/jade:branches compare main feat/add-8-slash-commands
```

Output:
```
=== Comparing main...feat/add-8-slash-commands ===

Commits ahead: 3
Commits behind: 0

Files Only in feat/add-8-slash-commands:
  + commands/jade-status.md
  + commands/jade-scan.md
  + lib/health-checker.js
  + lib/quality-gate.js

Files Modified Differently:
  (none)

Merge Status: Clean merge possible
```

### Branch Graph

```bash
/jade:branches graph
```

Output:
```
* abc1234 (HEAD -> feat/add-8-slash-commands) feat: add commands
* def5678 feat: add quality-gate module
* ghi9012 feat: add health-checker module
|
| * xyz7890 (feat/refactor-task-utils) refactor: task utils
| * uvw4567 test: add task utils tests
|/
* 0c581b7 (origin/main, main) chore: add c8 coverage
* a1b2c3d feat: implement dispatcher
```

### List with Worktrees

```bash
/jade:branches --worktrees
```

Shows branches with their associated worktrees:

```
=== Branches with Worktrees ===

  Branch                      Worktree Path              Status
* feat/add-8-slash-commands   ~/projects/jade-dev-assist  Current
  feat/refactor-task-utils    ~/worktrees/refactor        Clean
  main                        (none)                      -
```

## Branch Patterns

### Feature Branches

Convention: `feat/<feature-name>`

```bash
/jade:branches list --pattern "feat/*"
```

### Fix Branches

Convention: `fix/<issue-number>-<description>`

```bash
/jade:branches list --pattern "fix/*"
```

### Release Branches

Convention: `release/v<version>`

```bash
/jade:branches list --pattern "release/*"
```

## Branch Lifecycle

```
main
  |
  +-- feat/new-feature (create)
  |     |
  |     +-- (commits)
  |     |
  |     +-- PR review
  |     |
  +<--- merge
  |
  +-- (delete feature branch)
```

## Integration with jade-branch Function

This command integrates with the `jade-branch` shell function:

```bash
# Create and checkout branch
jade-branch create feat/new-feature

# Delete merged branch
jade-branch delete feat/old-feature

# Cleanup merged branches
jade-branch cleanup
```

### Shell Function Definition

From dotfiles:

```bash
jade-branch() {
  case "$1" in
    create)
      git checkout -b "$2"
      ;;
    delete)
      git branch -d "$2"
      ;;
    cleanup)
      git fetch -p
      git branch --merged | grep -v "main\|develop\|*" | xargs -r git branch -d
      ;;
    *)
      git branch "$@"
      ;;
  esac
}
```

## Multi-Project Branches

View branches across all ecosystem projects:

```bash
/jade:branches --ecosystem
```

Output:
```
=== Ecosystem Branches ===

jade-cli:
  * main
    feat/auto-complete (2 ahead)

jade-index:
  * main
    feat/gpu-embeddings (5 ahead)

jade-dev-assist:
  * feat/add-8-slash-commands (3 ahead)
    main

claude-objects:
  * main
```

## Configuration

```json
{
  "branches": {
    "protected": ["main", "develop"],
    "deleteOnMerge": true,
    "autoFetchRemote": true,
    "defaultBase": "main"
  }
}
```

## PR Integration

Create PR from current branch:

```bash
/jade:branches pr
```

Equivalent to:
```bash
gh pr create --fill
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Branch not showing | Run `git fetch --all` |
| Stale branches | Use `jade-branch cleanup` |
| Merge conflicts | Use `compare` to identify conflicts |
| Missing remote | Check `git remote -v` |

## Related Commands

- `/jade:worktree` - Manage git worktrees
- `/jade:review` - Code review workflow
- `/jade:plan` - Plan before branching
