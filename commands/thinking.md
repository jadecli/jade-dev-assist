---
name: jade:thinking
description: Configure extended thinking mode and token budgets
argument-hint: '[--enable | --disable | --budget <tokens>]'
allowed-tools: [Read, Write]
---

# Configure Extended Thinking

## Usage

```bash
/jade:thinking [options]
```

## Options

| Flag           | Description                             |
| -------------- | --------------------------------------- |
| `--enable`     | Enable extended thinking                |
| `--disable`    | Disable extended thinking               |
| `--budget <n>` | Set token budget (1024-31999)           |
| `--status`     | Show current thinking configuration     |
| `--auto`       | Enable auto-detection for complex tasks |

## Token Budget Guidelines

| Budget        | Use Case                          |
| ------------- | --------------------------------- |
| `1024-4000`   | Simple analysis, quick reasoning  |
| `4000-8000`   | Moderate complexity, debugging    |
| `8000-16000`  | Complex problems, architecture    |
| `16000-24000` | Deep analysis, competition coding |
| `24000-31999` | Maximum depth, formal proofs      |

## Examples

### Enable with Default Budget

```bash
/jade:thinking --enable
# Enables with 16000 token budget
```

### Set Custom Budget

```bash
/jade:thinking --budget 24000
```

### Check Status

```bash
/jade:thinking --status
```

Output:

```
🧠 Extended Thinking Configuration

Status: ENABLED
Budget: 16000 tokens
Auto-detect: ON

Recommended for current model (Claude Sonnet 4.5):
- Minimum: 1,024 tokens
- Maximum: 31,999 tokens
- Suggested: 10,000-16,000 tokens

Press Ctrl+O in Claude Code to view thinking in real-time.
```

### Auto-Detection Mode

```bash
/jade:thinking --auto
```

Automatically enables extended thinking when detecting:

- "debug", "optimize", "analyze" keywords
- Complex algorithms or data structures
- Architecture and design discussions
- Mathematical or logical problems

## Best Practices

**Use Extended Thinking For:**

- Mathematical proofs
- Competition-level coding
- Complex debugging
- System architecture design
- Multi-step analysis

**Avoid For:**

- Simple questions
- Basic code generation
- Quick lookups
- Conversational responses

## API Configuration

When using the API directly:

```python
thinking={
    "type": "enabled",
    "budget_tokens": 16000
}
```

## Environment Variable

```bash
export MAX_THINKING_TOKENS=16000
```
