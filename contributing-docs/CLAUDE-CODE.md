# Claude Code Contributing Guide - jade-dev-assist

## Project Overview

jade-dev-assist is a JavaScript Claude Code plugin that serves as the central orchestrator for the jade ecosystem. It coordinates between the CLI, semantic search, MCP tools, and AI processing to provide intelligent development assistance.

## Technology Stack

- **Language**: JavaScript (ES modules)
- **Runtime**: Node.js
- **Framework**: Claude Code plugin system
- **Testing**: Node.js test runner or Jest

## Key Directory Structure

| Directory   | Purpose                            |
| ----------- | ---------------------------------- |
| `commands/` | CLI command handlers               |
| `skills/`   | Reusable skill definitions         |
| `agents/`   | Agent configurations and behaviors |
| `lib/`      | Core utility modules               |

## Core Modules in lib/

| Module       | Purpose                                 |
| ------------ | --------------------------------------- |
| `scanner`    | Scans codebase for relevant context     |
| `scorer`     | Ranks and scores search results         |
| `presenter`  | Formats output for display              |
| `dispatcher` | Routes requests to appropriate handlers |

## Development Workflow

### Setup

```bash
npm install
```

### Plugin Validation

**Always validate before committing:**

```bash
node scripts/validate-plugin.js .
```

This checks:

- Required file structure
- Export formats
- Command definitions
- Skill configurations

### Running Tests

```bash
npm test                          # All tests
npm run test:unit                 # Unit tests
npm run test:integration          # Integration tests
```

### Code Style

```bash
npm run lint                      # ESLint
npm run lint:fix                  # Auto-fix
```

## Architecture Patterns

### Command Structure

```javascript
// commands/assist.js
export const name = 'assist';
export const description = 'Get AI development assistance';

export async function handler(args, context) {
  const results = await context.scanner.scan(args.query);
  const scored = context.scorer.rank(results);
  return context.presenter.format(scored);
}
```

### Skill Definition

```javascript
// skills/code-review.js
export const name = 'code-review';
export const description = 'Review code for issues';

export const steps = [
  { action: 'scan', target: 'modified-files' },
  { action: 'analyze', using: 'review-rules' },
  { action: 'present', format: 'markdown' },
];
```

### Agent Configuration

```javascript
// agents/assistant.js
export const name = 'assistant';
export const skills = ['code-review', 'explain', 'refactor'];
export const tools = ['jade-index', 'file-system'];
```

## Core Module Patterns

### Scanner

```javascript
// lib/scanner.js
export async function scan(query, options = {}) {
  // 1. Parse query intent
  // 2. Search jade-index for semantic matches
  // 3. Search file system for exact matches
  // 4. Combine and deduplicate results
  return results;
}
```

### Scorer

```javascript
// lib/scorer.js
export function rank(results, criteria = defaultCriteria) {
  return results
    .map((r) => ({ ...r, score: calculateScore(r, criteria) }))
    .sort((a, b) => b.score - a.score);
}
```

### Presenter

```javascript
// lib/presenter.js
export function format(results, format = 'markdown') {
  switch (format) {
    case 'markdown':
      return formatMarkdown(results);
    case 'json':
      return formatJson(results);
    case 'terminal':
      return formatTerminal(results);
  }
}
```

### Dispatcher

```javascript
// lib/dispatcher.js
export async function dispatch(request) {
  const handler = resolveHandler(request.type);
  const context = buildContext(request);
  return handler(request.args, context);
}
```

## Common Tasks

### Adding a New Command

1. Create command file in `commands/`
2. Export `name`, `description`, `handler`
3. Write tests for handler logic
4. Validate plugin: `node scripts/validate-plugin.js .`

### Adding a New Skill

1. Create skill file in `skills/`
2. Define skill steps and configuration
3. Register with relevant agents
4. Write tests for skill execution
5. Validate plugin

### Modifying Core Modules

1. Write tests for new behavior
2. Implement in `lib/` module
3. Update dependent commands/skills
4. Run full test suite
5. Validate plugin

## Plugin Validation

The validation script checks:

```bash
node scripts/validate-plugin.js .
```

**Required Structure:**

- `commands/` - At least one valid command
- `skills/` - Skill definitions (optional)
- `agents/` - Agent configurations (optional)
- `lib/` - Core modules

**Command Requirements:**

- `name` - String export
- `description` - String export
- `handler` - Async function export

## Conventions

- Use ES modules (import/export)
- Async/await for all I/O operations
- Dependency injection via context
- Clear separation of concerns
- Document public APIs with JSDoc

## Ecosystem Context

jade-dev-assist is the **central orchestrator** for the jade ecosystem:

```
jade-dev-assist (this project)
    |
    +-- receives commands from --> jade-cli
    |
    +-- uses semantic search from --> jade-index
    |
    +-- uses MCP tools from --> claude-objects
    |
    +-- integrates with --> jade-ide (via shared protocols)
```

### Integration Points

| Project        | Integration                              |
| -------------- | ---------------------------------------- |
| jade-cli       | Command dispatch and response formatting |
| jade-index     | Semantic code search via API             |
| claude-objects | MCP tool invocation                      |
| jade-ide       | Shared context and protocols             |

### Orchestration Flow

```
User Request (jade-cli)
       |
       v
jade-dev-assist (dispatcher)
       |
       +---> Scanner (jade-index)
       |
       +---> MCP Tools (claude-objects)
       |
       v
   Scorer + Presenter
       |
       v
Response (jade-cli)
```

When making changes, consider impact on:

- **jade-cli**: Response formats and latency
- **jade-index**: Query patterns and result handling
- **claude-objects**: Tool invocation protocols
