'use strict';

/**
 * Dispatcher Module for the jade-dev-assist orchestrator.
 *
 * Constructs a swarm worker prompt and prepares dispatch into the target
 * project directory. Reads the task details, project CLAUDE.md, and
 * relevant source files. Enforces the 60K token initial prompt cap.
 *
 * See ~/docs/plans/2026-02-02-jade-dev-assist-orchestrator-design.md Section 3.5.
 */

const fs = require('fs');
const path = require('path');
const { createLogger } = require('./logger');

const logger = createLogger('dispatcher');

// ── Constants ────────────────────────────────────────────────────────

/**
 * Maximum token budget for the worker initial prompt.
 */
const TOKEN_BUDGET = 60000;

/**
 * Default maximum turns for worker dispatch.
 */
const DEFAULT_MAX_TURNS = 25;

/**
 * Approximate characters per token for the heuristic estimator.
 * Claude tokenizes at roughly 4 characters per token on average.
 */
const CHARS_PER_TOKEN = 4;

/**
 * Token budget reserved for the non-file parts of the prompt
 * (template, task info, CLAUDE.md, constraints, etc.).
 * Files share whatever remains after this overhead.
 */
const PROMPT_OVERHEAD_TOKENS = 5000;

// ── Token Estimation ─────────────────────────────────────────────────

/**
 * Estimate the token count of a string using a simple heuristic.
 *
 * Uses ~4 characters per token, which is a reasonable approximation
 * for English text and source code processed by Claude's tokenizer.
 *
 * @param {string} text - The text to estimate.
 * @returns {number} Estimated token count.
 */
function estimateTokens(text) {
    if (!text) {
        return 0;
    }
    return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// ── Prompt Construction ──────────────────────────────────────────────

/**
 * Read a project's CLAUDE.md file.
 *
 * @param {string} projectPath - Absolute path to the project root.
 * @returns {string} Contents of CLAUDE.md, or empty string if not found.
 */
function readClaudeMd(projectPath) {
    const claudePath = path.join(projectPath, 'CLAUDE.md');
    try {
        return fs.readFileSync(claudePath, 'utf8');
    } catch (err) {
        if (err.code === 'ENOENT') {
            return '';
        }
        throw err;
    }
}

/**
 * Read relevant files from the project, respecting the token budget.
 *
 * Files are read in order. Each file is included fully if it fits within
 * the remaining budget. If a file would exceed the budget, it is truncated
 * to fit. If there is no room at all, the file is skipped.
 *
 * @param {string[]} filePaths   - Relative file paths from the task.
 * @param {string}   projectPath - Absolute path to the project root.
 * @param {number}   tokenBudget - Maximum tokens available for file contents.
 * @returns {{ sections: string[], filesIncluded: number, filesTrimmed: number }}
 */
function readRelevantFiles(filePaths, projectPath, tokenBudget) {
    const sections = [];
    let tokensUsed = 0;
    let filesIncluded = 0;
    let filesTrimmed = 0;

    for (const relPath of filePaths) {
        const fullPath = path.join(projectPath, relPath);
        let content;
        try {
            content = fs.readFileSync(fullPath, 'utf8');
        } catch (err) {
            if (err.code === 'ENOENT') {
                // File not found -- skip silently
                continue;
            }
            throw err;
        }

        // Build the section for this file
        const header = `### ${relPath}\n\n\`\`\`\n`;
        const footer = '\n```\n';
        const headerFooterTokens = estimateTokens(header + footer);

        const contentTokens = estimateTokens(content);
        const totalFileTokens = headerFooterTokens + contentTokens;

        const remainingBudget = tokenBudget - tokensUsed;

        if (remainingBudget <= headerFooterTokens) {
            // No room even for the header -- skip this file
            filesTrimmed++;
            continue;
        }

        if (totalFileTokens <= remainingBudget) {
            // File fits entirely
            sections.push(header + content + footer);
            tokensUsed += totalFileTokens;
            filesIncluded++;
        } else {
            // Truncate file content to fit remaining budget
            const availableContentTokens = remainingBudget - headerFooterTokens;
            const availableChars = availableContentTokens * CHARS_PER_TOKEN;
            const truncatedContent = content.slice(0, availableChars);
            const truncationNote = '\n\n... [file truncated to fit token budget] ...';
            sections.push(header + truncatedContent + truncationNote + footer);
            tokensUsed += remainingBudget;
            filesIncluded++;
            filesTrimmed++;
        }
    }

    return { sections, filesIncluded, filesTrimmed };
}

/**
 * Build the worker prompt for a given task and project.
 *
 * The prompt follows the template defined in the design doc Section 3.5:
 * - Swarm worker preamble with project name
 * - Your Assignment section (title, description)
 * - Feature Description section
 * - Acceptance Criteria section
 * - Project Context (CLAUDE.md contents)
 * - Relevant Files (trimmed to fit budget)
 * - Constraints section (project path, TDD, test command)
 * - Skills to Use section
 *
 * @param {Object} task    - Task object (from scanner, with _project metadata).
 * @param {Object} project - Project registry entry.
 * @param {Object} [options]
 * @param {string} [options.projectsRoot] - Root directory containing project directories.
 * @returns {{ prompt: string, meta: Object }}
 */
function buildWorkerPrompt(task, project, options) {
    const opts = options || {};
    const projectsRoot = opts.projectsRoot || '';
    const projectPath = path.join(projectsRoot, project.path || project.name);

    // ── Read CLAUDE.md ──────────────────────────────────────────────
    const claudeMdContent = readClaudeMd(projectPath);

    // ── Build prompt sections ───────────────────────────────────────

    const feature = task.feature || {};
    const criteria = feature.acceptance_criteria || [];
    const testCommand = project.test_command || null;

    const parts = [];

    // Preamble
    parts.push(`You are a swarm worker executing a task in the ${project.name} project.\n`);

    // Assignment
    parts.push('## Your Assignment\n');
    parts.push(task.title || '(untitled task)');
    parts.push('');
    if (task.description) {
        parts.push(task.description);
        parts.push('');
    }

    // Feature Description
    if (feature.description) {
        parts.push('## Feature Description\n');
        parts.push(feature.description);
        parts.push('');
    }

    // Acceptance Criteria
    if (criteria.length > 0) {
        parts.push('## Acceptance Criteria\n');
        for (const criterion of criteria) {
            parts.push(`- ${criterion}`);
        }
        parts.push('');
    }

    // Project Context
    if (claudeMdContent) {
        parts.push('## Project Context\n');
        parts.push(claudeMdContent);
        parts.push('');
    }

    // Constraints
    parts.push('## Constraints\n');
    parts.push(`- Only modify files within ${project.path || project.name}/`);
    parts.push('- Follow TDD: write failing test first, then implement');
    if (testCommand) {
        parts.push(`- Run ${testCommand} before reporting completion`);
    }
    parts.push('- Report results in structured JSON format');
    parts.push('');

    // Skills
    parts.push('## Skills to Use\n');
    parts.push('- test-driven-development (mandatory for all implementation tasks)');
    parts.push('- verification-before-completion (mandatory before reporting done)');
    parts.push('- systematic-debugging (if tests fail unexpectedly)');
    parts.push('');

    // ── Assemble base prompt (without files) ────────────────────────
    const basePrompt = parts.join('\n');
    const baseTokens = estimateTokens(basePrompt);

    // ── Read and include relevant files within budget ───────────────
    const relevantFiles = task.relevant_files || [];
    let fileSections = [];
    let filesIncluded = 0;
    let filesTrimmed = 0;

    if (relevantFiles.length > 0) {
        // Reserve budget for file content
        const fileBudget = TOKEN_BUDGET - baseTokens - PROMPT_OVERHEAD_TOKENS;

        if (fileBudget > 0) {
            const fileResult = readRelevantFiles(relevantFiles, projectPath, fileBudget);
            fileSections = fileResult.sections;
            filesIncluded = fileResult.filesIncluded;
            filesTrimmed = fileResult.filesTrimmed;
        } else {
            // No room for files at all
            filesTrimmed = relevantFiles.length;
        }
    }

    // ── Build final prompt ──────────────────────────────────────────
    let finalPrompt = basePrompt;
    if (fileSections.length > 0) {
        finalPrompt += '## Relevant Files\n\n' + fileSections.join('\n');
    }

    const tokenEstimate = estimateTokens(finalPrompt);

    return {
        prompt: finalPrompt,
        meta: {
            tokenEstimate,
            filesIncluded,
            filesTrimmed,
            projectPath
        }
    };
}

// ── Status Update ────────────────────────────────────────────────────

/**
 * Update the task status in the project's tasks.json file.
 *
 * Reads the file, finds the task by ID, updates its status,
 * adds a history entry, and writes the file back.
 *
 * @param {string} taskId      - The task ID to update.
 * @param {string} fromStatus  - The previous status.
 * @param {string} toStatus    - The new status.
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

// ── Public API ───────────────────────────────────────────────────────

/**
 * Dispatch a swarm worker for a given task.
 *
 * 1. Builds the worker prompt using buildWorkerPrompt().
 * 2. Logs the token estimate for the prompt.
 * 3. Warns if the prompt exceeds the 60K token budget.
 * 4. Updates the task status to in_progress in tasks.json.
 * 5. Returns a dispatch descriptor with the prompt, working directory,
 *    and max turns (the actual worker launch is handled by the caller).
 *
 * In dryRun mode, the prompt is constructed and status is updated,
 * but no worker process is spawned. This is useful for testing.
 *
 * @param {Object} task    - Task object (from scanner).
 * @param {Object} project - Project registry entry.
 * @param {Object} [options]
 * @param {string} [options.projectsRoot] - Root directory containing project directories.
 * @param {boolean} [options.dryRun]      - If true, do not spawn a worker process.
 * @param {boolean} [options.silent]      - If true, suppress logging output.
 * @returns {{ prompt: string, workingDirectory: string, maxTurns: number, meta: Object }}
 */
function dispatchWorker(task, project, options) {
    const opts = options || {};
    const projectsRoot = opts.projectsRoot || '';
    const projectPath = path.join(projectsRoot, project.path || project.name);
    const silent = opts.silent || false;

    // Build the worker prompt
    const promptResult = buildWorkerPrompt(task, project, opts);

    // Log token estimate
    const tokenEstimate = promptResult.meta.tokenEstimate;
    if (!silent) {
        logger.info('Token estimate for task', {
            taskId: task.id,
            tokens: tokenEstimate
        });
    }

    // Warn if prompt exceeds budget
    if (tokenEstimate > TOKEN_BUDGET) {
        logger.warn('Prompt exceeds token budget, content may be truncated', {
            taskId: task.id,
            tokens: tokenEstimate,
            budget: TOKEN_BUDGET
        });
    }

    // Update task status to in_progress
    const tasksJsonPath = path.join(projectPath, '.claude', 'tasks', 'tasks.json');
    try {
        updateTaskStatus(
            task.id,
            task.status || 'pending',
            'in_progress',
            tasksJsonPath
        );
    } catch (err) {
        // If tasks.json doesn't exist or can't be updated, warn but continue
        if (err.code !== 'ENOENT') {
            logger.warn('Could not update task status', {
                taskId: task.id,
                path: tasksJsonPath,
                error: err.message
            });
        }
    }

    return {
        prompt: promptResult.prompt,
        workingDirectory: projectPath,
        maxTurns: DEFAULT_MAX_TURNS,
        meta: promptResult.meta
    };
}

module.exports = {
    buildWorkerPrompt,
    dispatchWorker,
    estimateTokens,
    TOKEN_BUDGET
};
