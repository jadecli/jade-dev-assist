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

let loadRegistry, scanTasks;
try {
    const scanner = require('../lib/scanner');
    loadRegistry = scanner.loadRegistry;
    scanTasks = scanner.scanTasks;
} catch (err) {
    console.log('\nFATAL: Could not load lib/scanner.js');
    console.log(`  ${err.message}\n`);
    console.log('All 13 tests will be marked as failed.\n');
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
        const tasks = scanTasks({ registryPath: env.registryPath });
        assert(Array.isArray(tasks), 'Expected tasks to be an array');
        assert(tasks.length === 3, `Expected 3 tasks (2 from jade-cli + 1 from jade-index), got ${tasks.length}`);

        const ids = tasks.map(t => t.id);
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
        const tasks = scanTasks({ registryPath: env.registryPath });
        assert(tasks.length === 2, `Expected 2 tasks, got ${tasks.length}`);
        for (const task of tasks) {
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
        const tasks = scanTasks({ registryPath: env.registryPath });
        assert(tasks.length >= 1, 'Expected at least 1 task');
        const task = tasks[0];
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
        const tasks = scanTasks({ registryPath: env.registryPath });
        assert(tasks.length >= 1, 'Expected at least 1 task');
        const task = tasks[0];
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
        const tasks = scanTasks({ registry });
        assert(Array.isArray(tasks), 'Expected tasks to be an array');
        assert(tasks.length === 0, `Expected 0 tasks, got ${tasks.length}`);
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

        let tasks;
        try {
            tasks = scanTasks({ registryPath: env.registryPath });
        } finally {
            process.stderr.write = originalWrite;
        }

        // Verify JSON log output was written to stderr
        assert(stderrOutput.length > 0, 'Expected logger output to stderr');
        const logEntry = JSON.parse(stderrOutput.trim());
        assert(logEntry.level === 'warn', `Expected level warn, got ${logEntry.level}`);
        assert(logEntry.module === 'scanner', `Expected module scanner, got ${logEntry.module}`);
        assert(logEntry.project === 'bad-project', 'Expected project name in log');

        assert(Array.isArray(tasks), 'Expected tasks to be an array');
        assert(tasks.length === 1, `Expected 1 task from jade-index, got ${tasks.length}`);
        assert(tasks[0].id === 'jade-index/add-semantic-search', 'Expected the jade-index task');
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
        const tasks = scanTasks({ registryPath: env.registryPath });
        assert(Array.isArray(tasks), 'Expected tasks to be an array');
        assert(tasks.length === 0, `Expected 0 tasks, got ${tasks.length}`);
    } finally {
        env.cleanup();
    }
});

test('11. scanTasks returns [] for empty registry (projects: [])', () => {
    const env = createTestEnv({ projects: [] });
    try {
        const tasks = scanTasks({ registryPath: env.registryPath });
        assert(Array.isArray(tasks), 'Expected tasks to be an array');
        assert(tasks.length === 0, `Expected 0 tasks, got ${tasks.length}`);
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
        const tasks = scanTasks({ registryPath: env.registryPath });
        assert(Array.isArray(tasks), 'Expected tasks to be an array');
        assert(tasks.length === 0, `Expected 0 tasks, got ${tasks.length}`);
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
        const tasks = scanTasks({ registry: env.registry });
        assert(Array.isArray(tasks), 'Expected tasks to be an array');
        assert(tasks.length === 2, `Expected 2 tasks, got ${tasks.length}`);
        assert(tasks[0]._projectName === 'jade-cli', 'Expected _projectName to be jade-cli');
    } finally {
        env.cleanup();
    }
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
