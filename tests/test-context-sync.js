#!/usr/bin/env node

/**
 * Context Sync Module Tests (lib/context-sync.js)
 *
 * Tests for multi-source context aggregation with MCP server integration.
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

function assertIncludes(str, substr, message) {
    if (!str.includes(substr)) {
        throw new Error(
            message || `Expected string to include "${substr}", got "${str}"`
        );
    }
}

// ── Import modules ─────────────────────────────────────────────────────

let contextSync;
try {
    contextSync = require('../lib/context-sync');
} catch (err) {
    console.log('\nFATAL: Could not load lib/context-sync.js');
    console.log(`  ${err.message}\n`);
    process.exit(1);
}

const {
    syncContext,
    parseOptions,
    filterByFocus,
    generateSummary,
    formatOutput
} = contextSync;

// ── Test Suite ────────────────────────────────────────────────────────

console.log('\nContext Sync Module Tests\n');

// -- parseOptions function --

console.log('parseOptions():');

test('parses default options', () => {
    const opts = parseOptions([]);
    assertEqual(opts.days, 7, 'default days should be 7');
    assertEqual(opts.sources.length, 4, 'should have 4 default sources');
    assert(opts.sources.includes('slack'), 'should include slack');
    assert(opts.sources.includes('github'), 'should include github');
    assert(opts.sources.includes('asana'), 'should include asana');
    assert(opts.sources.includes('gdrive'), 'should include gdrive');
    assertEqual(opts.output, null, 'default output should be null (stdout)');
    assertEqual(opts.focus, null, 'default focus should be null');
});

test('parses --days option', () => {
    const opts = parseOptions(['--days', '14']);
    assertEqual(opts.days, 14);
});

test('parses --sources option', () => {
    const opts = parseOptions(['--sources', 'slack,github']);
    assertEqual(opts.sources.length, 2);
    assert(opts.sources.includes('slack'));
    assert(opts.sources.includes('github'));
});

test('parses --output option', () => {
    const opts = parseOptions(['--output', 'context.md']);
    assertEqual(opts.output, 'context.md');
});

test('parses --focus option', () => {
    const opts = parseOptions(['--focus', 'authentication']);
    assertEqual(opts.focus, 'authentication');
});

test('handles invalid days value', () => {
    const opts = parseOptions(['--days', 'invalid']);
    assertEqual(opts.days, 7, 'should fallback to default 7 days');
});

// -- filterByFocus function --

console.log('\nfilterByFocus():');

test('returns all items when no focus is set', () => {
    const items = [
        { title: 'Auth refactor', body: 'OAuth implementation' },
        { title: 'UI update', body: 'New dashboard' }
    ];
    const filtered = filterByFocus(items, null);
    assertEqual(filtered.length, 2);
});

test('filters items by focus keyword in title', () => {
    const items = [
        { title: 'Auth refactor', body: 'OAuth implementation' },
        { title: 'UI update', body: 'New dashboard' },
        { title: 'Authentication bug', body: 'Token refresh issue' }
    ];
    const filtered = filterByFocus(items, 'auth');
    assertEqual(filtered.length, 2);
    assert(filtered.some(item => item.title.includes('Auth')));
    assert(filtered.some(item => item.title.includes('Authentication')));
});

test('filters items by focus keyword in body', () => {
    const items = [
        { title: 'PR #234', body: 'Implements OAuth2 authentication' },
        { title: 'PR #235', body: 'Updates UI components' }
    ];
    const filtered = filterByFocus(items, 'oauth');
    assertEqual(filtered.length, 1);
    assertEqual(filtered[0].title, 'PR #234');
});

test('filter is case insensitive', () => {
    const items = [
        { title: 'AUTH REFACTOR', body: 'oauth implementation' }
    ];
    const filtered = filterByFocus(items, 'AuTh');
    assertEqual(filtered.length, 1);
});

// -- formatOutput function --

console.log('\nformatOutput():');

test('generates markdown output with all sections', () => {
    const contextData = {
        summary: 'Test summary',
        slack: [
            { channel: '#engineering', message: 'Test message', timestamp: '2026-02-01' }
        ],
        github: [
            { type: 'PR', number: 234, title: 'Auth refactor', status: 'open' }
        ],
        asana: [
            { title: 'Implement OAuth', status: 'in_progress' }
        ],
        gdrive: [
            { title: 'Design Doc', modified: '2026-02-01' }
        ]
    };

    const output = formatOutput(contextData, {
        days: 7,
        sources: ['slack', 'github', 'asana', 'gdrive']
    });

    assertIncludes(output, '# Context Sync');
    assertIncludes(output, '## Executive Summary');
    assertIncludes(output, '## Slack');
    assertIncludes(output, '## GitHub');
    assertIncludes(output, '## Asana');
    assertIncludes(output, '## Google Drive');
});

test('handles empty data gracefully', () => {
    const contextData = {
        summary: 'No activity found',
        slack: [],
        github: [],
        asana: [],
        gdrive: []
    };

    const output = formatOutput(contextData, {
        days: 7,
        sources: ['slack', 'github', 'asana', 'gdrive']
    });

    assertIncludes(output, '# Context Sync');
    assertIncludes(output, 'No activity found');
});

test('omits sources not requested', () => {
    const contextData = {
        summary: 'Summary',
        slack: [{ message: 'test' }],
        github: []
    };

    const output = formatOutput(contextData, { days: 7, sources: ['slack'] });

    assertIncludes(output, '## Slack');
    assert(!output.includes('## GitHub'), 'should not include GitHub section');
});

// -- generateSummary function --

console.log('\ngenerateSummary():');

test('generates summary with key themes', () => {
    const contextData = {
        slack: [
            { message: 'Auth refactor discussion', channel: '#engineering' },
            { message: 'OAuth2 decision', channel: '#engineering' }
        ],
        github: [
            { type: 'PR', title: 'Auth refactor', status: 'open' }
        ]
    };

    const summary = generateSummary(contextData);

    assert(summary.length > 0, 'summary should not be empty');
    assert(typeof summary === 'string', 'summary should be a string');
});

test('handles empty context data', () => {
    const contextData = {
        slack: [],
        github: [],
        asana: [],
        gdrive: []
    };

    const summary = generateSummary(contextData);

    assertIncludes(summary.toLowerCase(), 'no activity');
});

// -- Integration tests --

console.log('\nIntegration:');

test('syncContext returns expected structure', async () => {
    // Mock MCP responses
    const mockMCP = {
        slack: async () => [],
        github: async () => [],
        asana: async () => [],
        gdrive: async () => []
    };

    const result = await syncContext({ days: 7 }, mockMCP);

    assert(result.summary !== undefined, 'result should have summary');
    assert(Array.isArray(result.slack), 'slack should be array');
    assert(Array.isArray(result.github), 'github should be array');
    assert(Array.isArray(result.asana), 'asana should be array');
    assert(Array.isArray(result.gdrive), 'gdrive should be array');
});

test('syncContext applies focus filter', async () => {
    const mockMCP = {
        slack: async () => [
            { message: 'Auth refactor', channel: '#eng' },
            { message: 'UI update', channel: '#eng' }
        ],
        github: async () => [],
        asana: async () => [],
        gdrive: async () => []
    };

    const result = await syncContext({ days: 7, focus: 'auth' }, mockMCP);

    assertEqual(result.slack.length, 1);
    assertIncludes(result.slack[0].message, 'Auth');
});

test('syncContext respects sources filter', async () => {
    const mockMCP = {
        slack: async () => [{ message: 'test' }],
        github: async () => [{ pr: 123 }],
        asana: async () => [],
        gdrive: async () => []
    };

    const result = await syncContext({ days: 7, sources: ['slack'] }, mockMCP);

    assert(result.slack.length > 0, 'slack should have data');
    assert(result.github === undefined, 'github should not be present (not requested)');
});

// ── Summary ───────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(50));
console.log(`\n  Tests: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
    process.exit(1);
}
