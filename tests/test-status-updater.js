#!/usr/bin/env node

/**
 * Status Updater Module Tests (lib/status-updater.js)
 *
 * Tests for watchWorkerCompletion(), updateTaskStatus(), and getTaskStatus().
 *
 * Uses the same custom test framework as test-executor.js, test-dispatcher.js, etc.
 *
 * TDD red phase: all tests written before implementation.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');

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

async function testAsync(name, fn) {
  try {
    await fn();
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
 * Creates a temporary project directory structure for testing.
 * Returns { tmpdir, projectPath, tasksJsonPath, cleanup }.
 */
function createTestProject(options) {
  const opts = options || {};
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'jade-status-test-'));
  const projectPath = path.join(tmpdir, 'test-project');
  fs.mkdirSync(projectPath, { recursive: true });

  // Write tasks.json
  const taskDir = path.join(projectPath, '.claude', 'tasks');
  fs.mkdirSync(taskDir, { recursive: true });
  const tasksData = opts.tasksData || {
    version: 1,
    project: 'test-project',
    tasks: [
      {
        id: 'test-project/test-task',
        title: 'Test task title',
        description: 'Test task description.',
        status: 'pending',
        complexity: 'S',
        blocked_by: [],
        unlocks: [],
        labels: ['feature'],
        feature: {
          description: 'Feature desc',
          acceptance_criteria: ['criterion 1'],
        },
        relevant_files: [],
        created_at: '2026-02-02T00:00:00Z',
      },
    ],
  };
  const tasksJsonPath = path.join(taskDir, 'tasks.json');
  fs.writeFileSync(tasksJsonPath, JSON.stringify(tasksData, null, 2));

  return {
    tmpdir,
    projectPath,
    tasksJsonPath,
    cleanup() {
      fs.rmSync(tmpdir, { recursive: true, force: true });
    },
  };
}

/**
 * Build a mock child process that emits close with a given exit code.
 */
function createMockChild(exitCode) {
  const child = new EventEmitter();

  // Simulate stdout/stderr as event emitters
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();

  // Simulate stdin
  child.stdin = {
    write() {},
    end() {},
  };

  // Schedule exit event to fire asynchronously
  process.nextTick(() => {
    if (exitCode === 0) {
      child.stdout.emit('data', Buffer.from('Worker completed successfully\n'));
    } else {
      child.stderr.emit('data', Buffer.from('Worker error: task failed\n'));
    }
    child.emit('close', exitCode);
  });

  return child;
}

// ── Import status-updater ───────────────────────────────────────────

let updateTaskStatus, getTaskStatus, watchWorkerCompletion;
try {
  const statusUpdater = require('../lib/status-updater');
  updateTaskStatus = statusUpdater.updateTaskStatus;
  getTaskStatus = statusUpdater.getTaskStatus;
  watchWorkerCompletion = statusUpdater.watchWorkerCompletion;
} catch (err) {
  console.log('\nFATAL: Could not load lib/status-updater.js');
  console.log(`  ${err.message}\n`);
  console.log('All tests will be marked as failed.\n');
  process.exit(1);
}

// ═════════════════════════════════════════════════════════════════════
// 1. EXPORTS
// ═════════════════════════════════════════════════════════════════════

console.log('\n  Exports\n');

test('1. updateTaskStatus is exported as a function', () => {
  assert(
    typeof updateTaskStatus === 'function',
    'updateTaskStatus should be a function'
  );
});

test('2. getTaskStatus is exported as a function', () => {
  assert(
    typeof getTaskStatus === 'function',
    'getTaskStatus should be a function'
  );
});

test('3. watchWorkerCompletion is exported as a function', () => {
  assert(
    typeof watchWorkerCompletion === 'function',
    'watchWorkerCompletion should be a function'
  );
});

// ═════════════════════════════════════════════════════════════════════
// 2. updateTaskStatus
// ═════════════════════════════════════════════════════════════════════

console.log('\n  updateTaskStatus\n');

test('4. updateTaskStatus changes status in tasks.json', () => {
  const env = createTestProject();
  try {
    updateTaskStatus('test-project/test-task', 'in_progress', {
      projectsRoot: env.tmpdir,
    });
    // Read back tasks.json
    const content = fs.readFileSync(env.tasksJsonPath, 'utf8');
    const data = JSON.parse(content);
    const task = data.tasks.find((t) => t.id === 'test-project/test-task');
    assert(task != null, 'Task should exist in tasks.json');
    assert(
      task.status === 'in_progress',
      `Expected status "in_progress", got "${task.status}"`
    );
  } finally {
    env.cleanup();
  }
});

test('5. updateTaskStatus records history entry', () => {
  const env = createTestProject();
  try {
    updateTaskStatus('test-project/test-task', 'in_progress', {
      projectsRoot: env.tmpdir,
    });
    const content = fs.readFileSync(env.tasksJsonPath, 'utf8');
    const data = JSON.parse(content);
    const task = data.tasks.find((t) => t.id === 'test-project/test-task');
    assert(Array.isArray(task.history), 'Task should have a history array');
    assert(task.history.length >= 1, 'History should have at least one entry');
    const entry = task.history[task.history.length - 1];
    assert(
      entry.from_status === 'pending',
      `Expected from_status "pending", got "${entry.from_status}"`
    );
    assert(
      entry.to_status === 'in_progress',
      `Expected to_status "in_progress", got "${entry.to_status}"`
    );
    assert(
      typeof entry.timestamp === 'string',
      'History entry should have a timestamp'
    );
  } finally {
    env.cleanup();
  }
});

test('6. updateTaskStatus records history with agent_summary when provided', () => {
  const env = createTestProject();
  try {
    updateTaskStatus('test-project/test-task', 'completed', {
      projectsRoot: env.tmpdir,
      summary: 'All acceptance criteria met',
    });
    const content = fs.readFileSync(env.tasksJsonPath, 'utf8');
    const data = JSON.parse(content);
    const task = data.tasks.find((t) => t.id === 'test-project/test-task');
    const entry = task.history[task.history.length - 1];
    assert(
      entry.agent_summary === 'All acceptance criteria met',
      `Expected agent_summary "All acceptance criteria met", got "${entry.agent_summary}"`
    );
  } finally {
    env.cleanup();
  }
});

test('7. updateTaskStatus updates the updated_at timestamp', () => {
  const env = createTestProject();
  try {
    const before = new Date().toISOString();
    updateTaskStatus('test-project/test-task', 'in_progress', {
      projectsRoot: env.tmpdir,
    });
    const content = fs.readFileSync(env.tasksJsonPath, 'utf8');
    const data = JSON.parse(content);
    const task = data.tasks.find((t) => t.id === 'test-project/test-task');
    assert(
      typeof task.updated_at === 'string',
      'Task should have updated_at timestamp'
    );
    assert(
      !isNaN(Date.parse(task.updated_at)),
      'updated_at should be valid ISO date'
    );
  } finally {
    env.cleanup();
  }
});

test('8. updateTaskStatus throws if task not found', () => {
  const env = createTestProject();
  try {
    let threw = false;
    try {
      updateTaskStatus('test-project/nonexistent-task', 'in_progress', {
        projectsRoot: env.tmpdir,
      });
    } catch (err) {
      threw = true;
      assert(
        err.message.includes('not found') ||
          err.message.includes('nonexistent'),
        `Error should mention task not found, got: "${err.message}"`
      );
    }
    assert(threw, 'updateTaskStatus should throw for unknown taskId');
  } finally {
    env.cleanup();
  }
});

// ═════════════════════════════════════════════════════════════════════
// 3. getTaskStatus
// ═════════════════════════════════════════════════════════════════════

console.log('\n  getTaskStatus\n');

test('9. getTaskStatus returns current status', () => {
  const env = createTestProject();
  try {
    const status = getTaskStatus('test-project/test-task', {
      projectsRoot: env.tmpdir,
    });
    assert(status === 'pending', `Expected "pending", got "${status}"`);
  } finally {
    env.cleanup();
  }
});

test('10. getTaskStatus returns updated status after change', () => {
  const env = createTestProject();
  try {
    updateTaskStatus('test-project/test-task', 'in_progress', {
      projectsRoot: env.tmpdir,
    });
    const status = getTaskStatus('test-project/test-task', {
      projectsRoot: env.tmpdir,
    });
    assert(status === 'in_progress', `Expected "in_progress", got "${status}"`);
  } finally {
    env.cleanup();
  }
});

test('11. getTaskStatus throws if task not found', () => {
  const env = createTestProject();
  try {
    let threw = false;
    try {
      getTaskStatus('test-project/nonexistent-task', {
        projectsRoot: env.tmpdir,
      });
    } catch (err) {
      threw = true;
      assert(
        err.message.includes('not found') ||
          err.message.includes('nonexistent'),
        `Error should mention task not found, got: "${err.message}"`
      );
    }
    assert(threw, 'getTaskStatus should throw for unknown taskId');
  } finally {
    env.cleanup();
  }
});

// ═════════════════════════════════════════════════════════════════════
// 4. watchWorkerCompletion - Success
// ═════════════════════════════════════════════════════════════════════

console.log('\n  watchWorkerCompletion - Success\n');

const asyncTests = [];

function queueAsync(name, fn) {
  asyncTests.push({ name, fn });
}

queueAsync(
  '12. watchWorkerCompletion updates status to completed on exit 0',
  async () => {
    const env = createTestProject();
    try {
      // Set task to in_progress first
      updateTaskStatus('test-project/test-task', 'in_progress', {
        projectsRoot: env.tmpdir,
      });

      const child = createMockChild(0);
      const result = await watchWorkerCompletion(
        'test-project/test-task',
        child,
        {
          projectsRoot: env.tmpdir,
        }
      );

      // Read back tasks.json
      const content = fs.readFileSync(env.tasksJsonPath, 'utf8');
      const data = JSON.parse(content);
      const task = data.tasks.find((t) => t.id === 'test-project/test-task');
      assert(
        task.status === 'completed',
        `Expected status "completed", got "${task.status}"`
      );
    } finally {
      env.cleanup();
    }
  }
);

queueAsync(
  '13. watchWorkerCompletion records history entry on success',
  async () => {
    const env = createTestProject();
    try {
      updateTaskStatus('test-project/test-task', 'in_progress', {
        projectsRoot: env.tmpdir,
      });

      const child = createMockChild(0);
      await watchWorkerCompletion('test-project/test-task', child, {
        projectsRoot: env.tmpdir,
      });

      const content = fs.readFileSync(env.tasksJsonPath, 'utf8');
      const data = JSON.parse(content);
      const task = data.tasks.find((t) => t.id === 'test-project/test-task');
      const completedEntry = task.history.find(
        (h) => h.to_status === 'completed'
      );
      assert(completedEntry != null, 'History should have a "completed" entry');
      assert(
        typeof completedEntry.timestamp === 'string',
        'Entry should have timestamp'
      );
    } finally {
      env.cleanup();
    }
  }
);

queueAsync(
  '14. watchWorkerCompletion returns result with exitCode 0',
  async () => {
    const env = createTestProject();
    try {
      updateTaskStatus('test-project/test-task', 'in_progress', {
        projectsRoot: env.tmpdir,
      });

      const child = createMockChild(0);
      const result = await watchWorkerCompletion(
        'test-project/test-task',
        child,
        {
          projectsRoot: env.tmpdir,
        }
      );

      assert(result != null, 'Result should not be null');
      assert(
        result.exitCode === 0,
        `Expected exitCode 0, got ${result.exitCode}`
      );
      assert(
        typeof result.completedAt === 'string',
        'Result should have completedAt timestamp'
      );
    } finally {
      env.cleanup();
    }
  }
);

// ═════════════════════════════════════════════════════════════════════
// 5. watchWorkerCompletion - Failure
// ═════════════════════════════════════════════════════════════════════

console.log('\n  watchWorkerCompletion - Failure\n');

queueAsync(
  '15. watchWorkerCompletion updates status to failed on non-zero exit',
  async () => {
    const env = createTestProject();
    try {
      updateTaskStatus('test-project/test-task', 'in_progress', {
        projectsRoot: env.tmpdir,
      });

      const child = createMockChild(1);
      const result = await watchWorkerCompletion(
        'test-project/test-task',
        child,
        {
          projectsRoot: env.tmpdir,
        }
      );

      const content = fs.readFileSync(env.tasksJsonPath, 'utf8');
      const data = JSON.parse(content);
      const task = data.tasks.find((t) => t.id === 'test-project/test-task');
      assert(
        task.status === 'failed',
        `Expected status "failed", got "${task.status}"`
      );
    } finally {
      env.cleanup();
    }
  }
);

queueAsync(
  '16. watchWorkerCompletion records history with error details on failure',
  async () => {
    const env = createTestProject();
    try {
      updateTaskStatus('test-project/test-task', 'in_progress', {
        projectsRoot: env.tmpdir,
      });

      const child = createMockChild(1);
      const result = await watchWorkerCompletion(
        'test-project/test-task',
        child,
        {
          projectsRoot: env.tmpdir,
        }
      );

      const content = fs.readFileSync(env.tasksJsonPath, 'utf8');
      const data = JSON.parse(content);
      const task = data.tasks.find((t) => t.id === 'test-project/test-task');
      const failedEntry = task.history.find((h) => h.to_status === 'failed');
      assert(failedEntry != null, 'History should have a "failed" entry');
      assert(
        typeof failedEntry.timestamp === 'string',
        'Entry should have timestamp'
      );
      assert(
        typeof failedEntry.agent_summary === 'string' &&
          failedEntry.agent_summary.length > 0,
        'Failed entry should have error details in agent_summary'
      );
    } finally {
      env.cleanup();
    }
  }
);

queueAsync(
  '17. watchWorkerCompletion returns result with non-zero exitCode',
  async () => {
    const env = createTestProject();
    try {
      updateTaskStatus('test-project/test-task', 'in_progress', {
        projectsRoot: env.tmpdir,
      });

      const child = createMockChild(1);
      const result = await watchWorkerCompletion(
        'test-project/test-task',
        child,
        {
          projectsRoot: env.tmpdir,
        }
      );

      assert(result != null, 'Result should not be null');
      assert(
        result.exitCode === 1,
        `Expected exitCode 1, got ${result.exitCode}`
      );
      assert(typeof result.stderr === 'string', 'Result should have stderr');
    } finally {
      env.cleanup();
    }
  }
);

// ═════════════════════════════════════════════════════════════════════
// Run async tests
// ═════════════════════════════════════════════════════════════════════

async function runAsyncTests() {
  for (const { name, fn } of asyncTests) {
    await testAsync(name, fn);
  }
}

runAsyncTests().then(() => {
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
});
