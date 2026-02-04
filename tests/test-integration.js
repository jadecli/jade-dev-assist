#!/usr/bin/env node

/**
 * Integration Tests for the jade-dev-assist orchestration cycle.
 *
 * Tests the full scan -> score -> dispatch -> worker completion cycle
 * with mock projects.json and tasks.json files in a temp directory.
 *
 * Mocks child_process.spawn for the claude subprocess.
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

function assertClose(actual, expected, tolerance, message) {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    throw new Error(
      (message || 'assertClose failed') +
        `: expected ${expected} (+/- ${tolerance}), got ${actual} (diff ${diff})`
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Creates a complete test environment with projects.json and tasks.json
 * in a temporary directory structure.
 *
 * @param {Object} [options]
 * @param {Object[]} [options.projects] - Array of project configs
 * @param {Object} [options.tasksPerProject] - Map of project name to tasks array
 * @returns {{ tmpdir, projectsJsonPath, cleanup, getTasksJsonPath }}
 */
function createTestEnvironment(options) {
  const opts = options || {};
  const tmpdir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'jade-integration-test-')
  );

  // Default projects if not specified
  const projects = opts.projects || [
    {
      name: 'test-project-a',
      path: 'test-project-a',
      status: 'buildable',
      test_command: 'npm test',
    },
    {
      name: 'test-project-b',
      path: 'test-project-b',
      status: 'scaffolding',
      test_command: 'npm test',
    },
  ];

  // Default tasks per project
  const tasksPerProject = opts.tasksPerProject || {
    'test-project-a': [
      {
        id: 'test-project-a/task-high-priority',
        title: 'High priority task',
        description: 'A high priority task with good impact.',
        status: 'pending',
        complexity: 'S',
        blocked_by: [],
        unlocks: ['test-project-a/task-depends'],
        labels: ['feature'],
        feature: {
          description: 'Feature description',
          acceptance_criteria: ['Criterion 1', 'Criterion 2'],
        },
        relevant_files: ['src/index.js'],
        created_at: new Date().toISOString(),
      },
      {
        id: 'test-project-a/task-depends',
        title: 'Dependent task',
        description: 'This task depends on the high priority one.',
        status: 'pending',
        complexity: 'M',
        blocked_by: ['test-project-a/task-high-priority'],
        unlocks: [],
        labels: [],
        feature: {},
        relevant_files: [],
        created_at: '2025-01-01T00:00:00Z',
      },
    ],
    'test-project-b': [
      {
        id: 'test-project-b/task-low-priority',
        title: 'Low priority task',
        description: 'A lower priority task.',
        status: 'pending',
        complexity: 'XL',
        blocked_by: ['test-project-b/external-blocker'],
        unlocks: [],
        labels: [],
        feature: {},
        relevant_files: [],
        created_at: '2025-01-01T00:00:00Z',
      },
    ],
  };

  // Create projects.json
  const registry = {
    version: 1,
    projects_root: tmpdir,
    projects: projects,
  };
  const projectsJsonPath = path.join(tmpdir, 'projects.json');
  fs.writeFileSync(projectsJsonPath, JSON.stringify(registry, null, 2));

  // Create project directories and tasks.json files
  for (const project of projects) {
    const projectPath = path.join(tmpdir, project.path);
    const tasksDir = path.join(projectPath, '.claude', 'tasks');
    fs.mkdirSync(tasksDir, { recursive: true });

    // Create CLAUDE.md
    fs.writeFileSync(
      path.join(projectPath, 'CLAUDE.md'),
      `# ${project.name}\n\nTest project for integration tests.`
    );

    // Create tasks.json
    const projectTasks = tasksPerProject[project.name] || [];
    const tasksData = {
      version: 1,
      project: project.name,
      milestone: { name: 'Test Milestone', target_date: '2026-06-01' },
      tasks: projectTasks,
    };
    fs.writeFileSync(
      path.join(tasksDir, 'tasks.json'),
      JSON.stringify(tasksData, null, 2)
    );

    // Create src directory with dummy file
    const srcDir = path.join(projectPath, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'index.js'),
      '// Test file\nmodule.exports = { hello: "world" };\n'
    );
  }

  return {
    tmpdir,
    projectsJsonPath,
    getTasksJsonPath(projectName) {
      return path.join(tmpdir, projectName, '.claude', 'tasks', 'tasks.json');
    },
    cleanup() {
      fs.rmSync(tmpdir, { recursive: true, force: true });
    },
  };
}

/**
 * Creates a mock child process that emits close with a given exit code.
 * Optionally delays the close event to simulate async work.
 */
function createMockWorkerProcess(exitCode, delay) {
  const child = new EventEmitter();

  // Simulate stdout/stderr as event emitters
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();

  // Simulate stdin
  child.stdin = {
    write() {},
    end() {},
  };

  // Simulate pid
  child.pid = Math.floor(Math.random() * 10000) + 1000;

  // Schedule exit event
  const scheduleExit = () => {
    if (exitCode === 0) {
      child.stdout.emit('data', Buffer.from('Worker completed successfully\n'));
      child.stdout.emit('data', Buffer.from('All tests passed\n'));
    } else {
      child.stderr.emit('data', Buffer.from('Worker error: tests failed\n'));
    }
    child.emit('close', exitCode);
  };

  if (delay) {
    setTimeout(scheduleExit, delay);
  } else {
    process.nextTick(scheduleExit);
  }

  return child;
}

/**
 * Reads a task from tasks.json by ID.
 */
function readTaskFromFile(tasksJsonPath, taskId) {
  const content = fs.readFileSync(tasksJsonPath, 'utf8');
  const data = JSON.parse(content);
  return data.tasks.find((t) => t.id === taskId);
}

// ── Import modules ───────────────────────────────────────────────────

let scanTasks, loadRegistry;
let scoreTask, scoreTasks;
let buildWorkerPrompt, dispatchWorker;
let updateTaskStatus, getTaskStatus, watchWorkerCompletion;

try {
  const scanner = require('../lib/scanner');
  scanTasks = scanner.scanTasks;
  loadRegistry = scanner.loadRegistry;

  const scorer = require('../lib/scorer');
  scoreTask = scorer.scoreTask;
  scoreTasks = scorer.scoreTasks;

  const dispatcher = require('../lib/dispatcher');
  buildWorkerPrompt = dispatcher.buildWorkerPrompt;
  dispatchWorker = dispatcher.dispatchWorker;

  const statusUpdater = require('../lib/status-updater');
  updateTaskStatus = statusUpdater.updateTaskStatus;
  getTaskStatus = statusUpdater.getTaskStatus;
  watchWorkerCompletion = statusUpdater.watchWorkerCompletion;
} catch (err) {
  console.log('\nFATAL: Could not load required modules');
  console.log(`  ${err.message}\n`);
  process.exit(1);
}

// ═════════════════════════════════════════════════════════════════════
// 1. SCAN PHASE
// ═════════════════════════════════════════════════════════════════════

console.log('\n  Integration: Scan Phase\n');

test('1. scanTasks loads tasks from all projects in registry', () => {
  const env = createTestEnvironment();
  try {
    const tasks = scanTasks({ registryPath: env.projectsJsonPath }).tasks;
    assert(Array.isArray(tasks), 'Expected array of tasks');
    assert(tasks.length === 3, `Expected 3 tasks total, got ${tasks.length}`);

    // Verify tasks are augmented with project metadata
    const taskA = tasks.find(
      (t) => t.id === 'test-project-a/task-high-priority'
    );
    assert(taskA != null, 'Should find task-high-priority');
    assert(taskA._project != null, 'Task should have _project metadata');
    assert(
      taskA._project.name === 'test-project-a',
      'Task should have correct project name'
    );
    assert(
      taskA._projectName === 'test-project-a',
      'Task should have _projectName'
    );
  } finally {
    env.cleanup();
  }
});

test('2. scanTasks handles projects with missing tasks.json gracefully', () => {
  const env = createTestEnvironment({
    projects: [
      { name: 'has-tasks', path: 'has-tasks', status: 'buildable' },
      { name: 'no-tasks', path: 'no-tasks', status: 'scaffolding' },
    ],
    tasksPerProject: {
      'has-tasks': [
        {
          id: 'has-tasks/task1',
          title: 'Task 1',
          status: 'pending',
          complexity: 'S',
          blocked_by: [],
          unlocks: [],
          labels: [],
          feature: {},
        },
      ],
      // 'no-tasks' has no entry, so its tasks.json won't be created
    },
  });

  // Remove the tasks.json for 'no-tasks' project to simulate missing file
  const noTasksPath = path.join(
    env.tmpdir,
    'no-tasks',
    '.claude',
    'tasks',
    'tasks.json'
  );
  if (fs.existsSync(noTasksPath)) {
    fs.rmSync(noTasksPath);
  }

  try {
    const tasks = scanTasks({ registryPath: env.projectsJsonPath }).tasks;
    assert(
      tasks.length === 1,
      `Expected 1 task from existing project, got ${tasks.length}`
    );
    assert(
      tasks[0].id === 'has-tasks/task1',
      'Should find task from project with tasks.json'
    );
  } finally {
    env.cleanup();
  }
});

// ═════════════════════════════════════════════════════════════════════
// 2. SCORE PHASE
// ═════════════════════════════════════════════════════════════════════

console.log('\n  Integration: Score Phase\n');

test('3. scoreTasks ranks tasks by priority score', () => {
  const env = createTestEnvironment();
  try {
    const tasks = scanTasks({ registryPath: env.projectsJsonPath }).tasks;
    const scored = scoreTasks(tasks);

    assert(scored.length > 0, 'Should have scored tasks');
    assert(
      scored[0]._score >= scored[scored.length - 1]._score,
      'Tasks should be sorted descending by score'
    );

    // The high priority task from buildable project should rank highest
    assert(
      scored[0].id === 'test-project-a/task-high-priority',
      `Expected highest priority task first, got ${scored[0].id}`
    );
  } finally {
    env.cleanup();
  }
});

test('4. scoreTasks filters out completed tasks', () => {
  const env = createTestEnvironment({
    tasksPerProject: {
      'test-project-a': [
        {
          id: 'test-project-a/completed-task',
          title: 'Completed task',
          status: 'completed',
          complexity: 'S',
          blocked_by: [],
          unlocks: [],
          labels: [],
          feature: {},
        },
        {
          id: 'test-project-a/pending-task',
          title: 'Pending task',
          status: 'pending',
          complexity: 'S',
          blocked_by: [],
          unlocks: [],
          labels: [],
          feature: {},
        },
      ],
      'test-project-b': [],
    },
  });
  try {
    const tasks = scanTasks({ registryPath: env.projectsJsonPath }).tasks;
    const scored = scoreTasks(tasks);

    assert(
      scored.length === 1,
      `Expected 1 pending task, got ${scored.length}`
    );
    assert(
      scored[0].id === 'test-project-a/pending-task',
      'Should only include pending task'
    );
  } finally {
    env.cleanup();
  }
});

test('5. scoreTasks considers dependency status in scoring', () => {
  const env = createTestEnvironment();
  try {
    const tasks = scanTasks({ registryPath: env.projectsJsonPath }).tasks;
    const scored = scoreTasks(tasks);

    // Find the dependent task (blocked by another task)
    const dependentTask = scored.find(
      (t) => t.id === 'test-project-a/task-depends'
    );
    assert(dependentTask != null, 'Should find dependent task');

    // The blocked task should have lower score due to dependency factor
    const unblockedTask = scored.find(
      (t) => t.id === 'test-project-a/task-high-priority'
    );
    assert(
      unblockedTask._score > dependentTask._score,
      'Unblocked task should score higher than blocked task'
    );
  } finally {
    env.cleanup();
  }
});

// ═════════════════════════════════════════════════════════════════════
// 3. DISPATCH PHASE
// ═════════════════════════════════════════════════════════════════════

console.log('\n  Integration: Dispatch Phase\n');

test('6. dispatchWorker builds prompt and updates status to in_progress', () => {
  const env = createTestEnvironment();
  try {
    const tasks = scanTasks({ registryPath: env.projectsJsonPath }).tasks;
    const scored = scoreTasks(tasks);
    const topTask = scored[0];
    const project = topTask._project;

    // Dispatch the top task
    const result = dispatchWorker(topTask, project, {
      projectsRoot: env.tmpdir,
      dryRun: true,
      silent: true,
    });

    assert(result != null, 'Should return dispatch result');
    assert(typeof result.prompt === 'string', 'Should have prompt string');
    assert(result.prompt.length > 0, 'Prompt should not be empty');
    assert(
      result.prompt.includes(project.name),
      'Prompt should include project name'
    );
    assert(
      result.prompt.includes(topTask.title),
      'Prompt should include task title'
    );
    assert(
      typeof result.workingDirectory === 'string',
      'Should have working directory'
    );
    assert(
      result.maxTurns === 25,
      `Expected maxTurns 25, got ${result.maxTurns}`
    );

    // Verify status was updated to in_progress
    const tasksJsonPath = env.getTasksJsonPath('test-project-a');
    const updatedTask = readTaskFromFile(tasksJsonPath, topTask.id);
    assert(
      updatedTask.status === 'in_progress',
      `Expected status "in_progress", got "${updatedTask.status}"`
    );
  } finally {
    env.cleanup();
  }
});

test('7. dispatchWorker includes relevant files in prompt', () => {
  const env = createTestEnvironment();
  try {
    const tasks = scanTasks({ registryPath: env.projectsJsonPath }).tasks;
    const topTask = tasks.find(
      (t) => t.id === 'test-project-a/task-high-priority'
    );
    const project = topTask._project;

    const result = dispatchWorker(topTask, project, {
      projectsRoot: env.tmpdir,
      dryRun: true,
      silent: true,
    });

    // The task has relevant_files: ['src/index.js']
    assert(
      result.prompt.includes('src/index.js'),
      'Prompt should include relevant file path'
    );
    assert(
      result.meta.filesIncluded >= 1,
      `Expected at least 1 file included, got ${result.meta.filesIncluded}`
    );
  } finally {
    env.cleanup();
  }
});

test('8. dispatchWorker adds history entry on status change', () => {
  const env = createTestEnvironment();
  try {
    const tasks = scanTasks({ registryPath: env.projectsJsonPath }).tasks;
    const topTask = tasks.find(
      (t) => t.id === 'test-project-a/task-high-priority'
    );
    const project = topTask._project;

    dispatchWorker(topTask, project, {
      projectsRoot: env.tmpdir,
      dryRun: true,
      silent: true,
    });

    const tasksJsonPath = env.getTasksJsonPath('test-project-a');
    const updatedTask = readTaskFromFile(tasksJsonPath, topTask.id);

    assert(
      Array.isArray(updatedTask.history),
      'Task should have history array'
    );
    const historyEntry = updatedTask.history.find(
      (h) => h.to_status === 'in_progress'
    );
    assert(historyEntry != null, 'Should have in_progress history entry');
    assert(
      historyEntry.from_status === 'pending',
      `Expected from_status "pending", got "${historyEntry.from_status}"`
    );
    assert(
      typeof historyEntry.timestamp === 'string',
      'History entry should have timestamp'
    );
  } finally {
    env.cleanup();
  }
});

// ═════════════════════════════════════════════════════════════════════
// 4. WORKER COMPLETION - SUCCESS
// ═════════════════════════════════════════════════════════════════════

console.log('\n  Integration: Worker Completion - Success\n');

const asyncTests = [];

function queueAsync(name, fn) {
  asyncTests.push({ name, fn });
}

queueAsync(
  '9. watchWorkerCompletion updates status to completed on exit 0',
  async () => {
    const env = createTestEnvironment();
    try {
      const tasks = scanTasks({ registryPath: env.projectsJsonPath }).tasks;
      const topTask = tasks.find(
        (t) => t.id === 'test-project-a/task-high-priority'
      );
      const project = topTask._project;

      // Dispatch the task to set it to in_progress
      dispatchWorker(topTask, project, {
        projectsRoot: env.tmpdir,
        dryRun: true,
        silent: true,
      });

      // Simulate worker completion with success
      const mockChild = createMockWorkerProcess(0);
      const result = await watchWorkerCompletion(topTask.id, mockChild, {
        projectsRoot: env.tmpdir,
      });

      assert(
        result.exitCode === 0,
        `Expected exitCode 0, got ${result.exitCode}`
      );

      // Verify status was updated to completed
      const tasksJsonPath = env.getTasksJsonPath('test-project-a');
      const updatedTask = readTaskFromFile(tasksJsonPath, topTask.id);
      assert(
        updatedTask.status === 'completed',
        `Expected status "completed", got "${updatedTask.status}"`
      );
    } finally {
      env.cleanup();
    }
  }
);

queueAsync('10. successful completion adds history entry', async () => {
  const env = createTestEnvironment();
  try {
    const tasks = scanTasks({ registryPath: env.projectsJsonPath }).tasks;
    const topTask = tasks.find(
      (t) => t.id === 'test-project-a/task-high-priority'
    );
    const project = topTask._project;

    dispatchWorker(topTask, project, {
      projectsRoot: env.tmpdir,
      dryRun: true,
      silent: true,
    });

    const mockChild = createMockWorkerProcess(0);
    await watchWorkerCompletion(topTask.id, mockChild, {
      projectsRoot: env.tmpdir,
    });

    const tasksJsonPath = env.getTasksJsonPath('test-project-a');
    const updatedTask = readTaskFromFile(tasksJsonPath, topTask.id);

    const completedEntry = updatedTask.history.find(
      (h) => h.to_status === 'completed'
    );
    assert(completedEntry != null, 'Should have completed history entry');
    assert(
      completedEntry.from_status === 'in_progress',
      `Expected from_status "in_progress", got "${completedEntry.from_status}"`
    );
  } finally {
    env.cleanup();
  }
});

queueAsync(
  '11. completion result includes stdout and completedAt',
  async () => {
    const env = createTestEnvironment();
    try {
      const tasks = scanTasks({ registryPath: env.projectsJsonPath }).tasks;
      const topTask = tasks.find(
        (t) => t.id === 'test-project-a/task-high-priority'
      );
      const project = topTask._project;

      dispatchWorker(topTask, project, {
        projectsRoot: env.tmpdir,
        dryRun: true,
        silent: true,
      });

      const mockChild = createMockWorkerProcess(0);
      const result = await watchWorkerCompletion(topTask.id, mockChild, {
        projectsRoot: env.tmpdir,
      });

      assert(typeof result.stdout === 'string', 'Result should have stdout');
      assert(
        result.stdout.includes('completed successfully'),
        'stdout should contain success message'
      );
      assert(
        typeof result.completedAt === 'string',
        'Result should have completedAt'
      );
      assert(
        !isNaN(Date.parse(result.completedAt)),
        'completedAt should be valid ISO date'
      );
    } finally {
      env.cleanup();
    }
  }
);

// ═════════════════════════════════════════════════════════════════════
// 5. WORKER COMPLETION - FAILURE
// ═════════════════════════════════════════════════════════════════════

console.log('\n  Integration: Worker Completion - Failure\n');

queueAsync(
  '12. watchWorkerCompletion updates status to failed on non-zero exit',
  async () => {
    const env = createTestEnvironment();
    try {
      const tasks = scanTasks({ registryPath: env.projectsJsonPath }).tasks;
      const topTask = tasks.find(
        (t) => t.id === 'test-project-a/task-high-priority'
      );
      const project = topTask._project;

      dispatchWorker(topTask, project, {
        projectsRoot: env.tmpdir,
        dryRun: true,
        silent: true,
      });

      const mockChild = createMockWorkerProcess(1);
      const result = await watchWorkerCompletion(topTask.id, mockChild, {
        projectsRoot: env.tmpdir,
      });

      assert(
        result.exitCode === 1,
        `Expected exitCode 1, got ${result.exitCode}`
      );

      const tasksJsonPath = env.getTasksJsonPath('test-project-a');
      const updatedTask = readTaskFromFile(tasksJsonPath, topTask.id);
      assert(
        updatedTask.status === 'failed',
        `Expected status "failed", got "${updatedTask.status}"`
      );
    } finally {
      env.cleanup();
    }
  }
);

queueAsync(
  '13. failed completion adds history entry with error details',
  async () => {
    const env = createTestEnvironment();
    try {
      const tasks = scanTasks({ registryPath: env.projectsJsonPath }).tasks;
      const topTask = tasks.find(
        (t) => t.id === 'test-project-a/task-high-priority'
      );
      const project = topTask._project;

      dispatchWorker(topTask, project, {
        projectsRoot: env.tmpdir,
        dryRun: true,
        silent: true,
      });

      const mockChild = createMockWorkerProcess(1);
      await watchWorkerCompletion(topTask.id, mockChild, {
        projectsRoot: env.tmpdir,
      });

      const tasksJsonPath = env.getTasksJsonPath('test-project-a');
      const updatedTask = readTaskFromFile(tasksJsonPath, topTask.id);

      const failedEntry = updatedTask.history.find(
        (h) => h.to_status === 'failed'
      );
      assert(failedEntry != null, 'Should have failed history entry');
      assert(
        typeof failedEntry.agent_summary === 'string',
        'Failed entry should have agent_summary with error details'
      );
      assert(
        failedEntry.agent_summary.includes('exit'),
        'Error summary should mention exit code'
      );
    } finally {
      env.cleanup();
    }
  }
);

queueAsync('14. failure result includes stderr', async () => {
  const env = createTestEnvironment();
  try {
    const tasks = scanTasks({ registryPath: env.projectsJsonPath }).tasks;
    const topTask = tasks.find(
      (t) => t.id === 'test-project-a/task-high-priority'
    );
    const project = topTask._project;

    dispatchWorker(topTask, project, {
      projectsRoot: env.tmpdir,
      dryRun: true,
      silent: true,
    });

    const mockChild = createMockWorkerProcess(1);
    const result = await watchWorkerCompletion(topTask.id, mockChild, {
      projectsRoot: env.tmpdir,
    });

    assert(typeof result.stderr === 'string', 'Result should have stderr');
    assert(
      result.stderr.includes('error'),
      'stderr should contain error message'
    );
  } finally {
    env.cleanup();
  }
});

// ═════════════════════════════════════════════════════════════════════
// 6. FULL CYCLE TESTS
// ═════════════════════════════════════════════════════════════════════

console.log('\n  Integration: Full Orchestration Cycle\n');

queueAsync(
  '15. full cycle: scan -> score -> dispatch -> complete',
  async () => {
    const env = createTestEnvironment();
    try {
      // Phase 1: Scan
      const tasks = scanTasks({ registryPath: env.projectsJsonPath }).tasks;
      assert(
        tasks.length === 3,
        `Expected 3 tasks from scan, got ${tasks.length}`
      );

      // Phase 2: Score
      const scored = scoreTasks(tasks);
      assert(scored.length > 0, 'Should have scored tasks');
      const topTask = scored[0];
      assert(topTask._score != null, 'Top task should have _score');

      // Phase 3: Dispatch
      const project = topTask._project;
      const dispatchResult = dispatchWorker(topTask, project, {
        projectsRoot: env.tmpdir,
        dryRun: true,
        silent: true,
      });
      assert(
        dispatchResult.prompt.length > 100,
        'Dispatch should generate substantial prompt'
      );

      // Verify intermediate state
      const tasksJsonPath = env.getTasksJsonPath(project.name);
      let currentTask = readTaskFromFile(tasksJsonPath, topTask.id);
      assert(
        currentTask.status === 'in_progress',
        'Task should be in_progress after dispatch'
      );

      // Phase 4: Complete (success)
      const mockChild = createMockWorkerProcess(0);
      const completionResult = await watchWorkerCompletion(
        topTask.id,
        mockChild,
        {
          projectsRoot: env.tmpdir,
        }
      );

      assert(
        completionResult.exitCode === 0,
        'Worker should exit successfully'
      );

      // Verify final state
      currentTask = readTaskFromFile(tasksJsonPath, topTask.id);
      assert(
        currentTask.status === 'completed',
        `Task should be completed, got "${currentTask.status}"`
      );

      // Verify history has both transitions
      assert(
        currentTask.history.length >= 2,
        `Expected at least 2 history entries, got ${currentTask.history.length}`
      );
      const inProgressEntry = currentTask.history.find(
        (h) => h.to_status === 'in_progress'
      );
      const completedEntry = currentTask.history.find(
        (h) => h.to_status === 'completed'
      );
      assert(inProgressEntry != null, 'Should have in_progress transition');
      assert(completedEntry != null, 'Should have completed transition');
    } finally {
      env.cleanup();
    }
  }
);

queueAsync('16. full cycle: scan -> score -> dispatch -> fail', async () => {
  const env = createTestEnvironment();
  try {
    // Scan and score
    const tasks = scanTasks({ registryPath: env.projectsJsonPath }).tasks;
    const scored = scoreTasks(tasks);
    const topTask = scored[0];
    const project = topTask._project;

    // Dispatch
    dispatchWorker(topTask, project, {
      projectsRoot: env.tmpdir,
      dryRun: true,
      silent: true,
    });

    // Fail
    const mockChild = createMockWorkerProcess(1);
    const completionResult = await watchWorkerCompletion(
      topTask.id,
      mockChild,
      {
        projectsRoot: env.tmpdir,
      }
    );

    assert(completionResult.exitCode === 1, 'Worker should exit with error');

    // Verify final state
    const tasksJsonPath = env.getTasksJsonPath(project.name);
    const currentTask = readTaskFromFile(tasksJsonPath, topTask.id);
    assert(
      currentTask.status === 'failed',
      `Task should be failed, got "${currentTask.status}"`
    );
  } finally {
    env.cleanup();
  }
});

queueAsync('17. multiple workers can run in sequence', async () => {
  const env = createTestEnvironment({
    tasksPerProject: {
      'test-project-a': [
        {
          id: 'test-project-a/task-1',
          title: 'Task 1',
          status: 'pending',
          complexity: 'S',
          blocked_by: [],
          unlocks: [],
          labels: [],
          feature: {},
        },
        {
          id: 'test-project-a/task-2',
          title: 'Task 2',
          status: 'pending',
          complexity: 'S',
          blocked_by: [],
          unlocks: [],
          labels: [],
          feature: {},
        },
      ],
      'test-project-b': [],
    },
  });
  try {
    // First worker
    let tasks = scanTasks({ registryPath: env.projectsJsonPath }).tasks;
    let scored = scoreTasks(tasks);
    const task1 = scored[0];

    dispatchWorker(task1, task1._project, {
      projectsRoot: env.tmpdir,
      dryRun: true,
      silent: true,
    });

    const mock1 = createMockWorkerProcess(0);
    await watchWorkerCompletion(task1.id, mock1, {
      projectsRoot: env.tmpdir,
    });

    // Second worker (re-scan and re-score)
    tasks = scanTasks({ registryPath: env.projectsJsonPath }).tasks;
    scored = scoreTasks(tasks);

    // Should now only have 1 pending task (task1 is completed)
    assert(
      scored.length === 1,
      `Expected 1 pending task after first completion, got ${scored.length}`
    );

    const task2 = scored[0];
    assert(task2.id !== task1.id, 'Should dispatch different task');

    dispatchWorker(task2, task2._project, {
      projectsRoot: env.tmpdir,
      dryRun: true,
      silent: true,
    });

    const mock2 = createMockWorkerProcess(0);
    await watchWorkerCompletion(task2.id, mock2, {
      projectsRoot: env.tmpdir,
    });

    // Both tasks should now be completed
    tasks = scanTasks({ registryPath: env.projectsJsonPath }).tasks;
    scored = scoreTasks(tasks);
    assert(
      scored.length === 0,
      `Expected 0 pending tasks after both completions, got ${scored.length}`
    );
  } finally {
    env.cleanup();
  }
});

// ═════════════════════════════════════════════════════════════════════
// 7. EDGE CASES
// ═════════════════════════════════════════════════════════════════════

console.log('\n  Integration: Edge Cases\n');

test('18. handles empty task list gracefully', () => {
  const env = createTestEnvironment({
    tasksPerProject: {
      'test-project-a': [],
      'test-project-b': [],
    },
  });
  try {
    const tasks = scanTasks({ registryPath: env.projectsJsonPath }).tasks;
    assert(tasks.length === 0, `Expected 0 tasks, got ${tasks.length}`);

    const scored = scoreTasks(tasks);
    assert(
      scored.length === 0,
      `Expected 0 scored tasks, got ${scored.length}`
    );
  } finally {
    env.cleanup();
  }
});

test('19. handles all tasks already completed', () => {
  const env = createTestEnvironment({
    tasksPerProject: {
      'test-project-a': [
        {
          id: 'test-project-a/done-task',
          title: 'Done task',
          status: 'completed',
          complexity: 'S',
          blocked_by: [],
          unlocks: [],
          labels: [],
          feature: {},
        },
      ],
      'test-project-b': [],
    },
  });
  try {
    const tasks = scanTasks({ registryPath: env.projectsJsonPath }).tasks;
    assert(tasks.length === 1, 'Should find 1 task (completed)');

    const scored = scoreTasks(tasks);
    assert(scored.length === 0, 'Should filter out completed task');
  } finally {
    env.cleanup();
  }
});

queueAsync('20. handles delayed worker completion', async () => {
  const env = createTestEnvironment();
  try {
    const tasks = scanTasks({ registryPath: env.projectsJsonPath }).tasks;
    const scored = scoreTasks(tasks);
    const topTask = scored[0];

    dispatchWorker(topTask, topTask._project, {
      projectsRoot: env.tmpdir,
      dryRun: true,
      silent: true,
    });

    // Use a 50ms delay to simulate async work
    const mockChild = createMockWorkerProcess(0, 50);
    const result = await watchWorkerCompletion(topTask.id, mockChild, {
      projectsRoot: env.tmpdir,
    });

    assert(
      result.exitCode === 0,
      'Delayed worker should complete successfully'
    );

    const tasksJsonPath = env.getTasksJsonPath(topTask._project.name);
    const currentTask = readTaskFromFile(tasksJsonPath, topTask.id);
    assert(
      currentTask.status === 'completed',
      'Task should be completed after delayed worker finishes'
    );
  } finally {
    env.cleanup();
  }
});

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
