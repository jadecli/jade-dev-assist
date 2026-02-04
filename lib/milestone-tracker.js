"use strict";

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

const { scanTasks } = require("./scanner");
const { BOX, horizontalRule, dataRow } = require("./table-renderer");

// Progress bar characters
const BLOCK_FULL = "\u2588"; // █
const BLOCK_LIGHT = "\u2591"; // ░

// ── Column Widths ───────────────────────────────────────────────────

const COL_PROJECT = 20;
const COL_TOTAL = 7;
const COL_DONE = 6;
const COL_ACTIVE = 8;
const COL_PENDING = 9;
const COL_PROGRESS = 14;

const COLUMN_WIDTHS = [
  COL_PROJECT,
  COL_TOTAL,
  COL_DONE,
  COL_ACTIVE,
  COL_PENDING,
  COL_PROGRESS,
];

const PROGRESS_BAR_WIDTH = 5;

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
  const projectTasks = allTasks.filter((t) => t._projectName === projectName);

  const total = projectTasks.length;
  let completed = 0;
  let inProgress = 0;
  let pending = 0;

  for (const task of projectTasks) {
    const status = task.status || "pending";
    if (status === "completed") {
      completed++;
    } else if (status === "in_progress") {
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
    const { loadRegistry } = require("./scanner");
    registry = loadRegistry(opts.registryPath);
  }

  const projects = registry.projects || [];
  const result = scanTasks(opts);
  const allTasks = result.tasks;

  const results = [];

  for (const project of projects) {
    const projectName = project.name;
    const projectTasks = allTasks.filter((t) => t._projectName === projectName);

    const total = projectTasks.length;
    let completed = 0;
    let inProgress = 0;
    let pending = 0;

    for (const task of projectTasks) {
      const status = task.status || "pending";
      if (status === "completed") {
        completed++;
      } else if (status === "in_progress") {
        inProgress++;
      } else {
        pending++;
      }
    }

    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    results.push({
      projectName,
      total,
      completed,
      inProgress,
      pending,
      percentage,
    });
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
  lines.push(
    horizontalRule(BOX.topLeft, BOX.topTee, BOX.topRight, COLUMN_WIDTHS),
  );

  // Header row
  lines.push(
    dataRow(
      ["Project", "Total", "Done", "Active", "Pending", "Progress"],
      COLUMN_WIDTHS,
      ["left", "right", "right", "right", "right", "left"],
    ),
  );

  // Header separator
  lines.push(
    horizontalRule(BOX.leftTee, BOX.cross, BOX.rightTee, COLUMN_WIDTHS),
  );

  if (progress.length === 0) {
    // Empty state row
    lines.push(
      dataRow(
        ["(no projects)", "0", "0", "0", "0", progressBar(0)],
        COLUMN_WIDTHS,
        ["left", "right", "right", "right", "right", "left"],
      ),
    );
  } else {
    // Data rows
    for (const entry of progress) {
      lines.push(
        dataRow(
          [
            entry.projectName,
            String(entry.total),
            String(entry.completed),
            String(entry.inProgress),
            String(entry.pending),
            progressBar(entry.percentage),
          ],
          COLUMN_WIDTHS,
          ["left", "right", "right", "right", "right", "left"],
        ),
      );
    }
  }

  // Bottom border
  lines.push(
    horizontalRule(
      BOX.bottomLeft,
      BOX.bottomTee,
      BOX.bottomRight,
      COLUMN_WIDTHS,
    ),
  );

  return lines.join("\n") + "\n";
}

module.exports = {
  getMilestoneProgress,
  getAllMilestonesProgress,
  renderMilestoneTable,
};
