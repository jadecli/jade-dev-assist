---
name: jade:config
description: Configure personalization settings interactively or via flags
argument-hint: '[--show | --set key=value | --interactive]'
allowed-tools: [Read, Write, Bash]
---

# Configure JADE-DEV-ASSIST Settings

## Usage

```bash
/jade:config [options]
```

## Options

| Flag              | Description                             |
| ----------------- | --------------------------------------- |
| `--show`          | Display current configuration           |
| `--set key=value` | Set a specific configuration value      |
| `--interactive`   | Launch interactive configuration wizard |
| `--init`          | Initialize configuration files          |
| `--reset`         | Reset to default settings               |
| `--export`        | Export configuration to JSON            |
| `--import <file>` | Import configuration from JSON          |

## Configuration Keys

### Personalization

| Key                | Type   | Default                   | Description                   |
| ------------------ | ------ | ------------------------- | ----------------------------- |
| `profile.path`     | string | `~/.claude/CLAUDE.md`     | Global profile location       |
| `project.path`     | string | `.claude/CLAUDE.md`       | Project instructions location |
| `styles.directory` | string | `~/.claude/output-styles` | Styles directory              |

### Capabilities

| Key                 | Type    | Default | Description               |
| ------------------- | ------- | ------- | ------------------------- |
| `thinking.enabled`  | boolean | `true`  | Enable extended thinking  |
| `thinking.budget`   | number  | `16000` | Token budget (1024-31999) |
| `webSearch.enabled` | boolean | `true`  | Enable web search         |
| `artifacts.enabled` | boolean | `true`  | Enable artifacts          |
| `skills.enabled`    | boolean | `true`  | Enable skills             |

### Workflow

| Key                   | Type    | Default       | Description                    |
| --------------------- | ------- | ------------- | ------------------------------ |
| `workflow.style`      | string  | `superpowers` | Default workflow methodology   |
| `workflow.tdd`        | boolean | `true`        | Enforce TDD                    |
| `workflow.autoCommit` | boolean | `false`       | Auto-commit on task completion |

## Examples

### View Current Configuration

```bash
/jade:config --show
```

Output:

```yaml
personalization:
  profile: ~/.claude/CLAUDE.md
  project: .claude/CLAUDE.md (exists)
  styles: ~/.claude/output-styles (3 styles)

capabilities:
  extendedThinking: enabled (budget: 16000)
  webSearch: enabled
  artifacts: enabled
  skills: enabled (5 active)

workflow:
  style: superpowers
  tdd: enforced
  autoCommit: disabled
```

### Set Specific Value

```bash
# Set thinking budget
/jade:config --set thinking.budget=24000

# Disable web search
/jade:config --set webSearch.enabled=false

# Change workflow style
/jade:config --set workflow.style=gsd
```

### Interactive Configuration

```bash
/jade:config --interactive
```

Launches a step-by-step wizard:

1. Profile preferences
2. Capability toggles
3. Workflow settings
4. Style preferences
5. Review and confirm

### Export/Import

```bash
# Export current settings
/jade:config --export > my-settings.json

# Import settings
/jade:config --import my-settings.json
```

## Configuration File Locations

| File                          | Purpose                  |
| ----------------------------- | ------------------------ |
| `~/.claude/settings.json`     | Global settings          |
| `.claude/settings.local.json` | Project overrides        |
| `~/.jade/config.json`         | Plugin-specific settings |

## Validation

Configuration changes are validated before applying:

- Type checking (boolean, number, string)
- Range validation (e.g., budget 1024-31999)
- Path existence checks
- Permission verification
