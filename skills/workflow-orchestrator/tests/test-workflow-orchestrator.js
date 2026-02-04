#!/usr/bin/env node

/**
 * Workflow Orchestrator Tests
 *
 * Tests for workflow-orchestrator skill functions.
 * Follows TDD pattern used in other jade-dev-assist tests.
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

// ── Helpers ──────────────────────────────────────────────────────────

function createTestEnv() {
    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-test-'));

    return {
        tmpdir,
        cleanup() {
            fs.rmSync(tmpdir, { recursive: true, force: true });
        }
    };
}

// ── Import workflow-orchestrator ─────────────────────────────────────

let generateTaskList, triggerSwarmRun, monitorSwarmStatus, updateGitHubProject;
let detectConflicts, generateRunSummary, generateTokenReport;

try {
    const workflow = require('../index');
    generateTaskList = workflow.generateTaskList;
    triggerSwarmRun = workflow.triggerSwarmRun;
    monitorSwarmStatus = workflow.monitorSwarmStatus;
    updateGitHubProject = workflow.updateGitHubProject;
    detectConflicts = workflow.detectConflicts;
    generateRunSummary = workflow.generateRunSummary;
    generateTokenReport = workflow.generateTokenReport;
} catch (err) {
    console.log('\nFATAL: Could not load workflow-orchestrator/index.js');
    console.log(`  ${err.message}\n`);
    console.log('All tests will be marked as failed.\n');
    process.exit(1);
}

// ── Task List Generation Tests ──────────────────────────────────────

console.log('\n  Task List Generation Tests\n');

test('1. generateTaskList creates tasks from plan', () => {
    const plan = 'Implement feature X\nAdd tests for Y\nUpdate docs';
    const tasks = generateTaskList(plan);

    assert(Array.isArray(tasks), 'Expected tasks to be an array');
    assert(tasks.length > 0, 'Expected at least one task');
    assert(tasks[0].title, 'Expected task to have title');
    assert(tasks[0].id, 'Expected task to have id');
});

test('2. generateTaskList parses numbered list', () => {
    const plan = '1. First task\n2. Second task\n3. Third task';
    const tasks = generateTaskList(plan);

    assert(tasks.length === 3, `Expected 3 tasks, got ${tasks.length}`);
    assert(tasks[0].title.includes('First task'), 'Expected first task title');
    assert(tasks[1].title.includes('Second task'), 'Expected second task title');
});

test('3. generateTaskList parses bullet list', () => {
    const plan = '- First task\n- Second task\n- Third task';
    const tasks = generateTaskList(plan);

    assert(tasks.length === 3, `Expected 3 tasks, got ${tasks.length}`);
});

test('4. generateTaskList handles empty input', () => {
    const tasks = generateTaskList('');

    assert(Array.isArray(tasks), 'Expected empty array');
    assert(tasks.length === 0, 'Expected no tasks from empty input');
});

// ── Swarm Integration Tests ─────────────────────────────────────────

console.log('\n  Swarm Integration Tests\n');

test('5. triggerSwarmRun validates input', () => {
    let threw = false;
    try {
        triggerSwarmRun();
    } catch (err) {
        threw = true;
        assert(err.message.includes('required'), 'Expected error about required fields');
    }
    assert(threw, 'Expected triggerSwarmRun to throw on missing input');
});

test('6. triggerSwarmRun returns run metadata', () => {
    const env = createTestEnv();
    try {
        const result = triggerSwarmRun({
            tasks: [{ id: 'test-1', title: 'Test task' }],
            projectPath: env.tmpdir,
            dryRun: true
        });

        assert(result.runId, 'Expected runId in result');
        assert(result.status, 'Expected status in result');
        assert(result.tasks, 'Expected tasks in result');
    } finally {
        env.cleanup();
    }
});

test('7. monitorSwarmStatus reads run state', () => {
    const env = createTestEnv();
    try {
        // Create mock run directory
        const runDir = path.join(env.tmpdir, '.jade-swarm', 'runs', 'test-run');
        fs.mkdirSync(runDir, { recursive: true });

        const statusFile = path.join(runDir, 'status.json');
        fs.writeFileSync(statusFile, JSON.stringify({
            status: 'running',
            tasksTotal: 3,
            tasksCompleted: 1
        }));

        const status = monitorSwarmStatus('test-run', { baseDir: env.tmpdir });

        assert(status.status === 'running', 'Expected running status');
        assert(status.tasksTotal === 3, 'Expected 3 total tasks');
        assert(status.tasksCompleted === 1, 'Expected 1 completed task');
    } finally {
        env.cleanup();
    }
});

test('8. monitorSwarmStatus handles missing run', () => {
    const status = monitorSwarmStatus('nonexistent-run', { baseDir: '/tmp' });

    assert(status.status === 'not_found', 'Expected not_found status');
});

// ── GitHub Projects Integration Tests ───────────────────────────────

console.log('\n  GitHub Projects Integration Tests\n');

test('9. updateGitHubProject validates inputs', () => {
    let threw = false;
    try {
        updateGitHubProject();
    } catch (err) {
        threw = true;
    }
    assert(threw, 'Expected updateGitHubProject to throw on missing input');
});

test('10. updateGitHubProject constructs gh command', () => {
    const result = updateGitHubProject({
        itemId: 'item-123',
        fieldId: 'field-456',
        value: 'In Progress',
        dryRun: true
    });

    assert(result.command, 'Expected command in result');
    assert(result.command.includes('gh'), 'Expected gh CLI command');
    assert(result.command.includes('item-123'), 'Expected itemId in command');
});

// ── Conflict Detection Tests ────────────────────────────────────────

console.log('\n  Conflict Detection Tests\n');

test('11. detectConflicts finds overlapping file modifications', () => {
    const tasks = [
        {
            id: 'task-1',
            modifiedFiles: ['src/main.js', 'src/utils.js']
        },
        {
            id: 'task-2',
            modifiedFiles: ['src/utils.js', 'src/config.js']
        },
        {
            id: 'task-3',
            modifiedFiles: ['docs/README.md']
        }
    ];

    const conflicts = detectConflicts(tasks);

    assert(Array.isArray(conflicts), 'Expected conflicts to be an array');
    assert(conflicts.length > 0, 'Expected at least one conflict');

    const utilsConflict = conflicts.find(c =>
        c.file === 'src/utils.js' && c.tasks.includes('task-1') && c.tasks.includes('task-2')
    );
    assert(utilsConflict, 'Expected conflict on src/utils.js');
});

test('12. detectConflicts returns empty for non-overlapping changes', () => {
    const tasks = [
        {
            id: 'task-1',
            modifiedFiles: ['src/main.js']
        },
        {
            id: 'task-2',
            modifiedFiles: ['src/config.js']
        }
    ];

    const conflicts = detectConflicts(tasks);

    assert(conflicts.length === 0, 'Expected no conflicts');
});

test('13. detectConflicts handles empty task list', () => {
    const conflicts = detectConflicts([]);

    assert(Array.isArray(conflicts), 'Expected array');
    assert(conflicts.length === 0, 'Expected no conflicts from empty list');
});

// ── Reporting Tests ─────────────────────────────────────────────────

console.log('\n  Reporting Tests\n');

test('14. generateRunSummary creates report', () => {
    const runData = {
        runId: 'test-run-123',
        tasksTotal: 10,
        tasksCompleted: 8,
        tasksFailed: 2,
        tasksCached: 3,
        startTime: Date.now() - 60000,
        endTime: Date.now()
    };

    const summary = generateRunSummary(runData);

    assert(summary.includes('test-run-123'), 'Expected runId in summary');
    assert(summary.includes('8'), 'Expected completed count');
    assert(summary.includes('2'), 'Expected failed count');
});

test('15. generateTokenReport shows token usage', () => {
    const tokenData = {
        totalTokens: 50000,
        cachedTokens: 30000,
        tasks: [
            { id: 'task-1', tokens: 10000, cached: 5000 },
            { id: 'task-2', tokens: 15000, cached: 10000 }
        ]
    };

    const report = generateTokenReport(tokenData);

    assert(report.includes('50000'), 'Expected total tokens');
    assert(report.includes('30000'), 'Expected cached tokens');
    assert(report.includes('task-1'), 'Expected task-1 in report');
});

test('16. generateTokenReport handles empty data', () => {
    const report = generateTokenReport({ totalTokens: 0, cachedTokens: 0, tasks: [] });

    assert(report.includes('0'), 'Expected 0 tokens');
});

// ── Print Summary ────────────────────────────────────────────────────

console.log('\n' + '='.repeat(50));
console.log(`\n  Tests: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
