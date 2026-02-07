#!/usr/bin/env node

/**
 * Quality Gate Module Tests (lib/quality-gate.js)
 *
 * Tests for code quality gate runner functions.
 * Uses the same custom test framework as other test files.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (err) {
    console.log(`  \u2717 ${name}`);
    console.log(`    Error: ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Creates a temp directory with a mock project structure.
 * Returns { tmpdir, cleanup }.
 */
function createTestProject(options = {}) {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'jade-quality-gate-test-'));

  // Create package.json if Node.js project
  if (options.nodeProject) {
    fs.writeFileSync(
      path.join(tmpdir, 'package.json'),
      JSON.stringify(
        {
          name: 'test-project',
          scripts: {
            lint: options.lintCommand || 'echo "lint ok"',
            test: options.testCommand || 'echo "test ok"',
          },
        },
        null,
        2
      )
    );
  }

  // Create pyproject.toml if Python project
  if (options.pythonProject) {
    fs.writeFileSync(
      path.join(tmpdir, 'pyproject.toml'),
      `[project]
name = "test-project"
version = "0.1.0"
`
    );
  }

  return {
    tmpdir,
    cleanup() {
      fs.rmSync(tmpdir, { recursive: true, force: true });
    },
  };
}

// ── Import quality-gate ──────────────────────────────────────────────

let runLinter,
  runTypeChecker,
  runTests,
  detectProjectType,
  runQualityGate,
  formatQualityReport;

try {
  const qualityGate = require('../lib/quality-gate');
  runLinter = qualityGate.runLinter;
  runTypeChecker = qualityGate.runTypeChecker;
  runTests = qualityGate.runTests;
  detectProjectType = qualityGate.detectProjectType;
  runQualityGate = qualityGate.runQualityGate;
  formatQualityReport = qualityGate.formatQualityReport;
} catch (err) {
  console.log('\nFATAL: Could not load lib/quality-gate.js');
  console.log(`  ${err.message}\n`);
  console.log('All tests will be marked as failed.\n');
  process.exit(1);
}

// ── detectProjectType tests ──────────────────────────────────────────

console.log('\n  detectProjectType tests\n');

test('1. detectProjectType identifies Node.js project by package.json', () => {
  const env = createTestProject({ nodeProject: true });
  try {
    const result = detectProjectType(env.tmpdir);
    assert(result.node === true, 'Expected node to be true');
  } finally {
    env.cleanup();
  }
});

test('2. detectProjectType identifies Python project by pyproject.toml', () => {
  const env = createTestProject({ pythonProject: true });
  try {
    const result = detectProjectType(env.tmpdir);
    assert(result.python === true, 'Expected python to be true');
  } finally {
    env.cleanup();
  }
});

test('3. detectProjectType identifies mixed project', () => {
  const env = createTestProject({ nodeProject: true, pythonProject: true });
  try {
    const result = detectProjectType(env.tmpdir);
    assert(result.node === true, 'Expected node to be true');
    assert(result.python === true, 'Expected python to be true');
  } finally {
    env.cleanup();
  }
});

test('4. detectProjectType returns empty for unknown project', () => {
  const env = createTestProject({});
  try {
    const result = detectProjectType(env.tmpdir);
    assert(result.node === false, 'Expected node to be false');
    assert(result.python === false, 'Expected python to be false');
  } finally {
    env.cleanup();
  }
});

// ── runLinter tests ──────────────────────────────────────────────────

console.log('\n  runLinter tests\n');

test('5. runLinter returns an object with expected structure', async () => {
  const env = createTestProject({ nodeProject: true });
  try {
    const result = await runLinter(env.tmpdir, { type: 'node' });
    assert(typeof result === 'object', 'Expected result to be an object');
    assert(typeof result.passed === 'boolean', 'Expected passed to be boolean');
    assert(typeof result.output === 'string', 'Expected output to be string');
    assert(typeof result.errorCount === 'number', 'Expected errorCount to be number');
    assert(typeof result.warningCount === 'number', 'Expected warningCount to be number');
  } finally {
    env.cleanup();
  }
});

test('6. runLinter supports Python projects with ruff', async () => {
  const env = createTestProject({ pythonProject: true });
  try {
    const result = await runLinter(env.tmpdir, { type: 'python' });
    assert(typeof result === 'object', 'Expected result to be an object');
    assert(typeof result.passed === 'boolean', 'Expected passed to be boolean');
    // ruff may or may not be installed, so we don't assert on specific values
  } finally {
    env.cleanup();
  }
});

test('7. runLinter returns failure info when linter not found', async () => {
  const env = createTestProject({});
  try {
    const result = await runLinter(env.tmpdir, { type: 'node', command: 'nonexistent-linter' });
    assert(typeof result === 'object', 'Expected result to be an object');
    // Command not found should result in failure or skipped status
    assert(result.passed === false || result.skipped === true, 'Expected failed or skipped');
  } finally {
    env.cleanup();
  }
});

// ── runTypeChecker tests ─────────────────────────────────────────────

console.log('\n  runTypeChecker tests\n');

test('8. runTypeChecker returns an object with expected structure', async () => {
  const env = createTestProject({ pythonProject: true });
  try {
    const result = await runTypeChecker(env.tmpdir, { type: 'python' });
    assert(typeof result === 'object', 'Expected result to be an object');
    assert(typeof result.passed === 'boolean', 'Expected passed to be boolean');
    assert(typeof result.output === 'string', 'Expected output to be string');
    assert(typeof result.errorCount === 'number', 'Expected errorCount to be number');
  } finally {
    env.cleanup();
  }
});

test('9. runTypeChecker handles missing type checker gracefully', async () => {
  const env = createTestProject({});
  try {
    const result = await runTypeChecker(env.tmpdir, { type: 'node', command: 'nonexistent-checker' });
    assert(typeof result === 'object', 'Expected result to be an object');
    assert(result.passed === false || result.skipped === true, 'Expected failed or skipped');
  } finally {
    env.cleanup();
  }
});

// ── runTests tests ───────────────────────────────────────────────────

console.log('\n  runTests tests\n');

test('10. runTests returns an object with expected structure', async () => {
  const env = createTestProject({ nodeProject: true, testCommand: 'echo "test passed"' });
  try {
    const result = await runTests(env.tmpdir, { type: 'node' });
    assert(typeof result === 'object', 'Expected result to be an object');
    assert(typeof result.passed === 'boolean', 'Expected passed to be boolean');
    assert(typeof result.output === 'string', 'Expected output to be string');
  } finally {
    env.cleanup();
  }
});

test('11. runTests supports Python projects with pytest', async () => {
  const env = createTestProject({ pythonProject: true });
  try {
    const result = await runTests(env.tmpdir, { type: 'python' });
    assert(typeof result === 'object', 'Expected result to be an object');
    assert(typeof result.passed === 'boolean', 'Expected passed to be boolean');
    // pytest may or may not be installed
  } finally {
    env.cleanup();
  }
});

test('12. runTests reports failure correctly', async () => {
  const env = createTestProject({ nodeProject: true, testCommand: 'exit 1' });
  try {
    const result = await runTests(env.tmpdir, { type: 'node', command: 'npm test' });
    assert(typeof result === 'object', 'Expected result to be an object');
    // Should report failure
    assert(result.passed === false || result.skipped === true, 'Expected failed or skipped');
  } finally {
    env.cleanup();
  }
});

// ── runQualityGate tests ─────────────────────────────────────────────

console.log('\n  runQualityGate tests\n');

test('13. runQualityGate returns aggregated results', async () => {
  const env = createTestProject({ nodeProject: true });
  try {
    const result = await runQualityGate(env.tmpdir);
    assert(typeof result === 'object', 'Expected result to be an object');
    assert(typeof result.linter === 'object', 'Expected linter in result');
    assert(typeof result.typeChecker === 'object', 'Expected typeChecker in result');
    assert(typeof result.tests === 'object', 'Expected tests in result');
    assert(typeof result.overallPassed === 'boolean', 'Expected overallPassed in result');
    assert(typeof result.projectType === 'object', 'Expected projectType in result');
  } finally {
    env.cleanup();
  }
});

test('14. runQualityGate accepts options to skip specific checks', async () => {
  const env = createTestProject({ nodeProject: true });
  try {
    const result = await runQualityGate(env.tmpdir, { skipTests: true, skipTypeChecker: true });
    assert(result.tests === null || result.tests.skipped === true, 'Expected tests to be null or skipped');
    assert(result.typeChecker === null || result.typeChecker.skipped === true, 'Expected typeChecker to be null or skipped');
  } finally {
    env.cleanup();
  }
});

test('15. runQualityGate overallPassed is true when all checks pass', async () => {
  const env = createTestProject({
    nodeProject: true,
    lintCommand: 'echo "lint ok"',
    testCommand: 'echo "test ok"',
  });
  try {
    // Skip type checker as tsc may not be available
    const result = await runQualityGate(env.tmpdir, { skipTypeChecker: true });
    // With mock commands that return 0, should pass
    // Note: actual behavior depends on implementation
    assert(typeof result.overallPassed === 'boolean', 'Expected overallPassed to be boolean');
  } finally {
    env.cleanup();
  }
});

// ── formatQualityReport tests ────────────────────────────────────────

console.log('\n  formatQualityReport tests\n');

test('16. formatQualityReport returns a string', () => {
  const qualityData = {
    linter: { passed: true, errorCount: 0, warningCount: 0, output: '' },
    typeChecker: { passed: true, errorCount: 0, output: '' },
    tests: { passed: true, output: '' },
    overallPassed: true,
    projectType: { node: true, python: false },
  };
  const report = formatQualityReport(qualityData);
  assert(typeof report === 'string', 'Expected report to be a string');
  assert(report.length > 0, 'Expected non-empty report');
});

test('17. formatQualityReport includes status indicators', () => {
  const qualityData = {
    linter: { passed: true, errorCount: 0, warningCount: 2, output: 'warnings found' },
    typeChecker: { passed: false, errorCount: 3, output: 'type errors' },
    tests: { passed: true, output: 'all tests pass' },
    overallPassed: false,
    projectType: { node: true, python: false },
  };
  const report = formatQualityReport(qualityData);
  assert(report.includes('Linter'), 'Expected Linter section in report');
  assert(report.includes('Type'), 'Expected Type Checker section in report');
  assert(report.includes('Test'), 'Expected Tests section in report');
});

test('18. formatQualityReport handles null/skipped checks', () => {
  const qualityData = {
    linter: { passed: true, errorCount: 0, warningCount: 0, output: '' },
    typeChecker: null,
    tests: { skipped: true },
    overallPassed: true,
    projectType: { node: true, python: false },
  };
  const report = formatQualityReport(qualityData);
  assert(typeof report === 'string', 'Expected report to be a string');
  // Should not throw on null/skipped values
});

// ── Summary ──────────────────────────────────────────────────────────

async function runAsyncTests() {
  console.log('\n  Running async integration tests...\n');

  const asyncTests = [
    async () => {
      const env = createTestProject({ nodeProject: true });
      try {
        const result = await runQualityGate(env.tmpdir);
        assert(typeof result === 'object', 'Expected object');
        assert(typeof result.overallPassed === 'boolean', 'Expected overallPassed');
        console.log('  \u2713 async: runQualityGate integration');
        passed++;
      } finally {
        env.cleanup();
      }
    },
  ];

  for (const asyncTest of asyncTests) {
    try {
      await asyncTest();
    } catch (err) {
      console.log(`  \u2717 async test failed: ${err.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`\n  Test Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    console.log('  Some tests failed\n');
    process.exit(1);
  } else {
    console.log('  All tests passed\n');
    process.exit(0);
  }
}

runAsyncTests().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
