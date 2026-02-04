---
name: workflow-orchestrator
description: Coordinate between jade-swarm-superpowers and jade-dev-assist. Trigger swarm runs, monitor progress, update Projects board.
---

## Capabilities

### 1. Swarm Integration

- Generate task lists from plans or descriptions
- Trigger swarm runs via jade-swarm-superpowers commands
- Monitor swarm run status via filesystem (~/.jade-swarm/runs/)

### 2. Progress Tracking

- Read swarm task summaries as they complete
- Update GitHub Projects board items:
  - "In Progress" when swarm starts
  - "Review" when swarm completes
  - "Done" when tests pass and PR merged

### 3. Conflict Resolution

- Detect when multiple swarm workers modified overlapping files
- Present conflicts to user for resolution
- Re-run quality gate after resolution

### 4. Reporting

- Generate swarm run summary (tasks completed, failed, cached)
- Token usage report (actual vs cached)
- Update roadmap/current.md with progress
