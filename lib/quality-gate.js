'use strict';

/**
 * Quality Gate Module for jade-dev-assist.
 *
 * Provides code quality gate runner functions for:
 * - Running linters (ruff for Python, eslint for Node.js)
 * - Running type checkers (ty for Python, tsc for TypeScript)
 * - Running tests (pytest for Python, npm test for Node.js)
 * - Aggregating results with pass/fail status
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const { createLogger } = require('./logger');

const execAsync = promisify(exec);
const logger = createLogger('quality-gate');

// ── Project Type Detection ───────────────────────────────────────────

/**
 * Detect project type by checking for characteristic files.
 *
 * @param {string} projectPath - Path to the project directory.
 * @returns {{ node: boolean, python: boolean, typescript: boolean, go: boolean, rust: boolean }}
 */
function detectProjectType(projectPath) {
  const result = {
    node: false,
    python: false,
    typescript: false,
    go: false,
    rust: false,
  };

  try {
    // Node.js / JavaScript
    if (fs.existsSync(path.join(projectPath, 'package.json'))) {
      result.node = true;
      // Check for TypeScript
      const pkgPath = path.join(projectPath, 'package.json');
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (
          pkg.devDependencies?.typescript ||
          pkg.dependencies?.typescript ||
          fs.existsSync(path.join(projectPath, 'tsconfig.json'))
        ) {
          result.typescript = true;
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Python
    if (
      fs.existsSync(path.join(projectPath, 'pyproject.toml')) ||
      fs.existsSync(path.join(projectPath, 'setup.py')) ||
      fs.existsSync(path.join(projectPath, 'requirements.txt'))
    ) {
      result.python = true;
    }

    // Go
    if (fs.existsSync(path.join(projectPath, 'go.mod'))) {
      result.go = true;
    }

    // Rust
    if (fs.existsSync(path.join(projectPath, 'Cargo.toml'))) {
      result.rust = true;
    }
  } catch (err) {
    logger.warn('Project type detection failed', { error: err.message });
  }

  return result;
}

// ── Linter Runner ────────────────────────────────────────────────────

/**
 * Run linter for the specified project type.
 *
 * @param {string} projectPath - Path to the project directory.
 * @param {Object} [options]
 * @param {string} [options.type] - Project type ('node', 'python').
 * @param {string} [options.command] - Custom linter command to run.
 * @returns {Promise<{ passed: boolean, output: string, errorCount: number, warningCount: number, skipped?: boolean }>}
 */
async function runLinter(projectPath, options = {}) {
  const result = {
    passed: false,
    output: '',
    errorCount: 0,
    warningCount: 0,
  };

  let command = options.command;

  if (!command) {
    if (options.type === 'python') {
      command = 'ruff check .';
    } else if (options.type === 'node') {
      // Check if eslint is available via npm
      const pkgPath = path.join(projectPath, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          if (pkg.scripts?.lint) {
            command = 'npm run lint';
          } else if (pkg.devDependencies?.eslint) {
            command = 'npx eslint .';
          }
        } catch {
          // Fall through
        }
      }
      if (!command) {
        command = 'npm run lint';
      }
    } else {
      result.skipped = true;
      result.output = 'No linter configured for this project type';
      return result;
    }
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: projectPath,
      timeout: 120000, // 2 minutes
    });
    result.passed = true;
    result.output = stdout + stderr;

    // Parse output for error/warning counts (best effort)
    const lines = result.output.split('\n');
    for (const line of lines) {
      if (/error/i.test(line) && !/0 error/i.test(line)) {
        result.errorCount++;
      }
      if (/warning/i.test(line) && !/0 warning/i.test(line)) {
        result.warningCount++;
      }
    }
  } catch (err) {
    result.passed = false;
    result.output = err.stdout || err.stderr || err.message || 'Linter command failed';

    // Check if command not found
    if (err.message?.includes('not found') || err.message?.includes('ENOENT')) {
      result.skipped = true;
      result.output = `Linter not available: ${err.message}`;
    }

    // Try to extract error count from output
    const match = result.output.match(/(\d+)\s+error/i);
    if (match) {
      result.errorCount = parseInt(match[1], 10);
    }
    const warnMatch = result.output.match(/(\d+)\s+warning/i);
    if (warnMatch) {
      result.warningCount = parseInt(warnMatch[1], 10);
    }
  }

  return result;
}

// ── Type Checker Runner ──────────────────────────────────────────────

/**
 * Run type checker for the specified project type.
 *
 * @param {string} projectPath - Path to the project directory.
 * @param {Object} [options]
 * @param {string} [options.type] - Project type ('node', 'python').
 * @param {string} [options.command] - Custom type checker command to run.
 * @returns {Promise<{ passed: boolean, output: string, errorCount: number, skipped?: boolean }>}
 */
async function runTypeChecker(projectPath, options = {}) {
  const result = {
    passed: false,
    output: '',
    errorCount: 0,
  };

  let command = options.command;

  if (!command) {
    if (options.type === 'python') {
      command = 'ty check .';
    } else if (options.type === 'node') {
      // Check if TypeScript is available
      const pkgPath = path.join(projectPath, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          if (
            pkg.devDependencies?.typescript ||
            pkg.dependencies?.typescript ||
            fs.existsSync(path.join(projectPath, 'tsconfig.json'))
          ) {
            command = 'npx tsc --noEmit';
          }
        } catch {
          // Fall through
        }
      }
      if (!command) {
        result.skipped = true;
        result.output = 'TypeScript not configured for this project';
        return result;
      }
    } else {
      result.skipped = true;
      result.output = 'No type checker configured for this project type';
      return result;
    }
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: projectPath,
      timeout: 180000, // 3 minutes
    });
    result.passed = true;
    result.output = stdout + stderr;
  } catch (err) {
    result.passed = false;
    result.output = err.stdout || err.stderr || err.message || 'Type checker command failed';

    // Check if command not found
    if (err.message?.includes('not found') || err.message?.includes('ENOENT')) {
      result.skipped = true;
      result.output = `Type checker not available: ${err.message}`;
    }

    // Count errors from output
    const lines = result.output.split('\n');
    for (const line of lines) {
      if (/error/i.test(line) && !/0 error/i.test(line)) {
        result.errorCount++;
      }
    }
  }

  return result;
}

// ── Test Runner ──────────────────────────────────────────────────────

/**
 * Run tests for the specified project type.
 *
 * @param {string} projectPath - Path to the project directory.
 * @param {Object} [options]
 * @param {string} [options.type] - Project type ('node', 'python').
 * @param {string} [options.command] - Custom test command to run.
 * @returns {Promise<{ passed: boolean, output: string, skipped?: boolean }>}
 */
async function runTests(projectPath, options = {}) {
  const result = {
    passed: false,
    output: '',
  };

  let command = options.command;

  if (!command) {
    if (options.type === 'python') {
      command = 'pytest';
    } else if (options.type === 'node') {
      const pkgPath = path.join(projectPath, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          if (pkg.scripts?.test) {
            command = 'npm test';
          }
        } catch {
          // Fall through
        }
      }
      if (!command) {
        command = 'npm test';
      }
    } else {
      result.skipped = true;
      result.output = 'No test command configured for this project type';
      return result;
    }
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: projectPath,
      timeout: 300000, // 5 minutes
    });
    result.passed = true;
    result.output = stdout + stderr;
  } catch (err) {
    result.passed = false;
    result.output = err.stdout || err.stderr || err.message || 'Test command failed';

    // Check if command not found
    if (err.message?.includes('not found') || err.message?.includes('ENOENT')) {
      result.skipped = true;
      result.output = `Test runner not available: ${err.message}`;
    }
  }

  return result;
}

// ── Quality Gate Runner ──────────────────────────────────────────────

/**
 * Run all quality gate checks and aggregate results.
 *
 * @param {string} projectPath - Path to the project directory.
 * @param {Object} [options]
 * @param {boolean} [options.skipLinter] - Skip linter check.
 * @param {boolean} [options.skipTypeChecker] - Skip type checker.
 * @param {boolean} [options.skipTests] - Skip tests.
 * @param {string} [options.type] - Force project type.
 * @returns {Promise<Object>}
 */
async function runQualityGate(projectPath, options = {}) {
  const projectType = detectProjectType(projectPath);
  const type = options.type || (projectType.python ? 'python' : projectType.node ? 'node' : null);

  const [linter, typeChecker, tests] = await Promise.all([
    options.skipLinter
      ? Promise.resolve({ skipped: true, passed: true, output: '', errorCount: 0, warningCount: 0 })
      : runLinter(projectPath, { type }),
    options.skipTypeChecker
      ? Promise.resolve({ skipped: true, passed: true, output: '', errorCount: 0 })
      : runTypeChecker(projectPath, { type }),
    options.skipTests
      ? Promise.resolve({ skipped: true, passed: true, output: '' })
      : runTests(projectPath, { type }),
  ]);

  // Determine overall pass/fail
  const overallPassed =
    (linter.passed || linter.skipped) &&
    (typeChecker.passed || typeChecker.skipped) &&
    (tests.passed || tests.skipped);

  return {
    linter: options.skipLinter ? null : linter,
    typeChecker: options.skipTypeChecker ? null : typeChecker,
    tests: options.skipTests ? null : tests,
    overallPassed,
    projectType,
  };
}

// ── Report Formatting ────────────────────────────────────────────────

/**
 * Format quality gate results as a human-readable report.
 *
 * @param {Object} qualityData - Results from runQualityGate().
 * @returns {string}
 */
function formatQualityReport(qualityData) {
  const lines = [];
  const checkMark = '\u2713';
  const crossMark = '\u2717';
  const warnMark = '\u26A0';

  lines.push('');
  lines.push('=== Quality Gate Report ===');
  lines.push('');

  // Project type
  const types = [];
  if (qualityData.projectType?.node) types.push('Node.js');
  if (qualityData.projectType?.python) types.push('Python');
  if (qualityData.projectType?.typescript) types.push('TypeScript');
  if (qualityData.projectType?.go) types.push('Go');
  if (qualityData.projectType?.rust) types.push('Rust');
  lines.push(`Project Type: ${types.length > 0 ? types.join(', ') : 'Unknown'}`);
  lines.push('');

  // Linter section
  lines.push('## Linter');
  if (qualityData.linter === null || qualityData.linter.skipped) {
    lines.push(`  ${warnMark} Skipped`);
  } else {
    const status = qualityData.linter.passed ? checkMark : crossMark;
    lines.push(`  ${status} ${qualityData.linter.passed ? 'Passed' : 'Failed'}`);
    if (qualityData.linter.errorCount > 0) {
      lines.push(`    Errors: ${qualityData.linter.errorCount}`);
    }
    if (qualityData.linter.warningCount > 0) {
      lines.push(`    Warnings: ${qualityData.linter.warningCount}`);
    }
  }
  lines.push('');

  // Type checker section
  lines.push('## Type Checker');
  if (qualityData.typeChecker === null || qualityData.typeChecker.skipped) {
    lines.push(`  ${warnMark} Skipped`);
  } else {
    const status = qualityData.typeChecker.passed ? checkMark : crossMark;
    lines.push(`  ${status} ${qualityData.typeChecker.passed ? 'Passed' : 'Failed'}`);
    if (qualityData.typeChecker.errorCount > 0) {
      lines.push(`    Errors: ${qualityData.typeChecker.errorCount}`);
    }
  }
  lines.push('');

  // Tests section
  lines.push('## Tests');
  if (qualityData.tests === null || qualityData.tests.skipped) {
    lines.push(`  ${warnMark} Skipped`);
  } else {
    const status = qualityData.tests.passed ? checkMark : crossMark;
    lines.push(`  ${status} ${qualityData.tests.passed ? 'Passed' : 'Failed'}`);
  }
  lines.push('');

  // Overall status
  const overall = qualityData.overallPassed ? `${checkMark} PASSED` : `${crossMark} FAILED`;
  lines.push(`Overall Status: ${overall}`);
  lines.push('');

  return lines.join('\n');
}

module.exports = {
  detectProjectType,
  runLinter,
  runTypeChecker,
  runTests,
  runQualityGate,
  formatQualityReport,
};
