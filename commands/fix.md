---
name: jade:fix
description: Claude fixes most bugs by itself - zero context switching required
argument-hint: "[ci | <slack-url> | logs | <description>]"
allowed-tools: [Read, Write, Bash, Glob, Grep, MCP]
---

# Autonomous Bug Fixing

> "Claude fixes most bugs by itself. Enable the Slack MCP, paste a bug thread, and just say 'fix.' Zero context switching required." — Boris Cherny

## Usage

```bash
/jade:fix <target> [options]
```

## Commands

| Command | Description |
|---------|-------------|
| `ci` | Go fix the failing CI tests |
| `<slack-url>` | Fix bug from Slack thread |
| `logs` | Analyze and fix from logs |
| `<description>` | Fix described issue |

## Philosophy

**Don't micromanage how.**

Just tell Claude what's broken. Let it figure out the fix.

## Examples

### Fix CI Tests

```bash
/jade:fix ci
```

Claude will:
1. Check CI status
2. Identify failing tests
3. Read error messages
4. Find root cause
5. Implement fix
6. Verify tests pass

```
🔧 CI Fix Mode

• Checking CI status...
  └─ 3 tests failing in auth.test.ts

• Analyzing failures...
  └─ TypeError: Cannot read property 'id' of undefined

• Finding root cause...
  └─ User object not properly initialized in test setup

• Implementing fix...
  └─ Modified: tests/auth.test.ts

• Verifying...
  └─ ✅ All tests passing

Done. Don't micromanage how.
```

### Fix from Slack Thread

```bash
/jade:fix https://yourcompany.slack.com/archives/C0123/p1234567890
```

With Slack MCP enabled:
```
🔧 Slack Bug Fix

• Reading thread...
  └─ slack - search_public (MCP)(query: "in:C0123...")

• Bug summary:
  └─ Users can't login after password reset
  
• Finding related code...
  └─ src/auth/password-reset.ts

• Root cause:
  └─ Token not being cleared after reset

• Fix applied:
  └─ Clear token in resetPassword handler

✅ Fixed. Zero context switching.
```

### Analyze Docker Logs

```bash
/jade:fix logs
```

> "Point Claude at docker logs to troubleshoot distributed systems — it's surprisingly capable at this."

```
🔧 Log Analysis Mode

• Reading logs...
  └─ docker logs app-container --tail 1000

• Issues found:
  └─ Connection timeout to redis at 03:42:15
  └─ Memory spike at 03:42:18
  └─ Service restart at 03:42:20

• Root cause:
  └─ Redis connection pool exhaustion

• Fix:
  └─ Increased pool size, added connection timeout

✅ Distributed system debugged.
```

### Quick Fix Description

```bash
/jade:fix "Login button not working on mobile"
```

Claude handles:
1. Finding relevant code
2. Identifying the issue
3. Implementing the fix
4. Testing it works

## Integration with MCP

### Slack MCP

Enable for direct Slack access:
```json
{
  "mcp": {
    "servers": {
      "slack": {
        "enabled": true
      }
    }
  }
}
```

Then:
```
> fix this https://ant.slack.com/archives/...

• slack - search_public (MCP)(query: "in:C0...")
```

### GitHub MCP

For issue-based fixes:
```bash
/jade:fix https://github.com/org/repo/issues/123
```

### Linear MCP

For ticket-based fixes:
```bash
/jade:fix LIN-123
```

## Best Practices

### 1. Don't Micromanage

❌ Bad:
```
Fix the bug by opening the file at src/auth/login.ts, 
finding the function called handleLogin, and changing 
the validation logic on line 45...
```

✅ Good:
```
Fix the login bug
```

### 2. Provide Context When Helpful

Sometimes a bit of context helps:
```
Fix the login bug. It started after yesterday's deploy.
```

### 3. Let Claude Explore

Claude is good at:
- Reading logs
- Tracing errors
- Finding root causes
- Testing fixes

### 4. Trust the Process

If Claude's first fix doesn't work, just say:
```
That didn't work. Try again.
```

## Supported Fix Sources

| Source | Command | Requires |
|--------|---------|----------|
| CI/CD | `/jade:fix ci` | CI access |
| Slack | `/jade:fix <slack-url>` | Slack MCP |
| GitHub Issues | `/jade:fix <gh-url>` | GitHub access |
| Linear | `/jade:fix LIN-123` | Linear MCP |
| Logs | `/jade:fix logs` | Log access |
| Description | `/jade:fix "..."` | Nothing |

## Configuration

```json
{
  "fix": {
    "ciProvider": "github-actions",
    "logSources": [
      "docker",
      "kubernetes",
      "cloudwatch"
    ],
    "autoVerify": true,
    "createPR": false,
    "mcpIntegrations": {
      "slack": true,
      "github": true,
      "linear": true
    }
  }
}
```

## Implementation

### Modules

**lib/fixer.js** - Core bug fixing logic:
- `parseTestFailures()` - Extract test failures from CI output (Jest, Mocha, etc.)
- `parseStackTrace()` - Parse stack traces for file/line info
- `extractErrorPatterns()` - Identify error types (TypeError, ValidationError, etc.)
- `parseLogOutput()` - Parse JSON and standard log formats
- `analyzeRootCause()` - Identify likely problem files and error patterns
- `generateFixPrompt()` - Create detailed Claude prompt with extended thinking support
- `verifyFix()` - Run tests to verify fix works
- `fixBug()` - Main workflow orchestrator

**lib/ci-integrations.js** - GitHub Actions integration:
- `checkGhCli()` - Verify gh CLI is available and authenticated
- `getLatestCiRun()` - Fetch latest CI run information
- `getCiRunLogs()` - Get complete logs from a CI run
- `getFailedJobs()` - Extract failed jobs from a run
- `getLatestCiFailure()` - Find and analyze latest failure
- `extractTestCommand()` - Parse test command from workflow file

### Test Coverage

**tests/test-fixer.js** - 15 comprehensive tests:
- Error parsing (test failures, stack traces, patterns)
- Log analysis (errors, warnings, timestamps)
- Root cause analysis (single/multiple failures)
- Fix generation (prompts, extended thinking)
- Verification (test execution, success/failure)
- Integration (full workflow, multiple sources)

All tests passing ✓

### Design Decisions

1. **TDD Approach**: Tests written first, then implementation
2. **Extended Thinking**: Enabled for low confidence (<50%) or complex bugs (>3 failures)
3. **Modular Design**: Separate parsing, analysis, and generation logic
4. **Framework Agnostic**: Supports Jest, Mocha, generic test runners
5. **Log Format Support**: JSON logs, syslog, custom formats
6. **CI Provider**: GitHub Actions via gh CLI (extensible to other providers)

## Related Commands

- `/jade:logs analyze` - Deep log analysis
- `/jade:subagent` - Parallelize complex fixes
- `/jade:plan replan` - If fix goes sideways
