'use strict';

/**
 * Priority Scoring Module for the jade-dev-assist orchestrator.
 *
 * Computes a score from 0 to 100 for each task based on five weighted factors:
 * maturity, impact, dependency, effort-to-value, and developer preference.
 *
 * See ~/docs/plans/2026-02-02-jade-dev-assist-orchestrator-design.md Section 5.
 */

// ── Constants ────────────────────────────────────────────────────────

/**
 * Maps project status to a maturity score (0-100).
 */
const MATURITY_SCORES = {
    'buildable': 100,
    'near-buildable': 80,
    'scaffolding-plus': 60,
    'scaffolding': 40,
    'blocked': 10
};

/**
 * Maps task complexity to a multiplier for effort-to-value calculation.
 */
const COMPLEXITY_MULTIPLIERS = {
    'S': 1.0,
    'M': 0.75,
    'L': 0.50,
    'XL': 0.30
};

/**
 * Weights for the five scoring factors. Must sum to 1.0.
 */
const WEIGHTS = {
    maturity: 0.20,
    impact: 0.30,
    dependency: 0.20,
    effort: 0.15,
    preference: 0.15
};

/**
 * Label bonus values for the impact calculation.
 */
const LABEL_BONUSES = {
    'bugfix': 10,
    'feature': 5,
    'test': 10,
    'infra': 5,
    'docs': 0,
    'refactor': 0
};

// ── Factor Computation ───────────────────────────────────────────────

/**
 * Compute the project maturity factor (0-100).
 *
 * @param {Object} project - Project registry entry with a `status` field.
 * @returns {number}
 */
function computeMaturity(project) {
    const status = (project && project.status) || '';
    return MATURITY_SCORES[status] || 0;
}

/**
 * Compute the task impact factor (0-100, capped).
 *
 * Components:
 * - base_impact: acceptance_criteria (+20), feature.description (+10), github_issue (+10)
 * - unlock_bonus: +15 per unlock, max 45
 * - milestone_bonus: +15 for active milestone match, +25 additional if last blocker
 * - label_bonus: sum of label-specific bonuses
 *
 * @param {Object} task - Task object.
 * @param {Object[]} allTasks - All tasks (for milestone last-blocker check).
 * @returns {number} Impact score capped at 100.
 */
function computeImpact(task, allTasks) {
    let impact = 0;

    // Base impact
    const feature = task.feature || {};
    const criteria = feature.acceptance_criteria;
    if (Array.isArray(criteria) && criteria.length > 0) {
        impact += 20;
    }
    if (feature.description) {
        impact += 10;
    }
    if (task.github_issue) {
        impact += 10;
    }

    // Unlock bonus: +15 per unlocked task, max 3 counted
    const unlocks = task.unlocks || [];
    const unlockCount = Math.min(unlocks.length, 3);
    impact += unlockCount * 15;

    // Milestone bonus
    const milestone = task._milestone;
    if (milestone && task.milestone && task.milestone === milestone.name) {
        impact += 15;

        // Last blocker bonus: if this is the only incomplete task
        // in its milestone within the same project
        const projectName = task._projectName;
        const milestoneName = milestone.name;
        const siblingIncomplete = allTasks.filter(
            (t) =>
                t._projectName === projectName &&
                t.milestone === milestoneName &&
                t.id !== task.id &&
                t.status !== 'completed' &&
                t.status !== 'failed'
        );
        if (siblingIncomplete.length === 0) {
            impact += 25;
        }
    }

    // Label bonus
    const labels = task.labels || [];
    for (const label of labels) {
        impact += LABEL_BONUSES[label] || 0;
    }

    // Cap at 100
    return Math.min(impact, 100);
}

/**
 * Compute the dependency status factor (0, 50, or 100).
 *
 * - blocked_by empty or all completed: 100
 * - all non-completed blockers are in_progress: 50
 * - otherwise: 0
 *
 * @param {Object} task - Task object with blocked_by array.
 * @param {Object[]} allTasks - All tasks for blocker lookup.
 * @returns {number}
 */
function computeDependency(task, allTasks) {
    const blockedBy = task.blocked_by || [];
    if (blockedBy.length === 0) {
        return 100;
    }

    // Build a lookup map for blocker resolution
    const taskById = {};
    for (const t of allTasks) {
        taskById[t.id] = t;
    }

    let allCompleted = true;
    let allCompletedOrInProgress = true;

    for (const blockerId of blockedBy) {
        const blocker = taskById[blockerId];
        if (!blocker) {
            // Blocker not found -- treated as not completed
            allCompleted = false;
            allCompletedOrInProgress = false;
            break;
        }
        if (blocker.status !== 'completed') {
            allCompleted = false;
            if (blocker.status !== 'in_progress') {
                allCompletedOrInProgress = false;
                break;
            }
        }
    }

    if (allCompleted) {
        return 100;
    }
    if (allCompletedOrInProgress) {
        return 50;
    }
    return 0;
}

/**
 * Compute the effort-to-value factor (0-100).
 *
 * effort_value = impact * complexity_multiplier
 *
 * @param {number} impact - The computed impact score.
 * @param {string} complexity - Task complexity (S, M, L, XL).
 * @returns {number}
 */
function computeEffort(impact, complexity) {
    const multiplier = COMPLEXITY_MULTIPLIERS[complexity] || COMPLEXITY_MULTIPLIERS.S;
    return impact * multiplier;
}

/**
 * Compute the developer preference factor (0-100).
 *
 * Base: 50
 * +20 if created_at is within the last 24 hours
 * +30 if focusLabel is set and matches one of the task's labels
 *
 * @param {Object} task - Task object.
 * @param {Object} [options]
 * @param {string} [options.focusLabel] - Label receiving preference boost.
 * @returns {number}
 */
function computePreference(task, options) {
    let preference = 50;

    // Recency boost: +20 if within 24 hours
    if (task.created_at) {
        const created = new Date(task.created_at).getTime();
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        if (now - created <= twentyFourHours) {
            preference += 20;
        }
    }

    // Focus label boost: +30 if focusLabel matches
    const opts = options || {};
    if (opts.focusLabel) {
        const labels = task.labels || [];
        if (labels.includes(opts.focusLabel)) {
            preference += 30;
        }
    }

    return preference;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Compute a priority score (0-100) for a single task.
 *
 * @param {Object} task - Task object (with _project, _projectName, _milestone from scanner).
 * @param {Object} project - Project registry entry (has .status, .name, etc.).
 * @param {Object[]} allTasks - All tasks across all projects (for dependency resolution).
 * @param {Object} [options]
 * @param {string} [options.focusLabel] - Label receiving +30 preference boost.
 * @returns {number} Score from 0 to 100.
 */
function scoreTask(task, project, allTasks, options) {
    // Priority override replaces the entire computed score
    if (task.priority_override != null) {
        return task.priority_override;
    }

    const maturity = computeMaturity(project);
    const impact = computeImpact(task, allTasks);
    const dependency = computeDependency(task, allTasks);
    const complexity = task.complexity || 'S';
    const effort = computeEffort(impact, complexity);
    const preference = computePreference(task, options);

    const score =
        (maturity * WEIGHTS.maturity) +
        (impact * WEIGHTS.impact) +
        (dependency * WEIGHTS.dependency) +
        (effort * WEIGHTS.effort) +
        (preference * WEIGHTS.preference);

    return score;
}

/**
 * Score and sort an array of tasks from scanTasks().
 *
 * Filters out completed/failed tasks by default. Attaches `_score` to each task.
 * Returns sorted descending by score.
 *
 * @param {Object[]} tasks - Merged task array from scanTasks().
 * @param {Object} [options]
 * @param {boolean} [options.includeCompleted] - If true, include completed/failed tasks.
 * @param {string} [options.focusLabel] - Passed through to scoreTask.
 * @returns {Object[]} Sorted array of tasks with `_score` property.
 */
function scoreTasks(tasks, options) {
    const opts = options || {};

    // Filter out completed and failed tasks unless requested
    let filtered;
    if (opts.includeCompleted) {
        filtered = tasks.slice();
    } else {
        filtered = tasks.filter(
            (t) => t.status !== 'completed' && t.status !== 'failed'
        );
    }

    // Score each task using its attached _project metadata
    for (const task of filtered) {
        const project = task._project || {};
        task._score = scoreTask(task, project, tasks, opts);
    }

    // Sort descending by score
    filtered.sort((a, b) => b._score - a._score);

    return filtered;
}

module.exports = {
    scoreTask,
    scoreTasks,
    MATURITY_SCORES,
    COMPLEXITY_MULTIPLIERS,
    WEIGHTS
};
