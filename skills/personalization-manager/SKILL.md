---
name: personalization-manager
description: Manage Claude's three-tier personalization architecture for profile preferences, project instructions, and response styles
dependencies: []
---

# Personalization Manager Skill

## Overview

This skill manages Claude's three-tier personalization system:

1. **Profile Preferences** - Account-wide settings (`~/.claude/CLAUDE.md`)
2. **Project Instructions** - Workspace-scoped context (`.claude/CLAUDE.md`)
3. **Response Styles** - Per-conversation formatting (`~/.claude/output-styles/`)

## Capabilities

### Profile Preference Management

- Read and update global CLAUDE.md
- Manage settings.json configuration
- Sync preferences across environments

### Project Instruction Management

- Initialize project-level CLAUDE.md
- Merge global and project configurations
- Handle tech stack detection

### Style Management

- List available styles (built-in + custom)
- Apply styles to conversations
- Create custom styles from samples or descriptions

## Usage

### Initialize Personalization

```bash
/jade:config --init
```

This will:

1. Check for existing `~/.claude/CLAUDE.md`
2. Create if missing with default template
3. Detect project context
4. Initialize `.claude/CLAUDE.md` if in a project

### View Current Configuration

```bash
/jade:config --show
```

Displays:

- Active profile preferences
- Project instructions (if any)
- Current style
- Capability toggles

### Update Preferences

```bash
# Interactive mode
/jade:config --interactive

# Direct update
/jade:config --set thinking.budget=16000
/jade:config --set webSearch.enabled=true
```

## Configuration Schema

### Profile Preferences (~/.claude/CLAUDE.md)

```markdown
# Developer Profile

## About Me

- [Your role and experience]
- [Preferred languages/frameworks]
- [Coding style preferences]

## Preferences

- [General preferences that apply everywhere]

## Communication

- [How you prefer Claude to respond]
```

### Project Instructions (.claude/CLAUDE.md)

```markdown
# Project Context

## Overview

[Project description]

## Tech Stack

- [Languages]
- [Frameworks]
- [Tools]

## Conventions

[Project-specific coding standards]

## Important Files

- [Key files Claude should know about]
```

### Settings JSON (~/.claude/settings.json)

```json
{
  "personalization": {
    "profilePath": "~/.claude/CLAUDE.md",
    "projectPath": ".claude/CLAUDE.md"
  },
  "capabilities": {
    "extendedThinking": {
      "enabled": true,
      "budgetTokens": 16000
    },
    "webSearch": {
      "enabled": true,
      "allowedDomains": [],
      "blockedDomains": []
    },
    "artifacts": {
      "enabled": true,
      "mcpIntegration": true
    }
  },
  "styles": {
    "default": "normal",
    "directory": "~/.claude/output-styles"
  }
}
```

## Templates

### Minimal Profile

```markdown
# Developer Profile

## Preferences

- Prefer concise, code-first responses
- Use modern JavaScript/TypeScript patterns
- Follow standard formatting conventions
```

### Full Profile

```markdown
# Developer Profile

## About Me

I'm a senior full-stack developer specializing in TypeScript, React, and Node.js.
I have 10+ years of experience and prefer functional programming patterns.

## Technical Preferences

- **Languages**: TypeScript, Python, Go
- **Frontend**: React, Next.js, Tailwind CSS
- **Backend**: Node.js, PostgreSQL, Redis
- **Tools**: Git, Docker, VS Code

## Coding Style

- Always use async/await over .then()
- Prefer named exports over default exports
- Use descriptive variable names (no single letters except loops)
- Maximum function length: 50 lines
- Always include TypeScript types (no `any`)

## Communication Preferences

- Provide code first, explanations second
- Use minimal comments in code
- Show full file paths in code blocks
- Include test examples when relevant

## Common Tasks

- Code review and refactoring
- API design and implementation
- Database schema design
- Performance optimization
```

## Error Handling

| Error                       | Resolution                       |
| --------------------------- | -------------------------------- |
| Missing ~/.claude directory | Create with `mkdir -p ~/.claude` |
| Invalid CLAUDE.md syntax    | Validate markdown structure      |
| Conflicting settings        | Project settings override global |
| Permission denied           | Check file permissions           |

## Best Practices

1. **Keep profiles focused** - Don't include project-specific details in global profile
2. **Use project instructions** - Put repo context in `.claude/CLAUDE.md`
3. **Review periodically** - Update preferences as your workflow evolves
4. **Backup configurations** - Include `.claude/` in version control (except secrets)
