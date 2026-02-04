# JADE-DEV-ASSIST

> Advanced Claude Code Plugin for JADE-IDE Development Workflow Management

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Claude Code Plugin](https://img.shields.io/badge/Claude%20Code-Plugin-orange)](https://code.claude.com/docs/plugins)
[![Version](https://img.shields.io/badge/version-1.1.0-green)](CHANGELOG.md)
[![codecov](https://codecov.io/gh/jadecli/jade-dev-assist/branch/main/graph/badge.svg)](https://codecov.io/gh/jadecli/jade-dev-assist)
[![Coverage](https://img.shields.io/badge/coverage-79.5%25-yellow.svg)](./coverage/index.html)

## Overview

JADE-DEV-ASSIST is a comprehensive Claude Code plugin that helps developers manage Claude configurations within their development workflows. It implements Claude's **three-tier personalization architecture** and provides tools for managing styles, capabilities, skills, and project-specific configurations.

### Key Features

- **Three-Tier Personalization**: Profile preferences, project instructions, and response styles
- **Capability Management**: Toggle extended thinking, web search, research, and artifacts
- **Skills System**: Create, manage, and distribute custom skills following the Agent Skills specification
- **Style Presets**: IDE-optimized styles for code review, documentation, debugging, and more
- **Workflow Integration**: Inspired by Superpowers, GSD, and Ralph methodologies
- **Project Templates**: Quick-start configurations for common tech stacks

## Installation

### Via Claude Code Plugin Marketplace

```bash
# Register the marketplace (if not already registered)
/plugin marketplace add jadecli/jade-dev-assist-marketplace

# Install the plugin
/plugin install jade-dev-assist@jade-dev-assist-marketplace
```

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/jadecli/jade-dev-assist.git

# Install locally
claude plugin install ./jade-dev-assist --scope user
```

## Quick Start

```bash
# View live dashboard of all jadecli ecosystem tasks
jade-dashboard

# Initialize a new project with JADE-DEV-ASSIST
/jade:init my-project --template typescript-react

# Configure your preferences
/jade:config --interactive

# Sync your styles
/jade:styles --apply developer-concise

# Enable extended thinking for complex tasks
/jade:thinking --enable --budget 16000
```

## Anthropic-Style Workflow

Following Anthropic's build-first philosophy:

### 1. Tasks Seed Automatically

Swarm agents seed tasks into `.claude/tasks/tasks.json`

### 2. Create GitHub Issues

```bash
node scripts/create-issues-from-tasks.js [repo-name]
```

### 3. Tag @claude When Ready

Add comment to issue: `@claude please implement this`

### 4. Claude Creates PR

Claude analyzes, implements, runs tests, creates PR

### 5. Review & Merge

Quick review, merge, done

See `docs/guides/anthropic-workflow.md` for details.

## Architecture

### Three-Tier Personalization

```
┌─────────────────────────────────────────────────────────────┐
│                    PROFILE PREFERENCES                       │
│  ~/.claude/settings.json | ~/.claude/CLAUDE.md              │
│  Account-wide: Language, coding style, global context       │
├─────────────────────────────────────────────────────────────┤
│                   PROJECT INSTRUCTIONS                       │
│  .claude/CLAUDE.md | .claude/settings.local.json            │
│  Workspace-scoped: Tech stack, team standards, repo context │
├─────────────────────────────────────────────────────────────┤
│                     RESPONSE STYLES                          │
│  ~/.claude/output-styles/ | .claude/styles/                 │
│  Per-conversation: Verbosity, format, code conventions      │
└─────────────────────────────────────────────────────────────┘
```

### Capability Toggles

| Capability        | Description                         | Token Impact           |
| ----------------- | ----------------------------------- | ---------------------- |
| Extended Thinking | Deep reasoning for complex problems | 1,024–31,999 tokens    |
| Web Search        | Real-time information retrieval     | 1-2 tool calls         |
| Research          | Comprehensive multi-source analysis | 5+ tool calls, 1-3 min |
| Artifacts         | Persistent, shareable outputs       | 20MB storage limit     |
| Skills            | Dynamic capability loading          | Varies by skill        |

## Commands

### Core Configuration

| Command          | Description                             |
| ---------------- | --------------------------------------- |
| `/jade:init`     | Initialize JADE-DEV-ASSIST in a project |
| `/jade:config`   | Configure personalization settings      |
| `/jade:styles`   | Manage and apply response styles        |
| `/jade:thinking` | Configure extended thinking             |

### Boris Cherny's Top 10 Tips (Built-in)

| #   | Tip                    | Command                                |
| --- | ---------------------- | -------------------------------------- |
| 1   | Do more in parallel    | `/jade:worktree`                       |
| 2   | Start in plan mode     | `/jade:plan`                           |
| 3   | Invest in CLAUDE.md    | `/jade:learn`                          |
| 4   | Create your own skills | `/jade:techdebt`, `/jade:context-sync` |
| 5   | Claude fixes bugs      | `/jade:fix`                            |
| 6   | Level up prompting     | `/jade:review grill\|prove\|refine`    |
| 7   | Terminal setup         | Ghostty + `/statusline`                |
| 8   | Use subagents          | `/jade:subagent`                       |
| 9   | Data & analytics       | `/jade:query`                          |
| 10  | Learning mode          | `/jade:explain`                        |

### Full Command Reference

| Command              | Description                                            |
| -------------------- | ------------------------------------------------------ |
| `/jade:worktree`     | Manage 3-5 parallel git worktrees with Claude sessions |
| `/jade:plan`         | Plan mode for complex tasks (Shift+Tab to toggle)      |
| `/jade:learn`        | Add rules to CLAUDE.md from mistakes                   |
| `/jade:techdebt`     | Find duplicated code - run at end of every session     |
| `/jade:fix`          | Autonomous bug fixing from Slack, CI, logs             |
| `/jade:review`       | Grill mode, prove it works, request elegance           |
| `/jade:subagent`     | Throw more compute at problems                         |
| `/jade:context-sync` | Sync 7 days of Slack/GDrive/Asana/GitHub               |
| `/jade:query`        | Natural language to SQL - no more writing queries      |
| `/jade:explain`      | Learning mode with slides, diagrams, quizzes           |

## Skills

JADE-DEV-ASSIST includes built-in skills and supports custom skill creation:

### Built-in Skills

- **roadmap-updater**: Parse research, generate roadmaps, track progress
- **ide-scaffold**: Create repository structures, extensions, CI/CD
- **extension-integrator**: Manage third-party extension bundling
- **code-reviewer**: Automated code review with style enforcement
- **doc-generator**: Generate documentation from code

### Creating Custom Skills

```bash
# Create a new skill
/jade:skills create my-skill --template basic

# Skill structure
~/.claude/skills/my-skill/
├── SKILL.md          # Required: Instructions and metadata
├── resources/        # Optional: Supporting files
└── examples/         # Optional: Usage examples
```

See [docs/guides/creating-skills.md](docs/guides/creating-skills.md) for detailed instructions.

## Configuration Files

### Global Configuration (`~/.claude/`)

```
~/.claude/
├── settings.json           # Global settings and toggles
├── CLAUDE.md              # User-level context and preferences
├── output-styles/         # Custom style definitions
│   ├── developer-concise.md
│   ├── code-review.md
│   └── documentation.md
├── skills/                # User-installed skills
└── commands/              # Custom slash commands
```

### Project Configuration (`.claude/`)

```
.claude/
├── CLAUDE.md              # Project-specific instructions
├── settings.local.json    # Project overrides
├── styles/                # Project-specific styles
└── skills/                # Project-specific skills
```

## Workflow Integrations

JADE-DEV-ASSIST incorporates best practices from leading AI development methodologies:

### Superpowers Integration

- Brainstorming before coding
- Subagent-driven development
- TDD enforcement (RED-GREEN-REFACTOR)
- Two-stage code review

### GSD (Get Shit Done) Integration

- Context engineering to prevent context rot
- Structured XML task plans
- Verification loops
- Goal-backward analysis

### Ralph Integration

- Autonomous development loops
- Dual-condition exit gates
- Rate limiting and circuit breakers
- Session continuity

## Development

### Prerequisites

- Node.js 18+
- Claude Code CLI (`npm install -g @anthropic-ai/claude-code`)
- Git

### Setup

```bash
git clone https://github.com/jadecli/jade-dev-assist.git
cd jade-dev-assist
npm install
npm test

# Launch the live task dashboard
bin/jade-dashboard
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Generate HTML coverage report
npm run test:coverage:report

# View coverage report
# Open coverage/index.html in your browser

# Run specific test suite
node tests/test-plugin.js

# Validate plugin structure
node scripts/validate-plugin.js .
```

### Code Formatting

This project uses Prettier for consistent code formatting:

```bash
# Format all files
npm run format

# Check formatting without modifying files
npm run format:check
```

Formatting is automatically checked in the pre-commit hook. If the check fails, run `npm run format` to fix formatting issues.

### Test Coverage

The project maintains test coverage with the following thresholds:

- **Lines**: 79%+
- **Functions**: 80%+
- **Branches**: 73%+
- **Statements**: 79%+

Coverage reports are automatically generated in CI/CD and uploaded to Codecov. View the detailed HTML report locally by running `npm run test:coverage:report` and opening `coverage/index.html`.

## Documentation

- [Personalization Guide](docs/guides/personalization.md)
- [Skills Development](docs/guides/creating-skills.md)
- [Style Configuration](docs/guides/styles.md)
- [Workflow Integration](docs/guides/workflows.md)
- [API Reference](docs/api-reference.md)

### Research References

- [Claude Documentation Summary](docs/research/claude-documentation-summary.md)
- [Superpowers Methodology](docs/research/superpowers-analysis.md)
- [GSD Framework](docs/research/gsd-analysis.md)
- [Ralph Autonomous Loop](docs/research/ralph-analysis.md)
- [Claude Code Tasks System](docs/research/tasks-system-analysis.md)

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Priority Areas

1. **Skills Library**: Expand built-in skills for common workflows
2. **Style Presets**: Create optimized styles for different development contexts
3. **IDE Templates**: Add project templates for popular frameworks
4. **Documentation**: Improve guides and examples
5. **Testing**: Expand test coverage

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Superpowers](https://github.com/obra/superpowers) by Jesse Vincent
- [Get Shit Done](https://github.com/glittercowboy/get-shit-done) by glittercowboy
- [Ralph](https://github.com/frankbria/ralph-claude-code) by Frank Bria
- [Microsoft Prompt Flow](https://github.com/microsoft/promptflow)
- [Claude Code](https://code.claude.com) by Anthropic

---

**Ready to supercharge your Claude Code workflow?** Start with `/jade:init` and let JADE-DEV-ASSIST handle the configuration!
