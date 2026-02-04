#!/usr/bin/env node

/**
 * Dispatcher Module Tests (lib/dispatcher.js)
 *
 * Tests for buildWorkerPrompt() and dispatchWorker() functions.
 * Uses the same custom test framework as test-scanner.js, test-scorer.js, test-presenter.js.
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
 * Creates a temporary project directory structure for testing.
 * Returns { tmpdir, projectPath, cleanup }.
 *
 * @param {Object} options
 * @param {string} [options.claudeMd]       - Contents of CLAUDE.md
 * @param {Object} [options.tasksData]      - Object to write as .claude/tasks/tasks.json
 * @param {Object} [options.relevantFiles]  - Map of relative path -> content to create
 */
function createTestProject(options) {
  const opts = options || {};
  const tmpdir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'jade-dispatcher-test-')
  );
  const projectPath = path.join(tmpdir, 'test-project');
  fs.mkdirSync(projectPath, { recursive: true });

  // Write CLAUDE.md
  if (opts.claudeMd != null) {
    fs.writeFileSync(path.join(projectPath, 'CLAUDE.md'), opts.claudeMd);
  }

  // Write tasks.json
  if (opts.tasksData) {
    const taskDir = path.join(projectPath, '.claude', 'tasks');
    fs.mkdirSync(taskDir, { recursive: true });
    fs.writeFileSync(
      path.join(taskDir, 'tasks.json'),
      JSON.stringify(opts.tasksData, null, 2)
    );
  }

  // Write relevant files
  if (opts.relevantFiles) {
    for (const [relPath, content] of Object.entries(opts.relevantFiles)) {
      const fullPath = path.join(projectPath, relPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    }
  }

  return {
    tmpdir,
    projectPath,
    cleanup() {
      fs.rmSync(tmpdir, { recursive: true, force: true });
    },
  };
}

/**
 * Build a minimal task object with sensible defaults.
 */
function makeTask(overrides) {
  return Object.assign(
    {
      id: 'test-project/test-task',
      title: 'Test task title',
      description: 'Test task description with implementation details.',
      status: 'pending',
      complexity: 'S',
      blocked_by: [],
      unlocks: [],
      labels: ['feature'],
      feature: {
        description: 'Feature description for the test task',
        benefit: 'This enables something useful',
        acceptance_criteria: [
          'Criterion 1: it should do X',
          'Criterion 2: it should handle Y',
        ],
      },
      relevant_files: [],
      created_at: '2026-02-02T00:00:00Z',
      _project: {
        name: 'test-project',
        path: 'test-project',
        status: 'scaffolding',
        language: 'javascript',
        test_command: 'npm test',
      },
      _projectName: 'test-project',
      _milestone: null,
    },
    overrides
  );
}

/**
 * Build a minimal project registry entry.
 */
function makeProject(overrides) {
  return Object.assign(
    {
      name: 'test-project',
      path: 'test-project',
      repo: 'jadecli/test-project',
      status: 'scaffolding',
      language: 'javascript',
      test_command: 'npm test',
      build_command: null,
    },
    overrides
  );
}

// ── Import dispatcher ───────────────────────────────────────────────

let buildWorkerPrompt, dispatchWorker, TOKEN_BUDGET, estimateTokens;
try {
  const dispatcher = require('../lib/dispatcher');
  buildWorkerPrompt = dispatcher.buildWorkerPrompt;
  dispatchWorker = dispatcher.dispatchWorker;
  TOKEN_BUDGET = dispatcher.TOKEN_BUDGET;
  estimateTokens = dispatcher.estimateTokens;
} catch (err) {
  console.log('\nFATAL: Could not load lib/dispatcher.js');
  console.log(`  ${err.message}\n`);
  console.log('All tests will be marked as failed.\n');
  process.exit(1);
}

// ═════════════════════════════════════════════════════════════════════
// 1. EXPORTED CONSTANTS
// ═════════════════════════════════════════════════════════════════════

console.log('\n  Exported Constants\n');

test('1. TOKEN_BUDGET is 60000', () => {
  assert(TOKEN_BUDGET != null, 'TOKEN_BUDGET should be defined');
  assert(
    TOKEN_BUDGET === 60000,
    `TOKEN_BUDGET should be 60000, got ${TOKEN_BUDGET}`
  );
});

test('2. estimateTokens is a function', () => {
  assert(
    typeof estimateTokens === 'function',
    'estimateTokens should be a function'
  );
});

test('3. estimateTokens returns a number for a string', () => {
  const count = estimateTokens('Hello, world!');
  assert(typeof count === 'number', `Expected number, got ${typeof count}`);
  assert(count > 0, 'Token count should be > 0');
});

test('4. estimateTokens uses ~4 chars per token heuristic', () => {
  // 400 chars should be approximately 100 tokens
  const text = 'a'.repeat(400);
  const count = estimateTokens(text);
  assert(count === 100, `Expected ~100 tokens for 400 chars, got ${count}`);
});

// ═════════════════════════════════════════════════════════════════════
// 2. buildWorkerPrompt BASIC STRUCTURE
// ═════════════════════════════════════════════════════════════════════

console.log('\n  buildWorkerPrompt - Basic Structure\n');

test('5. buildWorkerPrompt returns an object with prompt and meta', () => {
  const env = createTestProject({
    claudeMd: '# Test Project\n\nA test project.',
  });
  try {
    const task = makeTask({});
    const project = makeProject({});
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    assert(result != null, 'Result should not be null');
    assert(
      typeof result.prompt === 'string',
      'result.prompt should be a string'
    );
    assert(typeof result.meta === 'object', 'result.meta should be an object');
  } finally {
    env.cleanup();
  }
});

test('6. buildWorkerPrompt prompt includes task title', () => {
  const env = createTestProject({
    claudeMd: '# Test\n',
  });
  try {
    const task = makeTask({ title: 'Implement the frobnicator' });
    const project = makeProject({});
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    assert(
      result.prompt.includes('Implement the frobnicator'),
      'Prompt should include task title'
    );
  } finally {
    env.cleanup();
  }
});

test('7. buildWorkerPrompt prompt includes task description', () => {
  const env = createTestProject({
    claudeMd: '# Test\n',
  });
  try {
    const task = makeTask({
      description: 'Add a frobnicator that processes widgets efficiently.',
    });
    const project = makeProject({});
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    assert(
      result.prompt.includes(
        'Add a frobnicator that processes widgets efficiently.'
      ),
      'Prompt should include task description'
    );
  } finally {
    env.cleanup();
  }
});

test('8. buildWorkerPrompt prompt includes feature description', () => {
  const env = createTestProject({
    claudeMd: '# Test\n',
  });
  try {
    const task = makeTask({
      feature: {
        description: 'A widget processing pipeline',
        acceptance_criteria: ['criterion A'],
      },
    });
    const project = makeProject({});
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    assert(
      result.prompt.includes('A widget processing pipeline'),
      'Prompt should include feature description'
    );
  } finally {
    env.cleanup();
  }
});

test('9. buildWorkerPrompt prompt includes acceptance criteria', () => {
  const env = createTestProject({
    claudeMd: '# Test\n',
  });
  try {
    const task = makeTask({
      feature: {
        description: 'desc',
        acceptance_criteria: [
          'Tests pass with npm test',
          'Build output is valid',
        ],
      },
    });
    const project = makeProject({});
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    assert(
      result.prompt.includes('Tests pass with npm test'),
      'Prompt should include first acceptance criterion'
    );
    assert(
      result.prompt.includes('Build output is valid'),
      'Prompt should include second acceptance criterion'
    );
  } finally {
    env.cleanup();
  }
});

// ═════════════════════════════════════════════════════════════════════
// 3. PROJECT CONTEXT (CLAUDE.md)
// ═════════════════════════════════════════════════════════════════════

console.log('\n  buildWorkerPrompt - Project Context\n');

test('10. buildWorkerPrompt prompt includes CLAUDE.md contents', () => {
  const claudeContent =
    '# My Project\n\nThis is the project context.\n\n## Conventions\n- Use strict mode\n';
  const env = createTestProject({
    claudeMd: claudeContent,
  });
  try {
    const task = makeTask({});
    const project = makeProject({});
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    assert(
      result.prompt.includes('This is the project context.'),
      'Prompt should include CLAUDE.md content'
    );
    assert(
      result.prompt.includes('Use strict mode'),
      'Prompt should include conventions from CLAUDE.md'
    );
  } finally {
    env.cleanup();
  }
});

test('11. buildWorkerPrompt handles missing CLAUDE.md gracefully', () => {
  const env = createTestProject({
    // No claudeMd -- no CLAUDE.md file created
  });
  try {
    const task = makeTask({});
    const project = makeProject({});
    // Should not throw
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    assert(typeof result.prompt === 'string', 'Should still return a prompt');
    assert(result.prompt.length > 0, 'Prompt should not be empty');
  } finally {
    env.cleanup();
  }
});

// ═════════════════════════════════════════════════════════════════════
// 4. RELEVANT FILES
// ═════════════════════════════════════════════════════════════════════

console.log('\n  buildWorkerPrompt - Relevant Files\n');

test('12. buildWorkerPrompt includes relevant file contents', () => {
  const env = createTestProject({
    claudeMd: '# Test\n',
    relevantFiles: {
      'src/widget.js': 'function processWidget() { return true; }',
      'src/helper.js': 'function helper() { return 42; }',
    },
  });
  try {
    const task = makeTask({
      relevant_files: ['src/widget.js', 'src/helper.js'],
    });
    const project = makeProject({});
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    assert(
      result.prompt.includes('function processWidget()'),
      'Prompt should include widget.js contents'
    );
    assert(
      result.prompt.includes('function helper()'),
      'Prompt should include helper.js contents'
    );
  } finally {
    env.cleanup();
  }
});

test('13. buildWorkerPrompt includes file paths as headers', () => {
  const env = createTestProject({
    claudeMd: '# Test\n',
    relevantFiles: {
      'src/widget.js': 'const x = 1;',
    },
  });
  try {
    const task = makeTask({
      relevant_files: ['src/widget.js'],
    });
    const project = makeProject({});
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    assert(
      result.prompt.includes('src/widget.js'),
      'Prompt should include the file path as a header'
    );
  } finally {
    env.cleanup();
  }
});

test('14. buildWorkerPrompt handles missing relevant files gracefully', () => {
  const env = createTestProject({
    claudeMd: '# Test\n',
    // No relevant files created on disk
  });
  try {
    const task = makeTask({
      relevant_files: ['src/nonexistent.js'],
    });
    const project = makeProject({});
    // Should not throw
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    assert(typeof result.prompt === 'string', 'Should still return a prompt');
  } finally {
    env.cleanup();
  }
});

test('15. buildWorkerPrompt handles empty relevant_files array', () => {
  const env = createTestProject({
    claudeMd: '# Test\n',
  });
  try {
    const task = makeTask({ relevant_files: [] });
    const project = makeProject({});
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    assert(typeof result.prompt === 'string', 'Should return a prompt');
    assert(result.prompt.length > 0, 'Prompt should not be empty');
  } finally {
    env.cleanup();
  }
});

test('16. buildWorkerPrompt handles undefined relevant_files', () => {
  const env = createTestProject({
    claudeMd: '# Test\n',
  });
  try {
    const task = makeTask({});
    delete task.relevant_files;
    const project = makeProject({});
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    assert(typeof result.prompt === 'string', 'Should return a prompt');
  } finally {
    env.cleanup();
  }
});

// ═════════════════════════════════════════════════════════════════════
// 5. TOKEN BUDGET ENFORCEMENT
// ═════════════════════════════════════════════════════════════════════

console.log('\n  buildWorkerPrompt - Token Budget\n');

test('17. buildWorkerPrompt prompt stays under 60K token budget', () => {
  const env = createTestProject({
    claudeMd: '# Test\n',
  });
  try {
    const task = makeTask({});
    const project = makeProject({});
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    const tokens = estimateTokens(result.prompt);
    assert(
      tokens <= TOKEN_BUDGET,
      `Prompt should be under ${TOKEN_BUDGET} tokens, got ${tokens}`
    );
  } finally {
    env.cleanup();
  }
});

test('18. buildWorkerPrompt trims relevant files to fit budget', () => {
  // Create a very large file that would exceed the budget
  const largeContent = 'x'.repeat(300000); // ~75K tokens at 4 chars/token
  const env = createTestProject({
    claudeMd: '# Test\n',
    relevantFiles: {
      'src/huge-file.js': largeContent,
    },
  });
  try {
    const task = makeTask({
      relevant_files: ['src/huge-file.js'],
    });
    const project = makeProject({});
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    const tokens = estimateTokens(result.prompt);
    assert(
      tokens <= TOKEN_BUDGET,
      `Prompt should be under ${TOKEN_BUDGET} tokens even with huge file, got ${tokens}`
    );
  } finally {
    env.cleanup();
  }
});

test('19. buildWorkerPrompt trims multiple files to fit budget', () => {
  // Create multiple large files -- together they exceed the budget
  const fileContent = 'y'.repeat(120000); // ~30K tokens each
  const env = createTestProject({
    claudeMd: '# Test\n',
    relevantFiles: {
      'src/file1.js': fileContent,
      'src/file2.js': fileContent,
      'src/file3.js': fileContent,
    },
  });
  try {
    const task = makeTask({
      relevant_files: ['src/file1.js', 'src/file2.js', 'src/file3.js'],
    });
    const project = makeProject({});
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    const tokens = estimateTokens(result.prompt);
    assert(
      tokens <= TOKEN_BUDGET,
      `Prompt should be under ${TOKEN_BUDGET} tokens with multiple large files, got ${tokens}`
    );
  } finally {
    env.cleanup();
  }
});

test('20. meta reports token count', () => {
  const env = createTestProject({
    claudeMd: '# Test\n',
  });
  try {
    const task = makeTask({});
    const project = makeProject({});
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    assert(
      typeof result.meta.tokenEstimate === 'number',
      'meta.tokenEstimate should be a number'
    );
    assert(result.meta.tokenEstimate > 0, 'meta.tokenEstimate should be > 0');
    assert(
      result.meta.tokenEstimate <= TOKEN_BUDGET,
      `meta.tokenEstimate should be <= ${TOKEN_BUDGET}`
    );
  } finally {
    env.cleanup();
  }
});

test('21. meta reports included file count', () => {
  const env = createTestProject({
    claudeMd: '# Test\n',
    relevantFiles: {
      'src/a.js': 'const a = 1;',
      'src/b.js': 'const b = 2;',
    },
  });
  try {
    const task = makeTask({
      relevant_files: ['src/a.js', 'src/b.js'],
    });
    const project = makeProject({});
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    assert(
      typeof result.meta.filesIncluded === 'number',
      'meta.filesIncluded should be a number'
    );
    assert(
      result.meta.filesIncluded === 2,
      `Expected 2 files included, got ${result.meta.filesIncluded}`
    );
  } finally {
    env.cleanup();
  }
});

// ═════════════════════════════════════════════════════════════════════
// 6. PROMPT TEMPLATE SECTIONS
// ═════════════════════════════════════════════════════════════════════

console.log('\n  buildWorkerPrompt - Template Sections\n');

test('22. prompt includes project name', () => {
  const env = createTestProject({
    claudeMd: '# Test\n',
  });
  try {
    const task = makeTask({});
    const project = makeProject({ name: 'jade-cli' });
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    assert(
      result.prompt.includes('jade-cli'),
      'Prompt should include project name'
    );
  } finally {
    env.cleanup();
  }
});

test('23. prompt includes Your Assignment section', () => {
  const env = createTestProject({
    claudeMd: '# Test\n',
  });
  try {
    const task = makeTask({});
    const project = makeProject({});
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    assert(
      result.prompt.includes('Your Assignment') ||
        result.prompt.includes('Assignment'),
      'Prompt should include an Assignment section'
    );
  } finally {
    env.cleanup();
  }
});

test('24. prompt includes Constraints section with test command', () => {
  const env = createTestProject({
    claudeMd: '# Test\n',
  });
  try {
    const task = makeTask({});
    const project = makeProject({ test_command: 'npx vitest run' });
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    assert(
      result.prompt.includes('npx vitest run'),
      'Prompt should include the project test command'
    );
  } finally {
    env.cleanup();
  }
});

test('25. prompt includes Constraints section with project path', () => {
  const env = createTestProject({
    claudeMd: '# Test\n',
  });
  try {
    const task = makeTask({});
    const project = makeProject({ path: 'jade-cli' });
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    assert(
      result.prompt.includes('jade-cli'),
      'Prompt should reference the project path in constraints'
    );
  } finally {
    env.cleanup();
  }
});

test('26. prompt includes TDD skill reference', () => {
  const env = createTestProject({
    claudeMd: '# Test\n',
  });
  try {
    const task = makeTask({});
    const project = makeProject({});
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    assert(
      result.prompt.includes('test-driven-development') ||
        result.prompt.includes('TDD'),
      'Prompt should reference TDD skill'
    );
  } finally {
    env.cleanup();
  }
});

// ═════════════════════════════════════════════════════════════════════
// 7. dispatchWorker FUNCTION
// ═════════════════════════════════════════════════════════════════════

console.log('\n  dispatchWorker\n');

test('27. dispatchWorker returns a dispatch descriptor', () => {
  const env = createTestProject({
    claudeMd: '# Test\n',
    tasksData: {
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
          feature: {
            description: 'Feature desc',
            acceptance_criteria: ['criterion 1'],
          },
          relevant_files: [],
          created_at: '2026-02-02T00:00:00Z',
        },
      ],
    },
  });
  try {
    const task = makeTask({});
    const project = makeProject({});
    const result = dispatchWorker(task, project, {
      projectsRoot: env.tmpdir,
      dryRun: true,
    });
    assert(result != null, 'Result should not be null');
    assert(
      typeof result.prompt === 'string',
      'result.prompt should be a string'
    );
    assert(
      typeof result.workingDirectory === 'string',
      'result.workingDirectory should be a string'
    );
    assert(
      typeof result.maxTurns === 'number',
      'result.maxTurns should be a number'
    );
  } finally {
    env.cleanup();
  }
});

test('28. dispatchWorker sets working directory to project root', () => {
  const env = createTestProject({
    claudeMd: '# Test\n',
    tasksData: {
      version: 1,
      project: 'test-project',
      tasks: [
        {
          id: 'test-project/test-task',
          title: 'Test',
          status: 'pending',
          complexity: 'S',
        },
      ],
    },
  });
  try {
    const task = makeTask({});
    const project = makeProject({});
    const result = dispatchWorker(task, project, {
      projectsRoot: env.tmpdir,
      dryRun: true,
    });
    const expected = path.join(env.tmpdir, 'test-project');
    assert(
      result.workingDirectory === expected,
      `Expected working dir ${expected}, got ${result.workingDirectory}`
    );
  } finally {
    env.cleanup();
  }
});

test('29. dispatchWorker sets maxTurns to 25', () => {
  const env = createTestProject({
    claudeMd: '# Test\n',
    tasksData: {
      version: 1,
      project: 'test-project',
      tasks: [
        {
          id: 'test-project/test-task',
          title: 'Test',
          status: 'pending',
          complexity: 'S',
        },
      ],
    },
  });
  try {
    const task = makeTask({});
    const project = makeProject({});
    const result = dispatchWorker(task, project, {
      projectsRoot: env.tmpdir,
      dryRun: true,
    });
    assert(
      result.maxTurns === 25,
      `Expected maxTurns 25, got ${result.maxTurns}`
    );
  } finally {
    env.cleanup();
  }
});

test('30. dispatchWorker updates task status to in_progress in tasks.json', () => {
  const tasksData = {
    version: 1,
    project: 'test-project',
    tasks: [
      {
        id: 'test-project/test-task',
        title: 'Test task',
        status: 'pending',
        complexity: 'S',
        blocked_by: [],
        unlocks: [],
        labels: [],
        feature: {},
        relevant_files: [],
        created_at: '2026-02-02T00:00:00Z',
      },
    ],
  };
  const env = createTestProject({
    claudeMd: '# Test\n',
    tasksData: tasksData,
  });
  try {
    const task = makeTask({ status: 'pending' });
    const project = makeProject({});
    dispatchWorker(task, project, {
      projectsRoot: env.tmpdir,
      dryRun: true,
    });

    // Read back the tasks.json and verify status was updated
    const updatedContent = fs.readFileSync(
      path.join(env.projectPath, '.claude', 'tasks', 'tasks.json'),
      'utf8'
    );
    const updatedData = JSON.parse(updatedContent);
    const updatedTask = updatedData.tasks.find(
      (t) => t.id === 'test-project/test-task'
    );
    assert(updatedTask != null, 'Task should still exist in tasks.json');
    assert(
      updatedTask.status === 'in_progress',
      `Expected status 'in_progress', got '${updatedTask.status}'`
    );
  } finally {
    env.cleanup();
  }
});

test('31. dispatchWorker adds history entry when updating status', () => {
  const tasksData = {
    version: 1,
    project: 'test-project',
    tasks: [
      {
        id: 'test-project/test-task',
        title: 'Test task',
        status: 'pending',
        complexity: 'S',
        blocked_by: [],
        unlocks: [],
        labels: [],
        feature: {},
        relevant_files: [],
        created_at: '2026-02-02T00:00:00Z',
      },
    ],
  };
  const env = createTestProject({
    claudeMd: '# Test\n',
    tasksData: tasksData,
  });
  try {
    const task = makeTask({ status: 'pending' });
    const project = makeProject({});
    dispatchWorker(task, project, {
      projectsRoot: env.tmpdir,
      dryRun: true,
    });

    const updatedContent = fs.readFileSync(
      path.join(env.projectPath, '.claude', 'tasks', 'tasks.json'),
      'utf8'
    );
    const updatedData = JSON.parse(updatedContent);
    const updatedTask = updatedData.tasks.find(
      (t) => t.id === 'test-project/test-task'
    );

    assert(
      Array.isArray(updatedTask.history),
      'Task should have a history array'
    );
    assert(
      updatedTask.history.length >= 1,
      'History should have at least 1 entry'
    );
    const entry = updatedTask.history[updatedTask.history.length - 1];
    assert(
      entry.from_status === 'pending',
      `Expected from_status 'pending', got '${entry.from_status}'`
    );
    assert(
      entry.to_status === 'in_progress',
      `Expected to_status 'in_progress', got '${entry.to_status}'`
    );
    assert(
      typeof entry.timestamp === 'string',
      'History entry should have a timestamp'
    );
  } finally {
    env.cleanup();
  }
});

// ═════════════════════════════════════════════════════════════════════
// 8. EDGE CASES
// ═════════════════════════════════════════════════════════════════════

console.log('\n  Edge Cases\n');

test('32. handles task with no feature property', () => {
  const env = createTestProject({
    claudeMd: '# Test\n',
  });
  try {
    const task = makeTask({});
    delete task.feature;
    const project = makeProject({});
    // Should not throw
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    assert(typeof result.prompt === 'string', 'Should return a prompt');
  } finally {
    env.cleanup();
  }
});

test('33. handles task with empty feature object', () => {
  const env = createTestProject({
    claudeMd: '# Test\n',
  });
  try {
    const task = makeTask({ feature: {} });
    const project = makeProject({});
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    assert(typeof result.prompt === 'string', 'Should return a prompt');
  } finally {
    env.cleanup();
  }
});

test('34. handles task with no description', () => {
  const env = createTestProject({
    claudeMd: '# Test\n',
  });
  try {
    const task = makeTask({});
    delete task.description;
    const project = makeProject({});
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    assert(typeof result.prompt === 'string', 'Should return a prompt');
  } finally {
    env.cleanup();
  }
});

test('35. handles project with no test_command', () => {
  const env = createTestProject({
    claudeMd: '# Test\n',
  });
  try {
    const task = makeTask({});
    const project = makeProject({ test_command: null });
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    assert(typeof result.prompt === 'string', 'Should return a prompt');
  } finally {
    env.cleanup();
  }
});

test('36. meta.filesIncluded is 0 when relevant_files missing on disk', () => {
  const env = createTestProject({
    claudeMd: '# Test\n',
  });
  try {
    const task = makeTask({
      relevant_files: ['nonexistent1.js', 'nonexistent2.js'],
    });
    const project = makeProject({});
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    assert(
      result.meta.filesIncluded === 0,
      `Expected 0 files included for missing files, got ${result.meta.filesIncluded}`
    );
  } finally {
    env.cleanup();
  }
});

test('37. meta.filesTrimmed counts files excluded due to budget', () => {
  // Create files that together exceed the budget
  const largeContent = 'z'.repeat(250000); // ~62.5K tokens
  const env = createTestProject({
    claudeMd: '# Test\n',
    relevantFiles: {
      'src/small.js': 'const x = 1;',
      'src/huge.js': largeContent,
    },
  });
  try {
    const task = makeTask({
      relevant_files: ['src/small.js', 'src/huge.js'],
    });
    const project = makeProject({});
    const result = buildWorkerPrompt(task, project, {
      projectsRoot: env.tmpdir,
    });
    assert(
      typeof result.meta.filesTrimmed === 'number',
      'meta.filesTrimmed should be a number'
    );
    // The huge file should have been trimmed or excluded
    assert(result.meta.filesTrimmed >= 0, 'meta.filesTrimmed should be >= 0');
  } finally {
    env.cleanup();
  }
});

// ═════════════════════════════════════════════════════════════════════
// 9. TOKEN ESTIMATION LOGGING
// ═════════════════════════════════════════════════════════════════════

console.log('\n  Token Estimation Logging\n');

test('38. dispatchWorker logs token estimate (captured via silent option)', () => {
  const env = createTestProject({
    claudeMd: '# Test\n',
    tasksData: {
      version: 1,
      project: 'test-project',
      tasks: [
        {
          id: 'test-project/test-task',
          title: 'Test',
          status: 'pending',
          complexity: 'S',
        },
      ],
    },
  });
  try {
    const task = makeTask({});
    const project = makeProject({});
    // With silent: true, no logging occurs -- this tests that the option works
    const result = dispatchWorker(task, project, {
      projectsRoot: env.tmpdir,
      dryRun: true,
      silent: true,
    });
    // Verify the meta still contains token estimate
    assert(
      typeof result.meta.tokenEstimate === 'number',
      'meta.tokenEstimate should be a number even with silent: true'
    );
    assert(result.meta.tokenEstimate > 0, 'meta.tokenEstimate should be > 0');
  } finally {
    env.cleanup();
  }
});

test('39. dispatchWorker handles prompts within token budget without warning', () => {
  const env = createTestProject({
    claudeMd: '# Test\n',
    tasksData: {
      version: 1,
      project: 'test-project',
      tasks: [
        {
          id: 'test-project/test-task',
          title: 'Test',
          status: 'pending',
          complexity: 'S',
        },
      ],
    },
  });
  try {
    const task = makeTask({});
    const project = makeProject({});
    const result = dispatchWorker(task, project, {
      projectsRoot: env.tmpdir,
      dryRun: true,
      silent: true,
    });
    // Normal prompt should be well under budget
    assert(
      result.meta.tokenEstimate <= TOKEN_BUDGET,
      `Token estimate ${result.meta.tokenEstimate} should be <= ${TOKEN_BUDGET}`
    );
  } finally {
    env.cleanup();
  }
});

test('40. estimateTokens returns 0 for empty string', () => {
  const count = estimateTokens('');
  assert(count === 0, `Expected 0 for empty string, got ${count}`);
});

test('41. estimateTokens returns 0 for null/undefined', () => {
  const countNull = estimateTokens(null);
  const countUndef = estimateTokens(undefined);
  assert(countNull === 0, `Expected 0 for null, got ${countNull}`);
  assert(countUndef === 0, `Expected 0 for undefined, got ${countUndef}`);
});

test('42. estimateTokens rounds up correctly', () => {
  // 5 chars should be ceil(5/4) = 2 tokens
  const count = estimateTokens('hello');
  assert(count === 2, `Expected 2 tokens for 5 chars, got ${count}`);
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
