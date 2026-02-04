#!/usr/bin/env node

/**
 * Task Utils Module Tests (lib/task-utils.js)
 *
 * Tests for parseTaskId(), getTasksJsonPath(), and findTask().
 *
 * Uses the same custom test framework as other test files in this project.
 *
 * TDD: all tests written before implementation.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseTaskId, getTasksJsonPath, findTask } = require('../lib/task-utils');

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
        failed++;
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEquals(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

function assertThrows(fn, expectedMessage) {
    let threw = false;
    let error = null;
    try {
        fn();
    } catch (err) {
        threw = true;
        error = err;
    }
    if (!threw) {
        throw new Error('Expected function to throw an error');
    }
    if (expectedMessage && !error.message.includes(expectedMessage)) {
        throw new Error(`Expected error message to include "${expectedMessage}", got "${error.message}"`);
    }
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Creates a temporary project directory structure for testing.
 * Returns { tmpdir, projectPath, tasksJsonPath, cleanup }.
 */
function createTestProject(options) {
    const opts = options || {};
    const projectId = opts.projectId || 'test-project';
    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'jade-task-utils-test-'));
    const projectPath = path.join(tmpdir, projectId);
    fs.mkdirSync(projectPath, { recursive: true });

    // Write tasks.json if tasksData is provided
    if (opts.tasksData) {
        const taskDir = path.join(projectPath, '.claude', 'tasks');
        fs.mkdirSync(taskDir, { recursive: true });
        const tasksJsonPath = path.join(taskDir, 'tasks.json');
        fs.writeFileSync(tasksJsonPath, JSON.stringify(opts.tasksData, null, 2));
        return {
            tmpdir,
            projectPath,
            tasksJsonPath,
            cleanup() {
                fs.rmSync(tmpdir, { recursive: true, force: true });
            }
        };
    }

    return {
        tmpdir,
        projectPath,
        cleanup() {
            fs.rmSync(tmpdir, { recursive: true, force: true });
        }
    };
}

// ── parseTaskId() Tests ──────────────────────────────────────────────

console.log('\n=== parseTaskId() ===\n');

test('parseTaskId: parses valid task ID', () => {
    const result = parseTaskId('jade-cli/implement-scanner');
    assertEquals(result.projectId, 'jade-cli');
    assertEquals(result.taskName, 'implement-scanner');
});

test('parseTaskId: parses task ID with hyphens', () => {
    const result = parseTaskId('jade-dev-assist/extract-task-utils');
    assertEquals(result.projectId, 'jade-dev-assist');
    assertEquals(result.taskName, 'extract-task-utils');
});

test('parseTaskId: parses task ID with multiple slashes (uses first)', () => {
    const result = parseTaskId('project/task/subtask');
    assertEquals(result.projectId, 'project');
    assertEquals(result.taskName, 'task/subtask');
});

test('parseTaskId: throws on missing slash', () => {
    assertThrows(
        () => parseTaskId('invalid-task-id'),
        'Invalid task ID format'
    );
});

test('parseTaskId: throws on empty string', () => {
    assertThrows(
        () => parseTaskId(''),
        'Invalid task ID format'
    );
});

test('parseTaskId: throws on slash-only string', () => {
    assertThrows(
        () => parseTaskId('/'),
        'Invalid task ID format'
    );
});

test('parseTaskId: handles task ID starting with slash', () => {
    const result = parseTaskId('/task-name');
    assertEquals(result.projectId, '');
    assertEquals(result.taskName, 'task-name');
});

// ── getTasksJsonPath() Tests ─────────────────────────────────────────

console.log('\n=== getTasksJsonPath() ===\n');

test('getTasksJsonPath: builds correct path', () => {
    const result = getTasksJsonPath('jade-cli', '/home/user/projects');
    assertEquals(
        result,
        '/home/user/projects/jade-cli/.claude/tasks/tasks.json'
    );
});

test('getTasksJsonPath: handles empty projectsRoot', () => {
    const result = getTasksJsonPath('jade-cli', '');
    assertEquals(result, 'jade-cli/.claude/tasks/tasks.json');
});

test('getTasksJsonPath: handles trailing slash in projectsRoot', () => {
    const result = getTasksJsonPath('jade-cli', '/home/user/projects/');
    assertEquals(
        result,
        '/home/user/projects/jade-cli/.claude/tasks/tasks.json'
    );
});

test('getTasksJsonPath: handles projectId with hyphens', () => {
    const result = getTasksJsonPath('jade-dev-assist', '/tmp');
    assertEquals(result, '/tmp/jade-dev-assist/.claude/tasks/tasks.json');
});

// ── findTask() Tests ─────────────────────────────────────────────────

console.log('\n=== findTask() ===\n');

test('findTask: finds task in valid tasks.json', () => {
    const testProj = createTestProject({
        projectId: 'test-project',
        tasksData: {
            version: 1,
            project: 'test-project',
            tasks: [
                {
                    id: 'test-project/task-one',
                    title: 'Task One',
                    description: 'First task',
                    status: 'pending',
                    complexity: 'S'
                },
                {
                    id: 'test-project/task-two',
                    title: 'Task Two',
                    description: 'Second task',
                    status: 'in_progress',
                    complexity: 'M'
                }
            ]
        }
    });

    try {
        const result = findTask('test-project/task-two', testProj.tmpdir);
        assertEquals(result.task.id, 'test-project/task-two');
        assertEquals(result.task.title, 'Task Two');
        assertEquals(result.task.status, 'in_progress');
        assertEquals(result.taskIndex, 1);
        assertEquals(result.data.version, 1);
        assertEquals(result.data.project, 'test-project');
        assertEquals(result.project.name, 'test-project');
        assertEquals(result.project.path, 'test-project');
        assert(result.tasksJsonPath.endsWith('.claude/tasks/tasks.json'));
    } finally {
        testProj.cleanup();
    }
});

test('findTask: builds project from task._project field', () => {
    const testProj = createTestProject({
        projectId: 'test-project',
        tasksData: {
            version: 1,
            project: 'test-project',
            tasks: [
                {
                    id: 'test-project/task-one',
                    title: 'Task One',
                    description: 'First task',
                    status: 'pending',
                    complexity: 'S',
                    _project: {
                        name: 'Custom Project Name',
                        path: 'custom-path',
                        status: 'buildable',
                        language: 'python',
                        test_command: 'pytest'
                    }
                }
            ]
        }
    });

    try {
        const result = findTask('test-project/task-one', testProj.tmpdir);
        assertEquals(result.project.name, 'Custom Project Name');
        assertEquals(result.project.path, 'custom-path');
        assertEquals(result.project.status, 'buildable');
        assertEquals(result.project.language, 'python');
        assertEquals(result.project.test_command, 'pytest');
    } finally {
        testProj.cleanup();
    }
});

test('findTask: derives project from data.project when _project missing', () => {
    const testProj = createTestProject({
        projectId: 'my-project',
        tasksData: {
            version: 1,
            project: 'My Awesome Project',
            tasks: [
                {
                    id: 'my-project/task-one',
                    title: 'Task One',
                    description: 'First task',
                    status: 'pending',
                    complexity: 'S'
                }
            ]
        }
    });

    try {
        const result = findTask('my-project/task-one', testProj.tmpdir);
        assertEquals(result.project.name, 'My Awesome Project');
        assertEquals(result.project.path, 'my-project');
        assertEquals(result.project.status, 'unknown');
        assertEquals(result.project.language, 'javascript');
        assertEquals(result.project.test_command, null);
    } finally {
        testProj.cleanup();
    }
});

test('findTask: derives project from task ID when both _project and data.project missing', () => {
    const testProj = createTestProject({
        projectId: 'my-project',
        tasksData: {
            version: 1,
            tasks: [
                {
                    id: 'my-project/task-one',
                    title: 'Task One',
                    description: 'First task',
                    status: 'pending',
                    complexity: 'S'
                }
            ]
        }
    });

    try {
        const result = findTask('my-project/task-one', testProj.tmpdir);
        assertEquals(result.project.name, 'my-project');
        assertEquals(result.project.path, 'my-project');
    } finally {
        testProj.cleanup();
    }
});

test('findTask: throws when tasks.json not found', () => {
    const testProj = createTestProject({ projectId: 'nonexistent-project' });
    try {
        assertThrows(
            () => findTask('nonexistent-project/some-task', testProj.tmpdir),
            'Tasks file not found'
        );
    } finally {
        testProj.cleanup();
    }
});

test('findTask: throws when task not found in tasks.json', () => {
    const testProj = createTestProject({
        projectId: 'test-project',
        tasksData: {
            version: 1,
            project: 'test-project',
            tasks: [
                {
                    id: 'test-project/task-one',
                    title: 'Task One',
                    description: 'First task',
                    status: 'pending',
                    complexity: 'S'
                }
            ]
        }
    });

    try {
        assertThrows(
            () => findTask('test-project/nonexistent-task', testProj.tmpdir),
            'Task not found'
        );
    } finally {
        testProj.cleanup();
    }
});

test('findTask: throws on invalid task ID format', () => {
    const testProj = createTestProject({
        projectId: 'test-project',
        tasksData: {
            version: 1,
            project: 'test-project',
            tasks: []
        }
    });

    try {
        assertThrows(
            () => findTask('invalid-task-id', testProj.tmpdir),
            'Invalid task ID format'
        );
    } finally {
        testProj.cleanup();
    }
});

test('findTask: handles empty tasks array', () => {
    const testProj = createTestProject({
        projectId: 'test-project',
        tasksData: {
            version: 1,
            project: 'test-project',
            tasks: []
        }
    });

    try {
        assertThrows(
            () => findTask('test-project/any-task', testProj.tmpdir),
            'Task not found'
        );
    } finally {
        testProj.cleanup();
    }
});

test('findTask: handles missing tasks field in tasks.json', () => {
    const testProj = createTestProject({
        projectId: 'test-project',
        tasksData: {
            version: 1,
            project: 'test-project'
        }
    });

    try {
        assertThrows(
            () => findTask('test-project/any-task', testProj.tmpdir),
            'Task not found'
        );
    } finally {
        testProj.cleanup();
    }
});

test('findTask: returns correct taskIndex for first task', () => {
    const testProj = createTestProject({
        projectId: 'test-project',
        tasksData: {
            version: 1,
            project: 'test-project',
            tasks: [
                { id: 'test-project/first', title: 'First', status: 'pending', complexity: 'S' },
                { id: 'test-project/second', title: 'Second', status: 'pending', complexity: 'S' }
            ]
        }
    });

    try {
        const result = findTask('test-project/first', testProj.tmpdir);
        assertEquals(result.taskIndex, 0);
    } finally {
        testProj.cleanup();
    }
});

test('findTask: returns correct taskIndex for middle task', () => {
    const testProj = createTestProject({
        projectId: 'test-project',
        tasksData: {
            version: 1,
            project: 'test-project',
            tasks: [
                { id: 'test-project/first', title: 'First', status: 'pending', complexity: 'S' },
                { id: 'test-project/second', title: 'Second', status: 'pending', complexity: 'S' },
                { id: 'test-project/third', title: 'Third', status: 'pending', complexity: 'S' }
            ]
        }
    });

    try {
        const result = findTask('test-project/second', testProj.tmpdir);
        assertEquals(result.taskIndex, 1);
    } finally {
        testProj.cleanup();
    }
});

test('findTask: preserves all task fields', () => {
    const testProj = createTestProject({
        projectId: 'test-project',
        tasksData: {
            version: 1,
            project: 'test-project',
            tasks: [
                {
                    id: 'test-project/complex-task',
                    title: 'Complex Task',
                    description: 'A complex task with many fields',
                    status: 'in_progress',
                    complexity: 'XL',
                    blocked_by: ['other-task'],
                    unlocks: ['future-task'],
                    labels: ['feature', 'high-priority'],
                    custom_field: 'custom_value',
                    created_at: '2026-02-01T00:00:00Z',
                    updated_at: '2026-02-02T00:00:00Z'
                }
            ]
        }
    });

    try {
        const result = findTask('test-project/complex-task', testProj.tmpdir);
        assertEquals(result.task.title, 'Complex Task');
        assertEquals(result.task.complexity, 'XL');
        assert(Array.isArray(result.task.blocked_by));
        assertEquals(result.task.blocked_by[0], 'other-task');
        assertEquals(result.task.custom_field, 'custom_value');
    } finally {
        testProj.cleanup();
    }
});

// ── Summary ──────────────────────────────────────────────────────────

console.log('\n=== Summary ===\n');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
    process.exit(1);
}
