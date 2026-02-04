---
name: workflow-orchestrator
description: Coordinate between jade-swarm-superpowers and jade-dev-assist. Trigger swarm runs, monitor progress, update Projects board.
---

## Capabilities

### 1. Swarm Integration
- Generate task lists from plans or descriptions (supports numbered, bullet, and paragraph formats)
- Trigger swarm runs via filesystem-based state management
- Monitor swarm run status via filesystem (~/.jade-swarm/runs/)

### 2. Progress Tracking
- Read swarm task summaries as they complete
- Update GitHub Projects board items via gh CLI:
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

## Implementation

**Module:** `skills/workflow-orchestrator/index.js`

**Exported Functions:**

- `generateTaskList(plan)` - Parse plan text into structured tasks
- `triggerSwarmRun(options)` - Initialize swarm run with tasks
- `monitorSwarmStatus(runId, options)` - Read run status from filesystem
- `updateGitHubProject(options)` - Update GitHub Projects via gh CLI
- `detectConflicts(tasks)` - Find overlapping file modifications
- `generateRunSummary(runData)` - Create formatted run summary
- `generateTokenReport(tokenData)` - Create token usage report

**Tests:** `skills/workflow-orchestrator/tests/test-workflow-orchestrator.js` (16 tests, all passing)

## Usage Patterns

### From Reference Documentation

This skill implements patterns from `docs/reference-index.md`:

1. **GitHub Projects GraphQL API** - Uses gh CLI for item updates
2. **Tool Use Patterns** - External process management via execSync
3. **Extended Thinking** - Complex coordination logic for conflict detection
4. **TDD Patterns** - Comprehensive test coverage with 16 test cases

### Integration Points

- **jade-swarm-superpowers** - Triggers swarm runs, reads status files
- **GitHub Projects** - Updates board via gh CLI GraphQL commands
- **File System** - State management via ~/.jade-swarm/runs/
- **Task Files** - Reads/writes .claude/tasks/tasks.json
