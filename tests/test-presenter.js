#!/usr/bin/env node

/**
 * Presenter Module Tests (lib/presenter.js)
 *
 * Tests for presentTasks() -- renders ranked task tables with box-drawing chars.
 * Uses the same custom test framework as test-plugin.js, test-scanner.js, test-scorer.js.
 *
 * TDD red phase: all 10 tests written before implementation.
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

// ── Mock Output Stream ───────────────────────────────────────────────

/**
 * Creates a mock writable stream that captures all written chunks.
 */
function createMockStream() {
    const chunks = [];
    return {
        write(chunk) { chunks.push(chunk); },
        getOutput() { return chunks.join(''); }
    };
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Build a minimal ranked task (as produced by scoreTasks).
 */
function makeRankedTask(overrides) {
    return Object.assign({
        _projectName: 'jade-cli',
        title: 'Fix Node.js build configuration',
        _score: 78.0,
        complexity: 'S'
    }, overrides);
}

// ── Import presenter ─────────────────────────────────────────────────

let presentTasks;
try {
    const presenter = require('../lib/presenter');
    presentTasks = presenter.presentTasks;
} catch (err) {
    console.log('\nFATAL: Could not load lib/presenter.js');
    console.log(`  ${err.message}\n`);
    console.log('All 10 tests will be marked as failed.\n');
    process.exit(1);
}

// ═════════════════════════════════════════════════════════════════════
// TESTS
// ═════════════════════════════════════════════════════════════════════

console.log('\n  presentTasks tests\n');

// 1. Renders table with box-drawing chars
test('1. Renders table with box-drawing chars', () => {
    const tasks = [
        makeRankedTask({ _score: 80.0 }),
        makeRankedTask({ _projectName: 'jade-index', title: 'Add semantic search', _score: 65.0, complexity: 'M' }),
        makeRankedTask({ _projectName: 'jade-dev-assist', title: 'Implement scanner', _score: 50.0, complexity: 'L' })
    ];
    const mockStream = createMockStream();
    presentTasks(tasks, { output: mockStream });
    const output = mockStream.getOutput();

    assert(output.includes('\u250c'), 'Expected top-left corner (\\u250c)');
    assert(output.includes('\u251c'), 'Expected left tee (\\u251c)');
    assert(output.includes('\u2514'), 'Expected bottom-left corner (\\u2514)');
    assert(output.includes('\u2502'), 'Expected vertical bar (\\u2502)');
    assert(output.includes('\u2500'), 'Expected horizontal bar (\\u2500)');
    assert(output.includes('\u252c'), 'Expected top tee (\\u252c)');
    assert(output.includes('\u2534'), 'Expected bottom tee (\\u2534)');
    assert(output.includes('\u253c'), 'Expected cross (\\u253c)');
    assert(output.includes('\u2510'), 'Expected top-right corner (\\u2510)');
    assert(output.includes('\u2518'), 'Expected bottom-right corner (\\u2518)');
    assert(output.includes('\u2524'), 'Expected right tee (\\u2524)');
});

// 2. Shows correct column headers
test('2. Shows correct column headers', () => {
    const tasks = [
        makeRankedTask({})
    ];
    const mockStream = createMockStream();
    presentTasks(tasks, { output: mockStream });
    const output = mockStream.getOutput();

    assert(output.includes('#'), 'Expected # column header');
    assert(output.includes('Project'), 'Expected Project column header');
    assert(output.includes('Task'), 'Expected Task column header');
    assert(output.includes('Score'), 'Expected Score column header');
    assert(output.includes('Size'), 'Expected Size column header');
});

// 3. Truncates project names >16 chars
test('3. Truncates project names >16 chars', () => {
    const longName = 'jade-swarm-superpowers'; // 22 chars
    const tasks = [
        makeRankedTask({ _projectName: longName })
    ];
    const mockStream = createMockStream();
    presentTasks(tasks, { output: mockStream });
    const output = mockStream.getOutput();

    // Should NOT contain the full long name
    assert(!output.includes(longName), 'Full project name should be truncated');
    // Should contain the truncated version with ellipsis
    // 16 chars = first 15 chars + ellipsis
    const truncated = longName.slice(0, 15) + '\u2026';
    assert(output.includes(truncated), `Expected truncated name "${truncated}" in output`);
});

// 4. Truncates task titles >40 chars
test('4. Truncates task titles >40 chars', () => {
    const longTitle = 'A very long task title that exceeds forty characters limit'; // 58 chars
    const tasks = [
        makeRankedTask({ title: longTitle })
    ];
    const mockStream = createMockStream();
    presentTasks(tasks, { output: mockStream });
    const output = mockStream.getOutput();

    assert(!output.includes(longTitle), 'Full task title should be truncated');
    const truncated = longTitle.slice(0, 39) + '\u2026';
    assert(output.includes(truncated), `Expected truncated title "${truncated}" in output`);
});

// 5. Defaults to 10 tasks
test('5. Defaults to 10 tasks', () => {
    const tasks = [];
    for (let i = 0; i < 15; i++) {
        tasks.push(makeRankedTask({
            title: `Task number ${i + 1}`,
            _score: 100 - i
        }));
    }
    const mockStream = createMockStream();
    presentTasks(tasks, { output: mockStream });
    const output = mockStream.getOutput();

    // Count data rows by looking for row numbers in the output
    // Data rows have a number followed by the vertical bar
    const lines = output.split('\n');
    let dataRowCount = 0;
    for (const line of lines) {
        // Match lines that look like data rows (have a rank number between vertical bars)
        if (/\u2502\s+\d+\s+\u2502/.test(line)) {
            dataRowCount++;
        }
    }
    assert(dataRowCount === 10, `Expected 10 data rows, got ${dataRowCount}`);

    // Verify that task 11 is not shown
    assert(!output.includes('Task number 11'), 'Task 11 should not appear');
});

// 6. Respects count option
test('6. Respects count option', () => {
    const tasks = [];
    for (let i = 0; i < 10; i++) {
        tasks.push(makeRankedTask({
            title: `Task number ${i + 1}`,
            _score: 100 - i
        }));
    }
    const mockStream = createMockStream();
    presentTasks(tasks, { count: 5, output: mockStream });
    const output = mockStream.getOutput();

    const lines = output.split('\n');
    let dataRowCount = 0;
    for (const line of lines) {
        if (/\u2502\s+\d+\s+\u2502/.test(line)) {
            dataRowCount++;
        }
    }
    assert(dataRowCount === 5, `Expected 5 data rows, got ${dataRowCount}`);

    // Verify that task 6 is not shown
    assert(!output.includes('Task number 6'), 'Task 6 should not appear');
});

// 7. Output order matches input order (pre-sorted)
test('7. Output order matches input order (pre-sorted)', () => {
    const tasks = [
        makeRankedTask({ title: 'First task', _score: 90.0 }),
        makeRankedTask({ title: 'Second task', _score: 70.0 }),
        makeRankedTask({ title: 'Third task', _score: 50.0 })
    ];
    const mockStream = createMockStream();
    presentTasks(tasks, { output: mockStream });
    const output = mockStream.getOutput();

    const firstIdx = output.indexOf('First task');
    const secondIdx = output.indexOf('Second task');
    const thirdIdx = output.indexOf('Third task');

    assert(firstIdx >= 0, 'First task should be in output');
    assert(secondIdx >= 0, 'Second task should be in output');
    assert(thirdIdx >= 0, 'Third task should be in output');
    assert(firstIdx < secondIdx, 'First task should appear before Second task');
    assert(secondIdx < thirdIdx, 'Second task should appear before Third task');
});

// 8. Handles empty task list
test('8. Handles empty task list', () => {
    const mockStream = createMockStream();
    presentTasks([], { output: mockStream });
    const output = mockStream.getOutput();

    assert(output.includes('(no tasks)'), 'Expected "(no tasks)" message for empty list');
});

// 9. Writes to custom output stream
test('9. Writes to custom output stream', () => {
    const tasks = [
        makeRankedTask({})
    ];
    const mockStream = createMockStream();

    // Temporarily replace process.stdout.write to detect accidental writes
    const origWrite = process.stdout.write;
    let stdoutCalled = false;
    process.stdout.write = function () {
        stdoutCalled = true;
        return origWrite.apply(process.stdout, arguments);
    };

    try {
        presentTasks(tasks, { output: mockStream });
    } finally {
        process.stdout.write = origWrite;
    }

    const output = mockStream.getOutput();
    assert(output.length > 0, 'Mock stream should have received output');
    assert(!stdoutCalled, 'process.stdout should not have been written to when custom output is provided');
});

// 10. Returns the formatted string
test('10. Returns the formatted string', () => {
    const tasks = [
        makeRankedTask({ title: 'Return value test', _score: 55.5, complexity: 'M' })
    ];
    const mockStream = createMockStream();
    const result = presentTasks(tasks, { output: mockStream });

    assert(typeof result === 'string', `Expected return type string, got ${typeof result}`);
    assert(result.length > 0, 'Return value should not be empty');
    assert(result.includes('Return value test'), 'Return value should contain the task title');
    assert(result.includes('\u2502'), 'Return value should contain box-drawing characters');
    assert(result === mockStream.getOutput(), 'Return value should match stream output');
});

// ── Summary ─────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(50));
console.log(`\n  Test Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
    console.log('  Some tests failed\n');
    process.exit(1);
} else {
    console.log('  All tests passed\n');
    process.exit(0);
}
