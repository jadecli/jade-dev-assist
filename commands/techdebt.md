---
name: jade:techdebt
description: Find and kill duplicated code, unused imports, and tech debt - run at end of every session
argument-hint: '[--fix | --report | --watch]'
allowed-tools: [Read, Write, Bash, Glob, Grep]
---

# Tech Debt Scanner

> "Build a /techdebt slash command and run it at the end of every session to find and kill duplicated code." — Boris Cherny

## Usage

```bash
/jade:techdebt [options]
```

## Options

| Flag                 | Description                                      |
| -------------------- | ------------------------------------------------ |
| `--report`           | Generate report without fixing (default)         |
| `--fix`              | Automatically fix issues                         |
| `--watch`            | Run continuously during session                  |
| `--severity <level>` | Filter by severity (low, medium, high, critical) |
| `--scope <path>`     | Limit to specific directory                      |

## What It Detects

### 1. Code Duplication

- Duplicated functions across files
- Copy-pasted code blocks (5+ lines)
- Similar logic with minor variations

### 2. Dead Code

- Unused imports
- Unused variables
- Unreachable code
- Deprecated functions still present

### 3. Complexity Issues

- Functions > 50 lines
- Files > 500 lines
- Cyclomatic complexity > 10
- Deep nesting (4+ levels)

### 4. Consistency Problems

- Mixed coding styles
- Inconsistent naming
- TODO/FIXME comments
- Console.log / print statements

## Examples

### End of Session Scan

```bash
/jade:techdebt
```

Output:

```
🔍 Tech Debt Scan Results

📋 SUMMARY
   Duplications: 3 found
   Dead code: 12 instances
   Complexity: 5 warnings
   Consistency: 8 issues

🔴 CRITICAL (fix now)
   • src/utils/auth.ts:45-78 duplicates src/lib/auth.ts:23-56
   • src/api/users.ts has 3 unused imports

🟡 WARNINGS (should fix)
   • src/components/Dashboard.tsx:234 lines (recommend split)
   • 5 TODO comments older than 30 days

🔵 INFO (nice to have)
   • 3 console.log statements in production code

💡 Run '/jade:techdebt --fix' to auto-fix safe issues
```

### Auto-Fix Safe Issues

```bash
/jade:techdebt --fix
```

What gets auto-fixed:

- Unused imports removed
- Console.log statements removed
- Trailing whitespace cleaned
- Obvious duplicates consolidated

### Watch Mode

```bash
/jade:techdebt --watch
```

Runs in background, alerts when new debt introduced.

## Integration with Workflow

### Recommended: End of Every Session

Add to your routine:

```
1. Complete feature work
2. Run /jade:techdebt
3. Fix critical issues
4. Commit and push
```

### Pre-PR Check

```bash
/jade:techdebt --severity high
```

Only shows issues that should block PR.

### CI Integration

Add to `.github/workflows/techdebt.yml`:

```yaml
- name: Tech Debt Check
  run: claude --command "/jade:techdebt --report --severity critical"
  continue-on-error: true
```

## Detection Rules

### Duplication Detection

Uses AST analysis to find:

```javascript
// Duplicate 1: src/utils/format.ts
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Duplicate 2: src/helpers/date.ts
export function formatDateString(d: Date): string {
  return d.toISOString().split('T')[0];
}
```

Recommendation:

```
→ Consolidate to single location: src/utils/date.ts
→ Export and import where needed
```

### Dead Code Detection

```javascript
import { unused, used } from './utils';  // 'unused' flagged
const DEBUG = true;                       // Never read
function oldHandler() { ... }             // Never called
```

### Complexity Metrics

| Metric                | Threshold | Action                       |
| --------------------- | --------- | ---------------------------- |
| Lines per function    | > 50      | Split into smaller functions |
| Lines per file        | > 500     | Consider module extraction   |
| Cyclomatic complexity | > 10      | Simplify conditionals        |
| Nesting depth         | > 4       | Extract to functions         |

## Configuration

Create `.jade/techdebt.json`:

```json
{
  "duplication": {
    "minLines": 5,
    "ignorePatterns": ["*.test.ts", "*.spec.ts"]
  },
  "deadCode": {
    "checkImports": true,
    "checkVariables": true,
    "checkFunctions": true
  },
  "complexity": {
    "maxFunctionLines": 50,
    "maxFileLines": 500,
    "maxCyclomatic": 10,
    "maxNesting": 4
  },
  "consistency": {
    "checkTodos": true,
    "todoMaxAgeDays": 30,
    "checkConsoleLogs": true
  },
  "autoFix": {
    "unusedImports": true,
    "consoleLogs": true,
    "trailingWhitespace": true,
    "duplicates": false
  }
}
```

## Language Support

| Language   | Duplication | Dead Code | Complexity |
| ---------- | ----------- | --------- | ---------- |
| TypeScript | ✓           | ✓         | ✓          |
| JavaScript | ✓           | ✓         | ✓          |
| Python     | ✓           | ✓         | ✓          |
| Go         | ✓           | ✓         | ✓          |
| Rust       | ✓           | ✓         | ✓          |

## Best Practices

1. **Run daily** - Don't let debt accumulate
2. **Fix critical first** - Start with duplications
3. **Automate** - Add to pre-commit hooks
4. **Track trends** - Debt should decrease over time
5. **Don't ignore warnings** - They become critical

## Related Commands

- `/jade:refine` - "Make it elegant" after finding debt
- `/jade:subagent` - Parallelize cleanup across files
- `/jade:plan` - Plan major refactoring
