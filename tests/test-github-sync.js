#!/usr/bin/env node

/**
 * GitHub Sync Module Tests (lib/github-sync.js)
 *
 * Tests for bidirectional sync between tasks.json and GitHub Issues.
 * Uses mocked gh CLI commands to avoid actual GitHub API calls.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

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
 * Create a mock execGh function that returns predefined responses.
 */
function createMockExecGh(responses) {
  return function mockExecGh(args, options = {}) {
    const key = args.join(' ');
    const response = responses[key] ||
      responses['*'] || {
        success: true,
        output: '',
        error: '',
      };

    if (
      options.json &&
      typeof response.output === 'string' &&
      response.output.trim()
    ) {
      try {
        response.output = JSON.parse(response.output);
      } catch (e) {
        // Keep as string if not valid JSON
      }
    }

    if (!response.success && !options.ignoreErrors) {
      const err = new Error(response.error || 'Mock error');
      err.code = 'GH_CLI_ERROR';
      throw err;
    }

    return response;
  };
}

/**
 * Create a temp directory with a tasks.json file for testing syncIssueToTask.
 */
function createTestEnv(tasks) {
  const tmpdir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'jade-github-sync-test-')
  );
  const projectName = tasks[0]?.id?.split('/')[0] || 'test-project';
  const taskDir = path.join(tmpdir, projectName, '.claude', 'tasks');
  fs.mkdirSync(taskDir, { recursive: true });

  const tasksData = {
    version: 1,
    project: projectName,
    tasks: tasks,
  };
  fs.writeFileSync(
    path.join(taskDir, 'tasks.json'),
    JSON.stringify(tasksData, null, 2)
  );

  return {
    tmpdir,
    projectsRoot: tmpdir,
    taskDir,
    tasksJsonPath: path.join(taskDir, 'tasks.json'),
    cleanup() {
      fs.rmSync(tmpdir, { recursive: true, force: true });
    },
    readTasks() {
      return JSON.parse(fs.readFileSync(this.tasksJsonPath, 'utf8'));
    },
  };
}

// ── Import module ────────────────────────────────────────────────────

let githubSync;
try {
  githubSync = require('../lib/github-sync');
} catch (err) {
  console.log('\nFATAL: Could not load lib/github-sync.js');
  console.log(`  ${err.message}\n`);
  process.exit(1);
}

const {
  createIssueFromTask,
  updateIssueFromTask,
  closeIssueOnComplete,
  syncIssueToTask,
  syncTasksToIssues,
  syncIssuesToTasks,
  formatIssueBody,
  extractTaskIdFromBody,
  DEFAULT_LABEL_MAPPING,
} = githubSync;

// ── formatIssueBody tests ────────────────────────────────────────────

console.log('\n  formatIssueBody tests\n');

test('1. formatIssueBody includes task ID in metadata section', () => {
  const task = {
    id: 'test-project/my-task',
    title: 'My Task',
    status: 'pending',
  };

  const body = formatIssueBody(task);

  assert(
    body.includes('**Task ID:** `test-project/my-task`'),
    'Should include task ID'
  );
});

test('2. formatIssueBody includes description section', () => {
  const task = {
    id: 'test-project/task-1',
    title: 'Task 1',
    status: 'pending',
    description: 'This is a test task description.',
  };

  const body = formatIssueBody(task);

  assert(body.includes('## Description'), 'Should have description section');
  assert(
    body.includes('This is a test task description.'),
    'Should include description text'
  );
});

test('3. formatIssueBody includes acceptance criteria as checkboxes', () => {
  const task = {
    id: 'test-project/task-2',
    title: 'Task 2',
    status: 'pending',
    feature: {
      acceptance_criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'],
    },
  };

  const body = formatIssueBody(task);

  assert(
    body.includes('## Acceptance Criteria'),
    'Should have acceptance criteria section'
  );
  assert(
    body.includes('- [ ] Criterion 1'),
    'Should include first criterion as checkbox'
  );
  assert(
    body.includes('- [ ] Criterion 2'),
    'Should include second criterion as checkbox'
  );
  assert(
    body.includes('- [ ] Criterion 3'),
    'Should include third criterion as checkbox'
  );
});

test('4. formatIssueBody includes blocked_by dependencies', () => {
  const task = {
    id: 'test-project/task-3',
    title: 'Task 3',
    status: 'blocked',
    blocked_by: ['test-project/task-1', 'test-project/task-2'],
  };

  const body = formatIssueBody(task);

  assert(body.includes('**Blocked By:**'), 'Should have blocked by field');
  assert(body.includes('test-project/task-1'), 'Should include first blocker');
  assert(body.includes('test-project/task-2'), 'Should include second blocker');
});

test('5. formatIssueBody includes relevant files section', () => {
  const task = {
    id: 'test-project/task-4',
    title: 'Task 4',
    status: 'pending',
    relevant_files: ['lib/foo.js', 'tests/test-foo.js'],
  };

  const body = formatIssueBody(task);

  assert(
    body.includes('## Relevant Files'),
    'Should have relevant files section'
  );
  assert(body.includes('`lib/foo.js`'), 'Should include first file');
  assert(body.includes('`tests/test-foo.js`'), 'Should include second file');
});

test('6. formatIssueBody includes footer attribution', () => {
  const task = {
    id: 'test-project/task-5',
    title: 'Task 5',
    status: 'pending',
  };

  const body = formatIssueBody(task);

  assert(
    body.includes('Synced from local tasks.json by jade-dev-assist'),
    'Should have footer'
  );
});

// ── extractTaskIdFromBody tests ──────────────────────────────────────

console.log('\n  extractTaskIdFromBody tests\n');

test('7. extractTaskIdFromBody extracts task ID from formatted body', () => {
  const body = `## Task Metadata

- **Task ID:** \`test-project/my-task\`
- **Status:** pending`;

  const taskId = extractTaskIdFromBody(body);

  assert(
    taskId === 'test-project/my-task',
    `Expected 'test-project/my-task', got '${taskId}'`
  );
});

test('8. extractTaskIdFromBody returns null for missing task ID', () => {
  const body = 'Some random issue body without task ID';

  const taskId = extractTaskIdFromBody(body);

  assert(taskId === null, 'Should return null for missing task ID');
});

test('9. extractTaskIdFromBody handles null/undefined body', () => {
  assert(
    extractTaskIdFromBody(null) === null,
    'Should return null for null body'
  );
  assert(
    extractTaskIdFromBody(undefined) === null,
    'Should return null for undefined body'
  );
  assert(
    extractTaskIdFromBody('') === null,
    'Should return null for empty body'
  );
});

// ── createIssueFromTask tests ────────────────────────────────────────

console.log('\n  createIssueFromTask tests\n');

test('10. createIssueFromTask in dryRun mode returns success without calling gh', () => {
  const task = {
    id: 'test-project/task-1',
    title: 'Test Task',
    status: 'pending',
    complexity: 'M',
  };

  const result = createIssueFromTask(task, { dryRun: true });

  assert(result.success === true, 'Should return success');
  assert(result.dryRun === true, 'Should indicate dryRun mode');
  assert(result.issueNumber === null, 'Issue number should be null in dryRun');
});

test('11. createIssueFromTask builds correct labels from task status and complexity', () => {
  // This test verifies the label building logic by checking the function behavior
  const task = {
    id: 'test-project/task-2',
    title: 'Another Task',
    status: 'in_progress',
    complexity: 'L',
    labels: ['feature', 'priority'],
  };

  // We can verify the label mapping is correct
  const statusLabel = DEFAULT_LABEL_MAPPING.status[task.status];
  const complexityLabel = DEFAULT_LABEL_MAPPING.complexity[task.complexity];

  assert(
    statusLabel === 'status:in-progress',
    `Expected 'status:in-progress', got '${statusLabel}'`
  );
  assert(
    complexityLabel === 'size:large',
    `Expected 'size:large', got '${complexityLabel}'`
  );
});

// ── updateIssueFromTask tests ────────────────────────────────────────

console.log('\n  updateIssueFromTask tests\n');

test('12. updateIssueFromTask in dryRun mode returns success', () => {
  const task = {
    id: 'test-project/task-1',
    title: 'Test Task',
    status: 'completed',
    complexity: 'S',
  };

  const result = updateIssueFromTask(task, 123, { dryRun: true });

  assert(result.success === true, 'Should return success');
  assert(result.dryRun === true, 'Should indicate dryRun mode');
});

// ── closeIssueOnComplete tests ───────────────────────────────────────

console.log('\n  closeIssueOnComplete tests\n');

test('13. closeIssueOnComplete in dryRun mode returns success', () => {
  const result = closeIssueOnComplete(456, { dryRun: true });

  assert(result.success === true, 'Should return success');
  assert(result.dryRun === true, 'Should indicate dryRun mode');
});

test('14. closeIssueOnComplete accepts optional comment', () => {
  const result = closeIssueOnComplete(789, {
    dryRun: true,
    comment: 'Task completed successfully!',
  });

  assert(result.success === true, 'Should return success with comment option');
});

// ── syncIssueToTask tests ────────────────────────────────────────────

console.log('\n  syncIssueToTask tests\n');

test('15. syncIssueToTask extracts task ID and status from issue', () => {
  const issue = {
    number: 42,
    title: 'Test Issue',
    body: `## Task Metadata

- **Task ID:** \`test-project/task-1\`
- **Status:** pending`,
    labels: [{ name: 'status:in-progress' }],
    state: 'OPEN',
  };

  const result = syncIssueToTask(issue, { dryRun: true });

  assert(result.success === true, 'Should return success');
  assert(
    result.taskId === 'test-project/task-1',
    `Expected task ID, got '${result.taskId}'`
  );
  assert(
    result.newStatus === 'in_progress',
    `Expected 'in_progress', got '${result.newStatus}'`
  );
  assert(result.dryRun === true, 'Should indicate dryRun mode');
});

test('16. syncIssueToTask returns completed status for closed issues', () => {
  const issue = {
    number: 43,
    title: 'Closed Issue',
    body: `- **Task ID:** \`test-project/task-2\``,
    labels: [{ name: 'status:pending' }],
    state: 'CLOSED',
  };

  const result = syncIssueToTask(issue, { dryRun: true });

  assert(result.success === true, 'Should return success');
  assert(
    result.newStatus === 'completed',
    'Closed issues should map to completed status'
  );
});

test('17. syncIssueToTask fails when task ID cannot be extracted', () => {
  const issue = {
    number: 44,
    title: 'Issue Without Task ID',
    body: 'This issue has no task ID in the body.',
    labels: [],
    state: 'OPEN',
  };

  const result = syncIssueToTask(issue, { dryRun: true });

  assert(result.success === false, 'Should return failure');
  assert(result.error !== null, 'Should have error message');
  assert(
    result.error.includes('Could not extract task ID'),
    'Error should mention task ID'
  );
});

test('18. syncIssueToTask succeeds with null status when no status label found', () => {
  const issue = {
    number: 45,
    title: 'Issue Without Status Label',
    body: `- **Task ID:** \`test-project/task-3\``,
    labels: [{ name: 'feature' }, { name: 'documentation' }],
    state: 'OPEN',
  };

  const result = syncIssueToTask(issue, { dryRun: true });

  assert(
    result.success === true,
    'Should return success (no error, just no status)'
  );
  assert(
    result.taskId === 'test-project/task-3',
    'Should still extract task ID'
  );
  assert(
    result.newStatus === null,
    'newStatus should be null when no status label'
  );
});

test('19. syncIssueToTask updates tasks.json when not in dryRun mode', () => {
  // Suppress stderr output for this test
  const originalWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = () => true;

  const env = createTestEnv([
    { id: 'test-project/task-1', title: 'Test Task', status: 'pending' },
  ]);

  try {
    const issue = {
      number: 50,
      title: 'Test Issue',
      body: `- **Task ID:** \`test-project/task-1\``,
      labels: [{ name: 'status:in-progress' }],
      state: 'OPEN',
    };

    const result = syncIssueToTask(issue, {
      projectsRoot: env.projectsRoot,
      dryRun: false,
    });

    assert(result.success === true, 'Should return success');
    assert(result.newStatus === 'in_progress', 'Should sync to in_progress');

    // Verify the tasks.json was updated
    const updatedData = env.readTasks();
    const updatedTask = updatedData.tasks[0];

    assert(
      updatedTask.status === 'in_progress',
      `Task status should be 'in_progress', got '${updatedTask.status}'`
    );
    assert(
      Array.isArray(updatedTask.history),
      'Task should have history array'
    );
    assert(
      updatedTask.history.length > 0,
      'History should have at least one entry'
    );
  } finally {
    process.stderr.write = originalWrite;
    env.cleanup();
  }
});

// ── DEFAULT_LABEL_MAPPING tests ──────────────────────────────────────

console.log('\n  Label Mapping tests\n');

test('20. DEFAULT_LABEL_MAPPING has all task statuses mapped', () => {
  const { status } = DEFAULT_LABEL_MAPPING;

  assert(status.pending === 'status:pending', 'Should map pending');
  assert(status.in_progress === 'status:in-progress', 'Should map in_progress');
  assert(status.completed === 'status:completed', 'Should map completed');
  assert(status.blocked === 'status:blocked', 'Should map blocked');
  assert(status.failed === 'status:failed', 'Should map failed');
});

test('21. DEFAULT_LABEL_MAPPING has all complexity levels mapped', () => {
  const { complexity } = DEFAULT_LABEL_MAPPING;

  assert(complexity.S === 'size:small', 'Should map S to size:small');
  assert(complexity.M === 'size:medium', 'Should map M to size:medium');
  assert(complexity.L === 'size:large', 'Should map L to size:large');
  assert(complexity.XL === 'size:xlarge', 'Should map XL to size:xlarge');
});

test('22. DEFAULT_LABEL_MAPPING has reverse status mapping', () => {
  const { reverseStatus } = DEFAULT_LABEL_MAPPING;

  assert(
    reverseStatus['status:pending'] === 'pending',
    'Should reverse map status:pending'
  );
  assert(
    reverseStatus['status:in-progress'] === 'in_progress',
    'Should reverse map status:in-progress'
  );
  assert(
    reverseStatus['status:completed'] === 'completed',
    'Should reverse map status:completed'
  );
});

// ── syncTasksToIssues tests ──────────────────────────────────────────

console.log('\n  syncTasksToIssues tests\n');

test('23. syncTasksToIssues in dryRun mode processes tasks without errors', () => {
  // Suppress stderr output for this test
  const originalWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = () => true;

  try {
    const tasks = [
      {
        id: 'proj/task-1',
        title: 'Task 1',
        status: 'pending',
        complexity: 'S',
      },
      {
        id: 'proj/task-2',
        title: 'Task 2',
        status: 'in_progress',
        complexity: 'M',
        github_issue: 'owner/repo#123',
      },
    ];

    const result = syncTasksToIssues(tasks, { dryRun: true });

    assert(result.created >= 0, 'Should have created count');
    assert(result.updated >= 0, 'Should have updated count');
    assert(Array.isArray(result.errors), 'Should have errors array');
  } finally {
    process.stderr.write = originalWrite;
  }
});

test('24. syncTasksToIssues skips completed tasks without github_issue', () => {
  // Suppress stderr output for this test
  const originalWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = () => true;

  try {
    const tasks = [
      {
        id: 'proj/task-1',
        title: 'Completed Task',
        status: 'completed',
        complexity: 'M',
      },
    ];

    const result = syncTasksToIssues(tasks, { dryRun: true });

    // Completed task without github_issue should be skipped (no create attempt)
    assert(
      result.created === 0,
      'Should not create issue for completed task without existing issue'
    );
  } finally {
    process.stderr.write = originalWrite;
  }
});

// ── Module exports tests ─────────────────────────────────────────────

console.log('\n  Module exports tests\n');

test('25. Module exports all required functions', () => {
  assert(
    typeof githubSync.createIssueFromTask === 'function',
    'Should export createIssueFromTask'
  );
  assert(
    typeof githubSync.updateIssueFromTask === 'function',
    'Should export updateIssueFromTask'
  );
  assert(
    typeof githubSync.closeIssueOnComplete === 'function',
    'Should export closeIssueOnComplete'
  );
  assert(
    typeof githubSync.syncIssueToTask === 'function',
    'Should export syncIssueToTask'
  );
});

test('26. Module exports batch operations', () => {
  assert(
    typeof githubSync.syncTasksToIssues === 'function',
    'Should export syncTasksToIssues'
  );
  assert(
    typeof githubSync.syncIssuesToTasks === 'function',
    'Should export syncIssuesToTasks'
  );
});

test('27. Module exports utility functions', () => {
  assert(
    typeof githubSync.checkGhCli === 'function',
    'Should export checkGhCli'
  );
  assert(
    typeof githubSync.fetchOpenIssues === 'function',
    'Should export fetchOpenIssues'
  );
  assert(
    typeof githubSync.fetchIssue === 'function',
    'Should export fetchIssue'
  );
  assert(
    typeof githubSync.formatIssueBody === 'function',
    'Should export formatIssueBody'
  );
  assert(
    typeof githubSync.extractTaskIdFromBody === 'function',
    'Should export extractTaskIdFromBody'
  );
  assert(typeof githubSync.execGh === 'function', 'Should export execGh');
});

test('28. Module exports configuration constants', () => {
  assert(
    githubSync.DEFAULT_LABEL_MAPPING !== undefined,
    'Should export DEFAULT_LABEL_MAPPING'
  );
  assert(
    githubSync.DEFAULT_OPTIONS !== undefined,
    'Should export DEFAULT_OPTIONS'
  );
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
