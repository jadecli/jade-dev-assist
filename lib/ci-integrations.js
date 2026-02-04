'use strict';

/**
 * CI Integrations Module for jade-dev-assist
 *
 * Provides integration with CI/CD systems to fetch test failures and build logs.
 * Currently supports GitHub Actions via the gh CLI.
 *
 * Key features:
 * - Fetch latest CI run status
 * - Get test failure logs from failed runs
 * - Parse GitHub Actions workflow outputs
 * - Support for multiple workflow types
 */

const { execSync, spawnSync } = require('child_process');
const { createLogger } = require('./logger');

const logger = createLogger('ci-integrations');

// ── GitHub Actions Integration ──────────────────────────────────────

/**
 * Check if GitHub CLI is available and authenticated.
 *
 * @returns {{ available: boolean, authenticated: boolean }}
 */
function checkGhCli() {
    try {
        execSync('gh --version', { encoding: 'utf8', stdio: 'pipe' });
        const authStatus = execSync('gh auth status', {
            encoding: 'utf8',
            stdio: 'pipe'
        });
        return {
            available: true,
            authenticated: authStatus.includes('Logged in')
        };
    } catch (err) {
        return { available: false, authenticated: false };
    }
}

/**
 * Get the latest CI run for the current repository.
 *
 * @param {Object} options
 * @param {string} [options.branch] - Branch name (default: current branch)
 * @param {string} [options.workflow] - Workflow name/file (default: all workflows)
 * @param {number} [options.limit] - Number of runs to fetch (default: 1)
 * @returns {Object} Run information
 */
function getLatestCiRun(options = {}) {
    const opts = {
        branch: options.branch || 'main',
        workflow: options.workflow || null,
        limit: options.limit || 1
    };

    logger.info('Fetching latest CI run', opts);

    try {
        const args = [
            'run', 'list',
            '--branch', opts.branch,
            '--limit', String(opts.limit),
            '--json', 'databaseId,conclusion,status,name,headBranch,createdAt,workflowName'
        ];

        if (opts.workflow) {
            args.push('--workflow', opts.workflow);
        }

        const result = execSync(`gh ${args.join(' ')}`, {
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024
        });

        const runs = JSON.parse(result);

        if (runs.length === 0) {
            logger.warn('No CI runs found', opts);
            return null;
        }

        return runs[0];
    } catch (err) {
        logger.error('Failed to fetch CI runs', { error: err.message });
        throw new Error(`Failed to fetch CI runs: ${err.message}`);
    }
}

/**
 * Get logs from a specific CI run.
 *
 * @param {string|number} runId - GitHub Actions run ID
 * @returns {string} Complete log output
 */
function getCiRunLogs(runId) {
    logger.info('Fetching CI run logs', { runId });

    try {
        const result = execSync(`gh run view ${runId} --log`, {
            encoding: 'utf8',
            maxBuffer: 50 * 1024 * 1024 // 50MB buffer for large logs
        });

        return result;
    } catch (err) {
        logger.error('Failed to fetch CI logs', { runId, error: err.message });
        throw new Error(`Failed to fetch CI logs: ${err.message}`);
    }
}

/**
 * Get failed jobs from a CI run.
 *
 * @param {string|number} runId - GitHub Actions run ID
 * @returns {Array<Object>} Array of failed job information
 */
function getFailedJobs(runId) {
    logger.info('Fetching failed jobs', { runId });

    try {
        const result = execSync(
            `gh run view ${runId} --json jobs --jq '.jobs[] | select(.conclusion == "failure")'`,
            {
                encoding: 'utf8',
                maxBuffer: 10 * 1024 * 1024
            }
        );

        if (!result.trim()) {
            return [];
        }

        // Parse each JSON object (one per line)
        const jobs = result.trim().split('\n').map(line => JSON.parse(line));
        return jobs;
    } catch (err) {
        logger.error('Failed to fetch failed jobs', { runId, error: err.message });
        return [];
    }
}

/**
 * Get the latest failed CI run and extract test failures.
 *
 * @param {Object} options
 * @param {string} [options.branch] - Branch name
 * @param {string} [options.workflow] - Workflow name
 * @returns {Object} CI failure information
 */
function getLatestCiFailure(options = {}) {
    logger.info('Analyzing latest CI failure', options);

    // Check if gh CLI is available
    const ghStatus = checkGhCli();
    if (!ghStatus.available) {
        throw new Error('GitHub CLI (gh) is not available. Install from https://cli.github.com/');
    }
    if (!ghStatus.authenticated) {
        throw new Error('GitHub CLI is not authenticated. Run: gh auth login');
    }

    // Get latest runs and find the first failed one
    const runs = JSON.parse(execSync(
        `gh run list --branch ${options.branch || 'main'} --limit 10 --json databaseId,conclusion,status,name,workflowName`,
        { encoding: 'utf8' }
    ));

    const failedRun = runs.find(r => r.conclusion === 'failure');

    if (!failedRun) {
        logger.info('No failed CI runs found');
        return {
            hasFailure: false,
            message: 'No failed CI runs found'
        };
    }

    logger.info('Found failed run', {
        runId: failedRun.databaseId,
        workflow: failedRun.workflowName,
        name: failedRun.name
    });

    // Get logs and failed jobs
    const logs = getCiRunLogs(failedRun.databaseId);
    const failedJobs = getFailedJobs(failedRun.databaseId);

    return {
        hasFailure: true,
        runId: failedRun.databaseId,
        workflow: failedRun.workflowName,
        name: failedRun.name,
        logs,
        failedJobs,
        url: `https://github.com/${getRepoInfo().owner}/${getRepoInfo().name}/actions/runs/${failedRun.databaseId}`
    };
}

/**
 * Get current repository information.
 *
 * @returns {{ owner: string, name: string }}
 */
function getRepoInfo() {
    try {
        const result = execSync('gh repo view --json owner,name', {
            encoding: 'utf8'
        });
        return JSON.parse(result);
    } catch (err) {
        logger.error('Failed to get repo info', { error: err.message });
        throw new Error(`Failed to get repository info: ${err.message}`);
    }
}

/**
 * Extract test command from GitHub Actions workflow file.
 *
 * @param {string} workflowName - Name of the workflow
 * @returns {string|null} Test command or null if not found
 */
function extractTestCommand(workflowName) {
    try {
        // Try to read the workflow file
        const workflowPath = `.github/workflows/${workflowName}`;
        const fs = require('fs');

        if (!fs.existsSync(workflowPath)) {
            logger.warn('Workflow file not found', { workflowPath });
            return null;
        }

        const content = fs.readFileSync(workflowPath, 'utf8');

        // Look for common test commands
        const testPatterns = [
            /run:\s*npm\s+test/,
            /run:\s*npm\s+run\s+test/,
            /run:\s*yarn\s+test/,
            /run:\s*pnpm\s+test/,
            /run:\s*pytest/,
            /run:\s*cargo\s+test/
        ];

        for (const pattern of testPatterns) {
            const match = content.match(pattern);
            if (match) {
                return match[0].replace(/run:\s*/, '');
            }
        }

        return null;
    } catch (err) {
        logger.error('Failed to extract test command', { error: err.message });
        return null;
    }
}

// ── Exports ──────────────────────────────────────────────────────────

module.exports = {
    checkGhCli,
    getLatestCiRun,
    getCiRunLogs,
    getFailedJobs,
    getLatestCiFailure,
    getRepoInfo,
    extractTestCommand
};
