'use strict';

/**
 * Presenter Module for the jade-dev-assist orchestrator.
 *
 * Renders a ranked task table to the terminal using box-drawing characters.
 * Operates on the sorted task array produced by scoreTasks().
 *
 * See ~/docs/plans/2026-02-02-jade-dev-assist-orchestrator-design.md Section 6.
 */

// ── Column Widths ────────────────────────────────────────────────────
//
// #:       4 chars total  (right-aligned number, padded)
// Project: 18 chars total (16 content + 2 padding)
// Task:    42 chars total (40 content + 2 padding)
// Score:   7 chars total  (5 content + 2 padding)
// Size:    6 chars total  (4 content + 2 padding)

const COL_RANK     = 4;
const COL_PROJECT  = 18;
const COL_TASK     = 42;
const COL_SCORE    = 7;
const COL_SIZE     = 6;

const MAX_RANK     = 2;   // content width for Rank
const MAX_PROJECT  = 16;  // content width for Project
const MAX_TASK     = 40;  // content width for Task
const MAX_SCORE    = 5;   // content width for Score
const MAX_SIZE     = 4;   // content width for Size

const ELLIPSIS = '\u2026';

// ── Box-drawing characters ───────────────────────────────────────────

const BOX = {
    topLeft:     '\u250c',  // ┌
    topRight:    '\u2510',  // ┐
    bottomLeft:  '\u2514',  // └
    bottomRight: '\u2518',  // ┘
    horizontal:  '\u2500',  // ─
    vertical:    '\u2502',  // │
    topTee:      '\u252c',  // ┬
    bottomTee:   '\u2534',  // ┴
    leftTee:     '\u251c',  // ├
    rightTee:    '\u2524',  // ┤
    cross:       '\u253c'   // ┼
};

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Truncate a string to maxLen characters, appending an ellipsis if truncated.
 */
function truncate(str, maxLen) {
    if (str.length <= maxLen) {
        return str;
    }
    return str.slice(0, maxLen - 1) + ELLIPSIS;
}

/**
 * Pad or truncate a string to exactly `width` characters, left-aligned.
 */
function padRight(str, width) {
    const truncated = truncate(str, width);
    if (truncated.length >= width) {
        return truncated;
    }
    return truncated + ' '.repeat(width - truncated.length);
}

/**
 * Pad or truncate a string to exactly `width` characters, right-aligned.
 */
function padLeft(str, width) {
    const truncated = truncate(str, width);
    if (truncated.length >= width) {
        return truncated;
    }
    return ' '.repeat(width - truncated.length) + truncated;
}

/**
 * Build a horizontal rule (top, middle, or bottom).
 *
 * @param {string} left  - Left edge character
 * @param {string} mid   - Column separator character
 * @param {string} right - Right edge character
 * @returns {string}
 */
function horizontalRule(left, mid, right) {
    return (
        left +
        BOX.horizontal.repeat(COL_RANK) +
        mid +
        BOX.horizontal.repeat(COL_PROJECT) +
        mid +
        BOX.horizontal.repeat(COL_TASK) +
        mid +
        BOX.horizontal.repeat(COL_SCORE) +
        mid +
        BOX.horizontal.repeat(COL_SIZE) +
        right
    );
}

/**
 * Build a data row.
 *
 * @param {string} rank    - Rank string (right-aligned in COL_RANK)
 * @param {string} project - Project name (left-aligned, padded in MAX_PROJECT)
 * @param {string} task    - Task title (left-aligned, padded in MAX_TASK)
 * @param {string} score   - Score string (right-aligned in MAX_SCORE)
 * @param {string} size    - Complexity string (left-aligned in MAX_SIZE)
 * @returns {string}
 */
function dataRow(rank, project, task, score, size) {
    return (
        BOX.vertical +
        ' ' + padLeft(rank, MAX_RANK) + ' ' +
        BOX.vertical +
        ' ' + padRight(project, MAX_PROJECT) + ' ' +
        BOX.vertical +
        ' ' + padRight(task, MAX_TASK) + ' ' +
        BOX.vertical +
        ' ' + padLeft(score, MAX_SCORE) + ' ' +
        BOX.vertical +
        ' ' + padRight(size, MAX_SIZE) + ' ' +
        BOX.vertical
    );
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Render a ranked task table to the terminal.
 *
 * @param {Object[]} rankedTasks - Array of task objects with _projectName, title, _score, complexity.
 * @param {Object}   [options]
 * @param {number}   [options.count=10]  - Number of tasks to display.
 * @param {Object}   [options.output]    - Writable stream (default: process.stdout).
 * @returns {string} The formatted table string.
 */
function presentTasks(rankedTasks, options) {
    const opts = options || {};
    const count = opts.count || 10;
    const output = opts.output || process.stdout;

    const tasksToShow = rankedTasks.slice(0, count);

    // Count unique project names across the entire input (not just displayed tasks)
    const uniqueProjects = new Set(rankedTasks.map(t => t._projectName));
    const projectCount = uniqueProjects.size;

    const lines = [];

    // Header line
    const displayCount = Math.min(count, rankedTasks.length);
    lines.push(`  jade-dev-assist orchestrator -- Top ${displayCount} tasks across ${projectCount} projects`);
    lines.push('');

    if (tasksToShow.length === 0) {
        lines.push('  (no tasks)');
        lines.push('');

        const result = lines.join('\n');
        output.write(result);
        return result;
    }

    // Top border
    lines.push(horizontalRule(BOX.topLeft, BOX.topTee, BOX.topRight));

    // Column headers
    lines.push(dataRow(' #', 'Project', 'Task', 'Score', 'Size'));

    // Separator
    lines.push(horizontalRule(BOX.leftTee, BOX.cross, BOX.rightTee));

    // Data rows
    for (let i = 0; i < tasksToShow.length; i++) {
        const task = tasksToShow[i];
        const rank = String(i + 1);
        const project = task._projectName || '';
        const title = task.title || '';
        const score = task._score != null ? task._score.toFixed(1) : '0.0';
        const size = task.complexity || '';

        lines.push(dataRow(rank, project, title, score, size));
    }

    // Bottom border
    lines.push(horizontalRule(BOX.bottomLeft, BOX.bottomTee, BOX.bottomRight));
    lines.push('');

    const result = lines.join('\n');
    output.write(result);
    return result;
}

module.exports = {
    presentTasks
};
