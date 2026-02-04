---
name: jade:context-sync
description: Sync 7 days of Slack, GDrive, Asana, and GitHub into one context dump
argument-hint: '[--days <n> | --sources <list>]'
allowed-tools: [Read, Write, Bash, MCP]
---

# Multi-Source Context Sync

> "Set up a slash command that syncs 7 days of Slack, GDrive, Asana, and GitHub into one context dump." — Boris Cherny

## Usage

```bash
/jade:context-sync [options]
```

## Options

| Flag               | Description             | Default |
| ------------------ | ----------------------- | ------- |
| `--days <n>`       | Number of days to sync  | 7       |
| `--sources <list>` | Comma-separated sources | all     |
| `--output <file>`  | Save to file            | stdout  |
| `--focus <topic>`  | Filter by topic         | none    |

## Supported Sources

| Source       | MCP Required | Data Synced                 |
| ------------ | ------------ | --------------------------- |
| Slack        | Yes          | Messages, threads, mentions |
| Google Drive | Yes          | Docs, comments, changes     |
| Asana        | Yes          | Tasks, comments, updates    |
| GitHub       | Yes          | Issues, PRs, comments       |
| Linear       | Yes          | Issues, updates             |
| Notion       | Yes          | Pages, databases            |
| Jira         | Yes          | Tickets, comments           |

## Examples

### Full Sync (7 Days)

```bash
/jade:context-sync
```

```
🔄 Context Sync - Last 7 Days

📱 SLACK (via MCP)
─────────────────
#engineering (23 messages)
  • Discussion about auth refactor
  • Bug report: login timeout
  • Decision: use OAuth2 instead of SAML

#alerts (5 messages)
  • 2 deployment notifications
  • 3 error alerts (resolved)

@mentions (3)
  • Request for code review
  • Question about API design
  • Meeting reminder

📄 GOOGLE DRIVE (via MCP)
─────────────────────────
Modified docs:
  • "Auth System Design" - updated yesterday
  • "Q1 Roadmap" - 3 new comments
  • "API Specification" - major revision

📋 ASANA (via MCP)
──────────────────
Your tasks:
  • [In Progress] Implement OAuth2 flow
  • [Review] Update API documentation
  • [Done] Fix login timeout bug

Team updates:
  • Sprint goal: Complete auth refactor
  • Blockers: Waiting on security review

🐙 GITHUB (via MCP)
───────────────────
PRs:
  • #234 - Auth refactor (awaiting review)
  • #230 - Bug fix merged

Issues:
  • #456 - Login timeout (assigned to you)
  • #455 - Token refresh (closed)

Reviews requested:
  • #238 - API rate limiting

📊 SUMMARY
──────────
Active work: Auth system refactor
Key decisions: OAuth2 over SAML
Blockers: Security review pending
Next actions: Complete PR #234, review #238
```

### Focus on Topic

```bash
/jade:context-sync --focus "authentication"
```

Only syncs items related to authentication.

### Custom Time Range

```bash
/jade:context-sync --days 14
```

### Specific Sources

```bash
/jade:context-sync --sources slack,github
```

### Save to File

```bash
/jade:context-sync --output context.md
```

## MCP Configuration

Enable required MCPs in Claude Code:

```json
{
  "mcp": {
    "servers": {
      "slack": { "enabled": true },
      "google-drive": { "enabled": true },
      "asana": { "enabled": true },
      "github": { "enabled": true }
    }
  }
}
```

## Use Cases

### 1. Start of Day Sync

```bash
/jade:context-sync --days 1
```

See everything that happened since yesterday.

### 2. Pre-Planning Context

```bash
/jade:context-sync --focus "sprint planning"
```

Gather all context before planning session.

### 3. Handoff Documentation

```bash
/jade:context-sync --days 14 --output handoff.md
```

Create context document for handoff.

### 4. Debug Context

```bash
/jade:context-sync --focus "error" --sources slack,github
```

Find all error-related discussions.

## Context Output Format

```markdown
# Context Sync: 2026-02-01

## Executive Summary

[Auto-generated summary of key points]

## Slack

### #engineering

- [2026-01-28] @alice: Started auth refactor
- [2026-01-29] @bob: Found edge case in token refresh
- [2026-01-30] Decision: Use OAuth2

### @mentions

- [2026-01-29] @alice: Can you review PR #234?

## GitHub

### PRs

- #234 - Auth refactor [Open, awaiting review]
- #230 - Bug fix [Merged]

### Issues

- #456 - Login timeout [Assigned to you]

## Asana

### Your Tasks

- [In Progress] Implement OAuth2 flow
- [Review] Update API documentation

## Key Themes

1. Auth refactor is priority
2. Security review needed
3. Documentation update required

## Action Items

- [ ] Complete PR #234
- [ ] Review PR #238
- [ ] Get security sign-off
```

## Best Practices

### 1. Daily Sync Habit

Start each day:

```bash
/jade:context-sync --days 1
```

### 2. Topic-Based Before Deep Work

Before tackling a feature:

```bash
/jade:context-sync --focus "feature-name"
```

### 3. Keep Context Fresh

Don't let context go stale:

- Sync at start of session
- Re-sync after breaks
- Sync before planning

## Configuration

```json
{
  "contextSync": {
    "defaultDays": 7,
    "defaultSources": ["slack", "github", "asana", "gdrive"],
    "autoSync": {
      "enabled": false,
      "interval": "daily"
    },
    "filters": {
      "excludeChannels": ["#random", "#social"],
      "includeLabels": ["priority", "urgent"]
    }
  }
}
```

## Related Commands

- `/jade:plan` - Use synced context for planning
- `/jade:fix` - Fix issues found in context
- `/jade:learn` - Capture decisions from context
