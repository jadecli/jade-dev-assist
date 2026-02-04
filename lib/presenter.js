"use strict";

/**
 * Presenter Module for the jade-dev-assist orchestrator.
 *
 * Renders a ranked task table to the terminal using box-drawing characters.
 * Operates on the sorted task array produced by scoreTasks().
 *
 * See ~/docs/plans/2026-02-02-jade-dev-assist-orchestrator-design.md Section 6.
 */

const { BOX, horizontalRule, dataRow } = require("./table-renderer");

// ── Column Widths ────────────────────────────────────────────────────
//
// #:       4 chars total  (right-aligned number, padded)
// Project: 18 chars total (16 content + 2 padding)
// Task:    42 chars total (40 content + 2 padding)
// Score:   7 chars total  (5 content + 2 padding)
// Size:    6 chars total  (4 content + 2 padding)

const COL_RANK = 4;
const COL_PROJECT = 18;
const COL_TASK = 42;
const COL_SCORE = 7;
const COL_SIZE = 6;

const COLUMN_WIDTHS = [COL_RANK, COL_PROJECT, COL_TASK, COL_SCORE, COL_SIZE];

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
  const uniqueProjects = new Set(rankedTasks.map((t) => t._projectName));
  const projectCount = uniqueProjects.size;

  const lines = [];

  // Header line
  const displayCount = Math.min(count, rankedTasks.length);
  lines.push(
    `  jade-dev-assist orchestrator -- Top ${displayCount} tasks across ${projectCount} projects`,
  );
  lines.push("");

  if (tasksToShow.length === 0) {
    lines.push("  (no tasks)");
    lines.push("");

    const result = lines.join("\n");
    output.write(result);
    return result;
  }

  // Top border
  lines.push(
    horizontalRule(BOX.topLeft, BOX.topTee, BOX.topRight, COLUMN_WIDTHS),
  );

  // Column headers
  lines.push(
    dataRow([" #", "Project", "Task", "Score", "Size"], COLUMN_WIDTHS, [
      "right",
      "left",
      "left",
      "right",
      "left",
    ]),
  );

  // Separator
  lines.push(
    horizontalRule(BOX.leftTee, BOX.cross, BOX.rightTee, COLUMN_WIDTHS),
  );

  // Data rows
  for (let i = 0; i < tasksToShow.length; i++) {
    const task = tasksToShow[i];
    const rank = String(i + 1);
    const project = task._projectName || "";
    const title = task.title || "";
    const score = task._score != null ? task._score.toFixed(1) : "0.0";
    const size = task.complexity || "";

    lines.push(
      dataRow([rank, project, title, score, size], COLUMN_WIDTHS, [
        "right",
        "left",
        "left",
        "right",
        "left",
      ]),
    );
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
  lines.push("");

  const result = lines.join("\n");
  output.write(result);
  return result;
}

module.exports = {
  presentTasks,
};
