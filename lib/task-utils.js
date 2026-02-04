'use strict';

/**
 * Task Utilities Module for the jade-dev-assist orchestrator.
 *
 * Provides shared utilities for task lookup and task file path resolution
 * across the orchestrator codebase. Extracted from duplicated code in
 * executor.js and status-updater.js.
 *
 * Functions:
 * - parseTaskId(taskId)              - Parse a task ID into project and task name.
 * - getTasksJsonPath(projectId, projectsRoot) - Build absolute path to a project's tasks.json.
 * - findTask(taskId, projectsRoot)   - Find a task by ID and return task data with metadata.
 */

const fs = require('fs');
const path = require('path');

// ── Task ID Parsing ─────────────────────────────────────────────────

/**
 * Parse a task ID into its component parts.
 *
 * Task IDs follow the format "project-name/task-name".
 * This function validates the format and extracts both parts.
 *
 * @param {string} taskId - Full task ID (e.g. "test-project/test-task").
 * @returns {{ projectId: string, taskName: string }}
 * @throws {Error} If the task ID format is invalid.
 *
 * @example
 * const { projectId, taskName } = parseTaskId('jade-cli/implement-scanner');
 * // projectId === 'jade-cli'
 * // taskName === 'implement-scanner'
 */
function parseTaskId(taskId) {
    const slashIdx = taskId.indexOf('/');
    if (slashIdx === -1) {
        throw new Error(`Invalid task ID format: "${taskId}" (expected "project/task")`);
    }

    const projectId = taskId.slice(0, slashIdx);
    const taskName = taskId.slice(slashIdx + 1);

    // Validate that we have both parts (not just a slash)
    if (!taskName) {
        throw new Error(`Invalid task ID format: "${taskId}" (expected "project/task")`);
    }

    return {
        projectId,
        taskName
    };
}

// ── Tasks File Path Resolution ──────────────────────────────────────

/**
 * Build the absolute path to a project's tasks.json file.
 *
 * All projects follow the convention:
 *   {projectsRoot}/{projectId}/.claude/tasks/tasks.json
 *
 * This function does NOT verify that the file exists.
 *
 * @param {string} projectId    - The project identifier (e.g. "jade-cli").
 * @param {string} projectsRoot - Root directory containing project directories.
 * @returns {string} Absolute path to the tasks.json file.
 *
 * @example
 * const tasksPath = getTasksJsonPath('jade-cli', '/home/user/projects');
 * // => '/home/user/projects/jade-cli/.claude/tasks/tasks.json'
 */
function getTasksJsonPath(projectId, projectsRoot) {
    const projectPath = path.join(projectsRoot, projectId);
    return path.join(projectPath, '.claude', 'tasks', 'tasks.json');
}

// ── Task Lookup ─────────────────────────────────────────────────────

/**
 * Find a task by ID in a project's tasks.json file.
 *
 * Reads the tasks.json file, locates the task object by ID, and returns
 * the task along with metadata including:
 * - The full tasks.json data object
 * - The task's index in the tasks array
 * - The absolute path to the tasks.json file
 * - A derived project registry entry
 *
 * The project registry entry is built from:
 * 1. task._project field (if present)
 * 2. data.project field (fallback for name)
 * 3. Derived from task ID (final fallback)
 *
 * @param {string} taskId       - Full task ID (e.g. "project-name/task-name").
 * @param {string} projectsRoot - Root directory containing project directories.
 * @returns {{
 *   task: Object,
 *   taskIndex: number,
 *   data: Object,
 *   project: Object,
 *   tasksJsonPath: string
 * }}
 * @throws {Error} If the task is not found or the file is missing.
 *
 * @example
 * const result = findTask('jade-cli/implement-scanner', '/home/user/projects');
 * // result.task => { id: 'jade-cli/implement-scanner', title: '...', ... }
 * // result.taskIndex => 2
 * // result.data => { version: 1, project: 'jade-cli', tasks: [...] }
 * // result.project => { name: 'jade-cli', path: 'jade-cli', ... }
 * // result.tasksJsonPath => '/home/user/projects/jade-cli/.claude/tasks/tasks.json'
 */
function findTask(taskId, projectsRoot) {
    // Parse the task ID to extract project name
    const { projectId } = parseTaskId(taskId);

    // Build path to tasks.json
    const tasksJsonPath = getTasksJsonPath(projectId, projectsRoot);

    // Read and parse tasks.json
    let content;
    try {
        content = fs.readFileSync(tasksJsonPath, 'utf8');
    } catch (err) {
        if (err.code === 'ENOENT') {
            throw new Error(`Tasks file not found for project "${projectId}": ${tasksJsonPath}`);
        }
        throw err;
    }

    const data = JSON.parse(content);
    const tasks = data.tasks || [];

    // Find the task by ID
    let taskIndex = -1;
    for (let i = 0; i < tasks.length; i++) {
        if (tasks[i].id === taskId) {
            taskIndex = i;
            break;
        }
    }

    if (taskIndex === -1) {
        throw new Error(`Task not found: "${taskId}" in ${tasksJsonPath}`);
    }

    const task = tasks[taskIndex];

    // Build a project registry entry from available data
    // Priority: task._project > data.project > derived from ID
    const project = task._project || {
        name: data.project || projectId,
        path: projectId,
        status: 'unknown',
        language: 'javascript',
        test_command: null
    };

    // Ensure project has name and path (defensive)
    if (!project.name) {
        project.name = data.project || projectId;
    }
    if (!project.path) {
        project.path = projectId;
    }

    return {
        task,
        taskIndex,
        data,
        project,
        tasksJsonPath
    };
}

module.exports = {
    parseTaskId,
    getTasksJsonPath,
    findTask
};
