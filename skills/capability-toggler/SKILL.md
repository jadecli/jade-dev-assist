---
name: capability-toggler
description: Toggle Claude capabilities including extended thinking, web search, research, and artifacts with configurable parameters
dependencies: []
---

# Capability Toggler Skill

## Overview

Manages Claude's capability toggles with sensible defaults and project-specific overrides.

## Capabilities Matrix

| Capability        | Description                  | Token Impact      | Plans     |
| ----------------- | ---------------------------- | ----------------- | --------- |
| Extended Thinking | Deep reasoning mode          | 1,024–31,999      | All       |
| Web Search        | Real-time information        | 1-2 tool calls    | All       |
| Research          | Comprehensive analysis       | 5+ calls, 1-3 min | Paid      |
| Artifacts         | Persistent outputs           | 20MB storage      | All       |
| Skills            | Dynamic capability loading   | Varies            | Paid + CC |
| MCP Integration   | External service connections | N/A               | Paid      |

## Usage

### View Current State

```bash
/jade:capabilities --status
```

Output:

```
🧠 Extended Thinking: ENABLED (budget: 16000 tokens)
🔍 Web Search: ENABLED (no domain restrictions)
📚 Research: AVAILABLE (paid plan detected)
📦 Artifacts: ENABLED
⚡ Skills: ENABLED (3 active)
🔗 MCP: ENABLED (2 servers connected)
```

### Toggle Capabilities

```bash
# Enable extended thinking with custom budget
/jade:thinking --enable --budget 24000

# Disable web search
/jade:capabilities --set webSearch=false

# Enable artifacts with MCP
/jade:capabilities --set artifacts=true --set mcp=true
```

### Configure Extended Thinking

```bash
# Enable with default budget (16000)
/jade:thinking --enable

# Set specific budget
/jade:thinking --budget 8000

# Maximum budget
/jade:thinking --budget max  # 31999

# Disable
/jade:thinking --disable

# View thinking in real-time (Claude Code)
# Press Ctrl+O during execution
```

### Configure Web Search

```bash
# Enable with defaults
/jade:capabilities --set webSearch=true

# With domain filtering
/jade:search --allowed "docs.example.com,api.example.com"
/jade:search --blocked "ads.example.com"

# With location context
/jade:search --location "San Francisco, CA, US"
```

## Configuration Schema

### Extended Thinking

```json
{
  "extendedThinking": {
    "enabled": true,
    "budgetTokens": 16000,
    "autoEnable": {
      "complexity": "high",
      "taskTypes": ["debugging", "architecture", "algorithms"]
    }
  }
}
```

### Web Search

```json
{
  "webSearch": {
    "enabled": true,
    "maxUses": 5,
    "allowedDomains": [],
    "blockedDomains": [],
    "userLocation": {
      "type": "approximate",
      "city": "San Francisco",
      "region": "California",
      "country": "US"
    }
  }
}
```

### Artifacts

```json
{
  "artifacts": {
    "enabled": true,
    "maxSize": "20MB",
    "mcpIntegration": true,
    "persistentStorage": true,
    "defaultVisibility": "private"
  }
}
```

## Best Practices by Task

### Complex Debugging

```json
{
  "extendedThinking": { "enabled": true, "budgetTokens": 24000 },
  "webSearch": { "enabled": true },
  "artifacts": { "enabled": true }
}
```

### Quick Code Generation

```json
{
  "extendedThinking": { "enabled": false },
  "webSearch": { "enabled": false },
  "artifacts": { "enabled": true }
}
```

### Research & Documentation

```json
{
  "extendedThinking": { "enabled": true, "budgetTokens": 16000 },
  "webSearch": { "enabled": true, "maxUses": 10 },
  "artifacts": { "enabled": true, "mcpIntegration": true }
}
```

### Architecture Design

```json
{
  "extendedThinking": { "enabled": true, "budgetTokens": 31999 },
  "webSearch": { "enabled": true },
  "artifacts": { "enabled": true }
}
```

## Auto-Enable Rules

Configure automatic capability enabling based on task detection:

```json
{
  "autoEnable": {
    "extendedThinking": {
      "triggers": [
        "debug",
        "optimize",
        "architecture",
        "algorithm",
        "complex",
        "analyze"
      ],
      "minComplexity": "medium"
    },
    "webSearch": {
      "triggers": [
        "latest",
        "current",
        "documentation",
        "api reference",
        "how to"
      ]
    }
  }
}
```

## API Configuration

### Extended Thinking API

```python
response = client.messages.create(
    model="claude-sonnet-4-5-20250929",
    max_tokens=16000,
    thinking={
        "type": "enabled",
        "budget_tokens": 10000
    },
    messages=[...]
)
```

### Web Search API

```python
response = client.messages.create(
    model="claude-sonnet-4-5-20250929",
    max_tokens=4096,
    tools=[{
        "type": "web_search_20250305",
        "name": "web_search",
        "max_uses": 5,
        "allowed_domains": ["docs.example.com"],
        "user_location": {
            "type": "approximate",
            "city": "San Francisco",
            "region": "California",
            "country": "US"
        }
    }],
    messages=[...]
)
```

### Skills API (Beta)

```python
response = client.messages.create(
    model="claude-sonnet-4-5-20250929",
    max_tokens=16000,
    betas=[
        "code-execution-2025-08-25",
        "skills-2025-10-02",
        "files-api-2025-04-14"
    ],
    messages=[...]
)
```

## Environment Variables (Claude Code)

```bash
# Extended thinking budget
export MAX_THINKING_TOKENS=16000

# Enable verbose thinking display
# Use Ctrl+O in Claude Code

# Container reuse for session persistence
export CLAUDE_CONTAINER_ID=<container-id>
```

## Troubleshooting

| Issue                   | Solution                                |
| ----------------------- | --------------------------------------- |
| Thinking not activating | Verify model supports it (Claude 4+)    |
| Search blocked          | Check domain filters                    |
| Artifacts failing       | Verify plan supports persistent storage |
| Skills not loading      | Check beta headers in API calls         |
| MCP not connecting      | Verify server authentication            |
