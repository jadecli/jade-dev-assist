---
name: jade:worktree
description: Manage parallel git worktrees with Claude sessions - the single biggest productivity unlock
argument-hint: '[create|list|switch|remove] [options]'
allowed-tools: [Read, Write, Bash, Glob]
---

# Parallel Development with Git Worktrees

> "Spin up 3–5 git worktrees at once, each running its own Claude session in parallel. It's the single biggest productivity unlock." — Boris Cherny, Claude Code Creator

## Usage

```bash
/jade:worktree <command> [options]
```

## Commands

| Command         | Description                               |
| --------------- | ----------------------------------------- |
| `create`        | Create a new worktree with Claude session |
| `list`          | Show all active worktrees                 |
| `switch`        | Quick switch between worktrees            |
| `remove`        | Remove a worktree                         |
| `setup-aliases` | Configure shell aliases (za, zb, zc...)   |
| `analysis`      | Create dedicated analysis worktree        |

## Examples

### Create Worktrees

```bash
# Create a feature worktree
/jade:worktree create feature-auth

# Create from specific branch
/jade:worktree create bugfix-api --from origin/main

# Create multiple at once
/jade:worktree create feature-a feature-b feature-c

# Create analysis worktree (read-only for logs/queries)
/jade:worktree analysis
```

### List Active Worktrees

```bash
/jade:worktree list
```

Output:

```
📂 Active Worktrees (4)

  main        → /code/myproject (active)
  feature-a   → .claude/worktrees/feature-a
  feature-b   → .claude/worktrees/feature-b
  analysis    → .claude/worktrees/analysis (read-only)

💡 Use 'za', 'zb', 'zc' aliases to switch quickly
```

### Switch Worktrees

```bash
# By name
/jade:worktree switch feature-a

# Using alias (after setup)
za  # switches to worktree a
zb  # switches to worktree b
```

### Setup Shell Aliases

```bash
/jade:worktree setup-aliases
```

Adds to your `.zshrc` or `.bashrc`:

```bash
# JADE Worktree Aliases
alias za='cd .claude/worktrees/a && claude'
alias zb='cd .claude/worktrees/b && claude'
alias zc='cd .claude/worktrees/c && claude'
alias zd='cd .claude/worktrees/d && claude'
alias ze='cd .claude/worktrees/e && claude'
alias zlist='git worktree list'
```

## Workflow Patterns

### Pattern 1: Feature Parallelization

Run 3-5 features simultaneously:

```
Terminal 1: worktree/feature-auth   → Claude working on auth
Terminal 2: worktree/feature-api    → Claude working on API
Terminal 3: worktree/feature-ui     → Claude working on UI
Terminal 4: main                    → You reviewing/merging
```

### Pattern 2: Analysis + Development

```
Terminal 1: main                    → Active development
Terminal 2: worktree/analysis       → Reading logs, BigQuery
Terminal 3: worktree/experiments    → Trying risky changes
```

### Pattern 3: Code Review Flow

```
Terminal 1: worktree/feature        → Claude implementing
Terminal 2: worktree/review         → Second Claude reviewing
```

## Directory Structure

```
myproject/
├── .claude/
│   └── worktrees/
│       ├── feature-auth/     # git worktree
│       ├── feature-api/      # git worktree
│       ├── analysis/         # git worktree (read-only)
│       └── .worktree-config  # JADE worktree metadata
├── src/
└── ...
```

## Analysis Worktree

Special worktree for non-coding tasks:

```bash
/jade:worktree analysis
```

Features:

- Read-only mode (prevents accidental changes)
- Pre-loaded with analytics skills
- Optimized for log analysis and BigQuery
- Separate context window

Use cases:

- Reading production logs
- Running BigQuery analytics
- Investigating issues without touching code

## Best Practices

1. **Name by task** - `feature-auth`, `bugfix-login`, not `worktree-1`
2. **One task per worktree** - Keep context focused
3. **Use aliases** - `za`, `zb`, `zc` for fast switching
4. **Clean up** - Remove completed worktrees to avoid confusion
5. **Dedicated analysis** - Keep a separate worktree for read-only work

## Implementation

### Create Worktree

```bash
# Git command executed
git worktree add .claude/worktrees/${name} origin/main

# Start Claude session
cd .claude/worktrees/${name} && claude
```

### Remove Worktree

```bash
# Verify no uncommitted changes
git -C .claude/worktrees/${name} status

# Remove
git worktree remove .claude/worktrees/${name}
```

## Integration with Other Commands

- `/jade:plan` - Works in any worktree
- `/jade:fix` - Fix bugs in isolated worktree
- `/jade:subagent` - Subagents can span worktrees
- `/jade:techdebt` - Run cleanup per worktree

## Troubleshooting

| Issue                     | Solution                                  |
| ------------------------- | ----------------------------------------- |
| "Worktree already exists" | Remove with `/jade:worktree remove <n>`   |
| Can't switch worktrees    | Check for uncommitted changes             |
| Merge conflicts           | Resolve in worktree, then merge to main   |
| Context bleed             | Each worktree has isolated Claude session |
