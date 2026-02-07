#!/usr/bin/env node

/**
 * Swarm Dispatcher Tests
 */

'use strict';

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
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

console.log('\n  Swarm Dispatcher Tests\n');

// Import module
let swarmDispatcher;
try {
  swarmDispatcher = require('../lib/swarm-dispatcher');
} catch (err) {
  console.log('\nFATAL: Could not load lib/swarm-dispatcher.js');
  console.log(`  ${err.message}\n`);
  process.exit(1);
}

test('swarmDispatcher exports expected functions', () => {
  assert(typeof swarmDispatcher.createSwarmSession === 'function');
  assert(typeof swarmDispatcher.dispatchAgent === 'function');
  assert(typeof swarmDispatcher.aggregateResults === 'function');
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`\n  Test Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  console.log('  Some tests failed\n');
  process.exit(1);
} else {
  console.log('  All tests passed\n');
  process.exit(0);
}
