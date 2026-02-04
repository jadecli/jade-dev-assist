/**
 * Planner Module (lib/planner.js)
 *
 * Implements /jade:plan command and workflow.
 * Based on Boris Cherny Tip #2: "Start every complex task in plan mode"
 *
 * Key Features:
 * - Plan mode activation with checklist
 * - Two-Claude review pattern (spawn second Claude as staff engineer)
 * - Verification step tracking
 * - Re-planning workflow when things go sideways
 *
 * Usage:
 *   const { startPlanMode, reviewPlan, verifyPlan, replan } = require('./planner');
 *
 *   // Start planning
 *   const planStart = startPlanMode('Implement OAuth2 auth', 'M');
 *   console.log(planStart.message);
 *
 *   // Review plan with second Claude
 *   const review = reviewPlan(myPlan);
 *   console.log(review.message);
 *   // Use review.reviewPrompt to spawn subagent
 *
 *   // Verify implementation
 *   const verify = verifyPlan('Implement OAuth2 auth');
 *   console.log(verify.message);
 *
 *   // Replan when things fail
 *   const replanResult = replan('Tests failing after refactor');
 *   console.log(replanResult.message);
 */

'use strict';

/**
 * Generate a planning checklist based on task complexity
 *
 * @param {string} [taskDescription] - Optional task description for context
 * @param {string} [complexity='M'] - Task complexity: S, M, L, XL
 * @returns {Object} Checklist object with items array
 */
function generatePlanningChecklist(taskDescription = '', complexity = 'M') {
    const baseItems = [
        'Define requirements and constraints',
        'Identify affected files',
        'Break into atomic steps',
        'Consider edge cases',
        'Define success criteria'
    ];

    const complexItems = [
        'Analyze dependencies and integrations',
        'Identify potential risks and mitigations',
        'Plan rollback strategy',
        'Consider performance implications'
    ];

    let items = [...baseItems];

    // Add complexity-specific items
    if (complexity === 'L' || complexity === 'XL') {
        items = [...items, ...complexItems];
    }

    return {
        task: taskDescription || null,
        complexity: complexity,
        items: items
    };
}

/**
 * Start plan mode for a complex task
 *
 * @param {string} taskDescription - Description of the task to plan
 * @param {string} [complexity='M'] - Task complexity: S, M, L, XL
 * @returns {Object} Result with message and metadata
 */
function startPlanMode(taskDescription = '', complexity = 'M') {
    const checklist = generatePlanningChecklist(taskDescription, complexity);

    const checkboxItems = checklist.items.map(item => `□ ${item}`).join('\n');

    const message = `🎯 Plan Mode Activated

Task: ${taskDescription || '(no task specified)'}

📋 PLANNING CHECKLIST
${checkboxItems}

💡 pour energy into the plan so Claude can 1-shot the implementation.

⏸ plan mode on (shift+Tab to cycle)`;

    return {
        message: message,
        task: taskDescription,
        complexity: complexity,
        checklist: checklist
    };
}

/**
 * Review a plan using the two-Claude pattern
 * Generates instructions for spawning a second Claude as staff engineer reviewer
 *
 * @param {Object} plan - The plan object to review
 * @param {string} plan.task - Task description
 * @param {Array} [plan.requirements] - List of requirements
 * @param {Array} [plan.approach] - Implementation approach steps
 * @param {Array} [plan.files] - Files to modify
 * @returns {Object} Result with message and reviewPrompt for subagent
 */
function reviewPlan(plan = {}) {
    const task = plan.task || 'Unspecified task';

    // Generate review checklist
    const reviewChecklist = `□ Architecture decisions
□ Edge cases coverage
□ Implementation feasibility
□ Missing requirements
□ Potential issues`;

    const message = `🔍 Plan Review Mode

Spawning staff-level reviewer...

Reviewer will check:
${reviewChecklist}

Task: ${task}`;

    // Generate detailed prompt for staff engineer reviewer (subagent)
    const reviewPrompt = generateStaffEngineerReviewPrompt(plan);

    return {
        message: message,
        reviewPrompt: reviewPrompt,
        plan: plan
    };
}

/**
 * Generate a detailed staff engineer review prompt for subagent
 * Uses extended thinking for deep analysis
 *
 * @private
 * @param {Object} plan - The plan to review
 * @returns {string} Prompt for staff engineer reviewer
 */
function generateStaffEngineerReviewPrompt(plan) {
    const task = plan.task || 'Unspecified task';
    const requirements = plan.requirements || [];
    const approach = plan.approach || [];
    const files = plan.files || [];

    const prompt = `You are a staff engineer reviewing this implementation plan. Use extended thinking to deeply analyze potential issues, edge cases, and improvements.

Task: ${task}

${requirements.length > 0 ? `Requirements:\n${requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n` : ''}
${approach.length > 0 ? `Approach:\n${approach.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n` : ''}
${files.length > 0 ? `Files to modify:\n${files.map(f => `- ${f}`).join('\n')}\n` : ''}

As a staff engineer, carefully think through this plan and provide:

1. **Architecture Review**: Are the architectural decisions sound? Any concerns?
2. **Edge Cases**: What edge cases might be missing?
3. **Feasibility**: Is this approach practical and implementable?
4. **Missing Requirements**: Are there requirements that should be added?
5. **Potential Issues**: What could go wrong during implementation?
6. **Improvements**: How could this plan be improved?

Think through each aspect carefully. Be thorough but constructive.`;

    return prompt;
}

/**
 * Enter plan mode for verification steps
 * Explicitly plan how to verify the implementation works
 *
 * @param {string} [taskDescription] - Optional task description for context
 * @returns {Object} Result with verification message
 */
function verifyPlan(taskDescription = '') {
    const verificationChecklist = `□ What tests prove this works?
□ What edge cases to check?
□ How to verify no regressions?
□ What metrics confirm success?`;

    const message = `✅ Verification Plan Mode

${taskDescription ? `Task: ${taskDescription}\n\n` : ''}Before marking complete, plan how to verify:
${verificationChecklist}

💡 Verification needs as much planning as implementation.

⏸ plan mode on (shift+Tab to cycle)`;

    return {
        message: message,
        task: taskDescription,
        mode: 'verification'
    };
}

/**
 * Re-plan when something goes sideways
 * Switch back to plan mode to analyze what went wrong and create new approach
 *
 * @param {string} [issue] - Description of what went wrong
 * @returns {Object} Result with replan message
 */
function replan(issue = '') {
    const replanChecklist = `Current state:
${issue ? `⚠️  ${issue}\n` : '[Analyze what happened]\n'}
What to preserve:
[Working parts]

What to change:
[Failed approach]

New plan:
[Fresh approach]`;

    const message = `🔄 Replan Mode

Something went sideways. Let's step back.

${replanChecklist}

💡 The moment something goes sideways, switch back to plan mode and re-plan. Don't keep pushing.

⏸ plan mode on (shift+Tab to cycle)`;

    return {
        message: message,
        issue: issue,
        mode: 'replan'
    };
}

// ── Exports ──────────────────────────────────────────────────────────

module.exports = {
    generatePlanningChecklist,
    startPlanMode,
    reviewPlan,
    verifyPlan,
    replan
};
