'use strict';

/**
 * Milestone Tracker Module for the jade-dev-assist orchestrator.
 *
 * Computes per-project and overall milestone completion percentages
 * and renders a Unicode progress summary table.
 *
 * Uses scanner.js to load all tasks from the ecosystem.
 *
 * See Section 3.7 of the orchestrator design doc.
 */

const { scanTasks } = require('./scanner');

// ── Box-drawing characters ──────────────────────────────────────────

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

// Progress bar characters
const BLOCK_FULL  = '\u2588';  // █
const BLOCK_LIGHT = '\u2591';  // ░

// ── Column Widths ───────────────────────────────────────────────────

const COL_PROJECT  = 20;
const COL_TOTAL    = 7;
const COL_DONE     = 6;
const COL_ACTIVE   = 8;
const COL_PENDING  = 9;
const COL_PROGRESS = 14;

const MAX_PROJECT  = 18;  // content width (col - 2 padding)
const MAX_TOTAL    = 5;
const MAX_DONE     = 4;
const MAX_ACTIVE   = 6;
const MAX_PENDING  = 7;
const MAX_PROGRESS = 12;

const PROGRESS_BAR_WIDTH = 5;

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Truncate a string to maxLen characters, appending an ellipsis if truncated.
 */
function truncate(str, maxLen) {
    if (str.length <= maxLen) {
        return str;
    }
    return str.slice(0, maxLen - 1) + '\u2026';
}

/**
 * Pad a string to width, left-aligned.
 */
function padRight(str, width) {
    const truncated = truncate(str, width);
    if (truncated.length >= width) {
        return truncated;
    }
    return truncated + ' '.repeat(width - truncated.length);
}

/**
 * Pad a string to width, right-aligned.
 */
function padLeft(str, width) {
    const truncated = truncate(str, width);
    if (truncated.length >= width) {
        return truncated;
    }
    return ' '.repeat(width - truncated.length) + truncated;
}

/**
 * Build a horizontal rule line for the table.
 */
function horizontalRule(left, mid, right) {
    return (
        left +
        BOX.horizontal.repeat(COL_PROJECT) +
        mid +
        BOX.horizontal.repeat(COL_TOTAL) +
        mid +
        BOX.horizontal.repeat(COL_DONE) +
        mid +
        BOX.horizontal.repeat(COL_ACTIVE) +
        mid +
        BOX.horizontal.repeat(COL_PENDING) +
        mid +
        BOX.horizontal.repeat(COL_PROGRESS) +
        right
    );
}

/**
 * Build a data row for the table.
 */
function dataRow(project, total, done, active, pending, progress) {
    return (
        BOX.vertical +
        ' ' + padRight(project, MAX_PROJECT) + ' ' +
        BOX.vertical +
        ' ' + padLeft(total, MAX_TOTAL) + ' ' +
        BOX.vertical +
        ' ' + padLeft(done, MAX_DONE) + ' ' +
        BOX.vertical +
        ' ' + padLeft(active, MAX_ACTIVE) + ' ' +
        BOX.vertical +
        ' ' + padLeft(pending, MAX_PENDING) + ' ' +
        BOX.vertical +
        ' ' + padRight(progress, MAX_PROGRESS) + ' ' +
        BOX.vertical
    );
}

/**
 * Build a progress bar string from a percentage.
 *
 * @param {number} percentage - 0 to 100.
 * @returns {string} e.g. "████░ 83%"
 */
function progressBar(percentage) {
    const filled = Math.round((percentage / 100) * PROGRESS_BAR_WIDTH);
    const empty = PROGRESS_BAR_WIDTH - filled;
    const bar = BLOCK_FULL.repeat(filled) + BLOCK_LIGHT.repeat(empty);
    return `${bar} ${percentage}%`;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Get milestone progress for a single project.
 *
 * Scans all tasks for the given project and counts their statuses.
 *
 * @param {string} projectName - The project name to query.
 * @param {Object} [options]
 * @param {string} [options.registryPath] - Path to the registry JSON file.
 * @param {Object} [options.registry]     - Pre-loaded registry object.
 * @returns {{ total: number, completed: number, inProgress: number, pending: number, percentage: number }}
 */
function getMilestoneProgress(projectName, options) {
    const opts = options || {};
    const result = scanTasks(opts);
    const allTasks = result.tasks;

    // Filter tasks for this project
    const projectTasks = allTasks.filter(t => t._projectName === projectName);

    const total = projectTasks.length;
    let completed = 0;
    let inProgress = 0;
    let pending = 0;

    for (const task of projectTasks) {
        const status = task.status || 'pending';
        if (status === 'completed') {
            completed++;
        } else if (status === 'in_progress') {
            inProgress++;
        } else {
            // pending, blocked, failed, etc. all count as pending
            pending++;
        }
    }

    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, inProgress, pending, percentage };
}

/**
 * Get milestone progress for all projects in the registry.
 *
 * @param {Object} [options]
 * @param {string} [options.registryPath] - Path to the registry JSON file.
 * @param {Object} [options.registry]     - Pre-loaded registry object.
 * @returns {Array<{ projectName: string, total: number, completed: number, inProgress: number, pending: number, percentage: number }>}
 */
function getAllMilestonesProgress(options) {
    const opts = options || {};

    // Load registry to get project list
    let registry = opts.registry;
    if (!registry) {
        const { loadRegistry } = require('./scanner');
        registry = loadRegistry(opts.registryPath);
    }

    const projects = registry.projects || [];
    const result = scanTasks(opts);
    const allTasks = result.tasks;

    const results = [];

    for (const project of projects) {
        const projectName = project.name;
        const projectTasks = allTasks.filter(t => t._projectName === projectName);

        const total = projectTasks.length;
        let completed = 0;
        let inProgress = 0;
        let pending = 0;

        for (const task of projectTasks) {
            const status = task.status || 'pending';
            if (status === 'completed') {
                completed++;
            } else if (status === 'in_progress') {
                inProgress++;
            } else {
                pending++;
            }
        }

        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        results.push({ projectName, total, completed, inProgress, pending, percentage });
    }

    return results;
}

/**
 * Render a Unicode milestone progress table.
 *
 * Produces a table like:
 *
 *   ┌──────────────────┬───────┬──────┬────────┬─────────┬──────────────┐
 *   │ Project          │ Total │ Done │ Active │ Pending │ Progress     │
 *   ├──────────────────┼───────┼──────┼────────┼─────────┼──────────────┤
 *   │ jade-index       │     6 │    5 │      0 │       1 │ ████░ 83%   │
 *   └──────────────────┴───────┴──────┴────────┴─────────┴──────────────┘
 *
 * @param {Array} progress - Array of progress objects from getAllMilestonesProgress().
 * @returns {string} The formatted table string.
 */
function renderMilestoneTable(progress) {
    const lines = [];

    // Top border
    lines.push(horizontalRule(BOX.topLeft, BOX.topTee, BOX.topRight));

    // Header row
    lines.push(dataRow('Project', 'Total', 'Done', 'Active', 'Pending', 'Progress'));

    // Header separator
    lines.push(horizontalRule(BOX.leftTee, BOX.cross, BOX.rightTee));

    if (progress.length === 0) {
        // Empty state row
        lines.push(dataRow('(no projects)', '0', '0', '0', '0', progressBar(0)));
    } else {
        // Data rows
        for (const entry of progress) {
            lines.push(dataRow(
                entry.projectName,
                String(entry.total),
                String(entry.completed),
                String(entry.inProgress),
                String(entry.pending),
                progressBar(entry.percentage)
            ));
        }
    }

    // Bottom border
    lines.push(horizontalRule(BOX.bottomLeft, BOX.bottomTee, BOX.bottomRight));

    return lines.join('\n') + '\n';
}

module.exports = {
    getMilestoneProgress,
    getAllMilestonesProgress,
    renderMilestoneTable
};
