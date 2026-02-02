---
name: jade:plan
description: Start every complex task in plan mode - pour energy into the plan so Claude can 1-shot the implementation
argument-hint: "[start | review | verify | replan]"
allowed-tools: [Read, Write, Bash, Glob, Grep]
---

# Plan Mode Workflow

> "Start every complex task in plan mode. Pour your energy into the plan so Claude can 1-shot the implementation." — Boris Cherny

## Usage

```bash
/jade:plan <command> [options]
```

## Commands

| Command | Description |
|---------|-------------|
| `start` | Enter plan mode for a new task |
| `review` | Spawn second Claude to review plan as staff engineer |
| `verify` | Enter plan mode for verification steps |
| `replan` | Something went sideways? Re-plan instead of pushing |

## Keyboard Shortcut

**Shift+Tab** — Cycle plan mode on/off in Claude Code

## Examples

### Start Planning

```bash
/jade:plan start "Implement user authentication with OAuth2"
```

Output:
```
🎯 Plan Mode Activated

Task: Implement user authentication with OAuth2

📋 PLANNING CHECKLIST
□ Define requirements and constraints
□ Identify affected files
□ Break into atomic steps
□ Consider edge cases
□ Define success criteria

💡 Pour energy into this plan. Claude will 1-shot the implementation.

⏸ plan mode on (shift+Tab to cycle)
```

### Two-Claude Review Pattern

```bash
/jade:plan review
```

This spawns a second Claude session to review your plan as a staff engineer:

```
🔍 Plan Review Mode

Spawning staff-level reviewer...

Reviewer will check:
□ Architecture decisions
□ Edge cases coverage
□ Implementation feasibility
□ Missing requirements
□ Potential issues

[Second Claude analyzing plan...]
```

### Verification in Plan Mode

```bash
/jade:plan verify
```

> "Explicitly tell Claude to enter plan mode for verification steps, not just for the build."

```
✅ Verification Plan Mode

Before marking complete, plan how to verify:
□ What tests prove this works?
□ What edge cases to check?
□ How to verify no regressions?
□ What metrics confirm success?
```

### Replan on Failure

```bash
/jade:plan replan
```

> "The moment something goes sideways, switch back to plan mode and re-plan. Don't keep pushing."

```
🔄 Replan Mode

Something went wrong. Let's step back.

Current state:
[Claude analyzes what happened]

What to preserve:
[Working parts]

What to change:
[Failed approach]

New plan:
[Fresh approach]
```

## Best Practices

### 1. Don't Skip Planning

❌ Bad: Jump straight to coding
✅ Good: Spend time on the plan first

### 2. Two-Claude Review

One person's workflow:
1. Claude #1 writes the plan
2. Spin up Claude #2 to review it as staff engineer
3. Only proceed when plan passes review

### 3. Re-Plan Early

The moment something goes sideways:
- **Don't** keep pushing and hope it works
- **Do** switch back to plan mode immediately
- Re-plan with new information

### 4. Plan Verification Too

Use plan mode for:
- ✅ Building features
- ✅ Verification steps
- ✅ Testing strategy
- ✅ Debugging approach

## Plan Template

When entering plan mode, use this structure:

```markdown
## Task
[What are we trying to accomplish?]

## Requirements
- [Requirement 1]
- [Requirement 2]

## Constraints
- [Technical constraints]
- [Time constraints]
- [Dependencies]

## Approach
1. [Step 1]
2. [Step 2]
3. [Step 3]

## Files to Modify
- `path/to/file1.ts` - [changes]
- `path/to/file2.ts` - [changes]

## Edge Cases
- [Edge case 1]
- [Edge case 2]

## Success Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]

## Verification Plan
- [ ] [Test 1]
- [ ] [Test 2]
```

## Integration with Workflow

### With Worktrees

```bash
# Plan in main worktree
/jade:plan start "Feature X"

# Review in separate worktree  
/jade:worktree create review
/jade:plan review
```

### With Subagents

```bash
# Plan, then execute with subagents
/jade:plan start "Refactor authentication"
# ... create plan ...
/jade:plan verify
# ... verify plan is solid ...

# Now execute with parallel subagents
use 3 subagents to implement the plan
```

## Configuration

```json
{
  "plan": {
    "autoEnter": {
      "complexity": "high",
      "newFeatures": true,
      "refactoring": true
    },
    "template": "default",
    "reviewRequired": false,
    "verificationRequired": true
  }
}
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Plan too vague | Add more specific steps |
| Implementation fails | `/jade:plan replan` immediately |
| Missing edge cases | Use `/jade:plan review` |
| Verification skipped | Enable `verificationRequired` |
