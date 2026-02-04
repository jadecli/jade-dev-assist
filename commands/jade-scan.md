---
name: jade:scan
description: Run quality gates (ruff, ty, npm lint/test) across all or selected projects
argument-hint: "[--project <name>] [--fix] [--parallel]"
allowed-tools: [Read, Bash, Glob]
---

# Quality Gate Scanner

Runs linters, type checkers, and tests across the jadecli ecosystem. Detects project language and applies appropriate tooling.

## Usage

```bash
/jade:scan [options]
```

## Options

| Flag | Description |
|------|-------------|
| (none) | Scan all projects in ~/.jade/projects.json |
| `--project <name>` | Scan specific project only |
| `--fix` | Auto-fix linting issues where possible |
| `--parallel` | Run scans in parallel (faster but noisier output) |
| `--lint-only` | Skip tests, run linters only |
| `--test-only` | Skip linters, run tests only |
| `--summary` | Show pass/fail summary only |

## Language Detection

| Language | Linter | Type Checker | Tests |
|----------|--------|--------------|-------|
| python | `ruff check` | `ty check` | `pytest` |
| typescript | `npm run lint` | `npm run typecheck` | `npm test` |
| javascript | `npm run lint` | - | `npm test` |
| docker | `docker compose config --quiet` | - | - |

## Examples

### Scan All Projects

```bash
/jade:scan
```

Iterates through all projects in `~/.jade/projects.json`:

```bash
for project in $(jq -r '.projects[] | "\(.name):\(.language)"' ~/.jade/projects.json); do
  name=$(echo $project | cut -d: -f1)
  lang=$(echo $project | cut -d: -f2)
  dir=~/projects/$name

  echo "=== Scanning $name ($lang) ==="
  cd "$dir"

  case $lang in
    python)
      ruff check . 2>&1 | head -20
      ty check . 2>&1 | head -20
      ;;
    typescript|javascript)
      npm run lint 2>&1 | head -20
      npm test 2>&1 | head -20
      ;;
    docker)
      docker compose config --quiet && echo "Docker config valid"
      ;;
  esac
done
```

### Scan Single Project

```bash
/jade:scan --project jade-index
```

```bash
cd ~/projects/jade-index
ruff check .
ty check .
pytest -v
```

### Auto-fix Mode

```bash
/jade:scan --fix
```

For Python projects:
```bash
ruff check --fix .
```

For Node projects:
```bash
npm run lint -- --fix
```

### Parallel Scanning

```bash
/jade:scan --parallel
```

Runs scans in background jobs:
```bash
for project in jade-index jade-cli jade-dev-assist; do
  (cd ~/projects/$project && npm test) &
done
wait
```

## Output Format

```
Quality Gate Scan
=================

jade-index (python)
  ruff check      PASS (0 issues)
  ty check        PASS (0 errors)
  pytest          PASS (42 tests)

jade-cli (typescript)
  npm lint        PASS
  npm typecheck   PASS
  npm test        PASS (18 tests)

jade-dev-assist (javascript)
  npm lint        WARN (2 warnings)
  npm test        PASS (12 tests)

jadecli-infra (docker)
  compose config  PASS

Summary: 4 projects, 3 passed, 1 warning, 0 failed
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All quality gates passed |
| 1 | One or more projects failed |
| 2 | Configuration error |

## Configuration

Projects are read from `~/.jade/projects.json`. Each project's `language` field determines which tools to run.

## Related Commands

- `/jade:status` - Check ecosystem health
- `/jade:validate` - Pre-commit check for current directory
- `/jade:metrics` - Code metrics and coverage
