'use strict';

/**
 * Status Updater Module for the jade-dev-assist orchestrator.
 *
 * Monitors spawned worker processes and updates task status back
 * to tasks.json. Provides direct status read/write functions and
 * a process watcher for automated completion tracking.
 *
 * See Section 3.6 of the orchestrator design doc.
 */

const fs = require('fs');
const path = require('path');
const { findTask } = require('./task-utils');

// ── Public API ──────────────────────────────────────────────────────

/**
 * Update a task's status in its tasks.json file and record a history entry.
 *
 * Reads the file, finds the task by ID, updates its status field,
 * appends a history entry with timestamp and optional agent_summary,
 * and writes the file back.
 *
 * @param {string} taskId    - Full task ID (e.g. "project-name/task-name").
 * @param {string} newStatus - The new status to set.
 * @param {Object} [options]
 * @param {string} [options.projectsRoot] - Root directory containing project directories.
 * @param {string} [options.summary]      - Optional agent summary for the history entry.
 * @throws {Error} If the task is not found.
 */
function updateTaskStatus(taskId, newStatus, options) {
  const opts = options || {};
  const projectsRoot = opts.projectsRoot || '';

  const { task, data, tasksJsonPath } = findTask(taskId, projectsRoot);
  const fromStatus = task.status;

  // Update status
  task.status = newStatus;

  // Add history entry
  if (!Array.isArray(task.history)) {
    task.history = [];
  }
  const historyEntry = {
    timestamp: new Date().toISOString(),
    from_status: fromStatus,
    to_status: newStatus,
  };
  if (opts.summary) {
    historyEntry.agent_summary = opts.summary;
  }
  task.history.push(historyEntry);

  // Update timestamp
  task.updated_at = new Date().toISOString();

  // Write back
  fs.writeFileSync(tasksJsonPath, JSON.stringify(data, null, 2) + '\n');
}

/**
 * Read the current status of a task.
 *
 * @param {string} taskId  - Full task ID (e.g. "project-name/task-name").
 * @param {Object} [options]
 * @param {string} [options.projectsRoot] - Root directory containing project directories.
 * @returns {string} The current status string.
 * @throws {Error} If the task is not found.
 */
function getTaskStatus(taskId, options) {
  const opts = options || {};
  const projectsRoot = opts.projectsRoot || '';

  const { task } = findTask(taskId, projectsRoot);
  return task.status;
}

/**
 * Monitor a spawned worker child process and update task status on completion.
 *
 * Listens for the child process 'close' event. On exit code 0, updates
 * the task status to "completed". On non-zero exit, updates to "failed"
 * with error details in the history entry.
 *
 * @param {string} taskId       - Full task ID (e.g. "project-name/task-name").
 * @param {ChildProcess} childProcess - The spawned child process to monitor.
 * @param {Object} [options]
 * @param {string} [options.projectsRoot] - Root directory containing project directories.
 * @returns {Promise<{ exitCode: number, stdout: string, stderr: string, completedAt: string }>}
 */
function watchWorkerCompletion(taskId, childProcess, options) {
  const opts = options || {};
  const projectsRoot = opts.projectsRoot || '';

  const stdoutChunks = [];
  const stderrChunks = [];

  if (childProcess.stdout) {
    childProcess.stdout.on('data', (data) => {
      stdoutChunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
    });
  }

  if (childProcess.stderr) {
    childProcess.stderr.on('data', (data) => {
      stderrChunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
    });
  }

  return new Promise((resolve) => {
    childProcess.on('close', (exitCode) => {
      const completedAt = new Date().toISOString();
      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');

      if (exitCode === 0) {
        // Success -- update to completed
        try {
          updateTaskStatus(taskId, 'completed', {
            projectsRoot,
          });
        } catch (err) {
          console.warn(
            `Warning: could not update task status to completed: ${err.message}`
          );
        }
      } else {
        // Failure -- update to failed with error details
        const errorSummary =
          `Worker exited with code ${exitCode}` +
          (stderr ? `: ${stderr.trim().slice(0, 200)}` : '');
        try {
          updateTaskStatus(taskId, 'failed', {
            projectsRoot,
            summary: errorSummary,
          });
        } catch (err) {
          console.warn(
            `Warning: could not update task status to failed: ${err.message}`
          );
        }
      }

      resolve({
        exitCode,
        stdout,
        stderr,
        completedAt,
      });
    });
  });
}

module.exports = {
  updateTaskStatus,
  getTaskStatus,
  watchWorkerCompletion,
};
