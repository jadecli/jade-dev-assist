#!/usr/bin/env node

/**
 * Workflow Orchestrator Skill
 *
 * Coordinates between jade-swarm-superpowers and jade-dev-assist.
 * Triggers swarm runs, monitors progress, updates GitHub Projects board.
 *
 * Key capabilities:
 * 1. Generate task lists from plans
 * 2. Trigger swarm runs via jade-swarm-superpowers
 * 3. Monitor swarm status via filesystem
 * 4. Update GitHub Projects via gh CLI
 * 5. Detect file conflicts between tasks
 * 6. Generate run summaries and token reports
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Task List Generation ─────────────────────────────────────────────

/**
 * Generate task list from a plan or description.
 *
 * Parses numbered lists, bullet lists, or plain text into structured tasks.
 *
 * @param {string} plan - Plan text (numbered list, bullets, or paragraphs)
 * @returns {Array<Object>} Array of task objects with id and title
 */
function generateTaskList(plan) {
    if (!plan || typeof plan !== 'string') {
        return [];
    }

    const lines = plan.trim().split('\n').filter(line => line.trim());
    const tasks = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip empty lines
        if (!line) continue;

        // Parse numbered list (1., 2., etc.)
        const numberedMatch = line.match(/^\d+\.\s+(.+)$/);
        if (numberedMatch) {
            tasks.push({
                id: `task-${i + 1}`,
                title: numberedMatch[1].trim()
            });
            continue;
        }

        // Parse bullet list (-, *, •)
        const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
        if (bulletMatch) {
            tasks.push({
                id: `task-${i + 1}`,
                title: bulletMatch[1].trim()
            });
            continue;
        }

        // Plain paragraph - treat each as a task
        if (line.length > 10) { // Ignore very short lines
            tasks.push({
                id: `task-${i + 1}`,
                title: line
            });
        }
    }

    return tasks;
}

// ── Swarm Integration ────────────────────────────────────────────────

/**
 * Trigger a swarm run with the given tasks.
 *
 * @param {Object} options
 * @param {Array<Object>} options.tasks - Tasks to execute
 * @param {string} options.projectPath - Project directory
 * @param {boolean} [options.dryRun=false] - If true, don't actually run
 * @returns {Object} Run metadata { runId, status, tasks }
 * @throws {Error} If required fields missing
 */
function triggerSwarmRun(options) {
    if (!options || !options.tasks || !options.projectPath) {
        throw new Error('triggerSwarmRun: tasks and projectPath are required');
    }

    const { tasks, projectPath, dryRun = false } = options;
    const runId = `run-${Date.now()}`;

    // In dry run mode, just return metadata
    if (dryRun) {
        return {
            runId,
            status: 'pending',
            tasks: tasks.length,
            dryRun: true
        };
    }

    // Create run directory structure
    const swarmDir = path.join(projectPath, '.jade-swarm', 'runs', runId);
    fs.mkdirSync(swarmDir, { recursive: true });

    // Write tasks file
    const tasksFile = path.join(swarmDir, 'tasks.json');
    fs.writeFileSync(tasksFile, JSON.stringify({ tasks }, null, 2));

    // Write status file
    const statusFile = path.join(swarmDir, 'status.json');
    fs.writeFileSync(statusFile, JSON.stringify({
        runId,
        status: 'pending',
        tasksTotal: tasks.length,
        tasksCompleted: 0,
        tasksFailed: 0,
        startTime: Date.now()
    }, null, 2));

    return {
        runId,
        status: 'pending',
        tasks: tasks.length,
        swarmDir
    };
}

/**
 * Monitor swarm run status.
 *
 * Reads status from filesystem (~/.jade-swarm/runs/{runId}/status.json).
 *
 * @param {string} runId - Run identifier
 * @param {Object} [options]
 * @param {string} [options.baseDir] - Base directory (default: HOME/.jade-swarm)
 * @returns {Object} Status object
 */
function monitorSwarmStatus(runId, options = {}) {
    const baseDir = options.baseDir || path.join(
        process.env.HOME || process.env.USERPROFILE,
        '.jade-swarm'
    );

    const statusFile = path.join(baseDir, '.jade-swarm', 'runs', runId, 'status.json');

    // Check if run exists
    if (!fs.existsSync(statusFile)) {
        return {
            runId,
            status: 'not_found'
        };
    }

    // Read status
    try {
        const content = fs.readFileSync(statusFile, 'utf8');
        return JSON.parse(content);
    } catch (err) {
        return {
            runId,
            status: 'error',
            error: err.message
        };
    }
}

// ── GitHub Projects Integration ──────────────────────────────────────

/**
 * Update GitHub Projects board via gh CLI.
 *
 * Uses GraphQL mutation via gh CLI to update project item field values.
 *
 * @param {Object} options
 * @param {string} options.itemId - Project item ID (node ID)
 * @param {string} options.fieldId - Field ID to update
 * @param {string} options.value - New value
 * @param {string} [options.projectId] - Project ID (optional, can be inferred)
 * @param {boolean} [options.dryRun=false] - If true, return command without executing
 * @returns {Object} Result { success, command, output? }
 * @throws {Error} If required fields missing
 */
function updateGitHubProject(options) {
    if (!options || !options.itemId || !options.fieldId || !options.value) {
        throw new Error('updateGitHubProject: itemId, fieldId, and value are required');
    }

    const { itemId, fieldId, value, projectId, dryRun = false } = options;

    // Construct gh CLI command
    const command = projectId
        ? `gh project item-edit --project-id "${projectId}" --id "${itemId}" --field-id "${fieldId}" --text "${value}"`
        : `gh project item-edit --id "${itemId}" --field-id "${fieldId}" --text "${value}"`;

    // In dry run mode, return command without executing
    if (dryRun) {
        return {
            success: true,
            command,
            dryRun: true
        };
    }

    // Execute command
    try {
        const output = execSync(command, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
        });

        return {
            success: true,
            command,
            output: output.trim()
        };
    } catch (err) {
        return {
            success: false,
            command,
            error: err.message,
            stderr: err.stderr ? err.stderr.toString() : ''
        };
    }
}

// ── Conflict Detection ───────────────────────────────────────────────

/**
 * Detect when multiple tasks modified overlapping files.
 *
 * @param {Array<Object>} tasks - Tasks with modifiedFiles arrays
 * @returns {Array<Object>} Conflicts: { file, tasks: [taskIds] }
 */
function detectConflicts(tasks) {
    if (!Array.isArray(tasks) || tasks.length === 0) {
        return [];
    }

    // Build file -> tasks mapping
    const fileToTasks = new Map();

    for (const task of tasks) {
        if (!task.modifiedFiles || !Array.isArray(task.modifiedFiles)) {
            continue;
        }

        for (const file of task.modifiedFiles) {
            if (!fileToTasks.has(file)) {
                fileToTasks.set(file, []);
            }
            fileToTasks.get(file).push(task.id);
        }
    }

    // Find files with multiple tasks
    const conflicts = [];

    for (const [file, taskIds] of fileToTasks.entries()) {
        if (taskIds.length > 1) {
            conflicts.push({
                file,
                tasks: taskIds
            });
        }
    }

    return conflicts;
}

// ── Reporting ────────────────────────────────────────────────────────

/**
 * Generate swarm run summary.
 *
 * @param {Object} runData - Run data with stats
 * @returns {string} Formatted summary
 */
function generateRunSummary(runData) {
    const {
        runId,
        tasksTotal = 0,
        tasksCompleted = 0,
        tasksFailed = 0,
        tasksCached = 0,
        startTime,
        endTime
    } = runData;

    const duration = endTime && startTime
        ? Math.round((endTime - startTime) / 1000)
        : 0;

    const lines = [
        '# Swarm Run Summary',
        '',
        `**Run ID:** ${runId}`,
        '',
        '## Task Completion',
        '',
        `- Total: ${tasksTotal}`,
        `- Completed: ${tasksCompleted}`,
        `- Failed: ${tasksFailed}`,
        `- Cached: ${tasksCached}`,
        '',
        '## Timing',
        '',
        `- Duration: ${duration}s`
    ];

    return lines.join('\n');
}

/**
 * Generate token usage report.
 *
 * @param {Object} tokenData - Token usage data
 * @returns {string} Formatted report
 */
function generateTokenReport(tokenData) {
    const {
        totalTokens = 0,
        cachedTokens = 0,
        tasks = []
    } = tokenData;

    const lines = [
        '# Token Usage Report',
        '',
        '## Summary',
        '',
        `- Total tokens: ${totalTokens}`,
        `- Cached tokens: ${cachedTokens}`,
        `- Actual usage: ${totalTokens - cachedTokens}`,
        ''
    ];

    if (tasks.length > 0) {
        lines.push('## Per-Task Breakdown', '');

        for (const task of tasks) {
            const { id, tokens = 0, cached = 0 } = task;
            lines.push(`- **${id}**: ${tokens} tokens (${cached} cached)`);
        }
    }

    return lines.join('\n');
}

// ── Exports ──────────────────────────────────────────────────────────

module.exports = {
    generateTaskList,
    triggerSwarmRun,
    monitorSwarmStatus,
    updateGitHubProject,
    detectConflicts,
    generateRunSummary,
    generateTokenReport
};
