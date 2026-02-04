#!/usr/bin/env node

/**
 * Fixer Module Tests (lib/fixer.js)
 *
 * Tests for autonomous bug fixing functionality including:
 * - CI failure detection and analysis
 * - Log parsing and error extraction
 * - Root cause analysis workflow
 * - Auto-fix + test verification cycle
 *
 * TDD red phase: all tests written before implementation.
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
        console.log(`  ✓ ${name}`);
        passed++;
    } catch (err) {
        console.log(`  ✗ ${name}`);
        console.log(`    Error: ${err.message}`);
        if (err.stack) {
            console.log(`    Stack: ${err.stack.split('\n').slice(1, 3).join('\n')}`);
        }
        failed++;
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

// ── Test Fixtures ────────────────────────────────────────────────────

const SAMPLE_CI_FAILURE_OUTPUT = `
FAIL tests/auth.test.ts
  ● Authentication › should login with valid credentials

    TypeError: Cannot read property 'id' of undefined

      at Object.<anonymous> (tests/auth.test.ts:45:32)
      at processTicksAndRejections (internal/process/task_queues.js:95:5)

FAIL tests/user.test.ts
  ● User Management › should create new user

    ValidationError: Email is required

      at validateUser (src/validators.ts:12:11)
      at createUser (src/user-service.ts:23:5)

Test Suites: 2 failed, 8 passed, 10 total
Tests:       2 failed, 45 passed, 47 total
`;

const SAMPLE_STACK_TRACE = `
Error: Connection timeout
    at Timeout._onTimeout (/app/src/db.js:145:15)
    at listOnTimeout (internal/timers.js:554:17)
    at processTimers (internal/timers.js:497:7)
`;

const SAMPLE_LOG_OUTPUT = `
[2026-02-04T10:23:15.342Z] INFO: Server starting on port 3000
[2026-02-04T10:23:15.450Z] INFO: Database connected
[2026-02-04T10:23:20.123Z] ERROR: Redis connection timeout
[2026-02-04T10:23:20.124Z] ERROR: Failed to initialize cache
[2026-02-04T10:23:20.125Z] FATAL: Application startup failed
`;

// ── Helper Functions ─────────────────────────────────────────────────

function createTestProject() {
    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'jade-fixer-test-'));
    const projectPath = path.join(tmpdir, 'test-project');
    fs.mkdirSync(projectPath, { recursive: true });

    return {
        tmpdir,
        projectPath,
        cleanup() {
            fs.rmSync(tmpdir, { recursive: true, force: true });
        }
    };
}

// ── Tests ────────────────────────────────────────────────────────────

console.log('\nRunning fixer module tests...\n');

// ── Error Parsing Tests ──────────────────────────────────────────────

test('parseTestFailures: extracts test failures from CI output', () => {
    const { parseTestFailures } = require('../lib/fixer');

    const failures = parseTestFailures(SAMPLE_CI_FAILURE_OUTPUT);

    assert(Array.isArray(failures), 'Should return an array');
    assert(failures.length === 2, `Should find 2 failures, found ${failures.length}`);

    const [failure1, failure2] = failures;

    assert(failure1.file === 'tests/auth.test.ts', 'First failure file should be auth.test.ts');
    assert(failure1.test.includes('should login'), 'First failure test name should include "should login"');
    assert(failure1.error.includes('TypeError'), 'First failure should be TypeError');
    assert(failure1.error.includes('Cannot read property'), 'First failure should include property error');

    assert(failure2.file === 'tests/user.test.ts', 'Second failure file should be user.test.ts');
    assert(failure2.error.includes('ValidationError'), 'Second failure should be ValidationError');
});

test('parseTestFailures: handles empty output', () => {
    const { parseTestFailures } = require('../lib/fixer');

    const failures = parseTestFailures('');

    assert(Array.isArray(failures), 'Should return an array');
    assert(failures.length === 0, 'Should return empty array for no failures');
});

test('parseStackTrace: extracts file paths and line numbers', () => {
    const { parseStackTrace } = require('../lib/fixer');

    const parsed = parseStackTrace(SAMPLE_STACK_TRACE);

    assert(Array.isArray(parsed), 'Should return an array');
    assert(parsed.length > 0, 'Should find at least one frame');

    const firstFrame = parsed[0];
    assert(firstFrame.file, 'Should extract file path');
    assert(firstFrame.file.includes('db.js'), 'Should find db.js file');
    assert(typeof firstFrame.line === 'number', 'Should extract line number');
    assert(firstFrame.line === 145, `Line should be 145, got ${firstFrame.line}`);
});

test('extractErrorPatterns: identifies common error types', () => {
    const { extractErrorPatterns } = require('../lib/fixer');

    const patterns = extractErrorPatterns(SAMPLE_CI_FAILURE_OUTPUT);

    assert(Array.isArray(patterns), 'Should return an array');
    assert(patterns.length > 0, 'Should find at least one pattern');

    const hasTypeError = patterns.some(p => p.type === 'TypeError');
    const hasValidationError = patterns.some(p => p.type === 'ValidationError');

    assert(hasTypeError, 'Should detect TypeError pattern');
    assert(hasValidationError, 'Should detect ValidationError pattern');
});

// ── Log Analysis Tests ───────────────────────────────────────────────

test('parseLogOutput: extracts errors and warnings from logs', () => {
    const { parseLogOutput } = require('../lib/fixer');

    const parsed = parseLogOutput(SAMPLE_LOG_OUTPUT);

    assert(parsed.errors.length > 0, 'Should find error logs');
    assert(parsed.warnings.length >= 0, 'Should have warnings array');

    const hasRedisError = parsed.errors.some(e => e.message.includes('Redis'));
    assert(hasRedisError, 'Should find Redis connection error');
});

test('parseLogOutput: handles empty logs', () => {
    const { parseLogOutput } = require('../lib/fixer');

    const parsed = parseLogOutput('');

    assert(Array.isArray(parsed.errors), 'Should return errors array');
    assert(Array.isArray(parsed.warnings), 'Should return warnings array');
    assert(parsed.errors.length === 0, 'Empty logs should have no errors');
});

// ── Root Cause Analysis Tests ────────────────────────────────────────

test('analyzeRootCause: identifies likely root cause from failures', () => {
    const { analyzeRootCause, parseTestFailures } = require('../lib/fixer');

    const failures = parseTestFailures(SAMPLE_CI_FAILURE_OUTPUT);
    const analysis = analyzeRootCause(failures);

    assert(analysis.summary, 'Should provide summary');
    assert(analysis.likelyFiles, 'Should identify likely problem files');
    assert(Array.isArray(analysis.likelyFiles), 'Likely files should be array');
    assert(analysis.confidence, 'Should provide confidence score');
    assert(typeof analysis.confidence === 'number', 'Confidence should be number');
});

test('analyzeRootCause: handles single failure', () => {
    const { analyzeRootCause } = require('../lib/fixer');

    const singleFailure = [{
        file: 'tests/login.test.ts',
        test: 'should handle invalid password',
        error: 'AssertionError: expected 401 to equal 403',
        stack: 'at login.test.ts:23:15'
    }];

    const analysis = analyzeRootCause(singleFailure);

    assert(analysis.summary, 'Should analyze single failure');
    assert(analysis.likelyFiles.length > 0, 'Should identify problem files');
});

// ── Fix Generation Tests ─────────────────────────────────────────────

test('generateFixPrompt: creates detailed prompt for Claude', () => {
    const { generateFixPrompt, parseTestFailures, analyzeRootCause } = require('../lib/fixer');

    const failures = parseTestFailures(SAMPLE_CI_FAILURE_OUTPUT);
    const analysis = analyzeRootCause(failures);

    const prompt = generateFixPrompt({
        failures,
        analysis,
        projectPath: '/test/project',
        context: 'Node.js API project'
    });

    assert(typeof prompt === 'string', 'Should return string prompt');
    assert(prompt.length > 100, 'Prompt should be detailed');
    assert(prompt.includes('TypeError'), 'Should include error details');
    assert(prompt.includes('auth.test.ts'), 'Should include failing test file');
});

test('generateFixPrompt: includes extended thinking for complex bugs', () => {
    const { generateFixPrompt } = require('../lib/fixer');

    const prompt = generateFixPrompt({
        failures: [{
            file: 'test.js',
            test: 'complex scenario',
            error: 'Intermittent race condition',
            stack: 'at test.js:100'
        }],
        analysis: {
            summary: 'Complex concurrency issue',
            likelyFiles: ['src/worker.js', 'src/queue.js'],
            confidence: 0.4
        },
        projectPath: '/test/project',
        useExtendedThinking: true
    });

    assert(prompt.includes('thinking') || prompt.includes('extended'),
        'Should indicate extended thinking for complex bugs');
});

// ── Fix Verification Tests ───────────────────────────────────────────

test('verifyFix: returns success when tests pass', () => {
    const { verifyFix } = require('../lib/fixer');

    const { projectPath, cleanup } = createTestProject();

    try {
        // Create a passing test
        const testFile = path.join(projectPath, 'test.js');
        fs.writeFileSync(testFile, `
            console.log('Test passed');
            process.exit(0);
        `);

        const result = verifyFix({
            projectPath,
            testCommand: `node ${testFile}`
        });

        assert(result.success === true, 'Should report success for passing tests');
        assert(!result.output.includes('FAIL'), 'Output should not contain FAIL');
    } finally {
        cleanup();
    }
});

test('verifyFix: returns failure when tests fail', () => {
    const { verifyFix } = require('../lib/fixer');

    const { projectPath, cleanup } = createTestProject();

    try {
        // Create a failing test
        const testFile = path.join(projectPath, 'test.js');
        fs.writeFileSync(testFile, `
            console.log('Test failed');
            process.exit(1);
        `);

        const result = verifyFix({
            projectPath,
            testCommand: `node ${testFile}`
        });

        assert(result.success === false, 'Should report failure for failing tests');
    } finally {
        cleanup();
    }
});

// ── Integration Tests ────────────────────────────────────────────────

test('fixBug: orchestrates full fix workflow', async () => {
    const { fixBug } = require('../lib/fixer');

    const { projectPath, cleanup } = createTestProject();

    try {
        // Create a simple failing scenario
        const srcFile = path.join(projectPath, 'src', 'auth.js');
        fs.mkdirSync(path.dirname(srcFile), { recursive: true });
        fs.writeFileSync(srcFile, `
            module.exports.login = function(user) {
                return user.id; // Will fail if user is undefined
            };
        `);

        const testFile = path.join(projectPath, 'tests', 'auth.test.js');
        fs.mkdirSync(path.dirname(testFile), { recursive: true });
        fs.writeFileSync(testFile, `
            const { login } = require('../src/auth');
            const user = { id: 123 };
            const result = login(user);
            if (result !== 123) throw new Error('Failed');
            console.log('PASS');
        `);

        const result = await fixBug({
            source: 'description',
            description: 'Login fails when user is undefined',
            projectPath,
            testCommand: `node ${testFile}`,
            dryRun: true // Don't actually apply fixes in test
        });

        assert(result.analyzed === true, 'Should complete analysis');
        assert(result.fixesGenerated, 'Should generate fixes');
    } finally {
        cleanup();
    }
});

test('fixBug: handles CI source type', async () => {
    const { fixBug } = require('../lib/fixer');

    const result = await fixBug({
        source: 'ci',
        projectPath: '/fake/path',
        dryRun: true,
        skipCiCheck: true // Skip actual CI check in tests
    });

    assert(result.source === 'ci', 'Should accept CI source type');
});

test('fixBug: handles logs source type', async () => {
    const { fixBug } = require('../lib/fixer');

    const result = await fixBug({
        source: 'logs',
        logFile: '/fake/logs.txt',
        projectPath: '/fake/path',
        dryRun: true,
        skipLogRead: true // Skip actual log reading in tests
    });

    assert(result.source === 'logs', 'Should accept logs source type');
});

// ── Summary ──────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(50));
if (failed === 0) {
    console.log(`\n  ✓ All tests passed (${passed}/${passed + failed})\n`);
    process.exit(0);
} else {
    console.log(`\n  ✗ Some tests failed (${passed} passed, ${failed} failed)\n`);
    process.exit(1);
}
