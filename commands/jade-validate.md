---
name: jade:validate
description: Run quality gates on current directory - pre-commit check
argument-hint: "[--fix] [--strict] [--staged-only]"
allowed-tools: [Read, Bash, Glob, Grep]
---

# Pre-Commit Validation

Runs quality gates on the current directory as a pre-commit check. Detects project language and runs appropriate linters, type checkers, and tests.

## Usage

```bash
/jade:validate [options]
```

## Options

| Flag | Description |
|------|-------------|
| (none) | Run all checks on current directory |
| `--fix` | Auto-fix issues where possible |
| `--strict` | Fail on warnings (not just errors) |
| `--staged-only` | Only check staged files |
| `--skip-tests` | Skip test execution |
| `--quick` | Fast mode: lint only, no tests |

## Language Detection

The command auto-detects the project type by checking for:

| File | Language | Tools |
|------|----------|-------|
| `pyproject.toml` | Python | ruff, ty, pytest |
| `package.json` | Node.js | npm lint, npm test |
| `Cargo.toml` | Rust | cargo clippy, cargo test |
| `docker-compose.yml` | Docker | docker compose config |

## Examples

### Full Validation

```bash
/jade:validate
```

Runs the complete quality gate:

```bash
# Detect project type
if [ -f "pyproject.toml" ]; then
  echo "Detected: Python project"

  # Lint
  echo "Running ruff..."
  ruff check . || exit 1

  # Type check
  echo "Running ty..."
  ty check . || exit 1

  # Tests
  echo "Running pytest..."
  pytest -v || exit 1

elif [ -f "package.json" ]; then
  echo "Detected: Node.js project"

  # Lint (if script exists)
  if jq -e '.scripts.lint' package.json > /dev/null; then
    echo "Running npm lint..."
    npm run lint || exit 1
  fi

  # Type check (if script exists)
  if jq -e '.scripts.typecheck' package.json > /dev/null; then
    echo "Running npm typecheck..."
    npm run typecheck || exit 1
  fi

  # Tests
  echo "Running npm test..."
  npm test || exit 1

elif [ -f "docker-compose.yml" ]; then
  echo "Detected: Docker project"
  docker compose config --quiet && echo "Docker config valid"
fi

echo "All checks passed!"
```

### Auto-Fix Mode

```bash
/jade:validate --fix
```

For Python:
```bash
ruff check --fix .
ruff format .
```

For Node:
```bash
npm run lint -- --fix
npm run format 2>/dev/null || npx prettier --write .
```

### Staged Files Only

```bash
/jade:validate --staged-only
```

Only checks files that are staged for commit:

```bash
# Get staged files
staged=$(git diff --cached --name-only --diff-filter=ACMR)

if [ -f "pyproject.toml" ]; then
  # Filter to Python files
  py_files=$(echo "$staged" | grep '\.py$')
  if [ -n "$py_files" ]; then
    ruff check $py_files
    ty check $py_files
  fi
elif [ -f "package.json" ]; then
  # Filter to JS/TS files
  js_files=$(echo "$staged" | grep -E '\.(js|ts|tsx)$')
  if [ -n "$js_files" ]; then
    npx eslint $js_files
  fi
fi
```

### Quick Mode

```bash
/jade:validate --quick
```

Skips tests, runs lint only:
```bash
if [ -f "pyproject.toml" ]; then
  ruff check .
elif [ -f "package.json" ]; then
  npm run lint
fi
```

### Strict Mode

```bash
/jade:validate --strict
```

Treats warnings as errors:
```bash
ruff check . --exit-non-zero-on-fix
npm run lint -- --max-warnings 0
```

## Output Format

```
Pre-Commit Validation
=====================

Project: jade-dev-assist (javascript)

Lint Check
  npm run lint... PASS (2 warnings)

Tests
  npm test... PASS (12 tests, 0 failures)

Summary
  Status: PASS
  Duration: 4.2s
  Warnings: 2
  Errors: 0
```

### On Failure

```
Pre-Commit Validation
=====================

Project: jade-index (python)

Lint Check
  ruff check... FAIL
    src/embedder.py:42:5 E501 Line too long (142 > 120)
    src/embedder.py:87:1 W291 Trailing whitespace

Type Check
  ty check... PASS

Tests
  Skipped (lint failed)

Summary
  Status: FAIL
  Errors: 2

Run '/jade:validate --fix' to auto-fix issues.
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed |
| 1 | Lint errors found |
| 2 | Type errors found |
| 3 | Test failures |
| 4 | Configuration error |

## Integration with Git Hooks

Add to `.git/hooks/pre-commit`:
```bash
#!/bin/bash
# Run jade:validate before commit
cd "$(git rev-parse --show-toplevel)"

if command -v claude &> /dev/null; then
  claude --skill jade:validate --staged-only
else
  # Fallback to direct commands
  npm run lint && npm test
fi
```

## Related Commands

- `/jade:scan` - Run quality gates across all projects
- `/jade:fix` - Fix issues in code
- `/jade:status` - Check ecosystem health
