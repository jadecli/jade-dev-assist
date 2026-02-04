---
name: jade:validate
description: Pre-commit validation runner - ensure code quality before committing
argument-hint: "[all | staged | file <path>] [--fix]"
allowed-tools: [Read, Bash, Glob, Grep]
---

# Pre-Commit Validation

Run comprehensive pre-commit validations to ensure code quality before committing. Validates staged files, runs appropriate linters and formatters, and checks for common issues.

## Usage

```bash
/jade:validate [scope] [options]
```

## Scope

| Scope | Description |
|-------|-------------|
| `all` | Validate entire project |
| `staged` | (Default) Validate only staged files |
| `file <path>` | Validate specific file |

## Options

| Option | Description |
|--------|-------------|
| `--fix` | Auto-fix issues where possible |
| `--strict` | Fail on warnings |
| `--skip-tests` | Skip test execution |
| `--verbose` | Show detailed output |

## Examples

### Validate Staged Files

```bash
/jade:validate
```

Output:
```
=== Pre-Commit Validation ===

Staged files: 4
  lib/health-checker.js
  lib/quality-gate.js
  tests/test-health-checker.js
  tests/test-quality-gate.js

## Format Check
  + All files properly formatted

## Lint Check
  + No linting errors
  ! 2 warnings (use --strict to fail)

## Type Check
  + No type errors

## Tests
  + 16 suites passed

## Conventional Commit
  Ready for commit

Validation: PASSED

Suggested commit message:
  feat: add health-checker and quality-gate modules
```

### Validate with Auto-Fix

```bash
/jade:validate --fix
```

Automatically fixes:
- Formatting issues (Prettier)
- Auto-fixable lint errors (ESLint, ruff)
- Import sorting
- Trailing whitespace

```
=== Pre-Commit Validation (Auto-Fix) ===

Fixed:
  lib/health-checker.js: 3 formatting issues
  lib/quality-gate.js: 1 trailing whitespace

Re-staged fixed files.

Validation: PASSED
```

### Validate Specific File

```bash
/jade:validate file lib/scanner.js
```

Validates a single file:

```
=== Validating: lib/scanner.js ===

Format:    + Passed
Lint:      + Passed (0 errors, 0 warnings)
Types:     + Passed
Tests:     + 26 related tests passed

File is ready for commit.
```

### Strict Mode

```bash
/jade:validate --strict
```

Fails on any warning:

```
=== Pre-Commit Validation (Strict) ===

## Lint Check
  x 2 warnings found (strict mode)

    lib/health-checker.js:45:5
      warning: Unexpected console statement

    lib/quality-gate.js:78:3
      warning: Variable 'result' is never reassigned

Validation: FAILED

Fix warnings or run without --strict.
```

### Skip Tests

```bash
/jade:validate --skip-tests
```

Useful for quick validation during iterative development.

## Validation Checks

### 1. Format Check

Ensures code is properly formatted:

- **Node.js**: Prettier
- **Python**: ruff format

```bash
# What it runs
npx prettier --check .
ruff format --check .
```

### 2. Lint Check

Checks for code quality issues:

- **Node.js**: ESLint
- **Python**: ruff check

```bash
# What it runs
npx eslint --max-warnings 0 .
ruff check .
```

### 3. Type Check

Verifies type correctness:

- **TypeScript**: tsc --noEmit
- **Python**: ty check

```bash
# What it runs
npx tsc --noEmit
ty check .
```

### 4. Test Check

Runs tests related to changed files:

```bash
# Node.js - runs only related tests
npm test -- --findRelatedTests <changed-files>

# Python - runs related tests
pytest <changed-files>
```

### 5. Conventional Commit Check

Verifies commit message format:

```
<type>(<scope>): <description>

Types: feat, fix, docs, style, refactor, test, chore
```

## Pre-Commit Hook

Install as a git hook:

```bash
# .husky/pre-commit
#!/bin/sh
/jade:validate --staged || exit 1
```

Or via package.json:

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "jade:validate"
    }
  }
}
```

## Integration

Uses `lib/quality-gate.js` and validation scripts:

```javascript
const { runQualityGate } = require('../lib/quality-gate');

// Get staged files
const stagedFiles = getStagedFiles();

// Run validation
const results = await runQualityGate(process.cwd(), {
  files: stagedFiles,
  fix: options.fix,
});

// Report results
console.log(formatValidationReport(results));

// Exit with code
process.exit(results.overallPassed ? 0 : 1);
```

## Configuration

```json
{
  "validate": {
    "format": true,
    "lint": true,
    "types": true,
    "tests": true,
    "conventionalCommit": true,
    "fix": false,
    "strict": false
  }
}
```

### Per-File Type Configuration

```json
{
  "validate": {
    "rules": {
      "*.js": ["format", "lint"],
      "*.ts": ["format", "lint", "types"],
      "*.py": ["format", "lint", "types"],
      "*.md": ["format"]
    }
  }
}
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Validation passed |
| 1 | Validation failed |
| 2 | Configuration error |

## Bypass Validation

In emergencies (not recommended):

```bash
git commit --no-verify -m "emergency: fix production issue"
```

Note: This skips all hooks. Use sparingly.

## CI Integration

The same validation runs in CI:

```yaml
# .github/workflows/ci.yml
jobs:
  validate:
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run validate
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Format fails | Run `/jade:validate --fix` |
| Tests timeout | Use `--skip-tests` temporarily |
| Hook not running | Check `.husky/pre-commit` permissions |
| False positives | Update linter config |

## Related Commands

- `/jade:scan` - Full quality gate scan
- `/jade:fix` - Fix code issues
- `/jade:review` - Code review before PR
