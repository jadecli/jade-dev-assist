---
name: jade:subagent
description: Use subagents to throw more compute at problems and keep context clean
argument-hint: '[explore | parallel <n> | route]'
allowed-tools: [Read, Write, Bash, Glob, Grep, Teammate]
---

# Subagent Orchestration

> "Append 'use subagents' to any request where you want Claude to throw more compute at the problem." — Boris Cherny

## Usage

```bash
/jade:subagent <command> [options]
```

## Commands

| Command           | Description                              |
| ----------------- | ---------------------------------------- |
| `explore <topic>` | Launch explore agents to search codebase |
| `parallel <n>`    | Run n subagents on current task          |
| `route`           | Route permission requests to Opus 4.5    |
| `status`          | Show running subagents                   |

## Quick Usage

Just append to any request:

```
Refactor the authentication module, use subagents
```

Claude will automatically parallelize the work.

## Examples

### Explore Codebase

```bash
/jade:subagent explore "authentication flow"
```

```
🔍 Launching Explore Subagents

> use 5 subagents to explore the codebase

• I'll launch 5 explore agents in parallel to...
• Running 5 Explore agents... (ctrl+o to expand)
  ├─ Explore entry points and startup · 10 tools
  │  └─ Bash: Find CLI or main entry files
  ├─ Explore React components structure · 14 tools
  │  └─ Bash: ls -la /Users/code/project/src...
  ├─ Explore authentication flow · 12 tools
  │  └─ Grep: searching for "login", "auth"...
  ├─ Explore API routes · 8 tools
  │  └─ Glob: **/api/**/*.ts
  └─ Explore database models · 11 tools
     └─ Grep: searching for "prisma", "model"...

📊 Summary:
   Entry: src/index.ts → routes → controllers
   Auth: OAuth2 + JWT in src/auth/
   Database: Prisma with 12 models
   Components: 45 React components
```

### Parallel Task Execution

```bash
/jade:subagent parallel 3 "Add error handling to all API routes"
```

```
⚡ Parallel Subagent Mode

Launching 3 subagents...

├─ Subagent 1: API routes /users/*
│  └─ Adding try/catch, error responses...
│
├─ Subagent 2: API routes /auth/*
│  └─ Adding validation, error middleware...
│
└─ Subagent 3: API routes /products/*
   └─ Adding error boundaries, logging...

Progress: [████████░░] 80%

Results:
✅ Subagent 1: 8 files modified
✅ Subagent 2: 5 files modified
✅ Subagent 3: 6 files modified

Total: 19 files with error handling
```

### Permission Routing to Opus 4.5

```bash
/jade:subagent route
```

> "Route permission requests to Opus 4.5 via a hook — let it scan for attacks and auto-approve the safe ones."

```
🛡️ Permission Routing Enabled

Hook installed: PreToolUse → Opus 4.5 scanner

How it works:
1. Tool permission requested
2. Opus 4.5 scans for potential attacks
3. Safe operations auto-approved
4. Risky operations require manual approval

Auto-approved:
  ✅ Read operations
  ✅ Safe writes to project files
  ✅ Standard git operations

Manual approval required:
  ⚠️ System file modifications
  ⚠️ Network requests to unknown hosts
  ⚠️ Credential file access

See: code.claude.com/docs/en/hooks
```

## Why Use Subagents?

### 1. Throw Compute at Problems

More agents = more parallel processing power:

```
analyze this codebase, use subagents
```

### 2. Keep Context Clean

Main agent stays focused:

- Subagents handle isolated tasks
- Results summarized back to main
- No context pollution

### 3. Parallel Exploration

Search codebase in parallel:

```
/jade:subagent explore "how does the payment system work"
```

## Subagent Types

| Type    | Tools               | Best For             |
| ------- | ------------------- | -------------------- |
| Explore | Read, Glob, Grep    | Codebase exploration |
| Plan    | Read, limited Write | Design strategy      |
| General | All tools           | Complex multi-step   |

## Patterns

### Pattern 1: Research Then Act

```bash
# First, explore
/jade:subagent explore "authentication"

# Then, act with full context
Refactor authentication using what the subagents found
```

### Pattern 2: Divide and Conquer

```bash
# Split large task across subagents
/jade:subagent parallel 5 "Add unit tests to all utility functions"
```

### Pattern 3: Security Scanning

```bash
# Enable permission routing
/jade:subagent route

# Now all operations are scanned
Refactor the entire codebase  # Opus 4.5 approves safe ops
```

## Configuration

```json
{
  "subagent": {
    "defaultCount": 3,
    "maxConcurrent": 5,
    "permissionRouting": {
      "enabled": true,
      "scanner": "opus-4.5",
      "autoApprove": ["read", "safe-write", "git"]
    },
    "contextIsolation": true
  }
}
```

## Hooks Integration

### PreToolUse Hook for Permission Routing

```json
{
  "event": "PreToolUse",
  "actions": [
    {
      "type": "route",
      "to": "opus-4.5",
      "for": "security-scan",
      "autoApprove": ["safe"]
    }
  ]
}
```

## Best Practices

### 1. Use for Exploration

```
explore the codebase with subagents
```

### 2. Use for Large Refactors

```
refactor all API routes, use 5 subagents
```

### 3. Use for Parallel Testing

```
run tests across all modules, use subagents
```

### 4. Keep Main Agent Clean

Don't pollute main context with exploration details.
Let subagents summarize findings.

## Troubleshooting

| Issue                 | Solution              |
| --------------------- | --------------------- |
| Subagents conflicting | Reduce parallel count |
| Context overflow      | Use more subagents    |
| Slow execution        | Check subagent count  |
| Permission denied     | Enable route mode     |

## Related Commands

- `/jade:worktree` - Parallel worktrees
- `/jade:fix` - Autonomous fixes
- `/jade:plan` - Plan before subagent execution
