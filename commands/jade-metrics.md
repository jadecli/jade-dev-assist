---
name: jade:metrics
description: Display code metrics - lines of code, test coverage, complexity
argument-hint: "[--project <name>] [--loc | --coverage | --complexity]"
allowed-tools: [Read, Bash, Glob]
---

# Code Metrics

Displays code metrics across the jadecli ecosystem including lines of code, test coverage, and cyclomatic complexity.

## Usage

```bash
/jade:metrics [options]
```

## Options

| Flag | Description |
|------|-------------|
| (none) | Show all metrics for all projects |
| `--project <name>` | Metrics for specific project only |
| `--loc` | Lines of code only |
| `--coverage` | Test coverage only |
| `--complexity` | Cyclomatic complexity only |
| `--json` | Output as JSON |
| `--compare <commit>` | Compare against a commit/branch |

## Metrics Collected

| Metric | Tool | Languages |
|--------|------|-----------|
| Lines of Code | `tokei` or `cloc` | All |
| Test Coverage | `pytest --cov` / `npm test --coverage` | Python, JS/TS |
| Complexity | `radon cc` / custom | Python |
| Dependencies | `uv tree` / `npm list` | Python, JS/TS |

## Examples

### All Metrics

```bash
/jade:metrics
```

Runs metrics collection across all projects:

```bash
# Lines of code with tokei
tokei ~/projects/jade-index ~/projects/jade-cli ~/projects/jade-dev-assist --output json

# Or with cloc
cloc ~/projects --json --exclude-dir=node_modules,.venv,dist
```

### Lines of Code

```bash
/jade:metrics --loc
```

```bash
# Using tokei (fast)
tokei ~/projects/jade-index --output json | jq '.Python'

# Breakdown by file type
tokei ~/projects/jade-index -o json | jq 'to_entries | .[] | "\(.key): \(.value.code) lines"'
```

### Test Coverage

```bash
/jade:metrics --coverage
```

For Python projects:
```bash
cd ~/projects/jade-index
pytest --cov=src --cov-report=term-missing --cov-report=json
cat coverage.json | jq '.totals.percent_covered'
```

For Node projects:
```bash
cd ~/projects/jade-cli
npm test -- --coverage --coverageReporters=json-summary
cat coverage/coverage-summary.json | jq '.total.lines.pct'
```

### Complexity Analysis

```bash
/jade:metrics --complexity
```

For Python:
```bash
cd ~/projects/jade-index
radon cc src -a -s --json | jq '.[] | .complexity'
```

### Single Project

```bash
/jade:metrics --project jade-index
```

### Compare to Branch

```bash
/jade:metrics --compare main
```

Shows delta in metrics:
```
jade-cli: +142 LOC, coverage 78% -> 82% (+4%)
```

## Output Format

```
Code Metrics
============

jade-index (python)
  Lines of Code
    Python:     2,847 (47 files)
    Tests:        892 (12 files)
    Total:      3,739
  Coverage:     84.2%
  Complexity:   A (avg 2.3)
  Dependencies: 18 (3 outdated)

jade-cli (typescript)
  Lines of Code
    TypeScript: 4,102 (62 files)
    Tests:      1,244 (18 files)
    Total:      5,346
  Coverage:     76.8%
  Dependencies: 42 (7 outdated)

jade-dev-assist (javascript)
  Lines of Code
    JavaScript: 1,856 (28 files)
    Markdown:   2,104 (31 files)
    Total:      3,960
  Coverage:     68.4%
  Dependencies: 12 (1 outdated)

Ecosystem Totals
  Total LOC:    13,045
  Avg Coverage: 76.5%
  Projects:     8
```

## Complexity Grades

| Grade | CC Range | Meaning |
|-------|----------|---------|
| A | 1-5 | Simple, low risk |
| B | 6-10 | Moderate complexity |
| C | 11-20 | Complex, higher risk |
| D | 21-30 | Very complex |
| F | 31+ | Unmaintainable |

## Configuration

Install required tools:
```bash
# For tokei (fast LOC counter)
cargo install tokei

# For Python metrics
uv pip install radon pytest-cov

# For cloc (alternative)
sudo apt install cloc
```

## Related Commands

- `/jade:scan` - Run quality gates
- `/jade:status` - Ecosystem health check
- `/jade:techdebt` - Technical debt analysis
