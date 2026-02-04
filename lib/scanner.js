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

// ── Task Schema Definition ────────────────────────────────────────────

/**
 * Required fields for a valid task.
 */
const REQUIRED_TASK_FIELDS = ['id', 'title', 'status'];

/**
 * Optional fields with their default values.
 */
const OPTIONAL_TASK_FIELDS = {
  complexity: 'M',
  blocked_by: [],
  unlocks: [],
};

/**
 * All known task fields (required + optional + common extras).
 */
const KNOWN_TASK_FIELDS = new Set([
  // Required
  'id',
  'title',
  'status',
  // Optional with defaults
  'complexity',
  'blocked_by',
  'unlocks',
  // Other known fields
  'description',
  'milestone',
  'labels',
  'feature',
  'github_issue',
  'relevant_files',
  'created_at',
  // Internal fields added by scanner
  '_project',
  '_projectName',
  '_milestone',
]);

// ── Schema Validation ─────────────────────────────────────────────────

/**
 * Validate a task object against the schema.
 *
 * @param {Object} task - The task object to validate.
 * @param {string} filePath - Path to the task file (for error messages).
 * @param {Object} [options]
 * @param {boolean} [options.strict] - If true, treat warnings as errors.
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateTask(task, filePath, options) {
  const opts = options || {};
  const errors = [];
  const warnings = [];

  // Check required fields
  for (const field of REQUIRED_TASK_FIELDS) {
    if (task[field] === undefined || task[field] === null) {
      errors.push(`Missing required field '${field}' in task at ${filePath}`);
    }
  }

  // Check for unknown fields
  for (const field of Object.keys(task)) {
    if (!KNOWN_TASK_FIELDS.has(field)) {
      warnings.push(
        `Unknown field '${field}' in task '${task.id || 'unknown'}' at ${filePath}`
      );
    }
  }

  return {
    valid: errors.length === 0 && (!opts.strict || warnings.length === 0),
    errors,
    warnings,
  };
}

/**
 * Apply default values to optional task fields.
 *
 * @param {Object} task - The task object to normalize.
 * @returns {Object} The task with defaults applied (mutates original).
 */
function applyTaskDefaults(task) {
  for (const [field, defaultValue] of Object.entries(OPTIONAL_TASK_FIELDS)) {
    if (task[field] === undefined) {
      task[field] = Array.isArray(defaultValue)
        ? [...defaultValue]
        : defaultValue;
    }
  }
  return task;
}

// ── Registry Loading ──────────────────────────────────────────────────

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

// ── Task Scanning ─────────────────────────────────────────────────────

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
 * @param {boolean} [options.strict] - If true, fail on any error (including warnings).
 * @returns {{ tasks: Object[], errors: Object[], warnings: Object[] }}
 *   In non-strict mode, returns partial results with error list.
 *   In strict mode, throws on first error.
 */
function scanTasks(options) {
  const opts = options || {};
  const strict = opts.strict || false;
  const registry = opts.registry || loadRegistry(opts.registryPath);
  const projectsRoot = registry.projects_root || '';
  const projects = registry.projects || [];
  const allTasks = [];
  const allErrors = [];
  const allWarnings = [];

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
      // Malformed JSON -- record error
      const errorInfo = {
        type: 'parse_error',
        project: project.name,
        path: tasksFilePath,
        message: err.message,
      };

      logger.warn('Malformed tasks.json, skipping project', {
        project: project.name,
        path: tasksFilePath,
        error: err.message,
      });

      allErrors.push(errorInfo);

      if (strict) {
        const strictError = new Error(
          `Parse error in ${tasksFilePath}: ${err.message}`
        );
        strictError.code = 'SCANNER_STRICT_ERROR';
        strictError.errors = allErrors;
        strictError.warnings = allWarnings;
        throw strictError;
      }

      continue;
    }

    const fileMilestone = taskData.milestone || null;
    const tasks = taskData.tasks || [];

    // NOTE: All tasks from the same project share the same `project`
    // and `fileMilestone` object references. Downstream consumers must
    // not mutate `_project` or `_milestone` without cloning first.
    for (const task of tasks) {
      // Validate task schema
      const validation = validateTask(task, tasksFilePath, { strict });

      // Record validation errors
      for (const errMsg of validation.errors) {
        const errorInfo = {
          type: 'validation_error',
          project: project.name,
          path: tasksFilePath,
          taskId: task.id || 'unknown',
          message: errMsg,
        };
        allErrors.push(errorInfo);
        logger.warn('Task validation error', errorInfo);
      }

      // Record validation warnings
      for (const warnMsg of validation.warnings) {
        const warnInfo = {
          type: 'validation_warning',
          project: project.name,
          path: tasksFilePath,
          taskId: task.id || 'unknown',
          message: warnMsg,
        };
        allWarnings.push(warnInfo);
        logger.debug('Task validation warning', warnInfo);
      }

      // In strict mode, fail on any validation error or warning
      if (strict && (!validation.valid || validation.warnings.length > 0)) {
        const strictError = new Error(
          `Validation error in task '${task.id || 'unknown'}' at ${tasksFilePath}`
        );
        strictError.code = 'SCANNER_STRICT_ERROR';
        strictError.errors = allErrors;
        strictError.warnings = allWarnings;
        throw strictError;
      }

      // Skip tasks with validation errors (but include those with only warnings)
      if (validation.errors.length > 0) {
        continue;
      }

      // Apply defaults for optional fields
      applyTaskDefaults(task);

      task._project = project;
      task._projectName = project.name;
      task._milestone = fileMilestone;
      allTasks.push(task);
    }
  }

  return {
    tasks: allTasks,
    errors: allErrors,
    warnings: allWarnings,
  };
}

/**
 * Scan tasks and return only the tasks array (legacy API).
 *
 * This is a convenience wrapper for backward compatibility.
 * Use scanTasks() with error checking for new code.
 *
 * @param {Object} [options] - Same options as scanTasks().
 * @returns {Object[]} Array of tasks (errors are logged but not returned).
 */
function scanTasksLegacy(options) {
  const result = scanTasks(options);
  return result.tasks;
}

module.exports = {
  scanTasks,
  scanTasksLegacy,
  loadRegistry,
  // Exposed for testing
  validateTask,
  applyTaskDefaults,
  REQUIRED_TASK_FIELDS,
  OPTIONAL_TASK_FIELDS,
  KNOWN_TASK_FIELDS,
};
