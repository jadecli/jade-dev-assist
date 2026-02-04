---
name: jade:status
description: Ecosystem health dashboard - check infra, GPU, tasks, and GitHub status
argument-hint: "[all | infra | gpu | tasks | github]"
allowed-tools: [Read, Bash, Glob, Grep]
---

# Ecosystem Health Dashboard

Display the health status of the jadecli ecosystem infrastructure, including Docker services, GPU availability, database connectivity, disk space, pending tasks, and GitHub project status.

## Usage

```bash
/jade:status [component]
```

## Components

| Component | Description |
|-----------|-------------|
| `all` | (Default) Show complete health dashboard |
| `infra` | Show infrastructure status (Docker, databases, disk) |
| `gpu` | Show GPU availability and utilization |
| `tasks` | Show pending tasks across all projects |
| `github` | Show GitHub project board status |

## Examples

### Full Dashboard

```bash
/jade:status
```

Output:
```
=== jadecli Ecosystem Health ===
Timestamp: 2026-02-04T15:30:00Z

## Infrastructure
  + Docker Services: 4/4 running
    - postgres: running
    - mongodb: running
    - dragonfly: running
    - ollama: running

## GPU
  + NVIDIA RTX 2080 Ti
    Memory: 2.1GB / 11.0GB (19%)
    Utilization: 5%

## Databases
  + PostgreSQL: connected (3ms)
  + MongoDB: connected (2ms)
  + Dragonfly: connected (1ms)

## Disk Space
  + /: 450GB / 1000GB (45%)

## Tasks
  Pending: 6 across 4 projects
  In Progress: 2
  Blocked: 1

## GitHub
  Open PRs: 3
  Open Issues: 12

Overall Status: HEALTHY
```

### Infrastructure Only

```bash
/jade:status infra
```

Shows Docker services, database connectivity, and disk space.

### GPU Status

```bash
/jade:status gpu
```

Output:
```
## GPU Status

Available: Yes
Name: NVIDIA GeForce RTX 2080 Ti
Driver: 560.94
CUDA: 12.4

Memory:
  Total: 11264 MB
  Used: 2156 MB (19%)
  Free: 9108 MB

Utilization:
  GPU: 5%
  Memory: 19%
```

### Pending Tasks

```bash
/jade:status tasks
```

Shows a summary of tasks across all 8 projects grouped by status.

### GitHub Status

```bash
/jade:status github
```

Shows open PRs, issues, and project board progress.

## Integration

This command uses the following library modules:

- `lib/health-checker.js` - Infrastructure health aggregation
- `lib/scanner.js` - Task scanning across projects

### Execution Flow

```javascript
const { runHealthChecks, formatHealthReport } = require('../lib/health-checker');
const { scanTasks } = require('../lib/scanner');

// Run health checks
const health = await runHealthChecks();
console.log(formatHealthReport(health));

// Scan tasks
const { tasks } = scanTasks();
const pending = tasks.filter(t => t.status === 'pending');
console.log(`Pending tasks: ${pending.length}`);
```

## Configuration

```json
{
  "status": {
    "refreshInterval": 30,
    "showGpu": true,
    "showGithub": true,
    "healthyThreshold": {
      "disk": 90,
      "memory": 80
    }
  }
}
```

## Related Commands

- `/jade:scan` - Run quality gate checks
- `/jade:tasks` - Detailed task list with filtering
- `/jade:metrics` - Code metrics and coverage
