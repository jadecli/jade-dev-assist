---
name: jade:branches
description: Show all branch clones created by jade-branch function across ecosystem
argument-hint: "[list | cleanup | --project <name>]"
allowed-tools: [Read, Bash, Glob]
---

# Branch Management

Lists and manages branch clones created by the jade-branch function. Shows worktrees, feature branches, and their status across the ecosystem.

## Usage

```bash
/jade:branches [command] [options]
```

## Commands

| Command | Description |
|---------|-------------|
| `list` | (Default) Show all branches and worktrees |
| `cleanup` | Remove merged branches and stale worktrees |
| `orphans` | Find worktrees without tracking branches |

## Options

| Flag | Description |
|------|-------------|
| `--project <name>` | Filter to specific project |
| `--stale` | Show only stale branches (no commits in 14 days) |
| `--merged` | Show only merged branches |
| `--worktrees` | Show only git worktrees |
| `--remote` | Include remote branches |

## Examples

### List All Branches

```bash
/jade:branches list
```

Scans all projects for branches and worktrees:

```bash
for project in $(jq -r '.projects[].name' ~/.jade/projects.json); do
  dir=~/projects/$project
  if [ -d "$dir/.git" ]; then
    echo "=== $project ==="

    # List local branches
    git -C "$dir" branch -v --format='%(refname:short) %(upstream:track) %(committerdate:relative)'

    # List worktrees
    git -C "$dir" worktree list --porcelain 2>/dev/null | grep -E '^worktree|^branch'
  fi
done
```

### Show Worktrees Only

```bash
/jade:branches --worktrees
```

```bash
for project in $(jq -r '.projects[].name' ~/.jade/projects.json); do
  dir=~/projects/$project
  if [ -d "$dir/.git" ]; then
    worktrees=$(git -C "$dir" worktree list 2>/dev/null)
    if [ -n "$worktrees" ]; then
      echo "=== $project ==="
      echo "$worktrees"
    fi
  fi
done
```

### Find Stale Branches

```bash
/jade:branches --stale
```

Shows branches with no commits in the last 14 days:

```bash
for project in $(jq -r '.projects[].name' ~/.jade/projects.json); do
  dir=~/projects/$project
  if [ -d "$dir/.git" ]; then
    echo "=== $project ==="
    git -C "$dir" for-each-ref --sort=-committerdate --format='%(refname:short) %(committerdate:relative)' refs/heads | \
      while read branch date; do
        days=$(git -C "$dir" log -1 --format=%cr "$branch" 2>/dev/null | grep -oE '[0-9]+ (days|weeks|months)')
        if echo "$days" | grep -qE '(weeks|months|[0-9]{2,} days)'; then
          echo "  $branch ($date)"
        fi
      done
  fi
done
```

### Find Merged Branches

```bash
/jade:branches --merged
```

```bash
for project in $(jq -r '.projects[].name' ~/.jade/projects.json); do
  dir=~/projects/$project
  base=$(jq -r ".projects[] | select(.name == \"$project\") | .base_branch // \"main\"" ~/.jade/projects.json)
  if [ -d "$dir/.git" ]; then
    merged=$(git -C "$dir" branch --merged "$base" | grep -v "^\*" | grep -v "$base")
    if [ -n "$merged" ]; then
      echo "=== $project ==="
      echo "$merged"
    fi
  fi
done
```

### Cleanup Stale Branches

```bash
/jade:branches cleanup
```

Interactive cleanup:
```bash
for project in $(jq -r '.projects[].name' ~/.jade/projects.json); do
  dir=~/projects/$project
  base=$(jq -r ".projects[] | select(.name == \"$project\") | .base_branch // \"main\"" ~/.jade/projects.json)

  if [ -d "$dir/.git" ]; then
    # List merged branches
    merged=$(git -C "$dir" branch --merged "$base" | grep -v "^\*" | grep -v "$base")

    if [ -n "$merged" ]; then
      echo "=== $project: merged branches ==="
      echo "$merged"
      echo "Delete these branches? [y/N]"
      # In actual use, read confirmation before deleting
    fi
  fi
done
```

### Filter by Project

```bash
/jade:branches --project jade-cli
```

## Output Format

```
Branch Overview
===============

jade-index (python)
  main              up-to-date     2 hours ago
  feat/batch-api    [ahead 3]      1 day ago
  worktrees:
    .claude/worktrees/batch-api -> feat/batch-api

jade-cli (typescript)
  main              up-to-date     3 hours ago
  feat/telemetry    [ahead 1]      4 hours ago
  fix/node-build    merged         2 days ago (deletable)

jade-dev-assist (javascript)
  main              up-to-date     1 hour ago
  feat/dispatcher   [ahead 5]      30 minutes ago

Summary
  Total branches: 8
  Merged (deletable): 1
  Stale (>14 days): 0
  Worktrees: 1
```

## Worktree Locations

By convention, worktrees are created in:
- `.claude/worktrees/<branch-name>/` (per project)
- `~/.jade/worktrees/<project>/<branch>/` (global)

## Related Commands

- `/jade:worktree` - Create and manage worktrees
- `/jade:status` - Ecosystem health check
- `/jade:scan` - Run quality gates
