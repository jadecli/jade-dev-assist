#!/usr/bin/env node

/**
 * Issue Mapper Module Tests (lib/issue-mapper.js)
 *
 * Tests for task-to-issue and issue-to-task mapping utilities.
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
 * Create a temp directory for testing.
 */
function createTestEnv() {
  const tmpdir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'jade-issue-mapper-test-')
  );
  const claudeDir = path.join(tmpdir, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });

  return {
    tmpdir,
    projectRoot: tmpdir,
    cleanup() {
      fs.rmSync(tmpdir, { recursive: true, force: true });
    },
    readMap() {
      const mapPath = path.join(tmpdir, '.claude', 'issue-map.json');
      if (fs.existsSync(mapPath)) {
        return JSON.parse(fs.readFileSync(mapPath, 'utf8'));
      }
      return null;
    },
  };
}

// ── Import module ────────────────────────────────────────────────────

let issueMapper;
try {
  issueMapper = require('../lib/issue-mapper');
} catch (err) {
  console.log('\nFATAL: Could not load lib/issue-mapper.js');
  console.log(`  ${err.message}\n`);
  process.exit(1);
}

const {
  getIssueForTask,
  getTaskForIssue,
  registerMapping,
  removeTaskMapping,
  removeIssueMapping,
  getAllMappings,
  clearMappings,
  getMapPath,
  loadMap,
  saveMap,
} = issueMapper;

// ── getMapPath tests ─────────────────────────────────────────────────

console.log('\n  getMapPath tests\n');

test('1. getMapPath returns correct path', () => {
  const projectRoot = '/home/user/projects/my-project';
  const mapPath = getMapPath(projectRoot);

  assert(mapPath.includes('.claude'), 'Path should include .claude directory');
  assert(
    mapPath.endsWith('issue-map.json'),
    'Path should end with issue-map.json'
  );
});

// ── loadMap/saveMap tests ────────────────────────────────────────────

console.log('\n  loadMap/saveMap tests\n');

test('2. loadMap returns empty maps for non-existent file', () => {
  const env = createTestEnv();
  try {
    const map = loadMap(env.projectRoot);

    assert(map.taskToIssue !== undefined, 'Should have taskToIssue');
    assert(map.issueToTask !== undefined, 'Should have issueToTask');
    assert(
      Object.keys(map.taskToIssue).length === 0,
      'taskToIssue should be empty'
    );
    assert(
      Object.keys(map.issueToTask).length === 0,
      'issueToTask should be empty'
    );
  } finally {
    env.cleanup();
  }
});

test('3. saveMap creates map file', () => {
  const env = createTestEnv();
  try {
    const map = {
      taskToIssue: { 'proj/task-1': 42 },
      issueToTask: { 42: 'proj/task-1' },
    };

    saveMap(env.projectRoot, map);

    const savedData = env.readMap();
    assert(savedData !== null, 'Map file should exist');
    assert(savedData.version === 1, 'Should have version 1');
    assert(
      savedData.taskToIssue['proj/task-1'] === 42,
      'Should have correct task mapping'
    );
    assert(
      savedData.issueToTask['42'] === 'proj/task-1',
      'Should have correct issue mapping'
    );
  } finally {
    env.cleanup();
  }
});

test('4. loadMap reads saved map correctly', () => {
  const env = createTestEnv();
  try {
    const originalMap = {
      taskToIssue: { 'proj/task-1': 100, 'proj/task-2': 101 },
      issueToTask: { 100: 'proj/task-1', 101: 'proj/task-2' },
    };

    saveMap(env.projectRoot, originalMap);
    const loadedMap = loadMap(env.projectRoot);

    assert(
      loadedMap.taskToIssue['proj/task-1'] === 100,
      'Should load task-1 mapping'
    );
    assert(
      loadedMap.taskToIssue['proj/task-2'] === 101,
      'Should load task-2 mapping'
    );
    assert(
      loadedMap.issueToTask['100'] === 'proj/task-1',
      'Should load issue 100 mapping'
    );
    assert(
      loadedMap.issueToTask['101'] === 'proj/task-2',
      'Should load issue 101 mapping'
    );
  } finally {
    env.cleanup();
  }
});

// ── registerMapping tests ────────────────────────────────────────────

console.log('\n  registerMapping tests\n');

test('5. registerMapping creates bidirectional mapping', () => {
  const env = createTestEnv();

  // Suppress stderr output for this test
  const originalWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = () => true;

  try {
    registerMapping('proj/task-1', 42, env.projectRoot);

    const issue = getIssueForTask('proj/task-1', env.projectRoot);
    const task = getTaskForIssue(42, env.projectRoot);

    assert(issue === 42, `Expected issue 42, got ${issue}`);
    assert(task === 'proj/task-1', `Expected 'proj/task-1', got '${task}'`);
  } finally {
    process.stderr.write = originalWrite;
    env.cleanup();
  }
});

test('6. registerMapping persists to disk', () => {
  const env = createTestEnv();

  // Suppress stderr output for this test
  const originalWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = () => true;

  try {
    registerMapping('proj/task-2', 99, env.projectRoot);

    const savedData = env.readMap();
    assert(
      savedData.taskToIssue['proj/task-2'] === 99,
      'Should persist task mapping'
    );
    assert(
      savedData.issueToTask['99'] === 'proj/task-2',
      'Should persist issue mapping'
    );
  } finally {
    process.stderr.write = originalWrite;
    env.cleanup();
  }
});

// ── getIssueForTask/getTaskForIssue tests ────────────────────────────

console.log('\n  Lookup tests\n');

test('7. getIssueForTask returns null for unmapped task', () => {
  const env = createTestEnv();
  try {
    const issue = getIssueForTask('unknown/task', env.projectRoot);
    assert(issue === null, 'Should return null for unmapped task');
  } finally {
    env.cleanup();
  }
});

test('8. getTaskForIssue returns null for unmapped issue', () => {
  const env = createTestEnv();
  try {
    const task = getTaskForIssue(9999, env.projectRoot);
    assert(task === null, 'Should return null for unmapped issue');
  } finally {
    env.cleanup();
  }
});

// ── removeMapping tests ──────────────────────────────────────────────

console.log('\n  Remove mapping tests\n');

test('9. removeTaskMapping removes bidirectional mapping', () => {
  const env = createTestEnv();

  // Suppress stderr output for this test
  const originalWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = () => true;

  try {
    registerMapping('proj/task-3', 77, env.projectRoot);
    removeTaskMapping('proj/task-3', env.projectRoot);

    const issue = getIssueForTask('proj/task-3', env.projectRoot);
    const task = getTaskForIssue(77, env.projectRoot);

    assert(issue === null, 'Issue mapping should be removed');
    assert(task === null, 'Task mapping should be removed');
  } finally {
    process.stderr.write = originalWrite;
    env.cleanup();
  }
});

test('10. removeIssueMapping removes bidirectional mapping', () => {
  const env = createTestEnv();

  // Suppress stderr output for this test
  const originalWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = () => true;

  try {
    registerMapping('proj/task-4', 88, env.projectRoot);
    removeIssueMapping(88, env.projectRoot);

    const issue = getIssueForTask('proj/task-4', env.projectRoot);
    const task = getTaskForIssue(88, env.projectRoot);

    assert(issue === null, 'Issue mapping should be removed');
    assert(task === null, 'Task mapping should be removed');
  } finally {
    process.stderr.write = originalWrite;
    env.cleanup();
  }
});

test('11. removeTaskMapping handles non-existent mapping gracefully', () => {
  const env = createTestEnv();

  // Suppress stderr output for this test
  const originalWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = () => true;

  try {
    // Should not throw
    removeTaskMapping('nonexistent/task', env.projectRoot);
  } finally {
    process.stderr.write = originalWrite;
    env.cleanup();
  }
});

// ── getAllMappings tests ─────────────────────────────────────────────

console.log('\n  getAllMappings tests\n');

test('12. getAllMappings returns all registered mappings', () => {
  const env = createTestEnv();

  // Suppress stderr output for this test
  const originalWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = () => true;

  try {
    registerMapping('proj/task-a', 1, env.projectRoot);
    registerMapping('proj/task-b', 2, env.projectRoot);
    registerMapping('proj/task-c', 3, env.projectRoot);

    const all = getAllMappings(env.projectRoot);

    assert(
      Object.keys(all.taskToIssue).length === 3,
      'Should have 3 task mappings'
    );
    assert(
      Object.keys(all.issueToTask).length === 3,
      'Should have 3 issue mappings'
    );
  } finally {
    process.stderr.write = originalWrite;
    env.cleanup();
  }
});

// ── clearMappings tests ──────────────────────────────────────────────

console.log('\n  clearMappings tests\n');

test('13. clearMappings removes all mappings', () => {
  const env = createTestEnv();

  // Suppress stderr output for this test
  const originalWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = () => true;

  try {
    registerMapping('proj/task-x', 10, env.projectRoot);
    registerMapping('proj/task-y', 20, env.projectRoot);

    clearMappings(env.projectRoot);

    const all = getAllMappings(env.projectRoot);
    assert(
      Object.keys(all.taskToIssue).length === 0,
      'taskToIssue should be empty'
    );
    assert(
      Object.keys(all.issueToTask).length === 0,
      'issueToTask should be empty'
    );
  } finally {
    process.stderr.write = originalWrite;
    env.cleanup();
  }
});

// ── Module exports tests ─────────────────────────────────────────────

console.log('\n  Module exports tests\n');

test('14. Module exports all required functions', () => {
  assert(
    typeof issueMapper.getIssueForTask === 'function',
    'Should export getIssueForTask'
  );
  assert(
    typeof issueMapper.getTaskForIssue === 'function',
    'Should export getTaskForIssue'
  );
  assert(
    typeof issueMapper.registerMapping === 'function',
    'Should export registerMapping'
  );
  assert(
    typeof issueMapper.removeTaskMapping === 'function',
    'Should export removeTaskMapping'
  );
  assert(
    typeof issueMapper.removeIssueMapping === 'function',
    'Should export removeIssueMapping'
  );
  assert(
    typeof issueMapper.getAllMappings === 'function',
    'Should export getAllMappings'
  );
  assert(
    typeof issueMapper.clearMappings === 'function',
    'Should export clearMappings'
  );
  assert(
    typeof issueMapper.syncMappingsToTasksJson === 'function',
    'Should export syncMappingsToTasksJson'
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
