#!/usr/bin/env node

/**
 * Milestone Tracker Module Tests (lib/milestone-tracker.js)
 *
 * Tests for getMilestoneProgress(), getAllMilestonesProgress(),
 * and renderMilestoneTable().
 *
 * Uses the same custom test framework as test-executor.js, test-dispatcher.js, etc.
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
 * Creates a temporary environment with multiple projects for testing.
 *
 * @param {Object} options
 * @param {Object[]} options.projects - Array of project registry entries.
 * @param {Object} options.taskFiles  - Map of projectPath -> tasks data object.
 * @returns {{ tmpdir, registryPath, registry, cleanup }}
 */
function createTestEnv(options) {
    const opts = options || {};
    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'jade-milestone-test-'));

    const projects = opts.projects || [];
    const registry = {
        version: 1,
        projects_root: tmpdir,
        projects: projects
    };

    const registryPath = path.join(tmpdir, 'projects.json');
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

    // Create project directories and task files
    if (opts.taskFiles) {
        for (const [projectPath, tasksData] of Object.entries(opts.taskFiles)) {
            const taskDir = path.join(tmpdir, projectPath, '.claude', 'tasks');
            fs.mkdirSync(taskDir, { recursive: true });
            fs.writeFileSync(
                path.join(taskDir, 'tasks.json'),
                JSON.stringify(tasksData, null, 2)
            );
        }
    }

    return {
        tmpdir,
        registryPath,
        registry,
        cleanup() {
            fs.rmSync(tmpdir, { recursive: true, force: true });
        }
    };
}

/**
 * Standard test environment with multiple projects having various task states.
 */
function createStandardEnv() {
    return createTestEnv({
        projects: [
            { name: 'project-alpha', path: 'project-alpha', status: 'buildable', language: 'javascript' },
            { name: 'project-beta', path: 'project-beta', status: 'near-buildable', language: 'typescript' },
            { name: 'project-gamma', path: 'project-gamma', status: 'scaffolding', language: 'python' }
        ],
        taskFiles: {
            'project-alpha': {
                version: 1,
                project: 'project-alpha',
                tasks: [
                    { id: 'project-alpha/task-1', title: 'Alpha task 1', status: 'completed', complexity: 'S' },
                    { id: 'project-alpha/task-2', title: 'Alpha task 2', status: 'completed', complexity: 'M' },
                    { id: 'project-alpha/task-3', title: 'Alpha task 3', status: 'in_progress', complexity: 'S' },
                    { id: 'project-alpha/task-4', title: 'Alpha task 4', status: 'pending', complexity: 'L' }
                ]
            },
            'project-beta': {
                version: 1,
                project: 'project-beta',
                tasks: [
                    { id: 'project-beta/task-1', title: 'Beta task 1', status: 'completed', complexity: 'S' },
                    { id: 'project-beta/task-2', title: 'Beta task 2', status: 'pending', complexity: 'M' },
                    { id: 'project-beta/task-3', title: 'Beta task 3', status: 'pending', complexity: 'L' }
                ]
            },
            'project-gamma': {
                version: 1,
                project: 'project-gamma',
                tasks: []
            }
        }
    });
}

// ── Import milestone-tracker ────────────────────────────────────────

let getMilestoneProgress, getAllMilestonesProgress, renderMilestoneTable;
try {
    const milestoneTracker = require('../lib/milestone-tracker');
    getMilestoneProgress = milestoneTracker.getMilestoneProgress;
    getAllMilestonesProgress = milestoneTracker.getAllMilestonesProgress;
    renderMilestoneTable = milestoneTracker.renderMilestoneTable;
} catch (err) {
    console.log('\nFATAL: Could not load lib/milestone-tracker.js');
    console.log(`  ${err.message}\n`);
    console.log('All tests will be marked as failed.\n');
    process.exit(1);
}

// ═════════════════════════════════════════════════════════════════════
// 1. EXPORTS
// ═════════════════════════════════════════════════════════════════════

console.log('\n  Exports\n');

test('1. getMilestoneProgress is exported as a function', () => {
    assert(typeof getMilestoneProgress === 'function', 'getMilestoneProgress should be a function');
});

test('2. getAllMilestonesProgress is exported as a function', () => {
    assert(typeof getAllMilestonesProgress === 'function', 'getAllMilestonesProgress should be a function');
});

test('3. renderMilestoneTable is exported as a function', () => {
    assert(typeof renderMilestoneTable === 'function', 'renderMilestoneTable should be a function');
});

// ═════════════════════════════════════════════════════════════════════
// 2. getMilestoneProgress
// ═════════════════════════════════════════════════════════════════════

console.log('\n  getMilestoneProgress\n');

test('4. getMilestoneProgress counts correctly for project-alpha', () => {
    const env = createStandardEnv();
    try {
        const progress = getMilestoneProgress('project-alpha', {
            registryPath: env.registryPath,
            registry: env.registry
        });
        assert(progress != null, 'Progress should not be null');
        assert(progress.total === 4, `Expected total 4, got ${progress.total}`);
        assert(progress.completed === 2, `Expected completed 2, got ${progress.completed}`);
        assert(progress.inProgress === 1, `Expected inProgress 1, got ${progress.inProgress}`);
        assert(progress.pending === 1, `Expected pending 1, got ${progress.pending}`);
    } finally {
        env.cleanup();
    }
});

test('5. getMilestoneProgress computes correct percentage', () => {
    const env = createStandardEnv();
    try {
        const progress = getMilestoneProgress('project-alpha', {
            registryPath: env.registryPath,
            registry: env.registry
        });
        // 2 completed out of 4 total = 50%
        assert(progress.percentage === 50, `Expected percentage 50, got ${progress.percentage}`);
    } finally {
        env.cleanup();
    }
});

test('6. getMilestoneProgress counts correctly for project-beta', () => {
    const env = createStandardEnv();
    try {
        const progress = getMilestoneProgress('project-beta', {
            registryPath: env.registryPath,
            registry: env.registry
        });
        assert(progress.total === 3, `Expected total 3, got ${progress.total}`);
        assert(progress.completed === 1, `Expected completed 1, got ${progress.completed}`);
        assert(progress.inProgress === 0, `Expected inProgress 0, got ${progress.inProgress}`);
        assert(progress.pending === 2, `Expected pending 2, got ${progress.pending}`);
    } finally {
        env.cleanup();
    }
});

test('7. getMilestoneProgress handles project with zero tasks', () => {
    const env = createStandardEnv();
    try {
        const progress = getMilestoneProgress('project-gamma', {
            registryPath: env.registryPath,
            registry: env.registry
        });
        assert(progress.total === 0, `Expected total 0, got ${progress.total}`);
        assert(progress.completed === 0, `Expected completed 0, got ${progress.completed}`);
        assert(progress.inProgress === 0, `Expected inProgress 0, got ${progress.inProgress}`);
        assert(progress.pending === 0, `Expected pending 0, got ${progress.pending}`);
        assert(progress.percentage === 0, `Expected percentage 0, got ${progress.percentage}`);
    } finally {
        env.cleanup();
    }
});

test('8. percentage is Math.round for non-integer percentages', () => {
    // project-beta: 1/3 = 33.33... -> should round to 33
    const env = createStandardEnv();
    try {
        const progress = getMilestoneProgress('project-beta', {
            registryPath: env.registryPath,
            registry: env.registry
        });
        assert(progress.percentage === 33, `Expected percentage 33, got ${progress.percentage}`);
    } finally {
        env.cleanup();
    }
});

// ═════════════════════════════════════════════════════════════════════
// 3. getAllMilestonesProgress
// ═════════════════════════════════════════════════════════════════════

console.log('\n  getAllMilestonesProgress\n');

test('9. getAllMilestonesProgress returns all projects', () => {
    const env = createStandardEnv();
    try {
        const allProgress = getAllMilestonesProgress({
            registryPath: env.registryPath,
            registry: env.registry
        });
        assert(Array.isArray(allProgress), 'allProgress should be an array');
        assert(allProgress.length === 3, `Expected 3 project entries, got ${allProgress.length}`);
    } finally {
        env.cleanup();
    }
});

test('10. getAllMilestonesProgress entries have project name', () => {
    const env = createStandardEnv();
    try {
        const allProgress = getAllMilestonesProgress({
            registryPath: env.registryPath,
            registry: env.registry
        });
        const names = allProgress.map(p => p.projectName);
        assert(names.includes('project-alpha'), 'Should include project-alpha');
        assert(names.includes('project-beta'), 'Should include project-beta');
        assert(names.includes('project-gamma'), 'Should include project-gamma');
    } finally {
        env.cleanup();
    }
});

test('11. getAllMilestonesProgress entries contain progress data', () => {
    const env = createStandardEnv();
    try {
        const allProgress = getAllMilestonesProgress({
            registryPath: env.registryPath,
            registry: env.registry
        });
        for (const entry of allProgress) {
            assert(typeof entry.total === 'number', `${entry.projectName} should have numeric total`);
            assert(typeof entry.completed === 'number', `${entry.projectName} should have numeric completed`);
            assert(typeof entry.inProgress === 'number', `${entry.projectName} should have numeric inProgress`);
            assert(typeof entry.pending === 'number', `${entry.projectName} should have numeric pending`);
            assert(typeof entry.percentage === 'number', `${entry.projectName} should have numeric percentage`);
        }
    } finally {
        env.cleanup();
    }
});

test('12. getAllMilestonesProgress handles missing task files gracefully', () => {
    const env = createTestEnv({
        projects: [
            { name: 'existing-project', path: 'existing-project', status: 'buildable', language: 'javascript' },
            { name: 'missing-project', path: 'no-such-dir', status: 'scaffolding', language: 'python' }
        ],
        taskFiles: {
            'existing-project': {
                version: 1,
                project: 'existing-project',
                tasks: [
                    { id: 'existing-project/t1', title: 'Task 1', status: 'completed' }
                ]
            }
        }
    });
    try {
        const allProgress = getAllMilestonesProgress({
            registryPath: env.registryPath,
            registry: env.registry
        });
        assert(allProgress.length === 2, `Expected 2 entries, got ${allProgress.length}`);
        const missing = allProgress.find(p => p.projectName === 'missing-project');
        assert(missing != null, 'Should include missing-project');
        assert(missing.total === 0, `Missing project should have 0 tasks, got ${missing.total}`);
    } finally {
        env.cleanup();
    }
});

// ═════════════════════════════════════════════════════════════════════
// 4. renderMilestoneTable
// ═════════════════════════════════════════════════════════════════════

console.log('\n  renderMilestoneTable\n');

test('13. renderMilestoneTable produces Unicode table', () => {
    const progress = [
        { projectName: 'project-alpha', total: 4, completed: 2, inProgress: 1, pending: 1, percentage: 50 },
        { projectName: 'project-beta', total: 3, completed: 1, inProgress: 0, pending: 2, percentage: 33 }
    ];
    const output = renderMilestoneTable(progress);
    assert(typeof output === 'string', 'Output should be a string');
    // Verify box-drawing characters
    assert(output.includes('\u250c'), 'Should contain top-left corner (\\u250c)');
    assert(output.includes('\u2510'), 'Should contain top-right corner (\\u2510)');
    assert(output.includes('\u2514'), 'Should contain bottom-left corner (\\u2514)');
    assert(output.includes('\u2518'), 'Should contain bottom-right corner (\\u2518)');
    assert(output.includes('\u2502'), 'Should contain vertical bars (\\u2502)');
    assert(output.includes('\u2500'), 'Should contain horizontal lines (\\u2500)');
});

test('14. renderMilestoneTable includes column headers', () => {
    const progress = [
        { projectName: 'project-alpha', total: 4, completed: 2, inProgress: 1, pending: 1, percentage: 50 }
    ];
    const output = renderMilestoneTable(progress);
    assert(output.includes('Project'), 'Should contain "Project" header');
    assert(output.includes('Total'), 'Should contain "Total" header');
    assert(output.includes('Done'), 'Should contain "Done" header');
    assert(output.includes('Active'), 'Should contain "Active" header');
    assert(output.includes('Pending'), 'Should contain "Pending" header');
    assert(output.includes('Progress'), 'Should contain "Progress" header');
});

test('15. renderMilestoneTable includes project data', () => {
    const progress = [
        { projectName: 'project-alpha', total: 4, completed: 2, inProgress: 1, pending: 1, percentage: 50 }
    ];
    const output = renderMilestoneTable(progress);
    assert(output.includes('project-alpha'), 'Should contain project name');
    assert(output.includes('50%'), 'Should contain percentage');
});

test('16. renderMilestoneTable includes progress bar with block characters', () => {
    const progress = [
        { projectName: 'project-alpha', total: 4, completed: 2, inProgress: 1, pending: 1, percentage: 50 }
    ];
    const output = renderMilestoneTable(progress);
    // Should contain filled blocks and/or empty blocks
    assert(
        output.includes('\u2588') || output.includes('\u2591'),
        'Should contain progress bar block characters (filled or empty)'
    );
});

test('17. renderMilestoneTable handles empty progress array', () => {
    const output = renderMilestoneTable([]);
    assert(typeof output === 'string', 'Output should be a string even for empty input');
    assert(output.length > 0, 'Output should not be empty');
});

test('18. renderMilestoneTable handles 100% completion', () => {
    const progress = [
        { projectName: 'done-project', total: 5, completed: 5, inProgress: 0, pending: 0, percentage: 100 }
    ];
    const output = renderMilestoneTable(progress);
    assert(output.includes('100%'), 'Should show 100%');
    assert(output.includes('done-project'), 'Should include project name');
});

test('19. renderMilestoneTable handles 0% completion', () => {
    const progress = [
        { projectName: 'empty-project', total: 0, completed: 0, inProgress: 0, pending: 0, percentage: 0 }
    ];
    const output = renderMilestoneTable(progress);
    assert(output.includes('0%'), 'Should show 0%');
    assert(output.includes('empty-project'), 'Should include project name');
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
