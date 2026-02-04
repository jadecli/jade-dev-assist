---
name: jade:status
description: Show ecosystem health - Docker services, GPU, tasks, GitHub rate limits
argument-hint: "[--docker | --gpu | --tasks | --github | --all]"
allowed-tools: [Read, Bash, Grep]
---

# Ecosystem Health Status

Displays the health status of the jadecli ecosystem including Docker services, GPU availability, task summary, and GitHub API rate limits.

## Usage

```bash
/jade:status [options]
```

## Options

| Flag | Description |
|------|-------------|
| `--all` | (Default) Show all status sections |
| `--docker` | Docker services health only |
| `--gpu` | GPU/CUDA availability only |
| `--tasks` | Task summary across all projects |
| `--github` | GitHub API rate limit status |
| `--json` | Output as JSON for scripting |

## Examples

### Full Status Check

```bash
/jade:status
```

Runs the following checks:

#### Docker Services

```bash
docker compose -f ~/projects/jadecli-infra/docker-compose.yml ps --format json 2>/dev/null | jq -r '.[] | "\(.Name): \(.State)"'
```

Expected services:
- PostgreSQL 16 + pgvector (5432)
- MongoDB 7 (27017)
- Dragonfly cache (6379)
- Ollama (11434, optional)

#### GPU Status

```bash
nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu --format=csv,noheader 2>/dev/null || echo "GPU not available"
```

#### Task Summary

```bash
# Count tasks per project from ~/.jade/projects.json
for project in $(jq -r '.projects[].name' ~/.jade/projects.json); do
  task_file=~/projects/$project/.claude/tasks/tasks.json
  if [ -f "$task_file" ]; then
    pending=$(jq '[.tasks[] | select(.status == "pending")] | length' "$task_file")
    in_progress=$(jq '[.tasks[] | select(.status == "in_progress")] | length' "$task_file")
    echo "$project: $pending pending, $in_progress in_progress"
  fi
done
```

#### GitHub Rate Limits

```bash
gh api rate_limit --jq '.resources.core | "Core: \(.remaining)/\(.limit) (resets \(.reset | strftime("%H:%M")))"'
gh api rate_limit --jq '.resources.graphql | "GraphQL: \(.remaining)/\(.limit)"'
```

### Docker Only

```bash
/jade:status --docker
```

### GPU Check

```bash
/jade:status --gpu
```

## Output Format

```
Ecosystem Status (2026-02-04 14:30)
==================================

Docker Services
  postgres-16    running (5432)
  mongodb-7      running (27017)
  dragonfly      running (6379)
  ollama         not running

GPU
  RTX 2080 Ti    2.1GB / 11GB (12% util)

Tasks
  jade-cli       2 pending, 1 in_progress
  jade-index     0 pending, 0 in_progress
  jade-dev-assist 1 pending, 0 in_progress
  Total: 3 pending, 1 in_progress

GitHub API
  Core: 4850/5000 (resets 15:00)
  GraphQL: 4998/5000
```

## Configuration

Reads project registry from `~/.jade/projects.json`.

## Related Commands

- `/jade:scan` - Run quality gates across projects
- `/jade:tasks` - Detailed task listing with filters
- `/jade:validate` - Pre-commit quality checks
