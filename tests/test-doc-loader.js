#!/usr/bin/env node

/**
 * Doc Loader Module Tests (lib/doc-loader.js)
 *
 * Tests for documentation loading, searching, and caching.
 * Uses custom test framework matching other tests in the suite.
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
        throw new Error(`${message || 'Assertion failed'}: expected ${expected}, got ${actual}`);
    }
}

function assertIncludes(haystack, needle, message) {
    if (!haystack.includes(needle)) {
        throw new Error(`${message || 'Assertion failed'}: "${needle}" not found in "${haystack}"`);
    }
}

function assertArrayIncludes(array, item, message) {
    if (!array.includes(item)) {
        throw new Error(`${message || 'Assertion failed'}: item not found in array`);
    }
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Creates a temporary doc directory structure for testing.
 * Returns { tmpdir, docsRoot, cleanup }.
 */
function createTestDocsEnv() {
    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'jade-doc-loader-test-'));
    const docsRoot = path.join(tmpdir, 'docs');

    // Create directory structure
    fs.mkdirSync(path.join(docsRoot, 'generated', 'summaries'), { recursive: true });
    fs.mkdirSync(path.join(docsRoot, 'uv', 'guides'), { recursive: true });
    fs.mkdirSync(path.join(docsRoot, 'ruff', 'guides'), { recursive: true });

    // Create sample summary files
    fs.writeFileSync(
        path.join(docsRoot, 'generated', 'summaries', 'uv.json'),
        JSON.stringify({
            title: 'uv Package Manager',
            description: 'Fast Python package installer and resolver',
            keywords: ['python', 'package', 'pip', 'installer'],
            summary: 'uv is a blazingly fast Python package installer written in Rust.'
        }, null, 2)
    );

    fs.writeFileSync(
        path.join(docsRoot, 'generated', 'summaries', 'ruff.json'),
        JSON.stringify({
            title: 'ruff Linter',
            description: 'Fast Python linter written in Rust',
            keywords: ['python', 'linter', 'style', 'lint'],
            summary: 'ruff is an extremely fast Python linter and code formatter.'
        }, null, 2)
    );

    // Create a guide file for fallback
    fs.writeFileSync(
        path.join(docsRoot, 'uv', 'guides', 'getting-started.md'),
        '# Getting Started with uv\n\nInstall with `pip install uv`'
    );

    return {
        tmpdir,
        docsRoot,
        cleanup: () => {
            fs.rmSync(tmpdir, { recursive: true, force: true });
        }
    };
}

// ── Tests ────────────────────────────────────────────────────────────

console.log('\nDocLoader Module Tests\n');

// Test 1: Module loads without errors
test('Module exports DocLoader class', () => {
    delete require.cache[require.resolve('../lib/doc-loader')];
    const DocLoader = require('../lib/doc-loader');
    assert(typeof DocLoader === 'function', 'DocLoader should be a function');
});

// Test 2: Constructor initializes with docs root
test('Constructor initializes with docs root', () => {
    delete require.cache[require.resolve('../lib/doc-loader')];
    const DocLoader = require('../lib/doc-loader');
    const env = createTestDocsEnv();
    try {
        const loader = new DocLoader(env.docsRoot);
        assert(loader !== null, 'Constructor should create instance');
        assert(loader.docsRoot === env.docsRoot, 'docsRoot should be set');
    } finally {
        env.cleanup();
    }
});

// Test 3: Loads summary from JSON file
test('Loads summary from JSON file', () => {
    delete require.cache[require.resolve('../lib/doc-loader')];
    const DocLoader = require('../lib/doc-loader');
    const env = createTestDocsEnv();
    try {
        const loader = new DocLoader(env.docsRoot);
        const summary = loader.loadSummary('uv');

        assert(summary !== null, 'Should load summary');
        assertEqual(summary.title, 'uv Package Manager', 'Title should match');
        assertArrayIncludes(summary.keywords, 'python', 'Should have python keyword');
    } finally {
        env.cleanup();
    }
});

// Test 4: Returns null for missing summary
test('Returns null for missing summary', () => {
    delete require.cache[require.resolve('../lib/doc-loader')];
    const DocLoader = require('../lib/doc-loader');
    const env = createTestDocsEnv();
    try {
        const loader = new DocLoader(env.docsRoot);
        const summary = loader.loadSummary('nonexistent');
        assert(summary === null, 'Should return null for missing summary');
    } finally {
        env.cleanup();
    }
});

// Test 5: Caches loaded summaries
test('Caches loaded summaries for performance', () => {
    delete require.cache[require.resolve('../lib/doc-loader')];
    const DocLoader = require('../lib/doc-loader');
    const env = createTestDocsEnv();
    try {
        const loader = new DocLoader(env.docsRoot);

        // First load
        const summary1 = loader.loadSummary('uv');
        // Second load (from cache)
        const summary2 = loader.loadSummary('uv');

        // Should be same object (cached)
        assert(summary1 === summary2, 'Should return cached instance');
    } finally {
        env.cleanup();
    }
});

// Test 6: Searches summaries by keyword
test('Searches summaries by keyword', () => {
    delete require.cache[require.resolve('../lib/doc-loader')];
    const DocLoader = require('../lib/doc-loader');
    const env = createTestDocsEnv();
    try {
        const loader = new DocLoader(env.docsRoot);
        const results = loader.search('python');

        assert(Array.isArray(results), 'Should return array');
        assert(results.length > 0, 'Should find results');
        assertArrayIncludes(results.map(r => r.title), 'uv Package Manager', 'Should find uv');
        assertArrayIncludes(results.map(r => r.title), 'ruff Linter', 'Should find ruff');
    } finally {
        env.cleanup();
    }
});

// Test 7: Searches in summary content
test('Searches in summary content and description', () => {
    delete require.cache[require.resolve('../lib/doc-loader')];
    const DocLoader = require('../lib/doc-loader');
    const env = createTestDocsEnv();
    try {
        const loader = new DocLoader(env.docsRoot);
        const results = loader.search('blazingly');

        assert(results.length > 0, 'Should find matches in summary text');
        assertEqual(results[0].title, 'uv Package Manager', 'Should match uv');
    } finally {
        env.cleanup();
    }
});

// Test 8: Case-insensitive search
test('Search is case-insensitive', () => {
    delete require.cache[require.resolve('../lib/doc-loader')];
    const DocLoader = require('../lib/doc-loader');
    const env = createTestDocsEnv();
    try {
        const loader = new DocLoader(env.docsRoot);
        const resultsLower = loader.search('linter');
        const resultsUpper = loader.search('LINTER');
        const resultsMixed = loader.search('LiNtEr');

        assert(resultsLower.length > 0, 'Should find lowercase');
        assertEqual(resultsUpper.length, resultsLower.length, 'Case should not matter');
        assertEqual(resultsMixed.length, resultsLower.length, 'Mixed case should work');
    } finally {
        env.cleanup();
    }
});

// Test 9: Returns empty array for no matches
test('Returns empty array when no matches found', () => {
    delete require.cache[require.resolve('../lib/doc-loader')];
    const DocLoader = require('../lib/doc-loader');
    const env = createTestDocsEnv();
    try {
        const loader = new DocLoader(env.docsRoot);
        const results = loader.search('nonexistentterm');

        assert(Array.isArray(results), 'Should return array');
        assertEqual(results.length, 0, 'Should be empty array');
    } finally {
        env.cleanup();
    }
});

// Test 10: Lists all available summaries
test('Lists all available summaries', () => {
    delete require.cache[require.resolve('../lib/doc-loader')];
    const DocLoader = require('../lib/doc-loader');
    const env = createTestDocsEnv();
    try {
        const loader = new DocLoader(env.docsRoot);
        const summaries = loader.listSummaries();

        assert(Array.isArray(summaries), 'Should return array');
        assert(summaries.length >= 2, 'Should find uv and ruff');
        const titles = summaries.map(s => s.title);
        assertArrayIncludes(titles, 'uv Package Manager', 'Should include uv');
        assertArrayIncludes(titles, 'ruff Linter', 'Should include ruff');
    } finally {
        env.cleanup();
    }
});

// Test 11: Gets cache statistics
test('Provides cache statistics', () => {
    delete require.cache[require.resolve('../lib/doc-loader')];
    const DocLoader = require('../lib/doc-loader');
    const env = createTestDocsEnv();
    try {
        const loader = new DocLoader(env.docsRoot);

        // Load some docs
        loader.loadSummary('uv');
        loader.loadSummary('ruff');
        loader.loadSummary('uv'); // Cache hit

        const stats = loader.getCacheStats();
        assert(stats !== null, 'Should return stats object');
        assertEqual(stats.cached, 2, 'Should have 2 items cached');
        assert(stats.hits >= 1, 'Should have at least 1 cache hit');
    } finally {
        env.cleanup();
    }
});

// Test 12: Clears cache
test('Clears cache when requested', () => {
    delete require.cache[require.resolve('../lib/doc-loader')];
    const DocLoader = require('../lib/doc-loader');
    const env = createTestDocsEnv();
    try {
        const loader = new DocLoader(env.docsRoot);

        // Load a doc
        loader.loadSummary('uv');
        let stats = loader.getCacheStats();
        assert(stats.cached === 1, 'Should have 1 item cached');

        // Clear cache
        loader.clearCache();
        stats = loader.getCacheStats();
        assertEqual(stats.cached, 0, 'Cache should be empty after clear');
    } finally {
        env.cleanup();
    }
});

// Test 13: Estimates token usage
test('Estimates token usage for content', () => {
    delete require.cache[require.resolve('../lib/doc-loader')];
    const DocLoader = require('../lib/doc-loader');
    const env = createTestDocsEnv();
    try {
        const loader = new DocLoader(env.docsRoot);
        const summary = loader.loadSummary('uv');
        const tokens = loader.estimateTokens(summary);

        assert(typeof tokens === 'number', 'Should return number');
        assert(tokens > 0, 'Should estimate positive tokens');
    } finally {
        env.cleanup();
    }
});

// Test 14: Handles malformed JSON gracefully
test('Handles malformed JSON gracefully', () => {
    delete require.cache[require.resolve('../lib/doc-loader')];
    const DocLoader = require('../lib/doc-loader');
    const env = createTestDocsEnv();
    try {
        // Create malformed JSON file
        fs.writeFileSync(
            path.join(env.docsRoot, 'generated', 'summaries', 'broken.json'),
            '{ invalid json'
        );

        const loader = new DocLoader(env.docsRoot);
        const summary = loader.loadSummary('broken');
        assert(summary === null, 'Should return null for malformed JSON');
    } finally {
        env.cleanup();
    }
});

// Test 15: Returns summary metadata
test('Returns summary with complete metadata', () => {
    delete require.cache[require.resolve('../lib/doc-loader')];
    const DocLoader = require('../lib/doc-loader');
    const env = createTestDocsEnv();
    try {
        const loader = new DocLoader(env.docsRoot);
        const summary = loader.loadSummary('uv');

        assert(summary.title !== undefined, 'Should have title');
        assert(summary.description !== undefined, 'Should have description');
        assert(summary.keywords !== undefined, 'Should have keywords');
        assert(summary.summary !== undefined, 'Should have summary text');
    } finally {
        env.cleanup();
    }
});

// ── Summary ──────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
