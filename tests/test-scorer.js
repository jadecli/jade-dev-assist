#!/usr/bin/env node

/**
 * Scorer Module Tests (lib/scorer.js)
 *
 * Tests for scoreTask(), scoreTasks(), and exported constants.
 * Uses the same custom test framework as test-plugin.js and test-scanner.js.
 *
 * TDD red phase: write all tests, then implement lib/scorer.js.
 */

'use strict';

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

function assertClose(actual, expected, tolerance, message) {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    throw new Error(
      (message || 'assertClose failed') +
        `: expected ${expected} (+/- ${tolerance}), got ${actual} (diff ${diff})`
    );
  }
}

// ── Import scorer ────────────────────────────────────────────────────

let scoreTask, scoreTasks, MATURITY_SCORES, COMPLEXITY_MULTIPLIERS, WEIGHTS;
try {
  const scorer = require('../lib/scorer');
  scoreTask = scorer.scoreTask;
  scoreTasks = scorer.scoreTasks;
  MATURITY_SCORES = scorer.MATURITY_SCORES;
  COMPLEXITY_MULTIPLIERS = scorer.COMPLEXITY_MULTIPLIERS;
  WEIGHTS = scorer.WEIGHTS;
} catch (err) {
  console.log('\nFATAL: Could not load lib/scorer.js');
  console.log(`  ${err.message}\n`);
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Build a minimal task object with sensible defaults.
 * Override any field by passing it in the `overrides` object.
 */
function makeTask(overrides) {
  return Object.assign(
    {
      id: 'test-project/test-task',
      title: 'Test task',
      status: 'pending',
      complexity: 'S',
      blocked_by: [],
      unlocks: [],
      labels: [],
      feature: {},
      created_at: '2025-01-01T00:00:00Z', // old date, no recency
      _project: { name: 'test-project', status: 'scaffolding' },
      _projectName: 'test-project',
      _milestone: null,
    },
    overrides
  );
}

function makeProject(overrides) {
  return Object.assign(
    { name: 'test-project', status: 'scaffolding' },
    overrides
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 1. EXPORTED CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

console.log('\n  Exported Constants\n');

test('1. MATURITY_SCORES maps all 5 statuses', () => {
  assert(MATURITY_SCORES != null, 'MATURITY_SCORES should be defined');
  assert(
    MATURITY_SCORES.buildable === 100,
    `buildable should be 100, got ${MATURITY_SCORES.buildable}`
  );
  assert(
    MATURITY_SCORES['near-buildable'] === 80,
    `near-buildable should be 80, got ${MATURITY_SCORES['near-buildable']}`
  );
  assert(
    MATURITY_SCORES['scaffolding-plus'] === 60,
    `scaffolding-plus should be 60, got ${MATURITY_SCORES['scaffolding-plus']}`
  );
  assert(
    MATURITY_SCORES.scaffolding === 40,
    `scaffolding should be 40, got ${MATURITY_SCORES.scaffolding}`
  );
  assert(
    MATURITY_SCORES.blocked === 10,
    `blocked should be 10, got ${MATURITY_SCORES.blocked}`
  );
});

test('2. COMPLEXITY_MULTIPLIERS maps S/M/L/XL', () => {
  assert(
    COMPLEXITY_MULTIPLIERS != null,
    'COMPLEXITY_MULTIPLIERS should be defined'
  );
  assert(
    COMPLEXITY_MULTIPLIERS.S === 1.0,
    `S should be 1.0, got ${COMPLEXITY_MULTIPLIERS.S}`
  );
  assert(
    COMPLEXITY_MULTIPLIERS.M === 0.75,
    `M should be 0.75, got ${COMPLEXITY_MULTIPLIERS.M}`
  );
  assert(
    COMPLEXITY_MULTIPLIERS.L === 0.5,
    `L should be 0.50, got ${COMPLEXITY_MULTIPLIERS.L}`
  );
  assert(
    COMPLEXITY_MULTIPLIERS.XL === 0.3,
    `XL should be 0.30, got ${COMPLEXITY_MULTIPLIERS.XL}`
  );
});

test('3. WEIGHTS has correct values summing to 1.0', () => {
  assert(WEIGHTS != null, 'WEIGHTS should be defined');
  assert(
    WEIGHTS.maturity === 0.2,
    `maturity weight should be 0.20, got ${WEIGHTS.maturity}`
  );
  assert(
    WEIGHTS.impact === 0.3,
    `impact weight should be 0.30, got ${WEIGHTS.impact}`
  );
  assert(
    WEIGHTS.dependency === 0.2,
    `dependency weight should be 0.20, got ${WEIGHTS.dependency}`
  );
  assert(
    WEIGHTS.effort === 0.15,
    `effort weight should be 0.15, got ${WEIGHTS.effort}`
  );
  assert(
    WEIGHTS.preference === 0.15,
    `preference weight should be 0.15, got ${WEIGHTS.preference}`
  );
  const sum =
    WEIGHTS.maturity +
    WEIGHTS.impact +
    WEIGHTS.dependency +
    WEIGHTS.effort +
    WEIGHTS.preference;
  assertClose(sum, 1.0, 0.001, 'Weights should sum to 1.0');
});

// ═══════════════════════════════════════════════════════════════════════
// 2. MATURITY FACTOR
// ═══════════════════════════════════════════════════════════════════════

console.log('\n  Maturity Factor\n');

test('4. scoreTask uses project.status for maturity (buildable=100)', () => {
  const task = makeTask({});
  const project = makeProject({ status: 'buildable' });
  const score = scoreTask(task, project, [task]);
  // maturity=100, all other factors at baseline
  // impact: empty feature = 0, no unlocks, no milestone, no labels = 0
  // dependency: blocked_by [] = 100
  // effort: 0 * 1.0 = 0
  // preference: 50 (default, old date)
  // = (100*0.20) + (0*0.30) + (100*0.20) + (0*0.15) + (50*0.15)
  // = 20 + 0 + 20 + 0 + 7.5 = 47.5
  assertClose(score, 47.5, 0.01, 'buildable project with minimal task');
});

test('5. scoreTask uses project.status for maturity (blocked=10)', () => {
  const task = makeTask({});
  const project = makeProject({ status: 'blocked' });
  const score = scoreTask(task, project, [task]);
  // maturity=10, impact=0, dependency=100, effort=0, preference=50
  // = (10*0.20) + (0*0.30) + (100*0.20) + (0*0.15) + (50*0.15)
  // = 2 + 0 + 20 + 0 + 7.5 = 29.5
  assertClose(score, 29.5, 0.01, 'blocked project with minimal task');
});

test('6. scoreTask defaults to 0 for unknown project status', () => {
  const task = makeTask({});
  const project = makeProject({ status: 'unknown-status' });
  const score = scoreTask(task, project, [task]);
  // maturity=0, impact=0, dependency=100, effort=0, preference=50
  // = 0 + 0 + 20 + 0 + 7.5 = 27.5
  assertClose(score, 27.5, 0.01, 'unknown status defaults to maturity 0');
});

// ═══════════════════════════════════════════════════════════════════════
// 3. IMPACT FACTOR
// ═══════════════════════════════════════════════════════════════════════

console.log('\n  Impact Factor\n');

test('7. impact: acceptance_criteria gives +20', () => {
  const task = makeTask({
    feature: { acceptance_criteria: ['criterion 1'] },
  });
  const project = makeProject({ status: 'scaffolding' });
  // impact = 20 (criteria only)
  // maturity=40, dependency=100, effort=20*1.0=20, preference=50
  // = (40*0.20) + (20*0.30) + (100*0.20) + (20*0.15) + (50*0.15)
  // = 8 + 6 + 20 + 3 + 7.5 = 44.5
  const score = scoreTask(task, project, [task]);
  assertClose(score, 44.5, 0.01, 'acceptance_criteria +20 impact');
});

test('8. impact: feature.description gives +10', () => {
  const task = makeTask({
    feature: { description: 'Some feature description' },
  });
  const project = makeProject({ status: 'scaffolding' });
  // impact = 10
  // = (40*0.20) + (10*0.30) + (100*0.20) + (10*0.15) + (50*0.15)
  // = 8 + 3 + 20 + 1.5 + 7.5 = 40.0
  const score = scoreTask(task, project, [task]);
  assertClose(score, 40.0, 0.01, 'feature.description +10 impact');
});

test('9. impact: github_issue gives +10', () => {
  const task = makeTask({ github_issue: 'repo/issue#1' });
  const project = makeProject({ status: 'scaffolding' });
  // impact = 10
  // = (40*0.20) + (10*0.30) + (100*0.20) + (10*0.15) + (50*0.15)
  // = 8 + 3 + 20 + 1.5 + 7.5 = 40.0
  const score = scoreTask(task, project, [task]);
  assertClose(score, 40.0, 0.01, 'github_issue +10 impact');
});

test('10. impact: unlocks gives +15 per task (max 45)', () => {
  const task = makeTask({
    unlocks: ['a/t1', 'a/t2', 'a/t3', 'a/t4'], // 4 entries, but capped at 3
  });
  const project = makeProject({ status: 'scaffolding' });
  // unlock_bonus = min(4,3)*15 = 45
  // impact = 45
  // effort = 45 * 1.0 = 45
  // = (40*0.20) + (45*0.30) + (100*0.20) + (45*0.15) + (50*0.15)
  // = 8 + 13.5 + 20 + 6.75 + 7.5 = 55.75
  const score = scoreTask(task, project, [task]);
  assertClose(score, 55.75, 0.01, 'unlocks capped at 3 = +45');
});

test('11. impact: milestone_bonus +15 when task milestone matches _milestone.name', () => {
  // Add a sibling task in the same milestone so this is NOT the last blocker
  const sibling = makeTask({
    id: 'test-project/sibling-pending',
    status: 'pending',
    milestone: 'Alpha',
    _projectName: 'test-project',
    _milestone: { name: 'Alpha', target_date: '2026-06-01' },
  });
  const task = makeTask({
    milestone: 'Alpha',
    _milestone: { name: 'Alpha', target_date: '2026-06-01' },
  });
  const project = makeProject({ status: 'scaffolding' });
  const allTasks = [task, sibling];
  // impact = 15 (milestone match only, not last blocker since sibling is also pending)
  // effort = 15 * 1.0 = 15
  // = (40*0.20) + (15*0.30) + (100*0.20) + (15*0.15) + (50*0.15)
  // = 8 + 4.5 + 20 + 2.25 + 7.5 = 42.25
  const score = scoreTask(task, project, allTasks);
  assertClose(score, 42.25, 0.01, 'milestone match gives +15 impact');
});

test('12. impact: milestone_bonus +25 additional when last blocker for milestone', () => {
  // Two tasks share milestone "Alpha". One is completed, one is pending.
  // The pending task is the LAST incomplete task for that milestone.
  const completedSibling = makeTask({
    id: 'test-project/sibling-done',
    status: 'completed',
    milestone: 'Alpha',
    _projectName: 'test-project',
    _milestone: { name: 'Alpha' },
  });
  const lastBlocker = makeTask({
    id: 'test-project/last-blocker',
    milestone: 'Alpha',
    _projectName: 'test-project',
    _milestone: { name: 'Alpha' },
  });
  const project = makeProject({ status: 'scaffolding' });
  const allTasks = [completedSibling, lastBlocker];
  // impact = 15 (milestone match) + 25 (last blocker) = 40
  // effort = 40 * 1.0 = 40
  // = (40*0.20) + (40*0.30) + (100*0.20) + (40*0.15) + (50*0.15)
  // = 8 + 12 + 20 + 6 + 7.5 = 53.5
  const score = scoreTask(lastBlocker, project, allTasks);
  assertClose(score, 53.5, 0.01, 'last blocker gets +40 total milestone bonus');
});

test('13. impact: label_bonus sums correctly', () => {
  const task = makeTask({
    labels: ['bugfix', 'test', 'feature', 'infra', 'docs', 'refactor'],
  });
  const project = makeProject({ status: 'scaffolding' });
  // label_bonus = 10+10+5+5+0+0 = 30
  // impact = 30
  // effort = 30 * 1.0 = 30
  // = (40*0.20) + (30*0.30) + (100*0.20) + (30*0.15) + (50*0.15)
  // = 8 + 9 + 20 + 4.5 + 7.5 = 49.0
  const score = scoreTask(task, project, [task]);
  assertClose(score, 49.0, 0.01, 'label bonus sums all known labels');
});

test('14. impact: capped at 100', () => {
  const task = makeTask({
    feature: {
      description: 'High impact',
      acceptance_criteria: ['a', 'b', 'c'],
    },
    github_issue: 'repo#1',
    unlocks: ['a/t1', 'a/t2', 'a/t3'], // 45
    milestone: 'Alpha',
    _milestone: { name: 'Alpha' },
    labels: ['bugfix', 'test', 'feature', 'infra'],
  });
  // base: 20+10+10=40, unlock: 45, milestone: 15, labels: 10+10+5+5=30
  // raw = 40+45+15+30 = 130 -> capped at 100
  const project = makeProject({ status: 'scaffolding' });
  // effort = 100 * 1.0 = 100
  // = (40*0.20) + (100*0.30) + (100*0.20) + (100*0.15) + (50*0.15)
  // = 8 + 30 + 20 + 15 + 7.5 = 80.5
  const score = scoreTask(task, project, [task]);
  assertClose(score, 80.5, 0.01, 'impact capped at 100');
});

// ═══════════════════════════════════════════════════════════════════════
// 4. DEPENDENCY FACTOR
// ═══════════════════════════════════════════════════════════════════════

console.log('\n  Dependency Factor\n');

test('15. dependency: blocked_by empty = 100', () => {
  const task = makeTask({ blocked_by: [] });
  const project = makeProject({ status: 'scaffolding' });
  // Already tested implicitly, but let's isolate.
  // impact=0, maturity=40, dep=100, effort=0, pref=50
  // = 8 + 0 + 20 + 0 + 7.5 = 35.5
  const score = scoreTask(task, project, [task]);
  assertClose(score, 35.5, 0.01, 'empty blocked_by gives dependency=100');
});

test('16. dependency: all blockers completed = 100', () => {
  const blocker = makeTask({ id: 'proj/blocker', status: 'completed' });
  const task = makeTask({ blocked_by: ['proj/blocker'] });
  const project = makeProject({ status: 'scaffolding' });
  const allTasks = [task, blocker];
  // dependency=100 (all completed)
  // = 8 + 0 + 20 + 0 + 7.5 = 35.5
  const score = scoreTask(task, project, allTasks);
  assertClose(score, 35.5, 0.01, 'all blockers completed gives dependency=100');
});

test('17. dependency: all blockers in_progress = 50', () => {
  const blocker = makeTask({ id: 'proj/blocker', status: 'in_progress' });
  const task = makeTask({ blocked_by: ['proj/blocker'] });
  const project = makeProject({ status: 'scaffolding' });
  const allTasks = [task, blocker];
  // dependency=50
  // = (40*0.20) + (0*0.30) + (50*0.20) + (0*0.15) + (50*0.15)
  // = 8 + 0 + 10 + 0 + 7.5 = 25.5
  const score = scoreTask(task, project, allTasks);
  assertClose(
    score,
    25.5,
    0.01,
    'all blockers in_progress gives dependency=50'
  );
});

test('18. dependency: mix of completed and in_progress = 50', () => {
  const blockerDone = makeTask({ id: 'proj/b1', status: 'completed' });
  const blockerWip = makeTask({ id: 'proj/b2', status: 'in_progress' });
  const task = makeTask({ blocked_by: ['proj/b1', 'proj/b2'] });
  const project = makeProject({ status: 'scaffolding' });
  const allTasks = [task, blockerDone, blockerWip];
  // Not all completed, but non-completed ones are all in_progress -> 50
  // = (40*0.20) + (0*0.30) + (50*0.20) + (0*0.15) + (50*0.15)
  // = 8 + 0 + 10 + 0 + 7.5 = 25.5
  const score = scoreTask(task, project, allTasks);
  assertClose(
    score,
    25.5,
    0.01,
    'completed+in_progress mix gives dependency=50'
  );
});

test('19. dependency: any blocker pending = 0', () => {
  const blockerPending = makeTask({ id: 'proj/blocker', status: 'pending' });
  const task = makeTask({ blocked_by: ['proj/blocker'] });
  const project = makeProject({ status: 'scaffolding' });
  const allTasks = [task, blockerPending];
  // dependency=0
  // = (40*0.20) + (0*0.30) + (0*0.20) + (0*0.15) + (50*0.15)
  // = 8 + 0 + 0 + 0 + 7.5 = 15.5
  const score = scoreTask(task, project, allTasks);
  assertClose(score, 15.5, 0.01, 'pending blocker gives dependency=0');
});

test('20. dependency: blocker not found in allTasks = 0', () => {
  const task = makeTask({ blocked_by: ['proj/nonexistent'] });
  const project = makeProject({ status: 'scaffolding' });
  const allTasks = [task];
  // dependency=0 (blocker not found)
  // = (40*0.20) + (0*0.30) + (0*0.20) + (0*0.15) + (50*0.15)
  // = 8 + 0 + 0 + 0 + 7.5 = 15.5
  const score = scoreTask(task, project, allTasks);
  assertClose(score, 15.5, 0.01, 'missing blocker gives dependency=0');
});

test('21. dependency: mix of in_progress and pending = 0', () => {
  const blockerWip = makeTask({ id: 'proj/b1', status: 'in_progress' });
  const blockerPending = makeTask({ id: 'proj/b2', status: 'pending' });
  const task = makeTask({ blocked_by: ['proj/b1', 'proj/b2'] });
  const project = makeProject({ status: 'scaffolding' });
  const allTasks = [task, blockerWip, blockerPending];
  // Not all completed, not all in_progress (one is pending) -> 0
  // = 8 + 0 + 0 + 0 + 7.5 = 15.5
  const score = scoreTask(task, project, allTasks);
  assertClose(score, 15.5, 0.01, 'in_progress+pending mix gives dependency=0');
});

// ═══════════════════════════════════════════════════════════════════════
// 5. EFFORT-TO-VALUE FACTOR
// ═══════════════════════════════════════════════════════════════════════

console.log('\n  Effort-to-Value Factor\n');

test('22. effort: S complexity uses full impact (multiplier 1.0)', () => {
  const task = makeTask({
    complexity: 'S',
    feature: { description: 'desc', acceptance_criteria: ['a'] },
    github_issue: 'repo#1',
  });
  const project = makeProject({ status: 'scaffolding' });
  // impact = 20+10+10 = 40, effort = 40*1.0 = 40
  // = (40*0.20) + (40*0.30) + (100*0.20) + (40*0.15) + (50*0.15)
  // = 8 + 12 + 20 + 6 + 7.5 = 53.5
  const score = scoreTask(task, project, [task]);
  assertClose(score, 53.5, 0.01, 'S complexity: effort = impact * 1.0');
});

test('23. effort: M complexity applies 0.75 multiplier', () => {
  const task = makeTask({
    complexity: 'M',
    feature: { description: 'desc', acceptance_criteria: ['a'] },
    github_issue: 'repo#1',
  });
  const project = makeProject({ status: 'scaffolding' });
  // impact = 40, effort = 40*0.75 = 30
  // = (40*0.20) + (40*0.30) + (100*0.20) + (30*0.15) + (50*0.15)
  // = 8 + 12 + 20 + 4.5 + 7.5 = 52.0
  const score = scoreTask(task, project, [task]);
  assertClose(score, 52.0, 0.01, 'M complexity: effort = impact * 0.75');
});

test('24. effort: XL complexity applies 0.30 multiplier', () => {
  const task = makeTask({
    complexity: 'XL',
    feature: { description: 'desc', acceptance_criteria: ['a'] },
    github_issue: 'repo#1',
  });
  const project = makeProject({ status: 'scaffolding' });
  // impact = 40, effort = 40*0.30 = 12
  // = (40*0.20) + (40*0.30) + (100*0.20) + (12*0.15) + (50*0.15)
  // = 8 + 12 + 20 + 1.8 + 7.5 = 49.3
  const score = scoreTask(task, project, [task]);
  assertClose(score, 49.3, 0.01, 'XL complexity: effort = impact * 0.30');
});

test('25. effort: defaults to S multiplier for unknown complexity', () => {
  const task = makeTask({
    complexity: 'ZZ',
    feature: { description: 'desc', acceptance_criteria: ['a'] },
    github_issue: 'repo#1',
  });
  const project = makeProject({ status: 'scaffolding' });
  // Same as S: impact=40, effort=40*1.0=40
  // = 8 + 12 + 20 + 6 + 7.5 = 53.5
  const score = scoreTask(task, project, [task]);
  assertClose(score, 53.5, 0.01, 'unknown complexity defaults to S (1.0)');
});

// ═══════════════════════════════════════════════════════════════════════
// 6. PREFERENCE FACTOR
// ═══════════════════════════════════════════════════════════════════════

console.log('\n  Preference Factor\n');

test('26. preference: base is 50 for old task with no focus', () => {
  const task = makeTask({ created_at: '2025-01-01T00:00:00Z' });
  const project = makeProject({ status: 'scaffolding' });
  // preference = 50 (base only)
  // = (40*0.20) + (0*0.30) + (100*0.20) + (0*0.15) + (50*0.15)
  // = 8 + 0 + 20 + 0 + 7.5 = 35.5
  const score = scoreTask(task, project, [task]);
  assertClose(score, 35.5, 0.01, 'base preference 50');
});

test('27. preference: +20 recency boost for task created within 24h', () => {
  const now = new Date();
  const task = makeTask({ created_at: now.toISOString() });
  const project = makeProject({ status: 'scaffolding' });
  // preference = 50 + 20 = 70
  // = (40*0.20) + (0*0.30) + (100*0.20) + (0*0.15) + (70*0.15)
  // = 8 + 0 + 20 + 0 + 10.5 = 38.5
  const score = scoreTask(task, project, [task]);
  assertClose(score, 38.5, 0.01, 'recency boost +20 for recent task');
});

test('28. preference: +30 focus boost when focusLabel matches', () => {
  const task = makeTask({
    labels: ['bugfix'],
    created_at: '2025-01-01T00:00:00Z',
  });
  const project = makeProject({ status: 'scaffolding' });
  // preference = 50 + 30 = 80
  // impact = 10 (bugfix label)
  // effort = 10 * 1.0 = 10
  // = (40*0.20) + (10*0.30) + (100*0.20) + (10*0.15) + (80*0.15)
  // = 8 + 3 + 20 + 1.5 + 12 = 44.5
  const score = scoreTask(task, project, [task], { focusLabel: 'bugfix' });
  assertClose(score, 44.5, 0.01, 'focus label boost +30');
});

test('29. preference: focus + recency stack (50 + 20 + 30 = 100)', () => {
  const now = new Date();
  const task = makeTask({
    labels: ['test'],
    created_at: now.toISOString(),
  });
  const project = makeProject({ status: 'scaffolding' });
  // preference = 50 + 20 + 30 = 100
  // impact = 10 (test label)
  // effort = 10 * 1.0 = 10
  // = (40*0.20) + (10*0.30) + (100*0.20) + (10*0.15) + (100*0.15)
  // = 8 + 3 + 20 + 1.5 + 15 = 47.5
  const score = scoreTask(task, project, [task], { focusLabel: 'test' });
  assertClose(score, 47.5, 0.01, 'recency + focus = 100 preference');
});

test('30. preference: focusLabel that does not match gives no boost', () => {
  const task = makeTask({
    labels: ['bugfix'],
    created_at: '2025-01-01T00:00:00Z',
  });
  const project = makeProject({ status: 'scaffolding' });
  // preference = 50 (no match for 'feature')
  // impact = 10 (bugfix)
  // effort = 10 * 1.0 = 10
  // = (40*0.20) + (10*0.30) + (100*0.20) + (10*0.15) + (50*0.15)
  // = 8 + 3 + 20 + 1.5 + 7.5 = 40.0
  const score = scoreTask(task, project, [task], { focusLabel: 'feature' });
  assertClose(score, 40.0, 0.01, 'non-matching focus label = no boost');
});

// ═══════════════════════════════════════════════════════════════════════
// 7. PRIORITY OVERRIDE
// ═══════════════════════════════════════════════════════════════════════

console.log('\n  Priority Override\n');

test('31. priority_override replaces entire computed score', () => {
  const task = makeTask({ priority_override: 95 });
  const project = makeProject({ status: 'scaffolding' });
  const score = scoreTask(task, project, [task]);
  assertClose(score, 95, 0.01, 'priority_override replaces computed score');
});

test('32. priority_override=0 overrides to 0', () => {
  const task = makeTask({
    priority_override: 0,
    feature: { description: 'high impact', acceptance_criteria: ['a', 'b'] },
    github_issue: 'repo#1',
    unlocks: ['a/t1', 'a/t2'],
  });
  const project = makeProject({ status: 'buildable' });
  const score = scoreTask(task, project, [task]);
  assertClose(score, 0, 0.01, 'priority_override=0 overrides to 0');
});

test('33. priority_override=null does not override (uses computed)', () => {
  const task = makeTask({ priority_override: null });
  const project = makeProject({ status: 'scaffolding' });
  const score = scoreTask(task, project, [task]);
  // Should compute normally: maturity=40, impact=0, dep=100, effort=0, pref=50
  // = 8 + 0 + 20 + 0 + 7.5 = 35.5
  assertClose(score, 35.5, 0.01, 'null override uses computed score');
});

test('34. priority_override=undefined does not override (uses computed)', () => {
  const task = makeTask({});
  // No priority_override property at all
  delete task.priority_override;
  const project = makeProject({ status: 'scaffolding' });
  const score = scoreTask(task, project, [task]);
  assertClose(score, 35.5, 0.01, 'undefined override uses computed score');
});

// ═══════════════════════════════════════════════════════════════════════
// 8. DESIGN DOC VERIFICATION EXAMPLES
// ═══════════════════════════════════════════════════════════════════════

console.log('\n  Design Doc Verification Examples\n');

test('35. Example 1: jade-cli/fix-node-build = 78.0', () => {
  // Carefully constructed to match the design doc calculation at line 656:
  // maturity: near-buildable = 80
  // impact: acceptance_criteria(+20) + feature.description(+10) + github_issue(+10) + unlocks 2(+30) = 70
  // dependency: blocked_by empty = 100
  // effort: 70 * 1.0 (S) = 70
  // preference: created today(+20) + base(50) = 70
  //
  // To get impact=70 exactly, we omit milestone bonus and label bonus:
  // - _milestone is null (no milestone match)
  // - labels is empty (no label bonus)
  const task = makeTask({
    id: 'jade-cli/fix-node-build',
    status: 'pending',
    complexity: 'S',
    blocked_by: [],
    unlocks: ['jade-cli/add-task-create', 'jade-cli/add-index-query'],
    feature: {
      description: 'Working build pipeline for jade-cli',
      acceptance_criteria: [
        'npm run build exits 0',
        'tests pass',
        'built output works',
      ],
    },
    github_issue: 'jadecli/jade-cli#1',
    labels: [],
    created_at: new Date().toISOString(),
    _project: { name: 'jade-cli', status: 'near-buildable' },
    _projectName: 'jade-cli',
    _milestone: null,
  });
  const project = { name: 'jade-cli', status: 'near-buildable' };

  const score = scoreTask(task, project, [task]);
  // (80*0.20) + (70*0.30) + (100*0.20) + (70*0.15) + (70*0.15)
  // = 16 + 21 + 20 + 10.5 + 10.5 = 78.0
  assertClose(score, 78.0, 0.01, 'jade-cli/fix-node-build should score 78.0');
});

test('36. Example 2: jade-ide/research-vscode-api = 12.95', () => {
  // Design doc calculation at line 667:
  // maturity: blocked = 10
  // impact: no acceptance_criteria, feature.description (+10), no unlocks = 10
  // dependency: blocked_by external (not found) = 0
  // effort: 10 * 0.30 (XL) = 3
  // preference: default = 50 (old date, no focus)
  const task = makeTask({
    id: 'jade-ide/research-vscode-api',
    status: 'pending',
    complexity: 'XL',
    blocked_by: ['jade-ide/external-blocker'],
    unlocks: [],
    labels: [],
    feature: {
      description: 'Understanding VS Code extension API capabilities',
    },
    created_at: '2026-01-15T00:00:00Z',
    _project: { name: 'jade-ide', status: 'blocked' },
    _projectName: 'jade-ide',
    _milestone: null,
  });
  const project = { name: 'jade-ide', status: 'blocked' };
  // The blocker is NOT in allTasks, so dependency = 0
  const allTasks = [task];

  const score = scoreTask(task, project, allTasks);
  // (10*0.20) + (10*0.30) + (0*0.20) + (3*0.15) + (50*0.15)
  // = 2 + 3 + 0 + 0.45 + 7.5 = 12.95
  assertClose(
    score,
    12.95,
    0.01,
    'jade-ide/research-vscode-api should score 12.95'
  );
});

// ═══════════════════════════════════════════════════════════════════════
// 9. scoreTasks() BATCH FUNCTION
// ═══════════════════════════════════════════════════════════════════════

console.log('\n  scoreTasks() Batch Function\n');

test('37. scoreTasks returns sorted array with _score property', () => {
  const lowTask = makeTask({
    id: 'proj/low',
    status: 'pending',
    complexity: 'XL',
    blocked_by: ['proj/nonexistent'],
    _project: { name: 'proj', status: 'blocked' },
    _projectName: 'proj',
  });
  const highTask = makeTask({
    id: 'proj/high',
    status: 'pending',
    complexity: 'S',
    blocked_by: [],
    feature: { description: 'desc', acceptance_criteria: ['a'] },
    github_issue: 'repo#1',
    _project: { name: 'proj', status: 'buildable' },
    _projectName: 'proj',
  });
  const result = scoreTasks([lowTask, highTask]);
  assert(Array.isArray(result), 'Expected array');
  assert(result.length === 2, `Expected 2 tasks, got ${result.length}`);
  assert(typeof result[0]._score === 'number', '_score should be a number');
  assert(typeof result[1]._score === 'number', '_score should be a number');
  assert(
    result[0]._score >= result[1]._score,
    'Should be sorted descending by score'
  );
  assert(result[0].id === 'proj/high', 'Highest scoring task should be first');
});

test('38. scoreTasks filters out completed tasks by default', () => {
  const pending = makeTask({
    id: 'proj/pending',
    status: 'pending',
    _project: { name: 'proj', status: 'scaffolding' },
    _projectName: 'proj',
  });
  const completed = makeTask({
    id: 'proj/done',
    status: 'completed',
    _project: { name: 'proj', status: 'scaffolding' },
    _projectName: 'proj',
  });
  const result = scoreTasks([pending, completed]);
  assert(
    result.length === 1,
    `Expected 1 task after filtering, got ${result.length}`
  );
  assert(result[0].id === 'proj/pending', 'Should keep pending task');
});

test('39. scoreTasks filters out failed tasks by default', () => {
  const pending = makeTask({
    id: 'proj/pending',
    status: 'pending',
    _project: { name: 'proj', status: 'scaffolding' },
    _projectName: 'proj',
  });
  const failedTask = makeTask({
    id: 'proj/failed',
    status: 'failed',
    _project: { name: 'proj', status: 'scaffolding' },
    _projectName: 'proj',
  });
  const result = scoreTasks([pending, failedTask]);
  assert(
    result.length === 1,
    `Expected 1 task after filtering, got ${result.length}`
  );
  assert(result[0].id === 'proj/pending', 'Should keep pending task');
});

test('40. scoreTasks includeCompleted option keeps completed/failed tasks', () => {
  const pending = makeTask({
    id: 'proj/pending',
    status: 'pending',
    _project: { name: 'proj', status: 'scaffolding' },
    _projectName: 'proj',
  });
  const completed = makeTask({
    id: 'proj/done',
    status: 'completed',
    _project: { name: 'proj', status: 'scaffolding' },
    _projectName: 'proj',
  });
  const failedTask = makeTask({
    id: 'proj/failed',
    status: 'failed',
    _project: { name: 'proj', status: 'scaffolding' },
    _projectName: 'proj',
  });
  const result = scoreTasks([pending, completed, failedTask], {
    includeCompleted: true,
  });
  assert(
    result.length === 3,
    `Expected 3 tasks with includeCompleted, got ${result.length}`
  );
});

test('41. scoreTasks passes focusLabel option through to scoreTask', () => {
  const focused = makeTask({
    id: 'proj/focused',
    status: 'pending',
    labels: ['bugfix'],
    _project: { name: 'proj', status: 'scaffolding' },
    _projectName: 'proj',
  });
  const unfocused = makeTask({
    id: 'proj/unfocused',
    status: 'pending',
    labels: ['docs'],
    _project: { name: 'proj', status: 'scaffolding' },
    _projectName: 'proj',
  });
  const result = scoreTasks([unfocused, focused], { focusLabel: 'bugfix' });
  assert(
    result[0].id === 'proj/focused',
    'Task with matching focusLabel should rank higher'
  );
  assert(
    result[0]._score > result[1]._score,
    'Focused task should have higher score'
  );
});

test('42. scoreTasks handles empty array', () => {
  const result = scoreTasks([]);
  assert(Array.isArray(result), 'Expected array');
  assert(result.length === 0, `Expected 0 tasks, got ${result.length}`);
});

test('43. scoreTasks uses task._project for project lookup', () => {
  // scoreTasks should use the _project metadata attached by scanner
  const task = makeTask({
    id: 'my-proj/my-task',
    status: 'pending',
    _project: { name: 'my-proj', status: 'buildable' },
    _projectName: 'my-proj',
  });
  const result = scoreTasks([task]);
  assert(result.length === 1, 'Expected 1 task');
  // maturity=100 (buildable), impact=0, dep=100, effort=0, pref=50
  // = 20 + 0 + 20 + 0 + 7.5 = 47.5
  assertClose(
    result[0]._score,
    47.5,
    0.01,
    'Should use _project.status for maturity'
  );
});

// ═══════════════════════════════════════════════════════════════════════
// 10. EDGE CASES
// ═══════════════════════════════════════════════════════════════════════

console.log('\n  Edge Cases\n');

test('44. handles task with no feature property', () => {
  const task = makeTask({ feature: undefined });
  delete task.feature;
  const project = makeProject({ status: 'scaffolding' });
  const score = scoreTask(task, project, [task]);
  // impact = 0 (no feature at all)
  // = 8 + 0 + 20 + 0 + 7.5 = 35.5
  assertClose(score, 35.5, 0.01, 'missing feature property handled');
});

test('45. handles task with empty acceptance_criteria array', () => {
  const task = makeTask({
    feature: { acceptance_criteria: [] },
  });
  const project = makeProject({ status: 'scaffolding' });
  // Empty array is not non-empty, so no +20
  const score = scoreTask(task, project, [task]);
  assertClose(score, 35.5, 0.01, 'empty acceptance_criteria gives no bonus');
});

test('46. handles task with no labels property', () => {
  const task = makeTask({});
  delete task.labels;
  const project = makeProject({ status: 'scaffolding' });
  const score = scoreTask(task, project, [task]);
  assertClose(score, 35.5, 0.01, 'missing labels handled');
});

test('47. handles task with no created_at (no recency)', () => {
  const task = makeTask({});
  delete task.created_at;
  const project = makeProject({ status: 'scaffolding' });
  const score = scoreTask(task, project, [task]);
  // preference = 50 (no recency since no date)
  assertClose(score, 35.5, 0.01, 'missing created_at means no recency boost');
});

test('48. handles task with no complexity (defaults to S)', () => {
  const task = makeTask({
    feature: { description: 'desc', acceptance_criteria: ['a'] },
    github_issue: 'repo#1',
  });
  delete task.complexity;
  const project = makeProject({ status: 'scaffolding' });
  // impact=40, effort=40*1.0=40 (default S)
  // = (40*0.20) + (40*0.30) + (100*0.20) + (40*0.15) + (50*0.15)
  // = 8 + 12 + 20 + 6 + 7.5 = 53.5
  const score = scoreTask(task, project, [task]);
  assertClose(score, 53.5, 0.01, 'missing complexity defaults to S');
});

test('49. score is always between 0 and 100', () => {
  // Maximum possible score: all factors maxed
  const maxTask = makeTask({
    complexity: 'S',
    feature: {
      description: 'desc',
      acceptance_criteria: ['a'],
    },
    github_issue: 'repo#1',
    unlocks: ['a/t1', 'a/t2', 'a/t3'],
    labels: ['bugfix', 'test'],
    created_at: new Date().toISOString(),
    _milestone: null,
  });
  const maxProject = makeProject({ status: 'buildable' });
  const maxScore = scoreTask(maxTask, maxProject, [maxTask], {
    focusLabel: 'bugfix',
  });
  assert(maxScore <= 100, `Score ${maxScore} exceeds 100`);
  assert(maxScore >= 0, `Score ${maxScore} below 0`);

  // Minimum realistic score: blocked project, no features, blocked dependency
  const minTask = makeTask({
    complexity: 'XL',
    blocked_by: ['proj/nonexistent'],
    created_at: '2020-01-01T00:00:00Z',
  });
  const minProject = makeProject({ status: 'blocked' });
  const minScore = scoreTask(minTask, minProject, [minTask]);
  assert(minScore <= 100, `Score ${minScore} exceeds 100`);
  assert(minScore >= 0, `Score ${minScore} below 0`);
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
