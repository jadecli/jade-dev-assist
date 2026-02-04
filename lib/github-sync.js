'use strict';

/**
 * GitHub Sync Module for jade-dev-assist orchestrator.
 *
 * Provides bidirectional synchronization between local tasks.json files
 * and GitHub Issues. Uses the `gh` CLI for all GitHub API operations.
 *
 * Features:
 * - Create GitHub Issues from tasks
 * - Update issue labels/status when task status changes
 * - Close issues when tasks complete
 * - Sync issue changes back to tasks.json
 *
 * See task jade-dev-assist/github-sync for requirements.
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createLogger } = require('./logger');

const logger = createLogger('github-sync');

// ── Configuration ────────────────────────────────────────────────────

/**
 * Default label mapping from task status to GitHub labels.
 * Can be overridden via options.labelMapping.
 */
const DEFAULT_LABEL_MAPPING = {
    status: {
        pending: 'status:pending',
        in_progress: 'status:in-progress',
        completed: 'status:completed',
        blocked: 'status:blocked',
        failed: 'status:failed'
    },
    complexity: {
        S: 'size:small',
        M: 'size:medium',
        L: 'size:large',
        XL: 'size:xlarge'
    },
    // Reverse mapping for syncing from GitHub to tasks.json
    reverseStatus: {
        'status:pending': 'pending',
        'status:in-progress': 'in_progress',
        'status:completed': 'completed',
        'status:blocked': 'blocked',
        'status:failed': 'failed'
    }
};

/**
 * Default options for GitHub sync operations.
 */
const DEFAULT_OPTIONS = {
    labelMapping: DEFAULT_LABEL_MAPPING,
    dryRun: false,
    verbose: false
};

// ── GitHub CLI Helpers ───────────────────────────────────────────────

/**
 * Execute a gh CLI command and return the result.
 *
 * @param {string[]} args - Command arguments (without 'gh' prefix).
 * @param {Object} [options]
 * @param {boolean} [options.json] - Parse output as JSON.
 * @param {boolean} [options.ignoreErrors] - Don't throw on non-zero exit.
 * @returns {{ success: boolean, output: string|Object, error: string }}
 */
function execGh(args, options = {}) {
    const cmd = ['gh', ...args];

    logger.debug('Executing gh command', { args });

    try {
        const result = spawnSync('gh', args, {
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024 // 10MB
        });

        if (result.error) {
            throw result.error;
        }

        if (result.status !== 0 && !options.ignoreErrors) {
            const error = new Error(`gh command failed: ${result.stderr || 'Unknown error'}`);
            error.code = 'GH_CLI_ERROR';
            error.exitCode = result.status;
            error.stderr = result.stderr;
            throw error;
        }

        let output = result.stdout || '';
        if (options.json && output.trim()) {
            try {
                output = JSON.parse(output);
            } catch (parseErr) {
                logger.warn('Failed to parse gh output as JSON', { output });
            }
        }

        return {
            success: result.status === 0,
            output,
            error: result.stderr || ''
        };
    } catch (err) {
        if (options.ignoreErrors) {
            return {
                success: false,
                output: '',
                error: err.message
            };
        }
        throw err;
    }
}

/**
 * Check if gh CLI is available and authenticated.
 *
 * @returns {{ available: boolean, authenticated: boolean, user: string|null }}
 */
function checkGhCli() {
    // Check if gh is available
    const versionResult = execGh(['--version'], { ignoreErrors: true });
    if (!versionResult.success) {
        return { available: false, authenticated: false, user: null };
    }

    // Check if authenticated
    const authResult = execGh(['auth', 'status'], { ignoreErrors: true });
    if (!authResult.success) {
        return { available: true, authenticated: false, user: null };
    }

    // Extract username from auth status output
    const match = authResult.output.match(/Logged in to .+ as (.+?) /);
    const user = match ? match[1] : null;

    return { available: true, authenticated: true, user };
}

// ── Issue Body Formatting ────────────────────────────────────────────

/**
 * Format task data as a GitHub Issue body.
 *
 * @param {Object} task - The task object from tasks.json.
 * @returns {string} Formatted markdown body for the issue.
 */
function formatIssueBody(task) {
    const lines = [];

    // Description
    if (task.description) {
        lines.push('## Description');
        lines.push('');
        lines.push(task.description);
        lines.push('');
    }

    // Feature details
    if (task.feature) {
        if (task.feature.description) {
            lines.push('## Feature');
            lines.push('');
            lines.push(task.feature.description);
            lines.push('');
        }

        if (task.feature.benefit) {
            lines.push('**Benefit:** ' + task.feature.benefit);
            lines.push('');
        }

        if (task.feature.acceptance_criteria && task.feature.acceptance_criteria.length > 0) {
            lines.push('## Acceptance Criteria');
            lines.push('');
            for (const criterion of task.feature.acceptance_criteria) {
                lines.push(`- [ ] ${criterion}`);
            }
            lines.push('');
        }
    }

    // Task metadata
    lines.push('## Task Metadata');
    lines.push('');
    lines.push(`- **Task ID:** \`${task.id}\``);
    lines.push(`- **Status:** ${task.status || 'pending'}`);
    lines.push(`- **Complexity:** ${task.complexity || 'M'}`);

    if (task.milestone) {
        lines.push(`- **Milestone:** ${task.milestone}`);
    }

    if (task.blocked_by && task.blocked_by.length > 0) {
        lines.push(`- **Blocked By:** ${task.blocked_by.join(', ')}`);
    }

    if (task.unlocks && task.unlocks.length > 0) {
        lines.push(`- **Unlocks:** ${task.unlocks.join(', ')}`);
    }

    if (task.relevant_files && task.relevant_files.length > 0) {
        lines.push('');
        lines.push('## Relevant Files');
        lines.push('');
        for (const file of task.relevant_files) {
            lines.push(`- \`${file}\``);
        }
    }

    // Footer
    lines.push('');
    lines.push('---');
    lines.push('*Synced from local tasks.json by jade-dev-assist*');

    return lines.join('\n');
}

/**
 * Extract task ID from an issue body.
 *
 * @param {string} body - The issue body text.
 * @returns {string|null} The task ID or null if not found.
 */
function extractTaskIdFromBody(body) {
    if (!body) return null;
    const match = body.match(/\*\*Task ID:\*\*\s*`([^`]+)`/);
    return match ? match[1] : null;
}

// ── Core Sync Functions ──────────────────────────────────────────────

/**
 * Create a GitHub Issue from a task.
 *
 * @param {Object} task - The task object from tasks.json.
 * @param {Object} [options]
 * @param {string} [options.repo] - Repository in "owner/repo" format.
 * @param {Object} [options.labelMapping] - Custom label mapping.
 * @param {boolean} [options.dryRun] - If true, don't actually create the issue.
 * @returns {{ success: boolean, issueNumber: number|null, issueUrl: string|null, error: string|null }}
 */
function createIssueFromTask(task, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const labelMapping = opts.labelMapping || DEFAULT_LABEL_MAPPING;

    // Build labels array
    const labels = [];

    // Status label
    const statusLabel = labelMapping.status[task.status];
    if (statusLabel) {
        labels.push(statusLabel);
    }

    // Complexity label
    const complexityLabel = labelMapping.complexity[task.complexity];
    if (complexityLabel) {
        labels.push(complexityLabel);
    }

    // Task labels (e.g., "feature", "bugfix")
    if (task.labels && Array.isArray(task.labels)) {
        labels.push(...task.labels);
    }

    // Build issue title
    const title = task.title;

    // Build issue body
    const body = formatIssueBody(task);

    // Build gh issue create command
    const args = ['issue', 'create', '--title', title, '--body', body];

    // Add labels
    if (labels.length > 0) {
        args.push('--label', labels.join(','));
    }

    // Add repo if specified
    if (opts.repo) {
        args.push('--repo', opts.repo);
    }

    logger.info('Creating GitHub issue from task', {
        taskId: task.id,
        title,
        labels,
        dryRun: opts.dryRun
    });

    if (opts.dryRun) {
        return {
            success: true,
            issueNumber: null,
            issueUrl: null,
            error: null,
            dryRun: true
        };
    }

    try {
        const result = execGh(args);

        // Parse issue URL from output (gh issue create outputs the URL)
        const url = result.output.trim();
        const issueMatch = url.match(/\/issues\/(\d+)$/);
        const issueNumber = issueMatch ? parseInt(issueMatch[1], 10) : null;

        logger.info('Created GitHub issue', {
            taskId: task.id,
            issueNumber,
            issueUrl: url
        });

        return {
            success: true,
            issueNumber,
            issueUrl: url,
            error: null
        };
    } catch (err) {
        logger.error('Failed to create GitHub issue', {
            taskId: task.id,
            error: err.message
        });

        return {
            success: false,
            issueNumber: null,
            issueUrl: null,
            error: err.message
        };
    }
}

/**
 * Update a GitHub Issue from a task (labels and status).
 *
 * @param {Object} task - The task object from tasks.json.
 * @param {number} issueNumber - The GitHub issue number to update.
 * @param {Object} [options]
 * @param {string} [options.repo] - Repository in "owner/repo" format.
 * @param {Object} [options.labelMapping] - Custom label mapping.
 * @param {boolean} [options.dryRun] - If true, don't actually update.
 * @returns {{ success: boolean, error: string|null }}
 */
function updateIssueFromTask(task, issueNumber, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const labelMapping = opts.labelMapping || DEFAULT_LABEL_MAPPING;

    // Build new labels array
    const labels = [];

    // Status label
    const statusLabel = labelMapping.status[task.status];
    if (statusLabel) {
        labels.push(statusLabel);
    }

    // Complexity label
    const complexityLabel = labelMapping.complexity[task.complexity];
    if (complexityLabel) {
        labels.push(complexityLabel);
    }

    // Task labels
    if (task.labels && Array.isArray(task.labels)) {
        labels.push(...task.labels);
    }

    logger.info('Updating GitHub issue from task', {
        taskId: task.id,
        issueNumber,
        labels,
        dryRun: opts.dryRun
    });

    if (opts.dryRun) {
        return { success: true, error: null, dryRun: true };
    }

    try {
        // First, remove existing status labels
        const existingStatusLabels = Object.values(labelMapping.status);
        const existingComplexityLabels = Object.values(labelMapping.complexity);
        const labelsToRemove = [...existingStatusLabels, ...existingComplexityLabels];

        // Get current issue labels
        const viewArgs = ['issue', 'view', String(issueNumber), '--json', 'labels'];
        if (opts.repo) {
            viewArgs.push('--repo', opts.repo);
        }

        const viewResult = execGh(viewArgs, { json: true, ignoreErrors: true });
        let currentLabels = [];
        if (viewResult.success && viewResult.output && viewResult.output.labels) {
            currentLabels = viewResult.output.labels.map(l => l.name);
        }

        // Filter out old status/complexity labels, keep others
        const preservedLabels = currentLabels.filter(
            l => !labelsToRemove.includes(l)
        );

        // Combine preserved labels with new ones
        const finalLabels = [...new Set([...preservedLabels, ...labels])];

        // Update issue with new labels
        const editArgs = ['issue', 'edit', String(issueNumber)];

        // Clear all labels and set new ones
        if (finalLabels.length > 0) {
            editArgs.push('--add-label', finalLabels.join(','));
        }

        // Remove old status/complexity labels that aren't in final set
        for (const oldLabel of labelsToRemove) {
            if (currentLabels.includes(oldLabel) && !finalLabels.includes(oldLabel)) {
                editArgs.push('--remove-label', oldLabel);
            }
        }

        if (opts.repo) {
            editArgs.push('--repo', opts.repo);
        }

        execGh(editArgs);

        logger.info('Updated GitHub issue', {
            taskId: task.id,
            issueNumber,
            finalLabels
        });

        return { success: true, error: null };
    } catch (err) {
        logger.error('Failed to update GitHub issue', {
            taskId: task.id,
            issueNumber,
            error: err.message
        });

        return { success: false, error: err.message };
    }
}

/**
 * Close a GitHub Issue when task completes.
 *
 * @param {number} issueNumber - The GitHub issue number to close.
 * @param {Object} [options]
 * @param {string} [options.repo] - Repository in "owner/repo" format.
 * @param {string} [options.comment] - Optional closing comment.
 * @param {boolean} [options.dryRun] - If true, don't actually close.
 * @returns {{ success: boolean, error: string|null }}
 */
function closeIssueOnComplete(issueNumber, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    logger.info('Closing GitHub issue', {
        issueNumber,
        dryRun: opts.dryRun
    });

    if (opts.dryRun) {
        return { success: true, error: null, dryRun: true };
    }

    try {
        // Add comment if provided
        if (opts.comment) {
            const commentArgs = ['issue', 'comment', String(issueNumber), '--body', opts.comment];
            if (opts.repo) {
                commentArgs.push('--repo', opts.repo);
            }
            execGh(commentArgs);
        }

        // Close the issue
        const closeArgs = ['issue', 'close', String(issueNumber)];
        if (opts.repo) {
            closeArgs.push('--repo', opts.repo);
        }
        execGh(closeArgs);

        logger.info('Closed GitHub issue', { issueNumber });

        return { success: true, error: null };
    } catch (err) {
        logger.error('Failed to close GitHub issue', {
            issueNumber,
            error: err.message
        });

        return { success: false, error: err.message };
    }
}

/**
 * Sync a GitHub Issue's state back to tasks.json.
 *
 * Reads the issue's labels to determine status and updates the local task.
 *
 * @param {Object} issue - The GitHub issue object (from gh issue view --json).
 * @param {Object} [options]
 * @param {string} [options.projectsRoot] - Root directory for projects.
 * @param {Object} [options.labelMapping] - Custom label mapping.
 * @param {boolean} [options.dryRun] - If true, don't actually update tasks.json.
 * @returns {{ success: boolean, taskId: string|null, newStatus: string|null, error: string|null }}
 */
function syncIssueToTask(issue, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const labelMapping = opts.labelMapping || DEFAULT_LABEL_MAPPING;
    const projectsRoot = opts.projectsRoot || '';

    // Extract task ID from issue body
    const taskId = extractTaskIdFromBody(issue.body);
    if (!taskId) {
        return {
            success: false,
            taskId: null,
            newStatus: null,
            error: 'Could not extract task ID from issue body'
        };
    }

    // Determine status from labels
    const issueLabels = (issue.labels || []).map(l => l.name || l);
    let newStatus = null;

    for (const label of issueLabels) {
        const status = labelMapping.reverseStatus[label];
        if (status) {
            newStatus = status;
            break;
        }
    }

    // Check if issue is closed - override status to completed
    if (issue.state === 'CLOSED' || issue.state === 'closed') {
        newStatus = 'completed';
    }

    if (!newStatus) {
        logger.debug('No status label found on issue', {
            issueNumber: issue.number,
            labels: issueLabels
        });
        return {
            success: true, // Not an error, just no status to sync
            taskId,
            newStatus: null,
            error: null
        };
    }

    logger.info('Syncing issue status to task', {
        issueNumber: issue.number,
        taskId,
        newStatus,
        dryRun: opts.dryRun
    });

    if (opts.dryRun) {
        return {
            success: true,
            taskId,
            newStatus,
            error: null,
            dryRun: true
        };
    }

    try {
        // Find and update the task
        const { updateTaskStatus } = require('./status-updater');
        updateTaskStatus(taskId, newStatus, {
            projectsRoot,
            summary: `Synced from GitHub issue #${issue.number}`
        });

        logger.info('Synced issue to task', {
            taskId,
            newStatus,
            issueNumber: issue.number
        });

        return {
            success: true,
            taskId,
            newStatus,
            error: null
        };
    } catch (err) {
        logger.error('Failed to sync issue to task', {
            taskId,
            issueNumber: issue.number,
            error: err.message
        });

        return {
            success: false,
            taskId,
            newStatus,
            error: err.message
        };
    }
}

// ── Batch Sync Operations ────────────────────────────────────────────

/**
 * Fetch all open issues from a repository.
 *
 * @param {Object} [options]
 * @param {string} [options.repo] - Repository in "owner/repo" format.
 * @param {number} [options.limit] - Maximum issues to fetch (default: 100).
 * @returns {{ success: boolean, issues: Object[], error: string|null }}
 */
function fetchOpenIssues(options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const limit = opts.limit || 100;

    const args = [
        'issue', 'list',
        '--state', 'open',
        '--limit', String(limit),
        '--json', 'number,title,body,labels,state,url'
    ];

    if (opts.repo) {
        args.push('--repo', opts.repo);
    }

    try {
        const result = execGh(args, { json: true });

        return {
            success: true,
            issues: Array.isArray(result.output) ? result.output : [],
            error: null
        };
    } catch (err) {
        logger.error('Failed to fetch open issues', { error: err.message });
        return {
            success: false,
            issues: [],
            error: err.message
        };
    }
}

/**
 * Fetch a single issue by number.
 *
 * @param {number} issueNumber - The issue number.
 * @param {Object} [options]
 * @param {string} [options.repo] - Repository in "owner/repo" format.
 * @returns {{ success: boolean, issue: Object|null, error: string|null }}
 */
function fetchIssue(issueNumber, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    const args = [
        'issue', 'view', String(issueNumber),
        '--json', 'number,title,body,labels,state,url'
    ];

    if (opts.repo) {
        args.push('--repo', opts.repo);
    }

    try {
        const result = execGh(args, { json: true });

        return {
            success: true,
            issue: result.output,
            error: null
        };
    } catch (err) {
        logger.error('Failed to fetch issue', {
            issueNumber,
            error: err.message
        });
        return {
            success: false,
            issue: null,
            error: err.message
        };
    }
}

/**
 * Sync all tasks from a project to GitHub Issues.
 *
 * Creates issues for tasks without github_issue field, updates existing ones.
 *
 * @param {Object[]} tasks - Array of task objects.
 * @param {Object} [options]
 * @param {string} [options.repo] - Repository in "owner/repo" format.
 * @param {boolean} [options.dryRun] - If true, don't actually create/update.
 * @returns {{ created: number, updated: number, errors: string[] }}
 */
function syncTasksToIssues(tasks, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const results = { created: 0, updated: 0, errors: [] };

    for (const task of tasks) {
        // Skip completed tasks without existing issues
        if (task.status === 'completed' && !task.github_issue) {
            continue;
        }

        if (task.github_issue) {
            // Extract issue number from github_issue field
            // Format: "owner/repo#123" or just "123"
            const match = task.github_issue.match(/#?(\d+)$/);
            if (match) {
                const issueNumber = parseInt(match[1], 10);

                // Update existing issue
                const updateResult = updateIssueFromTask(task, issueNumber, opts);
                if (updateResult.success) {
                    results.updated++;

                    // Close if completed
                    if (task.status === 'completed') {
                        closeIssueOnComplete(issueNumber, opts);
                    }
                } else {
                    results.errors.push(`Failed to update issue #${issueNumber}: ${updateResult.error}`);
                }
            }
        } else {
            // Create new issue
            const createResult = createIssueFromTask(task, opts);
            if (createResult.success) {
                results.created++;
            } else {
                results.errors.push(`Failed to create issue for ${task.id}: ${createResult.error}`);
            }
        }
    }

    return results;
}

/**
 * Sync all GitHub Issues back to tasks.json.
 *
 * @param {Object} [options]
 * @param {string} [options.repo] - Repository in "owner/repo" format.
 * @param {string} [options.projectsRoot] - Root directory for projects.
 * @param {boolean} [options.dryRun] - If true, don't actually update.
 * @returns {{ synced: number, skipped: number, errors: string[] }}
 */
function syncIssuesToTasks(options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const results = { synced: 0, skipped: 0, errors: [] };

    // Fetch all open issues
    const fetchResult = fetchOpenIssues(opts);
    if (!fetchResult.success) {
        results.errors.push(`Failed to fetch issues: ${fetchResult.error}`);
        return results;
    }

    for (const issue of fetchResult.issues) {
        const syncResult = syncIssueToTask(issue, opts);

        if (syncResult.success && syncResult.newStatus) {
            results.synced++;
        } else if (syncResult.success) {
            results.skipped++;
        } else {
            results.errors.push(`Failed to sync issue #${issue.number}: ${syncResult.error}`);
        }
    }

    return results;
}

// ── Exports ──────────────────────────────────────────────────────────

module.exports = {
    // Core functions (required by task)
    createIssueFromTask,
    updateIssueFromTask,
    closeIssueOnComplete,
    syncIssueToTask,

    // Batch operations
    syncTasksToIssues,
    syncIssuesToTasks,

    // Utilities
    checkGhCli,
    fetchOpenIssues,
    fetchIssue,
    formatIssueBody,
    extractTaskIdFromBody,
    execGh,

    // Configuration
    DEFAULT_LABEL_MAPPING,
    DEFAULT_OPTIONS
};
