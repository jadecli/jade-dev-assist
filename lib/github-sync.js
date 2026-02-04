/**
 * GitHub Projects sync module for jadecli ecosystem
 * Syncs tasks.json entries to GitHub Projects board
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ORG = 'jadecli';
const PROJECT_NUMBER = 4;

/**
 * Execute gh CLI command and return JSON result
 */
function ghApi(query) {
    const cmd = `gh api graphql -f query='${query.replace(/'/g, "'\\''")}'`;
    try {
        const result = execSync(cmd, { encoding: 'utf-8' });
        return JSON.parse(result);
    } catch (error) {
        console.error('GitHub API error:', error.message);
        return null;
    }
}

/**
 * Get organization project ID
 */
function getProjectId() {
    const result = ghApi(`
        query{
            organization(login: "${ORG}"){
                projectV2(number: ${PROJECT_NUMBER}) {
                    id
                }
            }
        }
    `);
    return result?.data?.organization?.projectV2?.id;
}

/**
 * Get project fields (Status, Priority, etc.)
 */
function getProjectFields(projectId) {
    const result = ghApi(`
        query{
            node(id: "${projectId}") {
                ... on ProjectV2 {
                    fields(first: 20) {
                        nodes {
                            ... on ProjectV2FieldCommon { id name }
                            ... on ProjectV2SingleSelectField {
                                id name
                                options { id name }
                            }
                        }
                    }
                }
            }
        }
    `);
    return result?.data?.node?.fields?.nodes || [];
}

/**
 * Create a draft issue in the project
 */
function createDraftIssue(projectId, title, body) {
    const result = ghApi(`
        mutation {
            addProjectV2DraftIssue(input: {
                projectId: "${projectId}"
                title: "${title.replace(/"/g, '\\"')}"
                body: "${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"
            }) {
                projectItem { id }
            }
        }
    `);
    return result?.data?.addProjectV2DraftIssue?.projectItem?.id;
}

/**
 * Sync a task from tasks.json to GitHub Projects
 */
function syncTask(task, projectId) {
    const title = `[${task.id}] ${task.title}`;
    const body = `
## Description
${task.description || 'No description'}

## Details
- **Complexity:** ${task.complexity || 'M'}
- **Status:** ${task.status || 'pending'}
- **Milestone:** ${task.milestone || 'N/A'}
- **Labels:** ${(task.labels || []).join(', ') || 'none'}

## Acceptance Criteria
${task.feature?.acceptance_criteria?.map(c => `- [ ] ${c}`).join('\n') || 'N/A'}

---
*Synced from \`${task.id.split('/')[0]}/.claude/tasks/tasks.json\`*
    `.trim();

    return createDraftIssue(projectId, title, body);
}

/**
 * Sync all pending tasks from a project
 */
function syncProjectTasks(projectPath) {
    const tasksFile = path.join(projectPath, '.claude', 'tasks', 'tasks.json');
    if (!fs.existsSync(tasksFile)) {
        console.log(`No tasks.json found in ${projectPath}`);
        return [];
    }

    const data = JSON.parse(fs.readFileSync(tasksFile, 'utf-8'));
    const pendingTasks = data.tasks.filter(t => t.status === 'pending');

    if (pendingTasks.length === 0) {
        console.log(`No pending tasks in ${data.project}`);
        return [];
    }

    const projectId = getProjectId();
    if (!projectId) {
        console.error('Could not get project ID');
        return [];
    }

    const synced = [];
    for (const task of pendingTasks) {
        const itemId = syncTask(task, projectId);
        if (itemId) {
            console.log(`Synced: ${task.id} -> ${itemId}`);
            synced.push({ task: task.id, itemId });
        }
    }

    return synced;
}

module.exports = {
    getProjectId,
    getProjectFields,
    createDraftIssue,
    syncTask,
    syncProjectTasks
};
