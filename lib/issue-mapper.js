'use strict';

/**
 * Issue Mapper Module for jade-dev-assist orchestrator.
 *
 * Provides utilities for mapping between local task IDs and GitHub Issue numbers.
 * Maintains a local cache of task-to-issue mappings to avoid repeated API calls.
 *
 * The mapping is stored in a JSON file at {projectRoot}/.claude/issue-map.json
 */

const fs = require('fs');
const path = require('path');
const { createLogger } = require('./logger');

const logger = createLogger('issue-mapper');

// ── Mapping File Helpers ─────────────────────────────────────────────

/**
 * Get the path to the issue map file for a project.
 *
 * @param {string} projectRoot - Root directory of the project.
 * @returns {string} Path to the issue-map.json file.
 */
function getMapPath(projectRoot) {
  return path.join(projectRoot, '.claude', 'issue-map.json');
}

/**
 * Load the issue map from disk.
 *
 * @param {string} projectRoot - Root directory of the project.
 * @returns {{ taskToIssue: Object, issueToTask: Object }}
 */
function loadMap(projectRoot) {
  const mapPath = getMapPath(projectRoot);

  try {
    const content = fs.readFileSync(mapPath, 'utf8');
    const data = JSON.parse(content);
    return {
      taskToIssue: data.taskToIssue || {},
      issueToTask: data.issueToTask || {},
    };
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.warn('Failed to load issue map', {
        path: mapPath,
        error: err.message,
      });
    }
    return { taskToIssue: {}, issueToTask: {} };
  }
}

/**
 * Save the issue map to disk.
 *
 * @param {string} projectRoot - Root directory of the project.
 * @param {{ taskToIssue: Object, issueToTask: Object }} map - The mapping data.
 */
function saveMap(projectRoot, map) {
  const mapPath = getMapPath(projectRoot);
  const mapDir = path.dirname(mapPath);

  // Ensure directory exists
  if (!fs.existsSync(mapDir)) {
    fs.mkdirSync(mapDir, { recursive: true });
  }

  const data = {
    version: 1,
    updatedAt: new Date().toISOString(),
    taskToIssue: map.taskToIssue || {},
    issueToTask: map.issueToTask || {},
  };

  fs.writeFileSync(mapPath, JSON.stringify(data, null, 2) + '\n');

  logger.debug('Saved issue map', {
    path: mapPath,
    taskCount: Object.keys(data.taskToIssue).length,
  });
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Get the GitHub issue number for a task ID.
 *
 * @param {string} taskId - The task ID (e.g., "project/task-name").
 * @param {string} projectRoot - Root directory of the project.
 * @returns {number|null} The issue number or null if not mapped.
 */
function getIssueForTask(taskId, projectRoot) {
  const map = loadMap(projectRoot);
  return map.taskToIssue[taskId] || null;
}

/**
 * Get the task ID for a GitHub issue number.
 *
 * @param {number} issueNumber - The GitHub issue number.
 * @param {string} projectRoot - Root directory of the project.
 * @returns {string|null} The task ID or null if not mapped.
 */
function getTaskForIssue(issueNumber, projectRoot) {
  const map = loadMap(projectRoot);
  return map.issueToTask[String(issueNumber)] || null;
}

/**
 * Register a task-to-issue mapping.
 *
 * @param {string} taskId - The task ID.
 * @param {number} issueNumber - The GitHub issue number.
 * @param {string} projectRoot - Root directory of the project.
 */
function registerMapping(taskId, issueNumber, projectRoot) {
  const map = loadMap(projectRoot);

  map.taskToIssue[taskId] = issueNumber;
  map.issueToTask[String(issueNumber)] = taskId;

  saveMap(projectRoot, map);

  logger.info('Registered task-issue mapping', {
    taskId,
    issueNumber,
  });
}

/**
 * Remove a task-to-issue mapping.
 *
 * @param {string} taskId - The task ID to unmap.
 * @param {string} projectRoot - Root directory of the project.
 */
function removeTaskMapping(taskId, projectRoot) {
  const map = loadMap(projectRoot);

  const issueNumber = map.taskToIssue[taskId];
  if (issueNumber !== undefined) {
    delete map.taskToIssue[taskId];
    delete map.issueToTask[String(issueNumber)];
    saveMap(projectRoot, map);

    logger.info('Removed task-issue mapping', {
      taskId,
      issueNumber,
    });
  }
}

/**
 * Remove an issue-to-task mapping.
 *
 * @param {number} issueNumber - The issue number to unmap.
 * @param {string} projectRoot - Root directory of the project.
 */
function removeIssueMapping(issueNumber, projectRoot) {
  const map = loadMap(projectRoot);

  const taskId = map.issueToTask[String(issueNumber)];
  if (taskId !== undefined) {
    delete map.issueToTask[String(issueNumber)];
    delete map.taskToIssue[taskId];
    saveMap(projectRoot, map);

    logger.info('Removed issue-task mapping', {
      issueNumber,
      taskId,
    });
  }
}

/**
 * Get all mappings for a project.
 *
 * @param {string} projectRoot - Root directory of the project.
 * @returns {{ taskToIssue: Object, issueToTask: Object }}
 */
function getAllMappings(projectRoot) {
  return loadMap(projectRoot);
}

/**
 * Clear all mappings for a project.
 *
 * @param {string} projectRoot - Root directory of the project.
 */
function clearMappings(projectRoot) {
  saveMap(projectRoot, { taskToIssue: {}, issueToTask: {} });

  logger.info('Cleared all issue mappings', { projectRoot });
}

/**
 * Update the github_issue field in tasks.json for mapped tasks.
 *
 * Reads tasks.json, updates the github_issue field for any tasks
 * that have a mapping but no github_issue, and writes back.
 *
 * @param {string} projectRoot - Root directory of the project.
 * @param {string} repo - Repository in "owner/repo" format.
 * @returns {{ updated: number, skipped: number }}
 */
function syncMappingsToTasksJson(projectRoot, repo) {
  const map = loadMap(projectRoot);
  const tasksJsonPath = path.join(
    projectRoot,
    '.claude',
    'tasks',
    'tasks.json'
  );

  let data;
  try {
    data = JSON.parse(fs.readFileSync(tasksJsonPath, 'utf8'));
  } catch (err) {
    logger.error('Failed to read tasks.json', { error: err.message });
    return { updated: 0, skipped: 0 };
  }

  let updated = 0;
  let skipped = 0;

  for (const task of data.tasks || []) {
    const issueNumber = map.taskToIssue[task.id];

    if (issueNumber && !task.github_issue) {
      task.github_issue = `${repo}#${issueNumber}`;
      updated++;
    } else if (task.github_issue) {
      skipped++;
    }
  }

  if (updated > 0) {
    fs.writeFileSync(tasksJsonPath, JSON.stringify(data, null, 2) + '\n');
    logger.info('Updated tasks.json with issue mappings', { updated });
  }

  return { updated, skipped };
}

// ── Exports ──────────────────────────────────────────────────────────

module.exports = {
  getIssueForTask,
  getTaskForIssue,
  registerMapping,
  removeTaskMapping,
  removeIssueMapping,
  getAllMappings,
  clearMappings,
  syncMappingsToTasksJson,
  // Exposed for testing
  getMapPath,
  loadMap,
  saveMap,
};
