#!/usr/bin/env node

/**
 * Scanner Module Tests (lib/scanner.js)
 *
 * Tests for loadRegistry() and scanTasks() functions.
 * Uses the same custom test framework as test-plugin.js.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

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
 * Creates a temp directory with a projects.json and optional project task files.
 * Returns { tmpdir, registryPath, cleanup }.
 *
 * @param {Object} options
 * @param {Object[]} options.projects - Array of { name, path, ...rest } entries for projects.json
 * @param {Object} options.taskFiles - Map of projectPath -> fixture filename (e.g. { 'jade-cli': 'jade-cli-tasks.json' })
 * @param {Object} options.rawTaskFiles - Map of projectPath -> raw string content (for malformed JSON tests)
 */
function createTestEnv(options) {
    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'jade-scanner-test-'));

    const registry = {
        version: 1,
        projects_root: tmpdir,
        projects: options.projects || []
    };

    const registryPath = path.join(tmpdir, 'projects.json');
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

    // Create project directories and task files
    if (options.taskFiles) {
        for (const [projectPath, fixtureName] of Object.entries(options.taskFiles)) {
            const taskDir = path.join(tmpdir, projectPath, '.claude', 'tasks');
            fs.mkdirSync(taskDir, { recursive: true });
            const fixtureContent = fs.readFileSync(path.join(FIXTURES_DIR, fixtureName), 'utf8');
            fs.writeFileSync(path.join(taskDir, 'tasks.json'), fixtureContent);
        }
    }

    // Write raw content (for malformed JSON)
    if (options.rawTaskFiles) {
        for (const [projectPath, content] of Object.entries(options.rawTaskFiles)) {
            const taskDir = path.join(tmpdir, projectPath, '.claude', 'tasks');
            fs.mkdirSync(taskDir, { recursive: true });
            fs.writeFileSync(path.join(taskDir, 'tasks.json'), content);
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

// ── Import scanner ───────────────────────────────────────────────────

let loadRegistry, scanTasks, validateTask, applyTaskDefaults;
let REQUIRED_TASK_FIELDS, OPTIONAL_TASK_FIELDS, KNOWN_TASK_FIELDS;
try {
    const scanner = require('../lib/scanner');
    loadRegistry = scanner.loadRegistry;
    scanTasks = scanner.scanTasks;
    validateTask = scanner.validateTask;
    applyTaskDefaults = scanner.applyTaskDefaults;
    REQUIRED_TASK_FIELDS = scanner.REQUIRED_TASK_FIELDS;
    OPTIONAL_TASK_FIELDS = scanner.OPTIONAL_TASK_FIELDS;
    KNOWN_TASK_FIELDS = scanner.KNOWN_TASK_FIELDS;
} catch (err) {
    console.log('\nFATAL: Could not load lib/scanner.js');
    console.log(`  ${err.message}\n`);
    console.log('All tests will be marked as failed.\n');
    process.exit(1);
}

// ── loadRegistry tests ──────────────────────────────────────────────

console.log('\n  loadRegistry tests\n');

test('1. loadRegistry reads valid projects.json', () => {
    const env = createTestEnv({
        projects: [
            { name: 'jade-cli', path: 'jade-cli', status: 'near-buildable', language: 'typescript' }
        ]
    });
    try {
        const registry = loadRegistry(env.registryPath);
        assert(registry.version === 1, 'Expected version to be 1');
        assert(Array.isArray(registry.projects), 'Expected projects to be an array');
        assert(registry.projects.length === 1, 'Expected 1 project');
        assert(registry.projects[0].name === 'jade-cli', 'Expected project name jade-cli');
    } finally {
        env.cleanup();
    }
});

test('2. loadRegistry throws on missing file', () => {
    let threw = false;
    try {
        loadRegistry('/tmp/nonexistent-jade-registry-12345.json');
    } catch (err) {
        threw = true;
        assert(err.code === 'ENOENT', `Expected ENOENT, got ${err.code}`);
    }
    assert(threw, 'Expected loadRegistry to throw on missing file');
});

test('3. loadRegistry throws on malformed JSON', () => {
    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'jade-scanner-test-'));
    const badPath = path.join(tmpdir, 'bad-registry.json');
    fs.writeFileSync(badPath, '{ "version": INVALID }');
    try {
        let threw = false;
        try {
            loadRegistry(badPath);
        } catch (err) {
            threw = true;
            // SyntaxError is what JSON.parse throws
            assert(err instanceof SyntaxError, `Expected SyntaxError, got ${err.constructor.name}`);
        }
        assert(threw, 'Expected loadRegistry to throw on malformed JSON');
    } finally {
        fs.rmSync(tmpdir, { recursive: true, force: true });
    }
});

// ── scanTasks tests ─────────────────────────────────────────────────

console.log('\n  scanTasks tests\n');

test('4. scanTasks returns merged tasks from multiple projects', () => {
    const env = createTestEnv({
        projects: [
            { name: 'jade-cli', path: 'jade-cli', status: 'near-buildable', language: 'typescript' },
            { name: 'jade-index', path: 'jade-index', status: 'buildable', language: 'python' }
        ],
        taskFiles: {
            'jade-cli': 'jade-cli-tasks.json',
            'jade-index': 'jade-index-tasks.json'
        }
    });
    try {
        const result = scanTasks({ registryPath: env.registryPath });
        assert(result.tasks !== undefined, 'Expected result to have tasks property');
        assert(Array.isArray(result.tasks), 'Expected tasks to be an array');
        assert(result.tasks.length === 3, `Expected 3 tasks (2 from jade-cli + 1 from jade-index), got ${result.tasks.length}`);

        const ids = result.tasks.map(t => t.id);
        assert(ids.includes('jade-cli/fix-node-build'), 'Expected jade-cli/fix-node-build task');
        assert(ids.includes('jade-cli/add-task-create'), 'Expected jade-cli/add-task-create task');
        assert(ids.includes('jade-index/add-semantic-search'), 'Expected jade-index/add-semantic-search task');
    } finally {
        env.cleanup();
    }
});

test('5. scanTasks tags each task with _projectName', () => {
    const env = createTestEnv({
        projects: [
            { name: 'jade-cli', path: 'jade-cli', status: 'near-buildable', language: 'typescript' }
        ],
        taskFiles: {
            'jade-cli': 'jade-cli-tasks.json'
        }
    });
    try {
        const result = scanTasks({ registryPath: env.registryPath });
        assert(result.tasks.length === 2, `Expected 2 tasks, got ${result.tasks.length}`);
        for (const task of result.tasks) {
            assert(task._projectName === 'jade-cli', `Expected _projectName 'jade-cli', got '${task._projectName}'`);
        }
    } finally {
        env.cleanup();
    }
});

test('6. scanTasks tags each task with _project (full registry entry)', () => {
    const env = createTestEnv({
        projects: [
            { name: 'jade-cli', path: 'jade-cli', status: 'near-buildable', language: 'typescript', test_command: 'npx vitest run' }
        ],
        taskFiles: {
            'jade-cli': 'jade-cli-tasks.json'
        }
    });
    try {
        const result = scanTasks({ registryPath: env.registryPath });
        assert(result.tasks.length >= 1, 'Expected at least 1 task');
        const task = result.tasks[0];
        assert(task._project != null, 'Expected _project to be defined');
        assert(task._project.name === 'jade-cli', `Expected _project.name 'jade-cli', got '${task._project.name}'`);
        assert(task._project.status === 'near-buildable', `Expected _project.status 'near-buildable', got '${task._project.status}'`);
        assert(task._project.language === 'typescript', `Expected _project.language 'typescript', got '${task._project.language}'`);
        assert(task._project.test_command === 'npx vitest run', `Expected _project.test_command 'npx vitest run'`);
    } finally {
        env.cleanup();
    }
});

test('7. scanTasks tags each task with _milestone from file-level milestone', () => {
    const env = createTestEnv({
        projects: [
            { name: 'jade-cli', path: 'jade-cli', status: 'near-buildable', language: 'typescript' }
        ],
        taskFiles: {
            'jade-cli': 'jade-cli-tasks.json'
        }
    });
    try {
        const result = scanTasks({ registryPath: env.registryPath });
        assert(result.tasks.length >= 1, 'Expected at least 1 task');
        const task = result.tasks[0];
        assert(task._milestone != null, 'Expected _milestone to be defined');
        assert(task._milestone.name === 'Core Commands', `Expected _milestone.name 'Core Commands', got '${task._milestone.name}'`);
        assert(task._milestone.target_date === '2026-03-15', `Expected _milestone.target_date '2026-03-15'`);
    } finally {
        env.cleanup();
    }
});

test('8. scanTasks handles missing tasks.json gracefully (returns 0 tasks for that project)', () => {
    // Create a project directory but no tasks.json inside it
    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'jade-scanner-test-'));
    const projectDir = path.join(tmpdir, 'no-tasks-project');
    fs.mkdirSync(projectDir, { recursive: true });
    // No .claude/tasks/tasks.json created

    const registry = {
        version: 1,
        projects_root: tmpdir,
        projects: [
            { name: 'no-tasks-project', path: 'no-tasks-project', status: 'scaffolding', language: 'javascript' }
        ]
    };
    try {
        const result = scanTasks({ registry });
        assert(Array.isArray(result.tasks), 'Expected tasks to be an array');
        assert(result.tasks.length === 0, `Expected 0 tasks, got ${result.tasks.length}`);
    } finally {
        fs.rmSync(tmpdir, { recursive: true, force: true });
    }
});

test('9. scanTasks handles malformed JSON gracefully (warns, continues with other projects)', () => {
    const env = createTestEnv({
        projects: [
            { name: 'bad-project', path: 'bad-project', status: 'scaffolding', language: 'javascript' },
            { name: 'jade-index', path: 'jade-index', status: 'buildable', language: 'python' }
        ],
        rawTaskFiles: {
            'bad-project': '{ "version": 1, "project": "bad", "tasks": [INVALID'
        },
        taskFiles: {
            'jade-index': 'jade-index-tasks.json'
        }
    });
    try {
        // Capture stderr output (logger writes warn/error to stderr as JSON)
        const originalWrite = process.stderr.write.bind(process.stderr);
        let stderrOutput = '';
        process.stderr.write = function (chunk) {
            stderrOutput += chunk;
            return originalWrite(chunk);
        };

        let result;
        try {
            result = scanTasks({ registryPath: env.registryPath });
        } finally {
            process.stderr.write = originalWrite;
        }

        // Verify JSON log output was written to stderr
        assert(stderrOutput.length > 0, 'Expected logger output to stderr');
        const logEntry = JSON.parse(stderrOutput.trim());
        assert(logEntry.level === 'warn', `Expected level warn, got ${logEntry.level}`);
        assert(logEntry.module === 'scanner', `Expected module scanner, got ${logEntry.module}`);
        assert(logEntry.project === 'bad-project', 'Expected project name in log');

        assert(Array.isArray(result.tasks), 'Expected tasks to be an array');
        assert(result.tasks.length === 1, `Expected 1 task from jade-index, got ${result.tasks.length}`);
        assert(result.tasks[0].id === 'jade-index/add-semantic-search', 'Expected the jade-index task');
    } finally {
        env.cleanup();
    }
});

test('10. scanTasks handles missing project directory gracefully', () => {
    const env = createTestEnv({
        projects: [
            { name: 'missing-project', path: 'no-such-dir', status: 'scaffolding', language: 'javascript' }
        ]
        // No taskFiles or rawTaskFiles -- directory won't exist
    });
    try {
        const result = scanTasks({ registryPath: env.registryPath });
        assert(Array.isArray(result.tasks), 'Expected tasks to be an array');
        assert(result.tasks.length === 0, `Expected 0 tasks, got ${result.tasks.length}`);
    } finally {
        env.cleanup();
    }
});

test('11. scanTasks returns [] for empty registry (projects: [])', () => {
    const env = createTestEnv({ projects: [] });
    try {
        const result = scanTasks({ registryPath: env.registryPath });
        assert(Array.isArray(result.tasks), 'Expected tasks to be an array');
        assert(result.tasks.length === 0, `Expected 0 tasks, got ${result.tasks.length}`);
    } finally {
        env.cleanup();
    }
});

test('12. scanTasks returns [] when all projects have empty tasks arrays', () => {
    const env = createTestEnv({
        projects: [
            { name: 'empty-project', path: 'empty-project', status: 'scaffolding', language: 'javascript' }
        ],
        taskFiles: {
            'empty-project': 'empty-tasks.json'
        }
    });
    try {
        const result = scanTasks({ registryPath: env.registryPath });
        assert(Array.isArray(result.tasks), 'Expected tasks to be an array');
        assert(result.tasks.length === 0, `Expected 0 tasks, got ${result.tasks.length}`);
    } finally {
        env.cleanup();
    }
});

test('13. scanTasks accepts pre-loaded registry object (options.registry instead of options.registryPath)', () => {
    const env = createTestEnv({
        projects: [
            { name: 'jade-cli', path: 'jade-cli', status: 'near-buildable', language: 'typescript' }
        ],
        taskFiles: {
            'jade-cli': 'jade-cli-tasks.json'
        }
    });
    try {
        // Pass the registry object directly instead of a file path
        const result = scanTasks({ registry: env.registry });
        assert(Array.isArray(result.tasks), 'Expected tasks to be an array');
        assert(result.tasks.length === 2, `Expected 2 tasks, got ${result.tasks.length}`);
        assert(result.tasks[0]._projectName === 'jade-cli', 'Expected _projectName to be jade-cli');
    } finally {
        env.cleanup();
    }
});

// ── Error Recovery tests ────────────────────────────────────────────

console.log('\n  Error Recovery tests\n');

test('14. scanTasks returns partial results with error list on malformed JSON', () => {
    const env = createTestEnv({
        projects: [
            { name: 'bad-project', path: 'bad-project', status: 'scaffolding', language: 'javascript' },
            { name: 'jade-index', path: 'jade-index', status: 'buildable', language: 'python' }
        ],
        rawTaskFiles: {
            'bad-project': '{ invalid json content'
        },
        taskFiles: {
            'jade-index': 'jade-index-tasks.json'
        }
    });
    try {
        // Suppress stderr output for this test
        const originalWrite = process.stderr.write.bind(process.stderr);
        process.stderr.write = () => true;

        let result;
        try {
            result = scanTasks({ registryPath: env.registryPath });
        } finally {
            process.stderr.write = originalWrite;
        }

        // Should return partial results
        assert(result.tasks.length === 1, `Expected 1 task from jade-index, got ${result.tasks.length}`);
        assert(result.tasks[0].id === 'jade-index/add-semantic-search', 'Expected jade-index task');

        // Should have error list
        assert(Array.isArray(result.errors), 'Expected errors to be an array');
        assert(result.errors.length === 1, `Expected 1 error, got ${result.errors.length}`);
        assert(result.errors[0].type === 'parse_error', `Expected parse_error type, got ${result.errors[0].type}`);
        assert(result.errors[0].project === 'bad-project', 'Expected bad-project in error');
    } finally {
        env.cleanup();
    }
});

test('15. scanTasks strict mode throws on parse error', () => {
    const env = createTestEnv({
        projects: [
            { name: 'bad-project', path: 'bad-project', status: 'scaffolding', language: 'javascript' }
        ],
        rawTaskFiles: {
            'bad-project': '{ invalid json'
        }
    });
    try {
        // Suppress stderr output for this test
        const originalWrite = process.stderr.write.bind(process.stderr);
        process.stderr.write = () => true;

        let threw = false;
        let thrownError;
        try {
            scanTasks({ registryPath: env.registryPath, strict: true });
        } catch (err) {
            threw = true;
            thrownError = err;
        } finally {
            process.stderr.write = originalWrite;
        }

        assert(threw, 'Expected strict mode to throw on parse error');
        assert(thrownError.code === 'SCANNER_STRICT_ERROR', `Expected SCANNER_STRICT_ERROR, got ${thrownError.code}`);
        assert(Array.isArray(thrownError.errors), 'Expected errors attached to thrown error');
        assert(thrownError.errors.length === 1, 'Expected 1 error in thrown error');
    } finally {
        env.cleanup();
    }
});

test('16. scanTasks returns warnings for unknown fields', () => {
    const env = createTestEnv({
        projects: [
            { name: 'test-project', path: 'test-project', status: 'scaffolding', language: 'javascript' }
        ],
        rawTaskFiles: {
            'test-project': JSON.stringify({
                version: 1,
                project: 'test-project',
                tasks: [{
                    id: 'test/task-1',
                    title: 'Test task',
                    status: 'pending',
                    unknown_field: 'some value',
                    another_unknown: 123
                }]
            })
        }
    });
    try {
        // Suppress stderr output for this test
        const originalWrite = process.stderr.write.bind(process.stderr);
        process.stderr.write = () => true;

        let result;
        try {
            result = scanTasks({ registryPath: env.registryPath });
        } finally {
            process.stderr.write = originalWrite;
        }

        // Task should still be included
        assert(result.tasks.length === 1, `Expected 1 task, got ${result.tasks.length}`);

        // Should have warnings for unknown fields
        assert(Array.isArray(result.warnings), 'Expected warnings to be an array');
        assert(result.warnings.length === 2, `Expected 2 warnings for unknown fields, got ${result.warnings.length}`);

        const warnMessages = result.warnings.map(w => w.message);
        assert(warnMessages.some(m => m.includes('unknown_field')), 'Expected warning about unknown_field');
        assert(warnMessages.some(m => m.includes('another_unknown')), 'Expected warning about another_unknown');
    } finally {
        env.cleanup();
    }
});

test('17. scanTasks strict mode throws on unknown fields (warnings treated as errors)', () => {
    const env = createTestEnv({
        projects: [
            { name: 'test-project', path: 'test-project', status: 'scaffolding', language: 'javascript' }
        ],
        rawTaskFiles: {
            'test-project': JSON.stringify({
                version: 1,
                project: 'test-project',
                tasks: [{
                    id: 'test/task-1',
                    title: 'Test task',
                    status: 'pending',
                    unknown_field: 'some value'
                }]
            })
        }
    });
    try {
        // Suppress stderr output for this test
        const originalWrite = process.stderr.write.bind(process.stderr);
        process.stderr.write = () => true;

        let threw = false;
        let thrownError;
        try {
            scanTasks({ registryPath: env.registryPath, strict: true });
        } catch (err) {
            threw = true;
            thrownError = err;
        } finally {
            process.stderr.write = originalWrite;
        }

        assert(threw, 'Expected strict mode to throw on unknown fields');
        assert(thrownError.code === 'SCANNER_STRICT_ERROR', `Expected SCANNER_STRICT_ERROR, got ${thrownError.code}`);
        assert(Array.isArray(thrownError.warnings), 'Expected warnings attached to thrown error');
    } finally {
        env.cleanup();
    }
});

// ── Schema Validation tests ─────────────────────────────────────────

console.log('\n  Schema Validation tests\n');

test('18. validateTask detects missing required fields', () => {
    const task = { title: 'Test task' }; // Missing id and status
    const result = validateTask(task, '/test/path');

    assert(!result.valid, 'Expected invalid result for missing fields');
    assert(result.errors.length === 2, `Expected 2 errors, got ${result.errors.length}`);
    assert(result.errors.some(e => e.includes("'id'")), 'Expected error about missing id');
    assert(result.errors.some(e => e.includes("'status'")), 'Expected error about missing status');
});

test('19. validateTask passes for valid task with required fields only', () => {
    const task = { id: 'test/task', title: 'Test task', status: 'pending' };
    const result = validateTask(task, '/test/path');

    assert(result.valid, 'Expected valid result for task with required fields');
    assert(result.errors.length === 0, `Expected 0 errors, got ${result.errors.length}`);
});

test('20. validateTask warns on unknown fields', () => {
    const task = {
        id: 'test/task',
        title: 'Test task',
        status: 'pending',
        mystery_field: 'unknown'
    };
    const result = validateTask(task, '/test/path');

    assert(result.valid, 'Expected valid result (warnings dont invalidate in non-strict mode)');
    assert(result.warnings.length === 1, `Expected 1 warning, got ${result.warnings.length}`);
    assert(result.warnings[0].includes('mystery_field'), 'Expected warning about mystery_field');
});

test('21. applyTaskDefaults sets defaults for optional fields', () => {
    const task = { id: 'test/task', title: 'Test', status: 'pending' };
    applyTaskDefaults(task);

    assert(task.complexity === 'M', `Expected default complexity 'M', got '${task.complexity}'`);
    assert(Array.isArray(task.blocked_by), 'Expected blocked_by to be an array');
    assert(task.blocked_by.length === 0, 'Expected blocked_by to be empty array');
    assert(Array.isArray(task.unlocks), 'Expected unlocks to be an array');
    assert(task.unlocks.length === 0, 'Expected unlocks to be empty array');
});

test('22. applyTaskDefaults does not overwrite existing values', () => {
    const task = {
        id: 'test/task',
        title: 'Test',
        status: 'pending',
        complexity: 'L',
        blocked_by: ['other/task'],
        unlocks: ['another/task']
    };
    applyTaskDefaults(task);

    assert(task.complexity === 'L', `Expected complexity 'L', got '${task.complexity}'`);
    assert(task.blocked_by.length === 1, 'Expected blocked_by to have 1 item');
    assert(task.blocked_by[0] === 'other/task', 'Expected blocked_by unchanged');
    assert(task.unlocks.length === 1, 'Expected unlocks to have 1 item');
    assert(task.unlocks[0] === 'another/task', 'Expected unlocks unchanged');
});

test('23. scanTasks skips tasks with missing required fields', () => {
    const env = createTestEnv({
        projects: [
            { name: 'test-project', path: 'test-project', status: 'scaffolding', language: 'javascript' }
        ],
        rawTaskFiles: {
            'test-project': JSON.stringify({
                version: 1,
                project: 'test-project',
                tasks: [
                    { id: 'test/valid', title: 'Valid task', status: 'pending' },
                    { title: 'Missing id', status: 'pending' }, // Invalid
                    { id: 'test/no-status', title: 'Missing status' } // Invalid
                ]
            })
        }
    });
    try {
        // Suppress stderr output for this test
        const originalWrite = process.stderr.write.bind(process.stderr);
        process.stderr.write = () => true;

        let result;
        try {
            result = scanTasks({ registryPath: env.registryPath });
        } finally {
            process.stderr.write = originalWrite;
        }

        // Only valid task should be included
        assert(result.tasks.length === 1, `Expected 1 valid task, got ${result.tasks.length}`);
        assert(result.tasks[0].id === 'test/valid', 'Expected the valid task');

        // Should have validation errors for invalid tasks
        assert(result.errors.length === 2, `Expected 2 validation errors, got ${result.errors.length}`);
    } finally {
        env.cleanup();
    }
});

test('24. scanTasks applies defaults to tasks with optional fields missing', () => {
    const env = createTestEnv({
        projects: [
            { name: 'test-project', path: 'test-project', status: 'scaffolding', language: 'javascript' }
        ],
        rawTaskFiles: {
            'test-project': JSON.stringify({
                version: 1,
                project: 'test-project',
                tasks: [{
                    id: 'test/minimal',
                    title: 'Minimal task',
                    status: 'pending'
                    // No complexity, blocked_by, unlocks
                }]
            })
        }
    });
    try {
        const result = scanTasks({ registryPath: env.registryPath });

        assert(result.tasks.length === 1, `Expected 1 task, got ${result.tasks.length}`);
        const task = result.tasks[0];
        assert(task.complexity === 'M', `Expected default complexity 'M', got '${task.complexity}'`);
        assert(Array.isArray(task.blocked_by), 'Expected blocked_by to be an array');
        assert(Array.isArray(task.unlocks), 'Expected unlocks to be an array');
    } finally {
        env.cleanup();
    }
});

test('25. REQUIRED_TASK_FIELDS contains id, title, status', () => {
    assert(REQUIRED_TASK_FIELDS.includes('id'), 'Expected id in REQUIRED_TASK_FIELDS');
    assert(REQUIRED_TASK_FIELDS.includes('title'), 'Expected title in REQUIRED_TASK_FIELDS');
    assert(REQUIRED_TASK_FIELDS.includes('status'), 'Expected status in REQUIRED_TASK_FIELDS');
    assert(REQUIRED_TASK_FIELDS.length === 3, `Expected 3 required fields, got ${REQUIRED_TASK_FIELDS.length}`);
});

test('26. OPTIONAL_TASK_FIELDS has correct defaults', () => {
    assert(OPTIONAL_TASK_FIELDS.complexity === 'M', 'Expected complexity default to be M');
    assert(Array.isArray(OPTIONAL_TASK_FIELDS.blocked_by), 'Expected blocked_by default to be array');
    assert(OPTIONAL_TASK_FIELDS.blocked_by.length === 0, 'Expected blocked_by default to be empty');
    assert(Array.isArray(OPTIONAL_TASK_FIELDS.unlocks), 'Expected unlocks default to be array');
    assert(OPTIONAL_TASK_FIELDS.unlocks.length === 0, 'Expected unlocks default to be empty');
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
