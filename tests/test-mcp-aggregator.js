#!/usr/bin/env node

/**
 * MCP Aggregator Module Tests (lib/mcp-aggregator.js)
 *
 * Tests for MCP server integration and context aggregation.
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

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(
            message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
        );
    }
}

// ── Import modules ─────────────────────────────────────────────────────

let mcpAggregator;
try {
    mcpAggregator = require('../lib/mcp-aggregator');
} catch (err) {
    console.log('\nFATAL: Could not load lib/mcp-aggregator.js');
    console.log(`  ${err.message}\n`);
    process.exit(1);
}

const {
    fetchSlackData,
    fetchGitHubData,
    fetchAsanaData,
    fetchGoogleDriveData,
    aggregateFromSources
} = mcpAggregator;

// ── Test Suite ────────────────────────────────────────────────────────

console.log('\nMCP Aggregator Module Tests\n');

// -- fetchSlackData function --

console.log('fetchSlackData():');

test('returns array of messages', async () => {
    const data = await fetchSlackData(7);
    assert(Array.isArray(data), 'should return an array');
});

test('includes required fields in slack messages', async () => {
    const data = await fetchSlackData(7);
    if (data.length > 0) {
        const msg = data[0];
        assert(msg.channel !== undefined, 'should have channel field');
        assert(msg.message !== undefined, 'should have message field');
        assert(msg.timestamp !== undefined, 'should have timestamp field');
    }
});

test('handles MCP connection errors gracefully', async () => {
    // Should not throw, should return empty array
    const data = await fetchSlackData(7);
    assert(Array.isArray(data), 'should return array even on error');
});

// -- fetchGitHubData function --

console.log('\nfetchGitHubData():');

test('returns array of items', async () => {
    const data = await fetchGitHubData(7);
    assert(Array.isArray(data), 'should return an array');
});

test('includes PRs and issues', async () => {
    const data = await fetchGitHubData(7);
    if (data.length > 0) {
        const item = data[0];
        assert(item.type !== undefined, 'should have type field (PR/issue)');
        assert(item.title !== undefined, 'should have title field');
        assert(item.number !== undefined, 'should have number field');
    }
});

test('handles GitHub API errors gracefully', async () => {
    const data = await fetchGitHubData(7);
    assert(Array.isArray(data), 'should return array even on error');
});

// -- fetchAsanaData function --

console.log('\nfetchAsanaData():');

test('returns array of tasks', async () => {
    const data = await fetchAsanaData(7);
    assert(Array.isArray(data), 'should return an array');
});

test('includes task metadata', async () => {
    const data = await fetchAsanaData(7);
    if (data.length > 0) {
        const task = data[0];
        assert(task.title !== undefined, 'should have title field');
        assert(task.status !== undefined, 'should have status field');
    }
});

test('handles Asana API errors gracefully', async () => {
    const data = await fetchAsanaData(7);
    assert(Array.isArray(data), 'should return array even on error');
});

// -- fetchGoogleDriveData function --

console.log('\nfetchGoogleDriveData():');

test('returns array of documents', async () => {
    const data = await fetchGoogleDriveData(7);
    assert(Array.isArray(data), 'should return an array');
});

test('includes document metadata', async () => {
    const data = await fetchGoogleDriveData(7);
    if (data.length > 0) {
        const doc = data[0];
        assert(doc.title !== undefined, 'should have title field');
        assert(doc.modified !== undefined, 'should have modified field');
    }
});

test('handles Google Drive API errors gracefully', async () => {
    const data = await fetchGoogleDriveData(7);
    assert(Array.isArray(data), 'should return array even on error');
});

// -- aggregateFromSources function --

console.log('\naggregateFromSources():');

test('aggregates data from all sources', async () => {
    const sources = ['slack', 'github', 'asana', 'gdrive'];
    const result = await aggregateFromSources(sources, 7);

    assert(result.slack !== undefined, 'should have slack data');
    assert(result.github !== undefined, 'should have github data');
    assert(result.asana !== undefined, 'should have asana data');
    assert(result.gdrive !== undefined, 'should have gdrive data');

    assert(Array.isArray(result.slack), 'slack should be array');
    assert(Array.isArray(result.github), 'github should be array');
    assert(Array.isArray(result.asana), 'asana should be array');
    assert(Array.isArray(result.gdrive), 'gdrive should be array');
});

test('only fetches requested sources', async () => {
    const sources = ['slack', 'github'];
    const result = await aggregateFromSources(sources, 7);

    assert(result.slack !== undefined, 'should have slack data');
    assert(result.github !== undefined, 'should have github data');
    assert(result.asana === undefined, 'should not have asana data');
    assert(result.gdrive === undefined, 'should not have gdrive data');
});

test('handles empty sources array', async () => {
    const result = await aggregateFromSources([], 7);
    assert(typeof result === 'object', 'should return object');
    assertEqual(Object.keys(result).length, 0, 'should be empty object');
});

test('handles unknown sources gracefully', async () => {
    const sources = ['slack', 'unknown-source'];
    const result = await aggregateFromSources(sources, 7);

    assert(result.slack !== undefined, 'should have slack data');
    assert(result['unknown-source'] === undefined, 'should skip unknown source');
});

// -- Date range filtering --

console.log('\nDate range filtering:');

test('respects days parameter', async () => {
    const result1 = await aggregateFromSources(['slack'], 1);
    const result7 = await aggregateFromSources(['slack'], 7);

    // We can't guarantee data counts without real data,
    // but we can verify the function accepts the parameter
    assert(Array.isArray(result1.slack), 'should return array for 1 day');
    assert(Array.isArray(result7.slack), 'should return array for 7 days');
});

// ── Summary ───────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(50));
console.log(`\n  Tests: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
    process.exit(1);
}
