'use strict';

const fs = require('fs');
const path = require('path');
const { createLogger } = require('./logger');

const logger = createLogger('scanner');

const DEFAULT_REGISTRY_PATH = path.join(
    process.env.HOME || process.env.USERPROFILE,
    '.jade',
    'projects.json'
);

/**
 * Load and parse a project registry file.
 *
 * @param {string} [registryPath] - Path to the registry JSON file.
 *   Defaults to ~/.jade/projects.json.
 * @returns {Object} The parsed registry object.
 * @throws {Error} If the file does not exist (ENOENT) or contains malformed JSON.
 */
function loadRegistry(registryPath) {
    const filePath = registryPath || DEFAULT_REGISTRY_PATH;
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
}

/**
 * Scan tasks from all projects in the registry.
 *
 * Iterates over every project in the registry, reads each project's
 * .claude/tasks/tasks.json file, and returns a merged array of all tasks
 * augmented with metadata from the registry and task file.
 *
 * @param {Object} [options]
 * @param {string} [options.registryPath] - Path to the registry JSON file.
 * @param {Object} [options.registry] - Pre-loaded registry object (skips file read).
 * @returns {Object[]} Merged array of tasks from all projects.
 */
function scanTasks(options) {
    const opts = options || {};
    const registry = opts.registry || loadRegistry(opts.registryPath);
    const projectsRoot = registry.projects_root || '';
    const projects = registry.projects || [];
    const allTasks = [];

    for (const project of projects) {
        const tasksFilePath = path.join(
            projectsRoot,
            project.path,
            '.claude',
            'tasks',
            'tasks.json'
        );

        let taskFileContent;
        try {
            taskFileContent = fs.readFileSync(tasksFilePath, 'utf8');
        } catch (err) {
            // Missing file or missing directory -- silently skip
            if (err.code === 'ENOENT') {
                continue;
            }
            // Re-throw unexpected errors
            throw err;
        }

        let taskData;
        try {
            taskData = JSON.parse(taskFileContent);
        } catch (err) {
            // Malformed JSON -- warn and skip
            logger.warn('Malformed tasks.json, skipping project', {
                project: project.name,
                path: tasksFilePath,
                error: err.message
            });
            continue;
        }

        const fileMilestone = taskData.milestone || null;
        const tasks = taskData.tasks || [];

        // NOTE: All tasks from the same project share the same `project`
        // and `fileMilestone` object references. Downstream consumers must
        // not mutate `_project` or `_milestone` without cloning first.
        for (const task of tasks) {
            task._project = project;
            task._projectName = project.name;
            task._milestone = fileMilestone;
            allTasks.push(task);
        }
    }

    return allTasks;
}

module.exports = { scanTasks, loadRegistry };
