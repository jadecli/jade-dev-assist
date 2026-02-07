#!/usr/bin/env node

/**
 * Health Checker Module Tests (lib/health-checker.js)
 *
 * Tests for infrastructure health aggregation functions.
 * Uses the same custom test framework as other test files.
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

// ── Import health-checker ────────────────────────────────────────────

let checkDockerServices,
  checkGpuAvailability,
  checkDatabaseConnectivity,
  checkDiskSpace,
  runHealthChecks,
  formatHealthReport;

try {
  const healthChecker = require('../lib/health-checker');
  checkDockerServices = healthChecker.checkDockerServices;
  checkGpuAvailability = healthChecker.checkGpuAvailability;
  checkDatabaseConnectivity = healthChecker.checkDatabaseConnectivity;
  checkDiskSpace = healthChecker.checkDiskSpace;
  runHealthChecks = healthChecker.runHealthChecks;
  formatHealthReport = healthChecker.formatHealthReport;
} catch (err) {
  console.log('\nFATAL: Could not load lib/health-checker.js');
  console.log(`  ${err.message}\n`);
  console.log('All tests will be marked as failed.\n');
  process.exit(1);
}

// ── Sync tests for module structure ──────────────────────────────────

console.log('\n  Module structure tests\n');

test('1. checkDockerServices is a function', () => {
  assert(typeof checkDockerServices === 'function', 'Expected function');
});

test('2. checkGpuAvailability is a function', () => {
  assert(typeof checkGpuAvailability === 'function', 'Expected function');
});

test('3. checkDatabaseConnectivity is a function', () => {
  assert(typeof checkDatabaseConnectivity === 'function', 'Expected function');
});

test('4. checkDiskSpace is a function', () => {
  assert(typeof checkDiskSpace === 'function', 'Expected function');
});

test('5. runHealthChecks is a function', () => {
  assert(typeof runHealthChecks === 'function', 'Expected function');
});

test('6. formatHealthReport is a function', () => {
  assert(typeof formatHealthReport === 'function', 'Expected function');
});

// ── formatHealthReport tests (sync) ──────────────────────────────────

console.log('\n  formatHealthReport tests\n');

test('7. formatHealthReport returns a string', () => {
  const healthData = {
    docker: { healthy: true, services: [] },
    gpu: { available: true, name: 'Test GPU' },
    databases: { postgresql: { connected: true }, mongodb: { connected: true }, dragonfly: { connected: true } },
    disk: { healthy: true, mounts: [] },
    timestamp: new Date().toISOString(),
    overallHealthy: true,
  };
  const report = formatHealthReport(healthData);
  assert(typeof report === 'string', 'Expected report to be a string');
  assert(report.length > 0, 'Expected non-empty report');
});

test('8. formatHealthReport includes status indicators', () => {
  const healthData = {
    docker: { healthy: true, services: [{ name: 'postgres', status: 'running' }] },
    gpu: { available: true, name: 'RTX 2080 Ti' },
    databases: { postgresql: { connected: true }, mongodb: { connected: false }, dragonfly: { connected: true } },
    disk: { healthy: true, mounts: [{ path: '/', total: 1000000000, used: 500000000, percent: 50 }] },
    timestamp: new Date().toISOString(),
    overallHealthy: false,
  };
  const report = formatHealthReport(healthData);
  assert(report.includes('Docker'), 'Expected Docker section in report');
  assert(report.includes('GPU'), 'Expected GPU section in report');
  assert(report.includes('Database'), 'Expected Database section in report');
  assert(report.includes('Disk'), 'Expected Disk section in report');
});

test('9. formatHealthReport handles null values', () => {
  const healthData = {
    docker: null,
    gpu: null,
    databases: null,
    disk: null,
    timestamp: new Date().toISOString(),
    overallHealthy: true,
  };
  const report = formatHealthReport(healthData);
  assert(typeof report === 'string', 'Expected report to be a string');
  assert(report.includes('Skipped'), 'Expected Skipped indicators');
});

test('10. formatHealthReport handles skipped checks', () => {
  const healthData = {
    docker: { skipped: true },
    gpu: { skipped: true },
    databases: null,
    disk: { skipped: true },
    timestamp: new Date().toISOString(),
    overallHealthy: true,
  };
  const report = formatHealthReport(healthData);
  assert(typeof report === 'string', 'Expected report to be a string');
});

// ── Async tests ──────────────────────────────────────────────────────

async function runAsyncTests() {
  console.log('\n  Async health check tests\n');

  // Test checkDockerServices
  try {
    const result = await checkDockerServices();
    assert(typeof result === 'object', 'Expected result to be an object');
    assert(typeof result.healthy === 'boolean', 'Expected healthy to be boolean');
    assert(Array.isArray(result.services), 'Expected services to be an array');
    console.log('  \u2713 11. checkDockerServices returns expected structure');
    passed++;
  } catch (err) {
    console.log(`  \u2717 11. checkDockerServices returns expected structure`);
    console.log(`    Error: ${err.message}`);
    failed++;
  }

  // Test checkGpuAvailability
  try {
    const result = await checkGpuAvailability();
    assert(typeof result === 'object', 'Expected result to be an object');
    assert(typeof result.available === 'boolean', 'Expected available to be boolean');
    console.log('  \u2713 12. checkGpuAvailability returns expected structure');
    passed++;
  } catch (err) {
    console.log(`  \u2717 12. checkGpuAvailability returns expected structure`);
    console.log(`    Error: ${err.message}`);
    failed++;
  }

  // Test checkDatabaseConnectivity
  try {
    const result = await checkDatabaseConnectivity();
    assert(typeof result === 'object', 'Expected result to be an object');
    assert(typeof result.postgresql === 'object', 'Expected postgresql to be object');
    assert(typeof result.mongodb === 'object', 'Expected mongodb to be object');
    assert(typeof result.dragonfly === 'object', 'Expected dragonfly to be object');
    console.log('  \u2713 13. checkDatabaseConnectivity returns expected structure');
    passed++;
  } catch (err) {
    console.log(`  \u2717 13. checkDatabaseConnectivity returns expected structure`);
    console.log(`    Error: ${err.message}`);
    failed++;
  }

  // Test checkDiskSpace
  try {
    const result = await checkDiskSpace();
    assert(typeof result === 'object', 'Expected result to be an object');
    assert(typeof result.healthy === 'boolean', 'Expected healthy to be boolean');
    assert(Array.isArray(result.mounts), 'Expected mounts to be an array');
    console.log('  \u2713 14. checkDiskSpace returns expected structure');
    passed++;
  } catch (err) {
    console.log(`  \u2717 14. checkDiskSpace returns expected structure`);
    console.log(`    Error: ${err.message}`);
    failed++;
  }

  // Test checkDiskSpace threshold
  try {
    const result = await checkDiskSpace({ threshold: 100 });
    assert(result.healthy === true, 'Expected healthy to be true with 100% threshold');
    console.log('  \u2713 15. checkDiskSpace respects threshold');
    passed++;
  } catch (err) {
    console.log(`  \u2717 15. checkDiskSpace respects threshold`);
    console.log(`    Error: ${err.message}`);
    failed++;
  }

  // Test runHealthChecks
  try {
    const result = await runHealthChecks();
    assert(typeof result === 'object', 'Expected result to be an object');
    assert(typeof result.timestamp === 'string', 'Expected timestamp in result');
    assert(typeof result.overallHealthy === 'boolean', 'Expected overallHealthy in result');
    console.log('  \u2713 16. runHealthChecks returns aggregated results');
    passed++;
  } catch (err) {
    console.log(`  \u2717 16. runHealthChecks returns aggregated results`);
    console.log(`    Error: ${err.message}`);
    failed++;
  }

  // Test runHealthChecks with skip options
  try {
    const result = await runHealthChecks({ skipGpu: true, skipDocker: true });
    assert(result.gpu === null, 'Expected gpu to be null when skipped');
    assert(result.docker === null, 'Expected docker to be null when skipped');
    console.log('  \u2713 17. runHealthChecks accepts skip options');
    passed++;
  } catch (err) {
    console.log(`  \u2717 17. runHealthChecks accepts skip options`);
    console.log(`    Error: ${err.message}`);
    failed++;
  }

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
}

runAsyncTests().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
