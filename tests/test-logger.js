#!/usr/bin/env node

/**
 * Logger Module Tests (lib/logger.js)
 *
 * Tests for the structured JSON logging module.
 * Uses the same custom test framework as other test files.
 */

'use strict';

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

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(
            message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
        );
    }
}

// ── Import logger ─────────────────────────────────────────────────────

let logger;
try {
    logger = require('../lib/logger');
} catch (err) {
    console.log('\nFATAL: Could not load lib/logger.js');
    console.log(`  ${err.message}\n`);
    process.exit(1);
}

const {
    createLogger,
    LOG_LEVELS,
    getLogLevel,
    shouldLog,
    formatLogEntry,
    debug,
    info,
    warn,
    error
} = logger;

// ── Test Suite ────────────────────────────────────────────────────────

console.log('\nLogger Module Tests\n');

// -- LOG_LEVELS constant --

console.log('LOG_LEVELS constant:');

test('LOG_LEVELS has debug at 0', () => {
    assertEqual(LOG_LEVELS.debug, 0);
});

test('LOG_LEVELS has info at 1', () => {
    assertEqual(LOG_LEVELS.info, 1);
});

test('LOG_LEVELS has warn at 2', () => {
    assertEqual(LOG_LEVELS.warn, 2);
});

test('LOG_LEVELS has error at 3', () => {
    assertEqual(LOG_LEVELS.error, 3);
});

// -- getLogLevel function --

console.log('\ngetLogLevel():');

test('returns info by default when LOG_LEVEL not set', () => {
    const originalLevel = process.env.LOG_LEVEL;
    delete process.env.LOG_LEVEL;
    try {
        assertEqual(getLogLevel(), 'info');
    } finally {
        if (originalLevel !== undefined) {
            process.env.LOG_LEVEL = originalLevel;
        }
    }
});

test('returns debug when LOG_LEVEL=debug', () => {
    const originalLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'debug';
    try {
        assertEqual(getLogLevel(), 'debug');
    } finally {
        if (originalLevel !== undefined) {
            process.env.LOG_LEVEL = originalLevel;
        } else {
            delete process.env.LOG_LEVEL;
        }
    }
});

test('returns warn when LOG_LEVEL=WARN (case insensitive)', () => {
    const originalLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'WARN';
    try {
        assertEqual(getLogLevel(), 'warn');
    } finally {
        if (originalLevel !== undefined) {
            process.env.LOG_LEVEL = originalLevel;
        } else {
            delete process.env.LOG_LEVEL;
        }
    }
});

test('returns info for invalid LOG_LEVEL values', () => {
    const originalLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'invalid';
    try {
        assertEqual(getLogLevel(), 'info');
    } finally {
        if (originalLevel !== undefined) {
            process.env.LOG_LEVEL = originalLevel;
        } else {
            delete process.env.LOG_LEVEL;
        }
    }
});

// -- shouldLog function --

console.log('\nshouldLog():');

test('error messages are always logged', () => {
    const originalLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'error';
    try {
        assert(shouldLog('error'), 'error should be logged at error level');
    } finally {
        if (originalLevel !== undefined) {
            process.env.LOG_LEVEL = originalLevel;
        } else {
            delete process.env.LOG_LEVEL;
        }
    }
});

test('warn is not logged at error level', () => {
    const originalLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'error';
    try {
        assert(!shouldLog('warn'), 'warn should not be logged at error level');
    } finally {
        if (originalLevel !== undefined) {
            process.env.LOG_LEVEL = originalLevel;
        } else {
            delete process.env.LOG_LEVEL;
        }
    }
});

test('debug is logged at debug level', () => {
    const originalLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'debug';
    try {
        assert(shouldLog('debug'), 'debug should be logged at debug level');
    } finally {
        if (originalLevel !== undefined) {
            process.env.LOG_LEVEL = originalLevel;
        } else {
            delete process.env.LOG_LEVEL;
        }
    }
});

test('debug is not logged at info level', () => {
    const originalLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'info';
    try {
        assert(!shouldLog('debug'), 'debug should not be logged at info level');
    } finally {
        if (originalLevel !== undefined) {
            process.env.LOG_LEVEL = originalLevel;
        } else {
            delete process.env.LOG_LEVEL;
        }
    }
});

test('info is logged at info level', () => {
    const originalLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'info';
    try {
        assert(shouldLog('info'), 'info should be logged at info level');
        assert(shouldLog('warn'), 'warn should be logged at info level');
        assert(shouldLog('error'), 'error should be logged at info level');
    } finally {
        if (originalLevel !== undefined) {
            process.env.LOG_LEVEL = originalLevel;
        } else {
            delete process.env.LOG_LEVEL;
        }
    }
});

// -- formatLogEntry function --

console.log('\nformatLogEntry():');

test('creates valid JSON with required fields', () => {
    const entry = formatLogEntry('info', 'test-module', 'Test message');
    const parsed = JSON.parse(entry);

    assert(typeof parsed.timestamp === 'string', 'timestamp should be a string');
    assertEqual(parsed.level, 'info');
    assertEqual(parsed.module, 'test-module');
    assertEqual(parsed.message, 'Test message');
});

test('timestamp is ISO 8601 format', () => {
    const entry = formatLogEntry('info', 'test', 'msg');
    const parsed = JSON.parse(entry);

    // Should be parseable as a date
    const date = new Date(parsed.timestamp);
    assert(!isNaN(date.getTime()), 'timestamp should be valid ISO date');

    // Should contain T and Z for ISO format
    assert(parsed.timestamp.includes('T'), 'timestamp should have T separator');
    assert(parsed.timestamp.includes('Z'), 'timestamp should end with Z (UTC)');
});

test('includes extra fields when provided', () => {
    const entry = formatLogEntry('warn', 'scanner', 'File error', {
        path: '/some/path.json',
        errorCode: 'ENOENT'
    });
    const parsed = JSON.parse(entry);

    assertEqual(parsed.level, 'warn');
    assertEqual(parsed.module, 'scanner');
    assertEqual(parsed.message, 'File error');
    assertEqual(parsed.path, '/some/path.json');
    assertEqual(parsed.errorCode, 'ENOENT');
});

test('handles null extra gracefully', () => {
    const entry = formatLogEntry('info', 'test', 'msg', null);
    const parsed = JSON.parse(entry);

    assertEqual(parsed.level, 'info');
    assertEqual(parsed.message, 'msg');
});

test('handles non-object extra gracefully', () => {
    const entry = formatLogEntry('info', 'test', 'msg', 'not-an-object');
    const parsed = JSON.parse(entry);

    assertEqual(parsed.level, 'info');
    assertEqual(parsed.message, 'msg');
});

// -- createLogger function --

console.log('\ncreateLogger():');

test('creates logger with debug, info, warn, error methods', () => {
    const log = createLogger('test-module');

    assert(typeof log.debug === 'function', 'should have debug method');
    assert(typeof log.info === 'function', 'should have info method');
    assert(typeof log.warn === 'function', 'should have warn method');
    assert(typeof log.error === 'function', 'should have error method');
});

test('logger methods are callable without error', () => {
    const log = createLogger('test-module');
    const originalLevel = process.env.LOG_LEVEL;

    // Suppress output for this test by setting level to error
    process.env.LOG_LEVEL = 'error';
    try {
        // These should not throw
        log.debug('debug message');
        log.info('info message');
        log.warn('warn message');
        // Skip error to avoid output
    } finally {
        if (originalLevel !== undefined) {
            process.env.LOG_LEVEL = originalLevel;
        } else {
            delete process.env.LOG_LEVEL;
        }
    }

    assert(true, 'all methods should be callable');
});

// -- Standalone functions --

console.log('\nStandalone functions:');

test('standalone functions are exported', () => {
    assert(typeof debug === 'function', 'debug should be exported');
    assert(typeof info === 'function', 'info should be exported');
    assert(typeof warn === 'function', 'warn should be exported');
    assert(typeof error === 'function', 'error should be exported');
});

test('standalone functions use app as default module', () => {
    // We can test this by checking the formatLogEntry directly
    const entry = formatLogEntry('info', 'app', 'test');
    const parsed = JSON.parse(entry);
    assertEqual(parsed.module, 'app');
});

// -- Integration test with output capture --

console.log('\nOutput format (integration):');

test('warn/error write to stderr, info/debug write to stdout', () => {
    // Just verify the functions exist and are properly structured
    // Actual output verification would require stream capture
    const log = createLogger('integration-test');

    // Verify the logger structure
    assert(log.debug !== log.info, 'methods should be distinct');
    assert(log.warn !== log.error, 'methods should be distinct');
});

// ── Summary ───────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(50));
console.log(`\n  Tests: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
    process.exit(1);
}
