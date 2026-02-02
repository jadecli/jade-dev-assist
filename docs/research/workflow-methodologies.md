# Workflow Methodologies Analysis

> Analysis of Superpowers, GSD, Ralph, and Claude Code Tasks for JADE-DEV-ASSIST integration

## Overview

This document analyzes four leading AI development workflow methodologies to identify patterns and best practices for integration into JADE-DEV-ASSIST.

---

## 1. Superpowers (Jesse Vincent / obra)

**Repository**: [github.com/obra/superpowers](https://github.com/obra/superpowers)
**Stars**: 40.9k | **Philosophy**: Agentic skills framework + development methodology

### Core Workflow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Brainstorm  │───▶│  Worktree   │───▶│ Write Plan  │───▶│  Execute    │
│  (Spec)     │    │  (Branch)   │    │  (Tasks)    │    │ (Subagents) │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                                                        │
       │                    ┌─────────────┐                    │
       └───────────────────▶│ Code Review │◀───────────────────┘
                            │ (2-Stage)   │
                            └─────────────┘
```

### Key Skills

| Skill | Purpose |
|-------|---------|
| `brainstorming` | Socratic design refinement before coding |
| `writing-plans` | Break work into 2-5 minute tasks |
| `executing-plans` | Batch execution with checkpoints |
| `subagent-driven-development` | Fresh subagent per task |
| `test-driven-development` | RED-GREEN-REFACTOR enforcement |
| `using-git-worktrees` | Isolated development branches |
| `requesting-code-review` | Pre-review checklist |
| `finishing-a-development-branch` | Merge/PR decision workflow |

### TDD Enforcement

```
1. Write failing test
2. Watch it fail (verify the test works)
3. Write minimal code to pass
4. Watch it pass
5. Commit
6. Refactor if needed
```

**Key Rule**: Code written before tests is deleted.

### Two-Stage Code Review

1. **Spec Compliance**: Does the implementation match the design?
2. **Code Quality**: Is the code clean, efficient, maintainable?

### Installation (Claude Code)

```bash
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

### JADE-DEV-ASSIST Integration Points

- [ ] Implement brainstorming skill with spec generation
- [ ] Add worktree management commands
- [ ] Create task planning with time estimates
- [ ] Support subagent orchestration
- [ ] Enforce TDD workflow
- [ ] Two-stage review automation

---

## 2. Get Shit Done (GSD)

**Repository**: [github.com/glittercowboy/get-shit-done](https://github.com/glittercowboy/get-shit-done)
**Stars**: 699 | **Philosophy**: Meta-prompting + context engineering

### Core Concept: Solving Context Rot

Context rot = quality degradation as Claude fills its context window.

GSD addresses this through:
- Structured XML task plans
- Size-limited context chunks
- Thin orchestrators that delegate
- Goal-backward verification

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR                           │
│            (Thin wrapper - never does heavy lifting)        │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Researcher  │    │    Planner    │    │   Executor    │
│   (915 lines) │    │   (744 lines) │    │   (Subagent)  │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Verifier    │    │ Plan Checker  │    │  Goal-Backward│
│               │    │               │    │   Analysis    │
└───────────────┘    └───────────────┘    └───────────────┘
```

### Structured Task Format

```xml
<task type="auto">
  <n>Create login endpoint</n>
  <files>src/app/api/auth/login/route.ts</files>
  <action>
    Use jose for JWT (not jsonwebtoken - CommonJS issues).
    Validate credentials against users table.
    Return httpOnly cookie on success.
  </action>
  <verify>curl -X POST localhost:3000/api/auth/login returns 200 + Set-Cookie</verify>
  <done>Valid credentials return cookie, invalid return 401</done>
</task>
```

### Key Commands

| Command | Description |
|---------|-------------|
| `/gsd:new-project` | Initialize new GSD project |
| `/gsd:map-codebase` | Analyze existing codebase |
| `/gsd:plan-phase` | Create phase plan with research |
| `/gsd:execute-plan` | Execute plan with verification |
| `/gsd:update` | Check for GSD updates |

### Verification Loop

```
Plan → Execute → Verify → (Gaps Found?) → Fix → Re-verify
```

### Installation

```bash
npx get-shit-done-cc --claude --global  # Install to ~/.claude/
npx get-shit-done-cc --claude --local   # Install to ./.claude/
```

### JADE-DEV-ASSIST Integration Points

- [ ] Context size monitoring
- [ ] Structured XML task templates
- [ ] Orchestrator pattern implementation
- [ ] Verification loop automation
- [ ] Goal-backward planning support
- [ ] Phase-based development tracking

---

## 3. Ralph (Frank Bria)

**Repository**: [github.com/frankbria/ralph-claude-code](https://github.com/frankbria/ralph-claude-code)
**Stars**: 5.9k | **Philosophy**: Autonomous development loop

### Core Concept: Continuous Autonomous Development

Ralph implements Geoffrey Huntley's technique for continuous Claude Code iterations with intelligent exit detection.

### Loop Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     RALPH LOOP                               │
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌────────┐│
│  │  Read    │───▶│ Execute  │───▶│  Track   │───▶│Evaluate││
│  │ PROMPT   │    │  Claude  │    │ Progress │    │  Exit  ││
│  └──────────┘    └──────────┘    └──────────┘    └────────┘│
│       ▲                                              │      │
│       └──────────────────────────────────────────────┘      │
│                        (Continue)                           │
└─────────────────────────────────────────────────────────────┘
```

### Dual-Condition Exit Gate

Exit requires BOTH:
1. `completion_indicators >= 2` (heuristic detection)
2. Claude's explicit `EXIT_SIGNAL: true`

```
Loop 5: "Phase complete, moving to next feature"
        → completion_indicators: 3
        → EXIT_SIGNAL: false
        → Result: CONTINUE

Loop 8: "All tasks complete, project ready"
        → completion_indicators: 4
        → EXIT_SIGNAL: true
        → Result: EXIT
```

### Rate Limiting & Circuit Breaker

| Feature | Threshold |
|---------|-----------|
| API calls per hour | 100 (configurable) |
| No progress loops | 3 (opens circuit) |
| Same error loops | 5 (opens circuit) |
| Output decline | 70% (opens circuit) |
| 5-hour API limit | Prompt wait/exit |

### Session Continuity

```bash
ralph --monitor                 # Uses session continuity (default)
ralph --no-continue             # Isolated iterations
ralph --reset-session           # Clear current session
```

### Project Structure

```
my-project/
├── .ralph/
│   ├── PROMPT.md              # Development instructions
│   ├── fix_plan.md            # Prioritized task list
│   ├── AGENT.md               # Build and run instructions
│   ├── specs/                 # Project specifications
│   ├── logs/                  # Execution logs
│   └── docs/generated/        # Auto-generated docs
└── .ralphrc                   # Configuration file
```

### Installation

```bash
git clone https://github.com/frankbria/ralph-claude-code.git
cd ralph-claude-code
./install.sh
ralph-setup my-project
```

### JADE-DEV-ASSIST Integration Points

- [ ] Autonomous loop orchestration
- [ ] Dual-condition exit detection
- [ ] Rate limiting with circuit breaker
- [ ] Session continuity management
- [ ] Progress tracking and logging
- [ ] PROMPT.md template generation

---

## 4. Claude Code Tasks System

**Source**: Claude Code v2.1.19+ | **Philosophy**: Session-scoped task orchestration

### Core Concept: Session-Scoped Tasks

Tasks are NOT persistent across sessions - this is intentional for:
- Lightweight, fast operation
- No database setup
- No cruft accumulation
- Clean session boundaries

### Task vs Todo

| Aspect | Todos (Old) | Tasks (New) |
|--------|-------------|-------------|
| Scope | Implicit | Session-scoped |
| Dependencies | None | Full graph support |
| Parallel | No | Yes |
| Sub-agents | Limited | Native support |

### TeammateTool Integration

```javascript
// Create a team
Teammate({
  operation: "spawn",
  target_agent_id: "worker-1",
  prompt: "Implement user authentication module"
})

// Communicate via inbox
Teammate({
  operation: "write",
  target_agent_id: "team-lead",
  value: "Authentication complete, tests passing"
})

// Coordinate shutdown
Teammate({
  operation: "requestShutdown",
  target_agent_id: "worker-1"
})
```

### Parallel Agent Coordination

```
┌───────────────────────────────────────────────────────────┐
│                        TEAM LEAD                          │
│                   (Orchestrates work)                     │
└─────────────────────────┬─────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│   Agent A     │ │   Agent B     │ │   Agent C     │
│  (Security)   │ │ (Performance) │ │   (Arch)      │
└───────┬───────┘ └───────┬───────┘ └───────┬───────┘
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ▼
                   ┌─────────────┐
                   │   Inbox     │
                   │  (Results)  │
                   └─────────────┘
```

### Built-in Agent Types

| Agent | Purpose | Tools |
|-------|---------|-------|
| Explore | Read-only codebase search | Read, Glob, Grep |
| Plan | Design strategy | Read, limited Write |
| General-purpose | Complex multi-step | All tools |

### JADE-DEV-ASSIST Integration Points

- [ ] Task creation and management
- [ ] Dependency graph tracking
- [ ] Parallel agent coordination
- [ ] TeammateTool wrapper functions
- [ ] Session-aware task persistence
- [ ] Agent type selection

---

## Integration Strategy for JADE-DEV-ASSIST

### Phase 1: Foundation
- Implement core personalization (profile, project, styles)
- Add capability toggles (thinking, search, artifacts)
- Create basic skill framework

### Phase 2: Superpowers Integration
- Brainstorming workflow
- Plan writing with task breakdown
- TDD enforcement
- Git worktree management

### Phase 3: GSD Integration
- Context monitoring
- XML task templates
- Verification loops
- Goal-backward analysis

### Phase 4: Ralph Integration
- Autonomous loop orchestration
- Exit detection
- Rate limiting
- Session management

### Phase 5: Tasks Integration
- Task/dependency management
- Parallel agent coordination
- TeammateTool wrappers
- Agent type routing

---

## Command Mapping

| Workflow | JADE-DEV-ASSIST Command |
|----------|------------------------|
| Superpowers brainstorm | `/jade:brainstorm` |
| Superpowers plan | `/jade:plan --style superpowers` |
| GSD map codebase | `/jade:analyze` |
| GSD plan phase | `/jade:plan --style gsd` |
| Ralph init | `/jade:loop --init` |
| Ralph execute | `/jade:loop --start` |
| Tasks create | `/jade:task create` |
| Tasks coordinate | `/jade:task coordinate` |

---

## Configuration Examples

### Superpowers Style

```json
{
  "workflow": "superpowers",
  "tdd": {
    "enforced": true,
    "deleteCodeBeforeTests": true
  },
  "planning": {
    "taskDuration": "2-5 minutes",
    "subagentPerTask": true
  },
  "review": {
    "twoStage": true,
    "stages": ["spec-compliance", "code-quality"]
  }
}
```

### GSD Style

```json
{
  "workflow": "gsd",
  "context": {
    "monitoring": true,
    "maxTokens": 80000
  },
  "tasks": {
    "format": "xml",
    "verification": true
  },
  "planning": {
    "goalBackward": true,
    "orchestratorOnly": true
  }
}
```

### Ralph Style

```json
{
  "workflow": "ralph",
  "loop": {
    "maxCallsPerHour": 100,
    "sessionContinuity": true,
    "exitGate": "dual-condition"
  },
  "circuitBreaker": {
    "noProgressThreshold": 3,
    "sameErrorThreshold": 5
  }
}
```
