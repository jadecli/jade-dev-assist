---
name: jade:metrics
description: Code metrics - lines of code, coverage, complexity
argument-hint: "[all | loc | coverage | complexity] [--project <name>]"
allowed-tools: [Read, Bash, Glob, Grep]
---

# Code Metrics

Display code metrics including lines of code (LOC), test coverage, and cyclomatic complexity. Supports individual projects or ecosystem-wide reports.

## Usage

```bash
/jade:metrics [metric] [options]
```

## Metrics

| Metric | Description | Tool |
|--------|-------------|------|
| `all` | (Default) All metrics combined | Multiple |
| `loc` | Lines of code by language | `tokei` or `cloc` |
| `coverage` | Test coverage percentage | `c8`, `pytest-cov` |
| `complexity` | Cyclomatic complexity | `radon`, `eslint` |

## Options

| Option | Description |
|--------|-------------|
| `--project <name>` | Analyze specific project only |
| `--json` | Output in JSON format |
| `--compare <branch>` | Compare against branch |

## Examples

### Full Metrics Report

```bash
/jade:metrics
```

Output:
```
=== Code Metrics Report ===
Project: jade-dev-assist

## Lines of Code
Language       Files    Lines     Code  Comments   Blanks
JavaScript        24     4521     3842       312      367
Markdown          21     3245     2890         0      355
JSON               8      482      482         0        0
---------------------------------------------------------
Total             53     8248     7214       312      722

## Test Coverage
Statements: 87.3% (1245/1426)
Branches:   82.1% (312/380)
Functions:  91.2% (156/171)
Lines:      87.5% (1198/1369)

## Complexity
Average:    3.2
Maximum:    12 (lib/scorer.js:scoreTasks)
Files > 10: 2

Summary: Good maintainability score
```

### Lines of Code Only

```bash
/jade:metrics loc
```

Shows detailed LOC breakdown by language and directory.

### Coverage Report

```bash
/jade:metrics coverage
```

Output:
```
## Test Coverage

Overall: 87.3%

By File:
  lib/scanner.js       92.1%  ++++++++++-
  lib/scorer.js        88.4%  +++++++++--
  lib/presenter.js     94.2%  ++++++++++-
  lib/dispatcher.js    85.3%  +++++++++--
  lib/logger.js        78.6%  ++++++++---

Uncovered Lines:
  lib/dispatcher.js:45-48  Error handling edge case
  lib/logger.js:112-118    Fallback path

Run 'npm test:coverage:report' for HTML report
```

### Complexity Analysis

```bash
/jade:metrics complexity
```

Output:
```
## Cyclomatic Complexity

Average: 3.2 (Good)
Median:  2.0

Distribution:
  A (1-5):   42 functions  +++++++++++++++++++++
  B (6-10):   8 functions  ++++
  C (11-15):  2 functions  +
  D (16-20):  0 functions
  F (21+):    0 functions

High Complexity Functions:
  lib/scorer.js:scoreTasks        12  Consider splitting
  lib/scanner.js:scanTasks        11  Consider splitting
```

### Compare Against Branch

```bash
/jade:metrics --compare main
```

Shows delta compared to the specified branch:

```
## Metrics Delta (vs main)

Lines of Code:  +234 (+3.2%)
Coverage:       +1.2% (86.1% -> 87.3%)
Complexity:     -0.3 (3.5 -> 3.2)

New Files: 2
  lib/health-checker.js (156 lines)
  lib/quality-gate.js (198 lines)

Modified Files: 3
  lib/scanner.js (+12 lines)
  tests/test-scanner.js (+45 lines)
```

### Ecosystem-Wide Report

```bash
/jade:metrics --project all
```

Shows metrics across all 8 projects:

```
## Ecosystem Metrics

Project              LOC     Coverage  Complexity
jade-cli           12,450      82.3%        3.8
jade-index          8,230      91.2%        2.9
claude-objects      6,890      88.7%        3.1
jade-dev-assist     7,214      87.3%        3.2
jade-ide          245,000         -         4.2
jadecli-infra         890         -           -
jade-swarm-superpowers  450      -           -
jadecli-roadmap       320         -           -
-------------------------------------------------
Total             281,444      87.4%        3.6
```

## Tools Used

### Lines of Code

Uses `tokei` (preferred) or `cloc`:

```bash
# Install tokei
cargo install tokei

# Or use cloc
apt install cloc
```

### Coverage

- **Python**: `pytest-cov` with `c8` format output
- **Node.js**: `c8` with V8 coverage

```bash
# Node.js
npm run test:coverage

# Python
pytest --cov=. --cov-report=term-missing
```

### Complexity

- **Python**: `radon` for cyclomatic complexity
- **Node.js**: `eslint-plugin-complexity`

## Integration

```javascript
const { getLOC, getCoverage, getComplexity } = require('../lib/metrics');

// Get all metrics
const loc = await getLOC(projectPath);
const coverage = await getCoverage(projectPath);
const complexity = await getComplexity(projectPath);

// Format report
console.log(formatMetricsReport({ loc, coverage, complexity }));
```

## Configuration

```json
{
  "metrics": {
    "exclude": ["node_modules", "dist", "coverage"],
    "complexity": {
      "threshold": 10,
      "warnAt": 8
    },
    "coverage": {
      "target": 80,
      "warnAt": 70
    }
  }
}
```

## Badges

Generate badges for README:

```bash
/jade:metrics --badges
```

Creates badge URLs:
```markdown
![Coverage](https://img.shields.io/badge/coverage-87.3%25-green)
![LOC](https://img.shields.io/badge/LOC-7.2k-blue)
![Complexity](https://img.shields.io/badge/complexity-3.2-green)
```

## Related Commands

- `/jade:scan` - Quality gate checks
- `/jade:status` - Ecosystem health
- `/jade:review` - Code review
