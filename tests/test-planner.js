#!/usr/bin/env node

/**
 * Planner Module Tests (lib/planner.js)
 *
 * Tests for /jade:plan command and workflow.
 * Based on Boris Cherny Tip #2: "Start in plan mode for complex tasks"
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
        console.log(`  ✓ ${name}`);
        passed++;
    } catch (err) {
        console.log(`  ✗ ${name}`);
        console.log(`    Error: ${err.message}`);
        if (err.stack) {
            console.log(`    ${err.stack.split('\n').slice(1, 3).join('\n    ')}`);
        }
        failed++;
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertIncludes(str, substring, message) {
    if (!str || !str.includes(substring)) {
        throw new Error(message || `Expected string to include "${substring}", got: ${str}`);
    }
}

function assertMatches(str, pattern, message) {
    if (!str || !pattern.test(str)) {
        throw new Error(message || `Expected string to match ${pattern}, got: ${str}`);
    }
}

// ── Import planner ───────────────────────────────────────────────────

let startPlanMode, reviewPlan, generatePlanningChecklist, verifyPlan, replan;
try {
    const planner = require('../lib/planner');
    startPlanMode = planner.startPlanMode;
    reviewPlan = planner.reviewPlan;
    generatePlanningChecklist = planner.generatePlanningChecklist;
    verifyPlan = planner.verifyPlan;
    replan = planner.replan;
} catch (err) {
    console.log('\n❌ Failed to load lib/planner.js');
    console.log(`   ${err.message}\n`);
    process.exit(1);
}

// ── Test Suite ───────────────────────────────────────────────────────

console.log('\nTesting lib/planner.js\n');

// ── 1. generatePlanningChecklist() ───────────────────────────────────

console.log('1. generatePlanningChecklist()');

test('returns planning checklist object', () => {
    const checklist = generatePlanningChecklist();
    assert(checklist !== null && typeof checklist === 'object', 'Should return an object');
    assert(Array.isArray(checklist.items), 'Should have items array');
    assert(checklist.items.length > 0, 'Should have at least one item');
});

test('checklist includes required planning steps', () => {
    const checklist = generatePlanningChecklist();
    const items = checklist.items.map(i => i.toLowerCase()).join(' ');

    assertIncludes(items, 'requirements', 'Should include requirements step');
    assertIncludes(items, 'constraints', 'Should include constraints step');
    assertIncludes(items, 'edge cases', 'Should include edge cases step');
    assertIncludes(items, 'success criteria', 'Should include success criteria step');
});

test('checklist includes task-specific context', () => {
    const taskDescription = 'Implement user authentication with OAuth2';
    const checklist = generatePlanningChecklist(taskDescription);

    assert(checklist.task === taskDescription, 'Should store task description');
    assert(checklist.items.length > 0, 'Should generate items');
});

test('checklist supports custom complexity levels', () => {
    const simpleTask = generatePlanningChecklist('Fix typo in README', 'S');
    const complexTask = generatePlanningChecklist('Refactor authentication system', 'XL');

    assert(simpleTask.complexity === 'S', 'Should store S complexity');
    assert(complexTask.complexity === 'XL', 'Should store XL complexity');

    // Complex tasks should have more checklist items
    assert(complexTask.items.length >= simpleTask.items.length,
        'Complex tasks should have at least as many items');
});

// ── 2. startPlanMode() ───────────────────────────────────────────────

console.log('\n2. startPlanMode()');

test('generates plan mode activation message', () => {
    const result = startPlanMode('Implement user authentication');

    assert(typeof result === 'object', 'Should return an object');
    assert(typeof result.message === 'string', 'Should have message property');
    assertIncludes(result.message, '🎯', 'Should include plan mode indicator');
    assertIncludes(result.message, 'Plan Mode', 'Should mention Plan Mode');
});

test('includes task description in plan mode', () => {
    const task = 'Implement OAuth2 authentication';
    const result = startPlanMode(task);

    assertIncludes(result.message, task, 'Should include task description');
});

test('includes planning checklist in output', () => {
    const result = startPlanMode('Refactor database layer');

    assertIncludes(result.message, 'requirements', 'Should include requirements step');
    assertIncludes(result.message, 'edge cases', 'Should include edge cases step');
    assertIncludes(result.message, 'success criteria', 'Should include success criteria');
});

test('includes Boris Cherny motivation quote', () => {
    const result = startPlanMode('Build new feature');

    assertIncludes(result.message, 'pour energy', 'Should include planning motivation');
    assertIncludes(result.message, '1-shot', 'Should mention 1-shot implementation');
});

test('includes plan mode toggle hint', () => {
    const result = startPlanMode('Implement API endpoint');

    assertIncludes(result.message, 'plan mode on', 'Should indicate plan mode is active');
});

test('supports optional complexity parameter', () => {
    const simpleResult = startPlanMode('Fix typo', 'S');
    const complexResult = startPlanMode('Refactor architecture', 'XL');

    assert(simpleResult.complexity === 'S', 'Should store S complexity');
    assert(complexResult.complexity === 'XL', 'Should store XL complexity');
});

// ── 3. reviewPlan() ──────────────────────────────────────────────────

console.log('\n3. reviewPlan()');

test('generates review mode instructions', () => {
    const plan = {
        task: 'Implement OAuth2',
        requirements: ['Support Google OAuth', 'Store refresh tokens'],
        approach: ['Add OAuth routes', 'Implement token storage']
    };

    const result = reviewPlan(plan);

    assert(typeof result === 'object', 'Should return an object');
    assert(typeof result.message === 'string', 'Should have message property');
    assertIncludes(result.message, 'Review', 'Should mention review');
});

test('includes review checklist', () => {
    const plan = { task: 'Refactor auth system' };
    const result = reviewPlan(plan);

    assertIncludes(result.message, 'Architecture', 'Should check architecture');
    assertIncludes(result.message, 'Edge cases', 'Should check edge cases');
    assertIncludes(result.message, 'feasibility', 'Should check feasibility');
});

test('includes plan details in review', () => {
    const plan = {
        task: 'Implement feature X',
        requirements: ['Req 1', 'Req 2']
    };
    const result = reviewPlan(plan);

    assertIncludes(result.message, 'Implement feature X', 'Should include task');
});

test('indicates spawning second Claude for review', () => {
    const plan = { task: 'Build API' };
    const result = reviewPlan(plan);

    assertIncludes(result.message, 'staff', 'Should mention staff-level review');
    assertIncludes(result.message, 'reviewer', 'Should mention reviewer');
});

test('generates staff engineer review prompt', () => {
    const plan = {
        task: 'Implement caching layer',
        requirements: ['Use Redis', 'Support TTL'],
        approach: ['Add Redis client', 'Implement cache wrapper']
    };

    const result = reviewPlan(plan);

    assert(result.reviewPrompt, 'Should include review prompt for subagent');
    assert(typeof result.reviewPrompt === 'string', 'Review prompt should be string');
    assertIncludes(result.reviewPrompt, 'staff engineer', 'Should position as staff engineer');
    assertIncludes(result.reviewPrompt, plan.task, 'Should include task in prompt');
});

test('review prompt uses extended thinking', () => {
    const plan = { task: 'Complex refactoring' };
    const result = reviewPlan(plan);

    assertIncludes(result.reviewPrompt, 'think', 'Should encourage thinking');
});

// ── 4. verifyPlan() ──────────────────────────────────────────────────

console.log('\n4. verifyPlan()');

test('generates verification plan mode message', () => {
    const result = verifyPlan();

    assert(typeof result === 'object', 'Should return an object');
    assert(typeof result.message === 'string', 'Should have message property');
    assertIncludes(result.message, 'Verification', 'Should mention verification');
});

test('includes verification checklist', () => {
    const result = verifyPlan();

    assertIncludes(result.message, 'tests', 'Should ask about tests');
    assertIncludes(result.message, 'edge cases', 'Should ask about edge cases');
    assertIncludes(result.message, 'regressions', 'Should ask about regressions');
    assertIncludes(result.message, 'metrics', 'Should ask about metrics');
});

test('supports task-specific verification', () => {
    const task = 'Implement OAuth2 authentication';
    const result = verifyPlan(task);

    assertIncludes(result.message, task, 'Should include task description');
});

test('verification includes plan mode indicator', () => {
    const result = verifyPlan();

    assertIncludes(result.message, '✅', 'Should include verification indicator');
});

// ── 5. replan() ──────────────────────────────────────────────────────

console.log('\n5. replan()');

test('generates replan mode message', () => {
    const result = replan('Tests failing after refactor');

    assert(typeof result === 'object', 'Should return an object');
    assert(typeof result.message === 'string', 'Should have message property');
    assertIncludes(result.message, 'Replan', 'Should mention replan');
});

test('includes what went wrong', () => {
    const issue = 'Database migration failed';
    const result = replan(issue);

    assertIncludes(result.message, issue, 'Should include the issue');
});

test('includes replan checklist', () => {
    const result = replan('Build failed');

    assertIncludes(result.message, 'Current state', 'Should analyze current state');
    assertIncludes(result.message, 'preserve', 'Should identify what to preserve');
    assertIncludes(result.message, 'change', 'Should identify what to change');
    assertIncludes(result.message, 'New plan', 'Should prompt for new plan');
});

test('includes Boris Cherny advice', () => {
    const result = replan('Something broke');

    assertIncludes(result.message, 'sideways', 'Should reference Boris Cherny advice');
});

test('replan message has urgency indicator', () => {
    const result = replan('Critical failure');

    assertIncludes(result.message, '🔄', 'Should include replan indicator');
});

// ── 6. Integration: Full planning workflow ───────────────────────────

console.log('\n6. Integration: Full planning workflow');

test('complete workflow: plan -> review -> verify', () => {
    // Step 1: Start planning
    const planStart = startPlanMode('Implement caching layer', 'M');
    assert(planStart.message, 'Should generate plan start message');
    assertIncludes(planStart.message, '🎯', 'Should activate plan mode');

    // Step 2: Create a plan (simulated)
    const plan = {
        task: 'Implement caching layer',
        complexity: 'M',
        requirements: ['Use Redis', 'Support TTL'],
        approach: ['Add Redis client', 'Implement cache wrapper'],
        files: ['lib/cache.js', 'tests/test-cache.js']
    };

    // Step 3: Review the plan
    const review = reviewPlan(plan);
    assert(review.message, 'Should generate review message');
    assert(review.reviewPrompt, 'Should generate review prompt');
    assertIncludes(review.reviewPrompt, 'staff engineer', 'Should use staff engineer perspective');

    // Step 4: Verify the plan
    const verify = verifyPlan(plan.task);
    assert(verify.message, 'Should generate verification message');
    assertIncludes(verify.message, '✅', 'Should activate verification mode');
});

test('workflow with failure: plan -> implement -> replan', () => {
    // Step 1: Start planning
    const planStart = startPlanMode('Refactor auth system', 'L');
    assert(planStart.message, 'Should start plan mode');

    // Step 2: Implementation fails (simulated)
    const issue = 'Tests failing after refactor - breaking changes in API';

    // Step 3: Replan
    const replanResult = replan(issue);
    assert(replanResult.message, 'Should generate replan message');
    assertIncludes(replanResult.message, issue, 'Should include failure reason');
    assertIncludes(replanResult.message, 'sideways', 'Should reference re-planning advice');
});

// ── 7. Edge cases and error handling ─────────────────────────────────

console.log('\n7. Edge cases and error handling');

test('handles empty task description gracefully', () => {
    const result = startPlanMode('');
    assert(result.message, 'Should still generate message');
    assertIncludes(result.message, 'Plan Mode', 'Should activate plan mode');
});

test('handles missing task in replan', () => {
    const result = replan();
    assert(result.message, 'Should generate message without issue');
    assertIncludes(result.message, 'Replan', 'Should activate replan mode');
});

test('handles minimal plan object in review', () => {
    const result = reviewPlan({ task: 'Simple task' });
    assert(result.message, 'Should handle minimal plan');
    assert(result.reviewPrompt, 'Should generate review prompt');
});

test('checklist generation handles null task', () => {
    const result = generatePlanningChecklist(null);
    assert(Array.isArray(result.items), 'Should return items array');
    assert(result.items.length > 0, 'Should have default items');
});

// ── Summary ──────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}\n`);

process.exit(failed > 0 ? 1 : 0);
