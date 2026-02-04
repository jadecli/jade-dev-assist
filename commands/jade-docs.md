---
name: jade:docs
description: Search and load documentation from jadecli-codespaces. Fast, cached doc lookups with keyword search.
argument-hint: "[search|load|list|context] [query|doc-name|task-id]"
allowed-tools: [Read, Bash]
---

# Command: /jade:docs

Search and load documentation from jadecli-codespaces project.

## Usage

```
/jade:docs search "keyword"     # Search docs by keyword
/jade:docs load "uv"            # Load specific doc summary
/jade:docs list                 # List all available docs
/jade:docs context task-id      # Get docs relevant to a task
```

## Examples

Search for documentation about Python package management:
```
/jade:docs search "package manager"
```

Load the uv package manager documentation:
```
/jade:docs load uv
```

List all available documentation summaries:
```
/jade:docs list
```

Get documentation context for a specific task:
```
/jade:docs context implement-scanner
```

## Features

- **Fast Searching**: Case-insensitive keyword search across doc titles, descriptions, and keywords
- **Caching**: Summaries cached in memory for fast subsequent lookups
- **Token-Aware**: Tracks token usage to optimize prompt injection
- **Smart Ranking**: Results ranked by relevance (keywords > title > description > content)
- **Auto-Discovery**: Automatically finds all available doc summaries

## Returns

### Search Results
```json
{
  "results": [
    {
      "title": "uv Package Manager",
      "description": "Fast Python package installer and resolver",
      "keywords": ["python", "package", "pip", "installer"],
      "summary": "uv is a blazingly fast Python package installer written in Rust.",
      "tokens": 42
    }
  ],
  "count": 1,
  "tokens": 42
}
```

### List Results
```json
{
  "summaries": [
    {
      "title": "uv Package Manager",
      "description": "Fast Python package installer and resolver"
    },
    {
      "title": "ruff Linter",
      "description": "Fast Python linter written in Rust"
    }
  ],
  "count": 2
}
```

## Integration with Worker Prompts

The `/jade:docs` command is automatically used by the `doc-context-loader` skill to inject relevant documentation into worker agent prompts. This ensures agents have access to accurate, up-to-date documentation without manual lookup.

## Performance

- **Load time**: <100ms for any summary (from cache)
- **Search time**: O(n) where n = number of available docs
- **Cache size**: Minimal (typically <50KB for all summaries)

## See Also

- `skill doc-context-loader` - Automatically loads relevant docs for tasks
- `lib doc-loader.js` - Core documentation loading and searching
