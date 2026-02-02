#!/usr/bin/env node

/**
 * Test Runner for jade-dev-assist
 *
 * Auto-discovers all test-*.js files in the tests/ directory,
 * runs each via child_process.execSync, and prints a summary.
 *
 * Exit code 0 if all suites pass, 1 if any fail.
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const testsDir = __dirname;
const testFiles = fs.readdirSync(testsDir)
    .filter(f => f.startsWith('test-') && f.endsWith('.js') && f !== 'test-runner.js')
    .sort();

if (testFiles.length === 0) {
    console.log('No test files found.');
    process.exit(0);
}

console.log(`\nDiscovered ${testFiles.length} test suite(s):\n`);

const results = [];

for (const file of testFiles) {
    const filePath = path.join(testsDir, file);
    const label = file.replace(/\.js$/, '');

    process.stdout.write(`  Running ${label} ... `);

    try {
        const output = execSync(`node "${filePath}"`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 30000
        });
        console.log('PASS');
        results.push({ file, label, passed: true, output });
    } catch (err) {
        console.log('FAIL');
        results.push({
            file,
            label,
            passed: false,
            output: (err.stdout || '') + (err.stderr || '')
        });
    }
}

// Print summary
const passedSuites = results.filter(r => r.passed);
const failedSuites = results.filter(r => !r.passed);

console.log('\n' + '='.repeat(50));
console.log(`\n  Suites: ${passedSuites.length} passed, ${failedSuites.length} failed, ${results.length} total\n`);

if (failedSuites.length > 0) {
    console.log('  Failed suites:\n');
    for (const r of failedSuites) {
        console.log(`    - ${r.label}`);
        // Print last 20 lines of output for debugging
        const lines = r.output.trim().split('\n');
        const tail = lines.slice(-20);
        for (const line of tail) {
            console.log(`      ${line}`);
        }
        console.log('');
    }
    process.exit(1);
} else {
    console.log('  All suites passed.\n');
    process.exit(0);
}
