---
name: jade:styles
description: Manage and apply response styles for different development contexts
argument-hint: '[--list | --apply <style> | --create <name>]'
allowed-tools: [Read, Write, Bash]
---

# Manage Response Styles

## Usage

```bash
/jade:styles [options]
```

## Options

| Flag                | Description                           |
| ------------------- | ------------------------------------- |
| `--list`            | List all available styles             |
| `--apply <style>`   | Apply a style to current conversation |
| `--create <name>`   | Create a new custom style             |
| `--edit <style>`    | Edit an existing style                |
| `--delete <style>`  | Delete a custom style                 |
| `--preview <style>` | Preview style with sample output      |
| `--once`            | Apply style for next message only     |

## Built-in Styles

### Claude Defaults

- `normal` - Balanced responses
- `concise` - Shorter, direct
- `formal` - Professional, polished
- `explanatory` - Educational, detailed

### IDE Optimized

- `developer-concise` - Code-first, minimal prose
- `code-review` - Structured PR feedback
- `debugging` - Step-by-step analysis
- `documentation` - Clean API docs
- `refactoring` - Before/after comparisons
- `architecture` - System design with diagrams

## Examples

### List Styles

```bash
/jade:styles --list
```

### Apply Style

```bash
# Apply for entire conversation
/jade:styles --apply developer-concise

# Apply for next message only
/jade:styles --apply code-review --once
```

### Create Custom Style

```bash
# From description
/jade:styles --create my-style --description "Technical but friendly"

# From sample file
/jade:styles --create my-style --sample ./writing-sample.md

# Interactive
/jade:styles --create --interactive
```

### Preview Style

```bash
/jade:styles --preview debugging
```

## Style File Format

```yaml
---
name: my-custom-style
description: Brief description for selection menu
basedOn: concise # Optional base style
tags: [development, technical]
---
# Style Instructions

## Core Principles
- [Key behaviors]

## Format
- [Output structure]

## Avoid
- [Things to not do]
```

## Style Locations

| Scope    | Path                       | Priority |
| -------- | -------------------------- | -------- |
| Built-in | Plugin defaults            | Lowest   |
| User     | `~/.claude/output-styles/` | Medium   |
| Project  | `.claude/styles/`          | Highest  |
