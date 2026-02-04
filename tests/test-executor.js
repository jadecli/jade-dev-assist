#!/usr/bin/env node

/**
 * Executor Module Tests (lib/executor.js)
 *
 * Tests for executeWorker() function that spawns a Claude Code subprocess
 * with the dispatcher-built prompt.
 *
 * Uses the same custom test framework as test-dispatcher.js, test-scanner.js, etc.
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
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'jade-executor-test-'));
  const projectPath = path.join(tmpdir, 'test-project');
  fs.mkdirSync(projectPath, { recursive: true });

  // Write CLAUDE.md
  if (opts.claudeMd != null) {
    fs.writeFileSync(path.join(projectPath, 'CLAUDE.md'), opts.claudeMd);
  }

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
 * Build a mock spawn function that simulates child_process.spawn.
 *
 * Returns { mockSpawn, calls } where calls is an array of
 * { command, args, options } objects for each invocation, and the
 * child emitter that can be controlled by the test.
 */
function createMockSpawn(exitCode) {
  const calls = [];
  const children = [];

  function mockSpawn(command, args, options) {
    const child = new EventEmitter();

    // Simulate stdin as a writable stream
    const stdinChunks = [];
    child.stdin = {
      write(data) {
        stdinChunks.push(data);
      },
      end() {
        child.stdin._ended = true;
      },
      _ended: false,
      _chunks: stdinChunks,
    };

    // Simulate stdout as a readable event emitter
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();

    // Record the call
    calls.push({ command, args, options, child, stdinChunks });
    children.push(child);

    // Schedule exit event to fire asynchronously
    process.nextTick(() => {
      if (exitCode === 0) {
        child.stdout.emit(
          'data',
          Buffer.from('Worker output: task completed successfully\n')
        );
      } else {
        child.stderr.emit(
          'data',
          Buffer.from('Worker error: something went wrong\n')
        );
      }
      child.emit('close', exitCode);
    });

    return child;
  }

  return { mockSpawn, calls, children };
}

// ── Import executor ─────────────────────────────────────────────────

let executeWorker;
let buildTierConfig;
let getOllamaBaseUrl;
let DEFAULT_OLLAMA_BASE_URL;
try {
  const executor = require('../lib/executor');
  executeWorker = executor.executeWorker;
  buildTierConfig = executor.buildTierConfig;
  getOllamaBaseUrl = executor.getOllamaBaseUrl;
  DEFAULT_OLLAMA_BASE_URL = executor.DEFAULT_OLLAMA_BASE_URL;
} catch (err) {
  console.log('\nFATAL: Could not load lib/executor.js');
  console.log(`  ${err.message}\n`);
  console.log('All tests will be marked as failed.\n');
  process.exit(1);
}

// ═════════════════════════════════════════════════════════════════════
// 1. EXPORTS
// ═════════════════════════════════════════════════════════════════════

console.log('\n  Exports\n');

test('1. executeWorker is exported as a function', () => {
  assert(
    typeof executeWorker === 'function',
    'executeWorker should be a function'
  );
});

// ═════════════════════════════════════════════════════════════════════
// 2. BASIC EXECUTION - returns a promise
// ═════════════════════════════════════════════════════════════════════

console.log('\n  Basic Execution\n');

// We need an async-aware runner for promise-based tests.
// Collect async tests and run them after sync tests.
const asyncTests = [];

function queueAsync(name, fn) {
  asyncTests.push({ name, fn });
}

queueAsync('2. executeWorker returns a promise', async () => {
  const env = createTestProject({ claudeMd: '# Test\n' });
  try {
    const { mockSpawn } = createMockSpawn(0);
    const result = executeWorker('test-project/test-task', {
      projectsRoot: env.tmpdir,
      _spawnFn: mockSpawn,
    });
    assert(result != null, 'Result should not be null');
    assert(
      typeof result.then === 'function',
      'Result should be a promise (thenable)'
    );
    // Wait for it to resolve
    await result;
  } finally {
    env.cleanup();
  }
});

queueAsync('3. executeWorker resolves with output on exit code 0', async () => {
  const env = createTestProject({ claudeMd: '# Test\n' });
  try {
    const { mockSpawn } = createMockSpawn(0);
    const result = await executeWorker('test-project/test-task', {
      projectsRoot: env.tmpdir,
      _spawnFn: mockSpawn,
    });
    assert(result != null, 'Result should not be null');
    assert(
      typeof result.stdout === 'string',
      'Result should have stdout string'
    );
    assert(
      result.stdout.includes('task completed'),
      'stdout should contain worker output'
    );
    assert(
      result.exitCode === 0,
      `Exit code should be 0, got ${result.exitCode}`
    );
  } finally {
    env.cleanup();
  }
});

queueAsync(
  '4. executeWorker rejects or returns failure on non-zero exit',
  async () => {
    const env = createTestProject({ claudeMd: '# Test\n' });
    try {
      const { mockSpawn } = createMockSpawn(1);
      try {
        const result = await executeWorker('test-project/test-task', {
          projectsRoot: env.tmpdir,
          _spawnFn: mockSpawn,
        });
        // If it resolves instead of rejecting, verify exit code is captured
        assert(
          result.exitCode === 1 || result.exitCode !== 0,
          `Resolved result should capture non-zero exit code, got ${result.exitCode}`
        );
      } catch (err) {
        // Rejection is expected for non-zero exit
        assert(
          err.exitCode === 1 || err.message.includes('exit'),
          'Error should contain exit code info'
        );
      }
    } finally {
      env.cleanup();
    }
  }
);

// ═════════════════════════════════════════════════════════════════════
// 3. SPAWNING CLAUDE SUBPROCESS
// ═════════════════════════════════════════════════════════════════════

console.log('\n  Spawn Configuration\n');

queueAsync(
  '5. spawns "claude" with --print and --dangerouslySkipPermissions flags',
  async () => {
    const env = createTestProject({ claudeMd: '# Test\n' });
    try {
      const { mockSpawn, calls } = createMockSpawn(0);
      await executeWorker('test-project/test-task', {
        projectsRoot: env.tmpdir,
        _spawnFn: mockSpawn,
      });
      assert(calls.length === 1, `Expected 1 spawn call, got ${calls.length}`);
      const call = calls[0];
      assert(
        call.command === 'claude',
        `Expected command "claude", got "${call.command}"`
      );
      const argsStr = call.args.join(' ');
      assert(argsStr.includes('--print'), 'Args should include --print flag');
      assert(
        argsStr.includes('--dangerouslySkipPermissions'),
        'Args should include --dangerouslySkipPermissions flag'
      );
    } finally {
      env.cleanup();
    }
  }
);

queueAsync('6. sets working directory from dispatcher result', async () => {
  const env = createTestProject({ claudeMd: '# Test\n' });
  try {
    const { mockSpawn, calls } = createMockSpawn(0);
    await executeWorker('test-project/test-task', {
      projectsRoot: env.tmpdir,
      _spawnFn: mockSpawn,
    });
    assert(calls.length === 1, `Expected 1 spawn call, got ${calls.length}`);
    const spawnOpts = calls[0].options;
    assert(spawnOpts != null, 'Spawn options should not be null');
    const expectedCwd = path.join(env.tmpdir, 'test-project');
    assert(
      spawnOpts.cwd === expectedCwd,
      `Expected cwd "${expectedCwd}", got "${spawnOpts.cwd}"`
    );
  } finally {
    env.cleanup();
  }
});

queueAsync('7. pipes dispatcher prompt to subprocess stdin', async () => {
  const env = createTestProject({ claudeMd: '# Test\n' });
  try {
    const { mockSpawn, calls } = createMockSpawn(0);
    await executeWorker('test-project/test-task', {
      projectsRoot: env.tmpdir,
      _spawnFn: mockSpawn,
    });
    assert(calls.length === 1, `Expected 1 spawn call, got ${calls.length}`);
    const stdinChunks = calls[0].stdinChunks;
    assert(stdinChunks.length > 0, 'Prompt should be written to stdin');
    const prompt = stdinChunks.join('');
    // Verify prompt contains task content (from dispatcher)
    assert(
      prompt.includes('Test task title'),
      'Stdin prompt should include the task title from dispatcher'
    );
    assert(
      /worker/i.test(prompt) && /task/i.test(prompt),
      'Stdin prompt should include worker role and task context'
    );
  } finally {
    env.cleanup();
  }
});

queueAsync('8. stdin is ended after writing prompt', async () => {
  const env = createTestProject({ claudeMd: '# Test\n' });
  try {
    const { mockSpawn, calls } = createMockSpawn(0);
    await executeWorker('test-project/test-task', {
      projectsRoot: env.tmpdir,
      _spawnFn: mockSpawn,
    });
    const child = calls[0].child;
    assert(child.stdin._ended === true, 'stdin.end() should have been called');
  } finally {
    env.cleanup();
  }
});

// ═════════════════════════════════════════════════════════════════════
// 4. STATUS UPDATES ON SUCCESS
// ═════════════════════════════════════════════════════════════════════

console.log('\n  Status Updates - Success\n');

queueAsync('9. updates task status to "completed" on exit code 0', async () => {
  const env = createTestProject({ claudeMd: '# Test\n' });
  try {
    const { mockSpawn } = createMockSpawn(0);
    await executeWorker('test-project/test-task', {
      projectsRoot: env.tmpdir,
      _spawnFn: mockSpawn,
    });
    // Read back tasks.json
    const content = fs.readFileSync(env.tasksJsonPath, 'utf8');
    const data = JSON.parse(content);
    const task = data.tasks.find((t) => t.id === 'test-project/test-task');
    assert(task != null, 'Task should exist in tasks.json');
    assert(
      task.status === 'completed',
      `Expected status "completed", got "${task.status}"`
    );
  } finally {
    env.cleanup();
  }
});

queueAsync('10. records history entry with timestamp on success', async () => {
  const env = createTestProject({ claudeMd: '# Test\n' });
  try {
    const { mockSpawn } = createMockSpawn(0);
    await executeWorker('test-project/test-task', {
      projectsRoot: env.tmpdir,
      _spawnFn: mockSpawn,
    });
    const content = fs.readFileSync(env.tasksJsonPath, 'utf8');
    const data = JSON.parse(content);
    const task = data.tasks.find((t) => t.id === 'test-project/test-task');
    assert(Array.isArray(task.history), 'Task should have a history array');
    // Should have at least 2 entries: in_progress (from dispatcher) and completed
    const completedEntry = task.history.find(
      (h) => h.to_status === 'completed'
    );
    assert(completedEntry != null, 'History should have a "completed" entry');
    assert(
      typeof completedEntry.timestamp === 'string',
      'Completed history entry should have a timestamp'
    );
    assert(
      completedEntry.from_status === 'in_progress',
      `Expected from_status "in_progress", got "${completedEntry.from_status}"`
    );
  } finally {
    env.cleanup();
  }
});

// ═════════════════════════════════════════════════════════════════════
// 5. STATUS UPDATES ON FAILURE
// ═════════════════════════════════════════════════════════════════════

console.log('\n  Status Updates - Failure\n');

queueAsync('11. updates task status to "failed" on non-zero exit', async () => {
  const env = createTestProject({ claudeMd: '# Test\n' });
  try {
    const { mockSpawn } = createMockSpawn(1);
    try {
      await executeWorker('test-project/test-task', {
        projectsRoot: env.tmpdir,
        _spawnFn: mockSpawn,
      });
    } catch (_err) {
      // Expected to reject
    }
    const content = fs.readFileSync(env.tasksJsonPath, 'utf8');
    const data = JSON.parse(content);
    const task = data.tasks.find((t) => t.id === 'test-project/test-task');
    assert(task != null, 'Task should exist in tasks.json');
    assert(
      task.status === 'failed',
      `Expected status "failed", got "${task.status}"`
    );
  } finally {
    env.cleanup();
  }
});

queueAsync('12. records history entry with timestamp on failure', async () => {
  const env = createTestProject({ claudeMd: '# Test\n' });
  try {
    const { mockSpawn } = createMockSpawn(1);
    try {
      await executeWorker('test-project/test-task', {
        projectsRoot: env.tmpdir,
        _spawnFn: mockSpawn,
      });
    } catch (_err) {
      // Expected to reject
    }
    const content = fs.readFileSync(env.tasksJsonPath, 'utf8');
    const data = JSON.parse(content);
    const task = data.tasks.find((t) => t.id === 'test-project/test-task');
    assert(Array.isArray(task.history), 'Task should have a history array');
    const failedEntry = task.history.find((h) => h.to_status === 'failed');
    assert(failedEntry != null, 'History should have a "failed" entry');
    assert(
      typeof failedEntry.timestamp === 'string',
      'Failed history entry should have a timestamp'
    );
    assert(
      failedEntry.from_status === 'in_progress',
      `Expected from_status "in_progress", got "${failedEntry.from_status}"`
    );
  } finally {
    env.cleanup();
  }
});

// ═════════════════════════════════════════════════════════════════════
// 6. STDOUT/STDERR STREAMING
// ═════════════════════════════════════════════════════════════════════

console.log('\n  Output Streaming\n');

queueAsync('13. captures stdout from subprocess', async () => {
  const env = createTestProject({ claudeMd: '# Test\n' });
  try {
    const { mockSpawn } = createMockSpawn(0);
    const result = await executeWorker('test-project/test-task', {
      projectsRoot: env.tmpdir,
      _spawnFn: mockSpawn,
    });
    assert(typeof result.stdout === 'string', 'Result should have stdout');
    assert(result.stdout.length > 0, 'stdout should not be empty');
  } finally {
    env.cleanup();
  }
});

queueAsync('14. captures stderr from subprocess', async () => {
  const env = createTestProject({ claudeMd: '# Test\n' });
  try {
    const { mockSpawn } = createMockSpawn(1);
    try {
      const result = await executeWorker('test-project/test-task', {
        projectsRoot: env.tmpdir,
        _spawnFn: mockSpawn,
      });
      // If resolved, verify stderr was captured on the result
      assert(
        typeof result.stderr === 'string',
        `Resolved result should capture stderr, got ${typeof result.stderr}`
      );
    } catch (err) {
      assert(
        typeof err.stderr === 'string' || typeof err.message === 'string',
        'Error should contain stderr info'
      );
    }
  } finally {
    env.cleanup();
  }
});

queueAsync('15. emits stdout data events via onStdout callback', async () => {
  const env = createTestProject({ claudeMd: '# Test\n' });
  try {
    const { mockSpawn } = createMockSpawn(0);
    const stdoutChunks = [];
    await executeWorker('test-project/test-task', {
      projectsRoot: env.tmpdir,
      _spawnFn: mockSpawn,
      onStdout: (data) => {
        stdoutChunks.push(data.toString());
      },
    });
    assert(
      stdoutChunks.length > 0,
      'onStdout should have been called at least once'
    );
    assert(
      stdoutChunks.join('').includes('task completed'),
      'onStdout data should include worker output'
    );
  } finally {
    env.cleanup();
  }
});

queueAsync('16. emits stderr data events via onStderr callback', async () => {
  const env = createTestProject({ claudeMd: '# Test\n' });
  try {
    const { mockSpawn } = createMockSpawn(1);
    const stderrChunks = [];
    try {
      await executeWorker('test-project/test-task', {
        projectsRoot: env.tmpdir,
        _spawnFn: mockSpawn,
        onStderr: (data) => {
          stderrChunks.push(data.toString());
        },
      });
    } catch (_err) {
      // Expected
    }
    assert(
      stderrChunks.length > 0,
      'onStderr should have been called at least once'
    );
    assert(
      stderrChunks.join('').includes('something went wrong'),
      'onStderr data should include error output'
    );
  } finally {
    env.cleanup();
  }
});

// ═════════════════════════════════════════════════════════════════════
// 7. TASK LOOKUP
// ═════════════════════════════════════════════════════════════════════

console.log('\n  Task Lookup\n');

queueAsync('17. looks up task from tasks.json by taskId', async () => {
  const tasksData = {
    version: 1,
    project: 'test-project',
    tasks: [
      {
        id: 'test-project/alpha-task',
        title: 'Alpha task',
        description: 'First task.',
        status: 'pending',
        complexity: 'S',
        blocked_by: [],
        unlocks: [],
        labels: ['feature'],
        feature: {
          description: 'Alpha feature',
          acceptance_criteria: ['alpha criterion'],
        },
        relevant_files: [],
        created_at: '2026-02-02T00:00:00Z',
      },
      {
        id: 'test-project/beta-task',
        title: 'Beta task',
        description: 'Second task.',
        status: 'pending',
        complexity: 'M',
        blocked_by: [],
        unlocks: [],
        labels: ['feature'],
        feature: {
          description: 'Beta feature',
          acceptance_criteria: ['beta criterion'],
        },
        relevant_files: [],
        created_at: '2026-02-02T01:00:00Z',
      },
    ],
  };
  const env = createTestProject({ claudeMd: '# Test\n', tasksData });
  try {
    const { mockSpawn, calls } = createMockSpawn(0);
    await executeWorker('test-project/beta-task', {
      projectsRoot: env.tmpdir,
      _spawnFn: mockSpawn,
    });
    // Verify prompt contains the beta task title
    const stdinData = calls[0].stdinChunks.join('');
    assert(
      stdinData.includes('Beta task'),
      'Prompt should be built from the correct task (beta-task)'
    );
  } finally {
    env.cleanup();
  }
});

queueAsync(
  '18. throws/rejects if taskId is not found in tasks.json',
  async () => {
    const env = createTestProject({ claudeMd: '# Test\n' });
    try {
      const { mockSpawn } = createMockSpawn(0);
      let threw = false;
      try {
        await executeWorker('test-project/nonexistent-task', {
          projectsRoot: env.tmpdir,
          _spawnFn: mockSpawn,
        });
      } catch (err) {
        threw = true;
        assert(
          err.message.includes('not found') ||
            err.message.includes('nonexistent'),
          `Error should mention task not found, got: "${err.message}"`
        );
      }
      assert(threw, 'executeWorker should reject for unknown taskId');
    } finally {
      env.cleanup();
    }
  }
);

// ═════════════════════════════════════════════════════════════════════
// 8. EDGE CASES
// ═════════════════════════════════════════════════════════════════════

console.log('\n  Edge Cases\n');

queueAsync(
  '19. handles task with standard project/task format in taskId',
  async () => {
    const tasksData = {
      version: 1,
      project: 'test-project',
      tasks: [
        {
          id: 'test-project/test-task',
          title: 'Test task title',
          description: 'Test description.',
          status: 'pending',
          complexity: 'S',
          blocked_by: [],
          unlocks: [],
          labels: ['feature'],
          feature: { description: 'desc', acceptance_criteria: ['c1'] },
          relevant_files: [],
          created_at: '2026-02-02T00:00:00Z',
        },
      ],
    };
    const env = createTestProject({ claudeMd: '# Test\n', tasksData });
    try {
      const { mockSpawn } = createMockSpawn(0);
      // Standard taskId format with project prefix
      const result = await executeWorker('test-project/test-task', {
        projectsRoot: env.tmpdir,
        _spawnFn: mockSpawn,
      });
      assert(result.exitCode === 0, 'Should complete successfully');
    } finally {
      env.cleanup();
    }
  }
);

queueAsync('20. result includes execution timestamps', async () => {
  const env = createTestProject({ claudeMd: '# Test\n' });
  try {
    const { mockSpawn } = createMockSpawn(0);
    const result = await executeWorker('test-project/test-task', {
      projectsRoot: env.tmpdir,
      _spawnFn: mockSpawn,
    });
    assert(
      typeof result.startedAt === 'string',
      'Result should have startedAt timestamp'
    );
    assert(
      typeof result.completedAt === 'string',
      'Result should have completedAt timestamp'
    );
    // Validate they are ISO date strings
    assert(
      !isNaN(Date.parse(result.startedAt)),
      'startedAt should be a valid ISO date'
    );
    assert(
      !isNaN(Date.parse(result.completedAt)),
      'completedAt should be a valid ISO date'
    );
  } finally {
    env.cleanup();
  }
});

// ═════════════════════════════════════════════════════════════════════
// 9. TIERED MODEL DISPATCH - buildTierConfig unit tests
// ═════════════════════════════════════════════════════════════════════

console.log('\n  Tiered Model Dispatch - buildTierConfig\n');

test('21. buildTierConfig is exported as a function', () => {
  assert(
    typeof buildTierConfig === 'function',
    'buildTierConfig should be a function'
  );
});

test('22. getOllamaBaseUrl is exported as a function', () => {
  assert(
    typeof getOllamaBaseUrl === 'function',
    'getOllamaBaseUrl should be a function'
  );
});

test('23. DEFAULT_OLLAMA_BASE_URL is http://localhost:11434', () => {
  assert(
    DEFAULT_OLLAMA_BASE_URL === 'http://localhost:11434',
    `Expected "http://localhost:11434", got "${DEFAULT_OLLAMA_BASE_URL}"`
  );
});

test('24. opus tier returns base args with no --model flag', () => {
  const config = buildTierConfig('opus');
  assert(Array.isArray(config.args), 'config.args should be an array');
  assert(config.args.includes('--print'), 'Should include --print');
  assert(
    config.args.includes('--dangerouslySkipPermissions'),
    'Should include --dangerouslySkipPermissions'
  );
  assert(
    !config.args.includes('--model'),
    'Should NOT include --model flag for opus tier'
  );
  assert(config.env === undefined, 'env should be undefined for opus tier');
});

test('25. local tier includes --model qwen3-coder flag', () => {
  const config = buildTierConfig('local');
  assert(Array.isArray(config.args), 'config.args should be an array');
  const modelIdx = config.args.indexOf('--model');
  assert(modelIdx !== -1, 'Should include --model flag for local tier');
  assert(
    config.args[modelIdx + 1] === 'qwen3-coder',
    `Expected model "qwen3-coder", got "${config.args[modelIdx + 1]}"`
  );
});

test('26. local tier sets ANTHROPIC_AUTH_TOKEN=ollama in env', () => {
  const config = buildTierConfig('local');
  assert(config.env != null, 'env should not be null for local tier');
  assert(
    config.env.ANTHROPIC_AUTH_TOKEN === 'ollama',
    `Expected ANTHROPIC_AUTH_TOKEN "ollama", got "${config.env.ANTHROPIC_AUTH_TOKEN}"`
  );
});

test('27. local tier sets ANTHROPIC_BASE_URL from default', () => {
  // Ensure env is clean
  const saved = process.env.OLLAMA_BASE_URL;
  delete process.env.OLLAMA_BASE_URL;
  try {
    const config = buildTierConfig('local');
    assert(config.env != null, 'env should not be null for local tier');
    assert(
      config.env.ANTHROPIC_BASE_URL === 'http://localhost:11434',
      `Expected ANTHROPIC_BASE_URL "http://localhost:11434", got "${config.env.ANTHROPIC_BASE_URL}"`
    );
  } finally {
    if (saved !== undefined) {
      process.env.OLLAMA_BASE_URL = saved;
    }
  }
});

test('28. default tier (undefined modelTier) behaves as opus', () => {
  const config = buildTierConfig(undefined);
  assert(Array.isArray(config.args), 'config.args should be an array');
  assert(
    !config.args.includes('--model'),
    'Should NOT include --model flag when modelTier is undefined'
  );
  assert(
    config.env === undefined,
    'env should be undefined when modelTier is undefined'
  );
});

test('29. default tier (null modelTier) behaves as opus', () => {
  const config = buildTierConfig(null);
  assert(Array.isArray(config.args), 'config.args should be an array');
  assert(
    !config.args.includes('--model'),
    'Should NOT include --model flag when modelTier is null'
  );
  assert(
    config.env === undefined,
    'env should be undefined when modelTier is null'
  );
});

test('30. OLLAMA_BASE_URL env var overrides default', () => {
  const saved = process.env.OLLAMA_BASE_URL;
  process.env.OLLAMA_BASE_URL = 'http://custom-host:9999';
  try {
    const config = buildTierConfig('local');
    assert(
      config.env.ANTHROPIC_BASE_URL === 'http://custom-host:9999',
      `Expected ANTHROPIC_BASE_URL "http://custom-host:9999", got "${config.env.ANTHROPIC_BASE_URL}"`
    );
  } finally {
    if (saved !== undefined) {
      process.env.OLLAMA_BASE_URL = saved;
    } else {
      delete process.env.OLLAMA_BASE_URL;
    }
  }
});

test('31. getOllamaBaseUrl returns env override when set', () => {
  const saved = process.env.OLLAMA_BASE_URL;
  process.env.OLLAMA_BASE_URL = 'http://myollama:7777';
  try {
    const url = getOllamaBaseUrl();
    assert(
      url === 'http://myollama:7777',
      `Expected "http://myollama:7777", got "${url}"`
    );
  } finally {
    if (saved !== undefined) {
      process.env.OLLAMA_BASE_URL = saved;
    } else {
      delete process.env.OLLAMA_BASE_URL;
    }
  }
});

test('32. getOllamaBaseUrl returns default when env not set', () => {
  const saved = process.env.OLLAMA_BASE_URL;
  delete process.env.OLLAMA_BASE_URL;
  try {
    const url = getOllamaBaseUrl();
    assert(
      url === 'http://localhost:11434',
      `Expected "http://localhost:11434", got "${url}"`
    );
  } finally {
    if (saved !== undefined) {
      process.env.OLLAMA_BASE_URL = saved;
    }
  }
});

// ═════════════════════════════════════════════════════════════════════
// 10. TIERED MODEL DISPATCH - Integration with executeWorker
// ═════════════════════════════════════════════════════════════════════

console.log('\n  Tiered Model Dispatch - executeWorker Integration\n');

/**
 * Creates a test project with a task that has a modelTier field.
 */
function createTieredTestProject(modelTier) {
  const task = {
    id: 'test-project/tier-task',
    title: 'Tiered task title',
    description: 'A task for testing tiered model dispatch.',
    status: 'pending',
    complexity: 'S',
    blocked_by: [],
    unlocks: [],
    labels: ['feature'],
    feature: {
      description: 'Tier feature',
      acceptance_criteria: ['tier criterion'],
    },
    relevant_files: [],
    created_at: '2026-02-02T00:00:00Z',
  };
  if (modelTier !== undefined) {
    task.modelTier = modelTier;
  }
  return createTestProject({
    claudeMd: '# Tier Test\n',
    tasksData: {
      version: 1,
      project: 'test-project',
      tasks: [task],
    },
  });
}

queueAsync(
  '33. opus tier task spawns claude with no --model flag',
  async () => {
    const env = createTieredTestProject('opus');
    try {
      const { mockSpawn, calls } = createMockSpawn(0);
      await executeWorker('test-project/tier-task', {
        projectsRoot: env.tmpdir,
        _spawnFn: mockSpawn,
      });
      assert(calls.length === 1, `Expected 1 spawn call, got ${calls.length}`);
      const call = calls[0];
      assert(
        call.command === 'claude',
        `Expected command "claude", got "${call.command}"`
      );
      assert(
        !call.args.includes('--model'),
        'Opus tier should NOT include --model flag'
      );
      assert(call.args.includes('--print'), 'Should include --print');
      assert(
        call.args.includes('--dangerouslySkipPermissions'),
        'Should include --dangerouslySkipPermissions'
      );
    } finally {
      env.cleanup();
    }
  }
);

queueAsync('34. opus tier task does not set custom env', async () => {
  const env = createTieredTestProject('opus');
  try {
    const { mockSpawn, calls } = createMockSpawn(0);
    await executeWorker('test-project/tier-task', {
      projectsRoot: env.tmpdir,
      _spawnFn: mockSpawn,
    });
    const spawnOpts = calls[0].options;
    assert(
      spawnOpts.env === undefined || spawnOpts.env == null,
      'Opus tier should not set custom env on spawn options'
    );
  } finally {
    env.cleanup();
  }
});

queueAsync(
  '35. local tier task spawns claude with --model qwen3-coder',
  async () => {
    const env = createTieredTestProject('local');
    try {
      const { mockSpawn, calls } = createMockSpawn(0);
      await executeWorker('test-project/tier-task', {
        projectsRoot: env.tmpdir,
        _spawnFn: mockSpawn,
      });
      assert(calls.length === 1, `Expected 1 spawn call, got ${calls.length}`);
      const call = calls[0];
      const modelIdx = call.args.indexOf('--model');
      assert(modelIdx !== -1, 'Local tier should include --model flag');
      assert(
        call.args[modelIdx + 1] === 'qwen3-coder',
        `Expected model "qwen3-coder", got "${call.args[modelIdx + 1]}"`
      );
    } finally {
      env.cleanup();
    }
  }
);

queueAsync(
  '36. local tier task sets ANTHROPIC_AUTH_TOKEN and ANTHROPIC_BASE_URL env vars',
  async () => {
    const savedOllama = process.env.OLLAMA_BASE_URL;
    delete process.env.OLLAMA_BASE_URL;
    const env = createTieredTestProject('local');
    try {
      const { mockSpawn, calls } = createMockSpawn(0);
      await executeWorker('test-project/tier-task', {
        projectsRoot: env.tmpdir,
        _spawnFn: mockSpawn,
      });
      const spawnOpts = calls[0].options;
      assert(
        spawnOpts.env != null,
        'Local tier should set env on spawn options'
      );
      assert(
        spawnOpts.env.ANTHROPIC_AUTH_TOKEN === 'ollama',
        `Expected ANTHROPIC_AUTH_TOKEN "ollama", got "${spawnOpts.env.ANTHROPIC_AUTH_TOKEN}"`
      );
      assert(
        spawnOpts.env.ANTHROPIC_BASE_URL === 'http://localhost:11434',
        `Expected ANTHROPIC_BASE_URL default, got "${spawnOpts.env.ANTHROPIC_BASE_URL}"`
      );
    } finally {
      env.cleanup();
      if (savedOllama !== undefined) {
        process.env.OLLAMA_BASE_URL = savedOllama;
      }
    }
  }
);

queueAsync(
  '37. default tier (no modelTier on task) behaves as opus',
  async () => {
    // createTieredTestProject(undefined) does NOT set modelTier on the task object
    const env = createTieredTestProject(undefined);
    try {
      const { mockSpawn, calls } = createMockSpawn(0);
      await executeWorker('test-project/tier-task', {
        projectsRoot: env.tmpdir,
        _spawnFn: mockSpawn,
      });
      assert(calls.length === 1, `Expected 1 spawn call, got ${calls.length}`);
      const call = calls[0];
      assert(
        !call.args.includes('--model'),
        'Default tier (no modelTier) should NOT include --model flag'
      );
      const spawnOpts = call.options;
      assert(
        spawnOpts.env === undefined || spawnOpts.env == null,
        'Default tier (no modelTier) should not set custom env'
      );
    } finally {
      env.cleanup();
    }
  }
);

queueAsync(
  '38. OLLAMA_BASE_URL config overrides default in local tier integration',
  async () => {
    const savedOllama = process.env.OLLAMA_BASE_URL;
    process.env.OLLAMA_BASE_URL = 'http://remote-ollama:5555';
    const env = createTieredTestProject('local');
    try {
      const { mockSpawn, calls } = createMockSpawn(0);
      await executeWorker('test-project/tier-task', {
        projectsRoot: env.tmpdir,
        _spawnFn: mockSpawn,
      });
      const spawnOpts = calls[0].options;
      assert(spawnOpts.env != null, 'Local tier should set env');
      assert(
        spawnOpts.env.ANTHROPIC_BASE_URL === 'http://remote-ollama:5555',
        `Expected ANTHROPIC_BASE_URL "http://remote-ollama:5555", got "${spawnOpts.env.ANTHROPIC_BASE_URL}"`
      );
    } finally {
      env.cleanup();
      if (savedOllama !== undefined) {
        process.env.OLLAMA_BASE_URL = savedOllama;
      } else {
        delete process.env.OLLAMA_BASE_URL;
      }
    }
  }
);

queueAsync(
  '39. local tier task still includes --print and --dangerouslySkipPermissions',
  async () => {
    const env = createTieredTestProject('local');
    try {
      const { mockSpawn, calls } = createMockSpawn(0);
      await executeWorker('test-project/tier-task', {
        projectsRoot: env.tmpdir,
        _spawnFn: mockSpawn,
      });
      const call = calls[0];
      assert(
        call.args.includes('--print'),
        'Local tier should still include --print'
      );
      assert(
        call.args.includes('--dangerouslySkipPermissions'),
        'Local tier should still include --dangerouslySkipPermissions'
      );
    } finally {
      env.cleanup();
    }
  }
);

queueAsync(
  '40. local tier task still updates status to completed on success',
  async () => {
    const env = createTieredTestProject('local');
    try {
      const { mockSpawn } = createMockSpawn(0);
      await executeWorker('test-project/tier-task', {
        projectsRoot: env.tmpdir,
        _spawnFn: mockSpawn,
      });
      const content = fs.readFileSync(env.tasksJsonPath, 'utf8');
      const data = JSON.parse(content);
      const task = data.tasks.find((t) => t.id === 'test-project/tier-task');
      assert(task != null, 'Task should exist in tasks.json');
      assert(
        task.status === 'completed',
        `Expected status "completed" for local tier, got "${task.status}"`
      );
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
