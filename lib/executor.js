'use strict';

/**
 * Executor Module for the jade-dev-assist orchestrator.
 *
 * Spawns a Claude Code subprocess with the dispatcher-built prompt.
 * Manages the full lifecycle: dispatch -> spawn -> stream -> status update.
 *
 * See Section 3.5 of the orchestrator design doc.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { dispatchWorker } = require('./dispatcher');
const { createLogger } = require('./logger');

const logger = createLogger('executor');

// ── Tiered Model Configuration ──────────────────────────────────────

/**
 * Default Ollama base URL used when modelTier is 'local'.
 * Can be overridden via OLLAMA_BASE_URL environment variable.
 */
const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';

/**
 * Get the Ollama base URL from environment or default.
 *
 * @returns {string} The Ollama base URL.
 */
function getOllamaBaseUrl() {
    return process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL;
}

/**
 * Build spawn arguments and environment for a given model tier.
 *
 * - 'opus' (or unspecified): uses default claude command with no --model flag.
 * - 'local': adds --model qwen3-coder flag and sets ANTHROPIC_BASE_URL
 *   and ANTHROPIC_AUTH_TOKEN environment variables for Ollama.
 *
 * @param {string} [modelTier] - The model tier: 'opus', 'local', or undefined (defaults to 'opus').
 * @returns {{ args: string[], env: Object|undefined }}
 */
function buildTierConfig(modelTier) {
    const tier = modelTier || 'opus';

    const baseArgs = ['--print', '--dangerouslySkipPermissions'];

    if (tier === 'local') {
        return {
            args: [...baseArgs, '--model', 'qwen3-coder'],
            env: {
                ...process.env,
                ANTHROPIC_AUTH_TOKEN: 'ollama',
                ANTHROPIC_BASE_URL: getOllamaBaseUrl()
            }
        };
    }

    // Default: opus tier -- no additional flags or env overrides
    return {
        args: baseArgs,
        env: undefined
    };
}

// ── Task Lookup ─────────────────────────────────────────────────────

/**
 * Find a task by ID in a project's tasks.json file.
 *
 * Scans the tasks.json to locate the task object and derives
 * the project registry entry from the tasks.json metadata and
 * the task's embedded _project data.
 *
 * @param {string} taskId       - Full task ID (e.g. "test-project/test-task").
 * @param {string} projectsRoot - Root directory containing project directories.
 * @returns {{ task: Object, project: Object, tasksJsonPath: string }}
 * @throws {Error} If the task is not found.
 */
function findTask(taskId, projectsRoot) {
    // Derive project name from task ID (format: "project-name/task-name")
    const slashIdx = taskId.indexOf('/');
    if (slashIdx === -1) {
        throw new Error(`Invalid task ID format: "${taskId}" (expected "project/task")`);
    }
    const projectName = taskId.slice(0, slashIdx);
    const projectPath = path.join(projectsRoot, projectName);
    const tasksJsonPath = path.join(projectPath, '.claude', 'tasks', 'tasks.json');

    let data;
    try {
        const content = fs.readFileSync(tasksJsonPath, 'utf8');
        data = JSON.parse(content);
    } catch (err) {
        if (err.code === 'ENOENT') {
            throw new Error(`Tasks file not found for project "${projectName}": ${tasksJsonPath}`);
        }
        throw err;
    }

    const tasks = data.tasks || [];
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
        throw new Error(`Task not found: "${taskId}" in ${tasksJsonPath}`);
    }

    // Build a project registry entry from available data
    const project = task._project || {
        name: data.project || projectName,
        path: projectName,
        status: 'unknown',
        language: 'javascript',
        test_command: null
    };

    // Ensure project has name and path
    if (!project.name) {
        project.name = data.project || projectName;
    }
    if (!project.path) {
        project.path = projectName;
    }

    return { task, project, tasksJsonPath };
}

// ── Status Update ───────────────────────────────────────────────────

/**
 * Update a task's status in its tasks.json file and record a history entry.
 *
 * @param {string} taskId        - The task ID to update.
 * @param {string} fromStatus    - Previous status.
 * @param {string} toStatus      - New status.
 * @param {string} tasksJsonPath - Absolute path to tasks.json.
 */
function updateTaskStatus(taskId, fromStatus, toStatus, tasksJsonPath) {
    const content = fs.readFileSync(tasksJsonPath, 'utf8');
    const data = JSON.parse(content);
    const tasks = data.tasks || [];

    for (const task of tasks) {
        if (task.id === taskId) {
            task.status = toStatus;

            // Add history entry
            if (!Array.isArray(task.history)) {
                task.history = [];
            }
            task.history.push({
                timestamp: new Date().toISOString(),
                from_status: fromStatus,
                to_status: toStatus
            });

            // Update timestamp
            task.updated_at = new Date().toISOString();
            break;
        }
    }

    fs.writeFileSync(tasksJsonPath, JSON.stringify(data, null, 2) + '\n');
}

// ── Execute Worker ──────────────────────────────────────────────────

/**
 * Execute a swarm worker for a given task.
 *
 * Supports tiered model dispatch via the task's `modelTier` field:
 * - 'opus' (default): spawns claude with default API (no --model flag).
 * - 'local': spawns claude with `--model qwen3-coder` and sets
 *   ANTHROPIC_AUTH_TOKEN=ollama, ANTHROPIC_BASE_URL from config.
 *
 * 1. Looks up the task in the project's tasks.json.
 * 2. Calls dispatchWorker() to build the prompt and set status to in_progress.
 * 3. Determines model tier from task.modelTier (defaults to 'opus').
 * 4. Spawns `claude` with tier-appropriate flags and env on stdin.
 * 5. Streams stdout/stderr to optional callbacks.
 * 6. On completion (exit 0): updates status to "completed".
 * 7. On failure (non-zero exit): updates status to "failed".
 * 8. Records execution history with timestamps.
 *
 * @param {string} taskId   - Full task ID (e.g. "project/task-name").
 * @param {Object} [options]
 * @param {string} [options.projectsRoot] - Root directory containing projects.
 * @param {Function} [options.onStdout]   - Callback for stdout data chunks.
 * @param {Function} [options.onStderr]   - Callback for stderr data chunks.
 * @param {Function} [options._spawnFn]   - Override spawn for testing (dependency injection).
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: number, startedAt: string, completedAt: string }>}
 */
function executeWorker(taskId, options) {
    const opts = options || {};
    const projectsRoot = opts.projectsRoot || '';
    const spawnFn = opts._spawnFn || spawn;
    const onStdout = opts.onStdout || null;
    const onStderr = opts.onStderr || null;

    // 1. Look up the task
    const { task, project, tasksJsonPath } = findTask(taskId, projectsRoot);

    // 2. Call dispatchWorker to build prompt and set status to in_progress
    const dispatch = dispatchWorker(task, project, {
        projectsRoot,
        dryRun: true
    });

    const startedAt = new Date().toISOString();

    // 3. Determine model tier from the task definition
    const modelTier = task.modelTier || 'opus';
    const tierConfig = buildTierConfig(modelTier);

    // 4. Spawn the claude subprocess with tier-specific args and env
    const spawnOpts = {
        cwd: dispatch.workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe']
    };
    if (tierConfig.env) {
        spawnOpts.env = tierConfig.env;
    }

    const child = spawnFn('claude', tierConfig.args, spawnOpts);

    // Write the prompt to stdin and close it
    child.stdin.write(dispatch.prompt);
    child.stdin.end();

    // 5. Collect stdout and stderr
    const stdoutChunks = [];
    const stderrChunks = [];

    child.stdout.on('data', (data) => {
        stdoutChunks.push(data);
        if (onStdout) {
            onStdout(data);
        }
    });

    child.stderr.on('data', (data) => {
        stderrChunks.push(data);
        if (onStderr) {
            onStderr(data);
        }
    });

    // 6. Return a promise that resolves/rejects on process exit
    return new Promise((resolve, reject) => {
        child.on('close', (exitCode) => {
            const completedAt = new Date().toISOString();
            const stdout = Buffer.concat(stdoutChunks.map(c =>
                Buffer.isBuffer(c) ? c : Buffer.from(c)
            )).toString('utf8');
            const stderr = Buffer.concat(stderrChunks.map(c =>
                Buffer.isBuffer(c) ? c : Buffer.from(c)
            )).toString('utf8');

            if (exitCode === 0) {
                // Success -- update status to completed
                try {
                    updateTaskStatus(taskId, 'in_progress', 'completed', tasksJsonPath);
                } catch (err) {
                    logger.warn('Could not update task status to completed', {
                        taskId,
                        error: err.message
                    });
                }

                resolve({
                    stdout,
                    stderr,
                    exitCode,
                    startedAt,
                    completedAt
                });
            } else {
                // Failure -- update status to failed
                try {
                    updateTaskStatus(taskId, 'in_progress', 'failed', tasksJsonPath);
                } catch (err) {
                    logger.warn('Could not update task status to failed', {
                        taskId,
                        error: err.message
                    });
                }

                const error = new Error(
                    `Worker exited with code ${exitCode}: ${stderr || '(no stderr)'}`
                );
                error.exitCode = exitCode;
                error.stdout = stdout;
                error.stderr = stderr;
                error.startedAt = startedAt;
                error.completedAt = completedAt;
                reject(error);
            }
        });
    });
}

module.exports = {
    executeWorker,
    buildTierConfig,
    getOllamaBaseUrl,
    DEFAULT_OLLAMA_BASE_URL
};
