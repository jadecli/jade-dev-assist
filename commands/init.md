---
name: jade:init
description: Initialize JADE-DEV-ASSIST in a project with optional template
argument-hint: "[project-name] [--template <template>]"
allowed-tools: [Read, Write, Bash, Glob, Grep]
---

# Initialize JADE-DEV-ASSIST

## Usage

```bash
/jade:init [project-name] [options]
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `--template` | Project template | `basic` |
| `--workflow` | Workflow style | `superpowers` |
| `--no-global` | Skip global config check | `false` |
| `--force` | Overwrite existing files | `false` |

## Templates

| Template | Description |
|----------|-------------|
| `basic` | Minimal setup with core configs |
| `typescript-react` | Next.js/React with TypeScript |
| `typescript-node` | Node.js backend with TypeScript |
| `python-fastapi` | FastAPI with modern Python |
| `python-django` | Django with best practices |
| `go-api` | Go API with standard layout |
| `rust-cli` | Rust CLI application |
| `full` | All features enabled |

## Execution Steps

### 1. Check Global Configuration

```bash
# Verify ~/.claude exists
if [ ! -d ~/.claude ]; then
  mkdir -p ~/.claude
  echo "Created ~/.claude directory"
fi

# Check for global CLAUDE.md
if [ ! -f ~/.claude/CLAUDE.md ]; then
  # Prompt to create or skip
fi
```

### 2. Create Project Structure

```
.claude/
├── CLAUDE.md              # Project instructions
├── settings.local.json    # Project-specific settings
├── styles/                # Project-specific styles
│   └── .gitkeep
└── skills/                # Project-specific skills
    └── .gitkeep
```

### 3. Generate CLAUDE.md

Based on template and detected context:

```markdown
# Project: {project-name}

## Overview
[Auto-generated based on template and detected files]

## Tech Stack
[Detected from package.json, requirements.txt, go.mod, etc.]

## Conventions
[Template-specific conventions]

## Important Files
[Key files Claude should reference]

## Development Workflow
[Based on --workflow flag]
```

### 4. Create Settings

```json
{
  "jade": {
    "version": "1.0.0",
    "template": "{template}",
    "workflow": "{workflow}"
  },
  "personalization": {
    "inheritGlobal": true
  },
  "capabilities": {
    "extendedThinking": {
      "enabled": true,
      "budgetTokens": 16000
    },
    "webSearch": {
      "enabled": true
    },
    "artifacts": {
      "enabled": true
    }
  }
}
```

### 5. Detect Existing Context

Scan for and incorporate:
- `package.json` → Node.js dependencies
- `requirements.txt` / `pyproject.toml` → Python dependencies
- `go.mod` → Go modules
- `Cargo.toml` → Rust crates
- `README.md` → Project description
- `.github/` → CI/CD context
- `docker-compose.yml` → Services

### 6. Display Summary

```
✅ JADE-DEV-ASSIST initialized in ./my-project

📁 Created files:
   .claude/CLAUDE.md
   .claude/settings.local.json
   .claude/styles/
   .claude/skills/

📋 Template: typescript-react
🔄 Workflow: superpowers

🚀 Next steps:
   1. Review .claude/CLAUDE.md and customize
   2. Run /jade:config to adjust settings
   3. Start developing with /jade:plan
```

## Template Details

### typescript-react

```markdown
## Tech Stack
- Framework: Next.js 14+ with App Router
- Language: TypeScript 5.x (strict mode)
- Styling: Tailwind CSS
- State: React hooks + Context (or Zustand)
- Testing: Jest + React Testing Library
- Linting: ESLint + Prettier

## Conventions
- Components: PascalCase, one component per file
- Hooks: useXxx naming, custom hooks in /hooks
- Types: Explicit types, no `any`
- Imports: Absolute paths with @/ alias
- Tests: Co-located .test.tsx files

## File Structure
```
src/
├── app/           # Next.js app router
├── components/    # Reusable UI components
├── hooks/         # Custom React hooks
├── lib/           # Utilities and helpers
├── types/         # TypeScript type definitions
└── styles/        # Global styles
```
```

### python-fastapi

```markdown
## Tech Stack
- Framework: FastAPI
- Language: Python 3.11+
- Database: SQLAlchemy + Alembic
- Validation: Pydantic v2
- Testing: pytest + httpx
- Linting: ruff + mypy

## Conventions
- Endpoints: snake_case, grouped by resource
- Models: Pydantic for API, SQLAlchemy for DB
- Dependencies: Dependency injection via FastAPI
- Async: Use async where I/O bound

## File Structure
```
app/
├── api/           # Route handlers
├── core/          # Config, security
├── db/            # Database models
├── schemas/       # Pydantic schemas
├── services/      # Business logic
└── tests/         # Test files
```
```

## Error Handling

| Error | Resolution |
|-------|------------|
| `.claude/` exists | Use `--force` to overwrite |
| Invalid template | Show available templates |
| Detection failed | Fallback to basic template |
| Permission denied | Check directory permissions |
