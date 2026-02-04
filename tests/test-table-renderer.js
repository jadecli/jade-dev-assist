#!/usr/bin/env node

/**
 * Table Renderer Module Tests (lib/table-renderer.js)
 *
 * Tests for shared table rendering utilities used by presenter.js
 * and milestone-tracker.js. Tests cover box-drawing characters,
 * string formatting (truncate, pad), and table building (rules, rows).
 *
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

// ── Import table-renderer ────────────────────────────────────────────

let BOX, truncate, padRight, padLeft, horizontalRule, dataRow;
try {
    const renderer = require('../lib/table-renderer');
    BOX = renderer.BOX;
    truncate = renderer.truncate;
    padRight = renderer.padRight;
    padLeft = renderer.padLeft;
    horizontalRule = renderer.horizontalRule;
    dataRow = renderer.dataRow;
} catch (err) {
    console.log('\nFATAL: Could not load lib/table-renderer.js');
    console.log(`  ${err.message}\n`);
    console.log('All tests will be marked as failed.\n');
    process.exit(1);
}

// ═════════════════════════════════════════════════════════════════════
// TESTS
// ═════════════════════════════════════════════════════════════════════

console.log('\n  BOX characters tests\n');

// 1. BOX object exports all required characters
test('1. BOX object exports all required characters', () => {
    const requiredKeys = [
        'topLeft', 'topRight', 'bottomLeft', 'bottomRight',
        'horizontal', 'vertical', 'topTee', 'bottomTee',
        'leftTee', 'rightTee', 'cross'
    ];

    for (const key of requiredKeys) {
        assert(key in BOX, `BOX.${key} should be defined`);
        assert(typeof BOX[key] === 'string', `BOX.${key} should be a string`);
        assert(BOX[key].length === 1, `BOX.${key} should be a single character`);
    }
});

// 2. BOX characters are correct Unicode values
test('2. BOX characters are correct Unicode values', () => {
    assert(BOX.topLeft === '\u250c', 'topLeft should be ┌');
    assert(BOX.topRight === '\u2510', 'topRight should be ┐');
    assert(BOX.bottomLeft === '\u2514', 'bottomLeft should be └');
    assert(BOX.bottomRight === '\u2518', 'bottomRight should be ┘');
    assert(BOX.horizontal === '\u2500', 'horizontal should be ─');
    assert(BOX.vertical === '\u2502', 'vertical should be │');
    assert(BOX.topTee === '\u252c', 'topTee should be ┬');
    assert(BOX.bottomTee === '\u2534', 'bottomTee should be ┴');
    assert(BOX.leftTee === '\u251c', 'leftTee should be ├');
    assert(BOX.rightTee === '\u2524', 'rightTee should be ┤');
    assert(BOX.cross === '\u253c', 'cross should be ┼');
});

console.log('\n  truncate() tests\n');

// 3. truncate() returns unchanged string when under maxLen
test('3. truncate() returns unchanged string when under maxLen', () => {
    const result = truncate('hello', 10);
    assert(result === 'hello', `Expected "hello", got "${result}"`);
});

// 4. truncate() returns unchanged string when exactly maxLen
test('4. truncate() returns unchanged string when exactly maxLen', () => {
    const result = truncate('hello', 5);
    assert(result === 'hello', `Expected "hello", got "${result}"`);
});

// 5. truncate() truncates string with ellipsis when over maxLen
test('5. truncate() truncates string with ellipsis when over maxLen', () => {
    const result = truncate('hello world', 8);
    assert(result === 'hello w\u2026', `Expected "hello w…", got "${result}"`);
    assert(result.length === 8, `Expected length 8, got ${result.length}`);
});

// 6. truncate() handles empty string
test('6. truncate() handles empty string', () => {
    const result = truncate('', 5);
    assert(result === '', `Expected "", got "${result}"`);
});

// 7. truncate() handles single character truncation
test('7. truncate() handles single character truncation', () => {
    const result = truncate('hello', 1);
    assert(result === '\u2026', `Expected "…", got "${result}"`);
    assert(result.length === 1, `Expected length 1, got ${result.length}`);
});

console.log('\n  padRight() tests\n');

// 8. padRight() pads short string with spaces
test('8. padRight() pads short string with spaces', () => {
    const result = padRight('hi', 5);
    assert(result === 'hi   ', `Expected "hi   ", got "${result}"`);
    assert(result.length === 5, `Expected length 5, got ${result.length}`);
});

// 9. padRight() returns unchanged string when exactly width
test('9. padRight() returns unchanged string when exactly width', () => {
    const result = padRight('hello', 5);
    assert(result === 'hello', `Expected "hello", got "${result}"`);
    assert(result.length === 5, `Expected length 5, got ${result.length}`);
});

// 10. padRight() truncates long string with ellipsis
test('10. padRight() truncates long string with ellipsis', () => {
    const result = padRight('hello world', 8);
    assert(result === 'hello w\u2026', `Expected "hello w…", got "${result}"`);
    assert(result.length === 8, `Expected length 8, got ${result.length}`);
});

// 11. padRight() handles empty string
test('11. padRight() handles empty string', () => {
    const result = padRight('', 3);
    assert(result === '   ', `Expected "   ", got "${result}"`);
    assert(result.length === 3, `Expected length 3, got ${result.length}`);
});

console.log('\n  padLeft() tests\n');

// 12. padLeft() pads short string with spaces on left
test('12. padLeft() pads short string with spaces on left', () => {
    const result = padLeft('42', 5);
    assert(result === '   42', `Expected "   42", got "${result}"`);
    assert(result.length === 5, `Expected length 5, got ${result.length}`);
});

// 13. padLeft() returns unchanged string when exactly width
test('13. padLeft() returns unchanged string when exactly width', () => {
    const result = padLeft('hello', 5);
    assert(result === 'hello', `Expected "hello", got "${result}"`);
    assert(result.length === 5, `Expected length 5, got ${result.length}`);
});

// 14. padLeft() truncates long string with ellipsis
test('14. padLeft() truncates long string with ellipsis', () => {
    const result = padLeft('hello world', 8);
    assert(result === 'hello w\u2026', `Expected "hello w…", got "${result}"`);
    assert(result.length === 8, `Expected length 8, got ${result.length}`);
});

// 15. padLeft() handles empty string
test('15. padLeft() handles empty string', () => {
    const result = padLeft('', 3);
    assert(result === '   ', `Expected "   ", got "${result}"`);
    assert(result.length === 3, `Expected length 3, got ${result.length}`);
});

console.log('\n  horizontalRule() tests\n');

// 16. horizontalRule() builds rule with single column
test('16. horizontalRule() builds rule with single column', () => {
    const result = horizontalRule(BOX.topLeft, BOX.topTee, BOX.topRight, [10]);
    assert(result === '\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510',
        `Expected "┌──────────┐", got "${result}"`);
});

// 17. horizontalRule() builds rule with multiple columns
test('17. horizontalRule() builds rule with multiple columns', () => {
    const result = horizontalRule(BOX.topLeft, BOX.topTee, BOX.topRight, [5, 8, 6]);
    const expected = '\u250c\u2500\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2500\u2510';
    assert(result === expected, `Expected correct top border, got "${result}"`);
    assert(result.includes(BOX.topLeft), 'Should include topLeft corner');
    assert(result.includes(BOX.topTee), 'Should include topTee junctions');
    assert(result.includes(BOX.topRight), 'Should include topRight corner');
});

// 18. horizontalRule() builds middle separator
test('18. horizontalRule() builds middle separator', () => {
    const result = horizontalRule(BOX.leftTee, BOX.cross, BOX.rightTee, [5, 5]);
    assert(result.startsWith(BOX.leftTee), 'Should start with leftTee');
    assert(result.includes(BOX.cross), 'Should include cross junction');
    assert(result.endsWith(BOX.rightTee), 'Should end with rightTee');
});

// 19. horizontalRule() builds bottom border
test('19. horizontalRule() builds bottom border', () => {
    const result = horizontalRule(BOX.bottomLeft, BOX.bottomTee, BOX.bottomRight, [5, 5]);
    assert(result.startsWith(BOX.bottomLeft), 'Should start with bottomLeft');
    assert(result.includes(BOX.bottomTee), 'Should include bottomTee');
    assert(result.endsWith(BOX.bottomRight), 'Should end with bottomRight');
});

// 20. horizontalRule() throws on empty columnWidths
test('20. horizontalRule() throws on empty columnWidths', () => {
    let threw = false;
    try {
        horizontalRule(BOX.topLeft, BOX.topTee, BOX.topRight, []);
    } catch (err) {
        threw = true;
        assert(err.message.includes('non-empty'), 'Error message should mention non-empty requirement');
    }
    assert(threw, 'Should throw on empty columnWidths array');
});

// 21. horizontalRule() throws on null columnWidths
test('21. horizontalRule() throws on null columnWidths', () => {
    let threw = false;
    try {
        horizontalRule(BOX.topLeft, BOX.topTee, BOX.topRight, null);
    } catch (err) {
        threw = true;
    }
    assert(threw, 'Should throw on null columnWidths');
});

console.log('\n  dataRow() tests\n');

// 22. dataRow() builds row with single cell
test('22. dataRow() builds row with single cell', () => {
    const result = dataRow(['Hello'], [10], ['left']);
    assert(result.startsWith(BOX.vertical), 'Should start with vertical bar');
    assert(result.endsWith(BOX.vertical), 'Should end with vertical bar');
    assert(result.includes('Hello'), 'Should include cell value');
});

// 23. dataRow() builds row with multiple cells
test('23. dataRow() builds row with multiple cells', () => {
    const result = dataRow(['Alice', '100', 'Active'], [10, 6, 10], ['left', 'right', 'left']);
    assert(result.includes('Alice'), 'Should include first value');
    assert(result.includes('100'), 'Should include second value');
    assert(result.includes('Active'), 'Should include third value');
    const bars = result.split(BOX.vertical).length - 1;
    assert(bars === 4, `Should have 4 vertical bars (edges + separators), got ${bars}`);
});

// 24. dataRow() respects left alignment
test('24. dataRow() respects left alignment', () => {
    const result = dataRow(['hi'], [10], ['left']);
    // Content width is 10 - 2 (padding) = 8, so 'hi' should have 6 trailing spaces
    assert(result.includes(' hi      '), `Expected " hi      " in result, got "${result}"`);
});

// 25. dataRow() respects right alignment
test('25. dataRow() respects right alignment', () => {
    const result = dataRow(['42'], [10], ['right']);
    // Content width is 10 - 2 (padding) = 8, so '42' should have 6 leading spaces
    assert(result.includes('      42 '), `Expected "      42 " in result, got "${result}"`);
});

// 26. dataRow() truncates long values
test('26. dataRow() truncates long values', () => {
    const longValue = 'this is a very long string that exceeds the column width';
    const result = dataRow([longValue], [15], ['left']);
    // Content width is 15 - 2 = 13
    assert(result.length <= 17, `Result should not exceed expected length, got ${result.length}`);
    assert(result.includes('\u2026'), 'Should include ellipsis for truncated value');
});

// 27. dataRow() handles mixed alignments
test('27. dataRow() handles mixed alignments', () => {
    const result = dataRow(['Left', 'Right', 'Left'], [10, 10, 10], ['left', 'right', 'left']);
    assert(result.includes('Left'), 'Should include left-aligned values');
    assert(result.includes('Right'), 'Should include right-aligned value');
});

// 28. dataRow() throws on empty values
test('28. dataRow() throws on empty values', () => {
    let threw = false;
    try {
        dataRow([], [10], ['left']);
    } catch (err) {
        threw = true;
        assert(err.message.includes('non-empty'), 'Error message should mention non-empty requirement');
    }
    assert(threw, 'Should throw on empty values array');
});

// 29. dataRow() throws on mismatched columnWidths length
test('29. dataRow() throws on mismatched columnWidths length', () => {
    let threw = false;
    try {
        dataRow(['A', 'B'], [10], ['left', 'right']);
    } catch (err) {
        threw = true;
        assert(err.message.includes('match'), 'Error message should mention length mismatch');
    }
    assert(threw, 'Should throw on mismatched columnWidths length');
});

// 30. dataRow() throws on mismatched alignments length
test('30. dataRow() throws on mismatched alignments length', () => {
    let threw = false;
    try {
        dataRow(['A', 'B'], [10, 10], ['left']);
    } catch (err) {
        threw = true;
        assert(err.message.includes('match'), 'Error message should mention length mismatch');
    }
    assert(threw, 'Should throw on mismatched alignments length');
});

// 31. dataRow() converts non-string values to strings
test('31. dataRow() converts non-string values to strings', () => {
    const result = dataRow([42, true, null], [8, 8, 8], ['right', 'left', 'left']);
    assert(result.includes('42'), 'Should convert number to string');
    assert(result.includes('true'), 'Should convert boolean to string');
    assert(result.includes('null'), 'Should convert null to string');
});

console.log('\n  Integration tests\n');

// 32. Build complete simple table
test('32. Build complete simple table', () => {
    const widths = [20, 10];
    const lines = [];

    // Top border
    lines.push(horizontalRule(BOX.topLeft, BOX.topTee, BOX.topRight, widths));

    // Header
    lines.push(dataRow(['Project', 'Score'], widths, ['left', 'right']));

    // Separator
    lines.push(horizontalRule(BOX.leftTee, BOX.cross, BOX.rightTee, widths));

    // Data row
    lines.push(dataRow(['jade-cli', '78.5'], widths, ['left', 'right']));

    // Bottom border
    lines.push(horizontalRule(BOX.bottomLeft, BOX.bottomTee, BOX.bottomRight, widths));

    const table = lines.join('\n');

    assert(table.includes('┌'), 'Table should have top-left corner');
    assert(table.includes('┐'), 'Table should have top-right corner');
    assert(table.includes('├'), 'Table should have left tee');
    assert(table.includes('┼'), 'Table should have cross');
    assert(table.includes('┤'), 'Table should have right tee');
    assert(table.includes('└'), 'Table should have bottom-left corner');
    assert(table.includes('┘'), 'Table should have bottom-right corner');
    assert(table.includes('Project'), 'Table should have header content');
    assert(table.includes('jade-cli'), 'Table should have data content');
});

// 33. Table rendering matches expected format
test('33. Table rendering matches expected format', () => {
    const widths = [10, 8];
    const lines = [];

    lines.push(horizontalRule(BOX.topLeft, BOX.topTee, BOX.topRight, widths));
    lines.push(dataRow(['Name', 'Value'], widths, ['left', 'right']));
    lines.push(horizontalRule(BOX.leftTee, BOX.cross, BOX.rightTee, widths));
    lines.push(dataRow(['Test', '123'], widths, ['left', 'right']));
    lines.push(horizontalRule(BOX.bottomLeft, BOX.bottomTee, BOX.bottomRight, widths));

    const table = lines.join('\n');
    const lineCount = table.split('\n').length;

    assert(lineCount === 5, `Expected 5 lines, got ${lineCount}`);

    // Verify each line has correct structure
    const tableLines = table.split('\n');
    assert(tableLines[0].startsWith('┌'), 'First line should be top border');
    assert(tableLines[1].includes('│'), 'Second line should be data row');
    assert(tableLines[2].startsWith('├'), 'Third line should be middle separator');
    assert(tableLines[3].includes('│'), 'Fourth line should be data row');
    assert(tableLines[4].startsWith('└'), 'Fifth line should be bottom border');
});

// ── Summary ──────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(50));
console.log(`\n  Test Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
    console.log('  Some tests failed\n');
    process.exit(1);
} else {
    console.log('  All tests passed\n');
    process.exit(0);
}
