---
name: jade:scan
description: Quality gate checker - run linter, type checker, and tests
argument-hint: "[all | lint | types | test] [--fix]"
allowed-tools: [Read, Bash, Glob, Grep]
---

# Quality Gate Scanner

Run code quality checks including linter, type checker, and tests. Automatically detects project type (Python, Node.js, TypeScript) and uses the appropriate tools.

## Usage

```bash
/jade:scan [check] [options]
```

## Checks

| Check | Description | Python | Node.js |
|-------|-------------|--------|---------|
| `all` | (Default) Run all checks | ruff + ty + pytest | eslint + tsc + npm test |
| `lint` | Run linter only | ruff check | eslint |
| `types` | Run type checker only | ty check | tsc --noEmit |
| `test` | Run tests only | pytest | npm test |

## Options

| Option | Description |
|--------|-------------|
| `--fix` | Auto-fix linter issues where possible |
| `--verbose` | Show detailed output |
| `--fail-fast` | Stop on first failure |

## Examples

### Run All Quality Checks

```bash
/jade:scan
```

Output:
```
=== Quality Gate Report ===

Project Type: Python

## Linter (ruff)
  + Passed
    Warnings: 2

## Type Checker (ty)
  + Passed
    Errors: 0

## Tests (pytest)
  + Passed
    Collected 47 tests
    47 passed in 3.21s

Overall Status: PASSED
```

### Run With Auto-Fix

```bash
/jade:scan lint --fix
```

Runs the linter with auto-fix enabled:
- Python: `ruff check --fix .`
- Node.js: `eslint --fix .`

### Run Tests Only

```bash
/jade:scan test
```

Runs tests using the project's test framework:
- Python: `pytest` or `uv run pytest`
- Node.js: `npm test`

### Verbose Output

```bash
/jade:scan --verbose
```

Shows full command output instead of summary.

## Project Detection

The scanner automatically detects the project type by looking for:

| File | Project Type |
|------|--------------|
| `pyproject.toml` | Python |
| `requirements.txt` | Python |
| `setup.py` | Python |
| `package.json` | Node.js |
| `tsconfig.json` | TypeScript |
| `go.mod` | Go |
| `Cargo.toml` | Rust |

## Tool Configuration

### Python Projects

Uses the jadecli toolchain:
- **Linter**: `ruff` (configured in `pyproject.toml` or `ruff.toml`)
- **Type Checker**: `ty` (configured in `ty.toml`)
- **Tests**: `pytest` (configured in `pytest.ini` or `pyproject.toml`)

### Node.js Projects

Uses standard Node.js tools:
- **Linter**: `eslint` (configured in `eslint.config.js` or `.eslintrc`)
- **Type Checker**: `tsc` for TypeScript projects
- **Tests**: `npm test` (configured in `package.json`)

## Integration

This command uses `lib/quality-gate.js`:

```javascript
const { runQualityGate, formatQualityReport } = require('../lib/quality-gate');

// Run all quality checks
const results = await runQualityGate(process.cwd());
console.log(formatQualityReport(results));

// Exit with appropriate code
process.exit(results.overallPassed ? 0 : 1);
```

## Pre-Commit Hook

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
/jade:scan --fail-fast || exit 1
```

Or use the hooks configuration:

```json
{
  "hooks": {
    "pre-commit": {
      "run": ["jade:scan"],
      "failFast": true
    }
  }
}
```

## Configuration

```json
{
  "scan": {
    "linter": {
      "enabled": true,
      "fix": false
    },
    "typeChecker": {
      "enabled": true
    },
    "tests": {
      "enabled": true,
      "coverage": true
    },
    "failFast": false
  }
}
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed |
| 1 | One or more checks failed |
| 2 | Configuration error |

## Related Commands

- `/jade:status` - Overall ecosystem health
- `/jade:validate` - Pre-commit validation
- `/jade:metrics` - Code metrics and coverage
