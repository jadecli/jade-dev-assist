#!/usr/bin/env node
/**
 * Sync ALL tasks (completed + pending) to GitHub Projects
 * - Each repo gets its own project board
 * - All tasks also go to the central ecosystem roadmap (#4)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECTS = {
    'jade-ide': { id: 'PVT_kwDOD0yPG84BOQAp', number: 7, dir: 'jade-ide' },
    'jade-index': { id: 'PVT_kwDOD0yPG84BOQAr', number: 8, dir: 'jade-index' },
    'claude-objects': { id: 'PVT_kwDOD0yPG84BOQAs', number: 9, dir: 'claude-objects' },
    'jadecli-infra': { id: 'PVT_kwDOD0yPG84BOQAt', number: 10, dir: 'jadecli-infra' },
    'jade-dev-assist': { id: 'PVT_kwDOD0yPG84BOQAu', number: 11, dir: 'jade-dev-assist' },
    'jade-cli': { id: 'PVT_kwDOD0yPG84BOQAv', number: 12, dir: 'jade-cli' },
    'jade-swarm': { id: 'PVT_kwDOD0yPG84BOQAx', number: 13, dir: 'jade-swarm' },
    'jadecli-roadmap': { id: 'PVT_kwDOD0yPG84BOQAy', number: 14, dir: 'jadecli-roadmap-and-architecture' }
};

// Ecosystem roadmap project for future cross-project sync
// const ECOSYSTEM_PROJECT = { id: 'PVT_kwDOD0yPG84BOE1i', number: 4 };

function ghApi(query) {
    try {
        const escaped = query.replace(/'/g, "'\\''");
        const result = execSync(`gh api graphql -f query='${escaped}'`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        return JSON.parse(result);
    } catch (_err) {
        return null;
    }
}

function createDraftIssue(projectId, title, body) {
    const result = ghApi(`
        mutation {
            addProjectV2DraftIssue(input: {
                projectId: "${projectId}"
                title: "${title.replace(/"/g, '\\"').replace(/\n/g, ' ')}"
                body: "${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"
            }) {
                projectItem { id }
            }
        }
    `);
    return result?.data?.addProjectV2DraftIssue?.projectItem?.id;
}

function getProjectFields(projectId) {
    const result = ghApi(`
        query {
            node(id: "${projectId}") {
                ... on ProjectV2 {
                    fields(first: 20) {
                        nodes {
                            ... on ProjectV2SingleSelectField {
                                id name options { id name }
                            }
                        }
                    }
                }
            }
        }
    `);
    const fields = {};
    for (const node of result?.data?.node?.fields?.nodes || []) {
        if (node?.name && node?.options) {
            fields[node.name] = { id: node.id, options: {} };
            for (const opt of node.options) {
                fields[node.name].options[opt.name] = opt.id;
            }
        }
    }
    return fields;
}

function updateItemField(projectId, itemId, fieldId, optionId) {
    ghApi(`
        mutation {
            updateProjectV2ItemFieldValue(input: {
                projectId: "${projectId}"
                itemId: "${itemId}"
                fieldId: "${fieldId}"
                value: { singleSelectOptionId: "${optionId}" }
            }) {
                projectV2Item { id }
            }
        }
    `);
}

function syncTask(task, projectId, fields) {
    const title = `[${task.id}] ${task.title}`;
    const body = `## Description
${task.description || 'No description'}

## Status: ${task.status?.toUpperCase() || 'PENDING'}
- **Complexity:** ${task.complexity || 'M'}
- **Milestone:** ${task.milestone || 'N/A'}
- **Labels:** ${(task.labels || []).join(', ') || 'none'}
${task.completed_at ? `- **Completed:** ${task.completed_at}` : ''}
${task.blocked_by?.length ? `- **Blocked By:** ${task.blocked_by.join(', ')}` : ''}

## Acceptance Criteria
${task.feature?.acceptance_criteria?.map(c => task.status === 'completed' ? `- [x] ${c}` : `- [ ] ${c}`).join('\\n') || 'N/A'}`;

    const itemId = createDraftIssue(projectId, title, body);
    if (!itemId) return null;

    // Set Status
    if (fields.Status) {
        let statusOpt;
        if (task.status === 'completed') statusOpt = fields.Status.options['Done'];
        else if (task.status === 'in_progress') statusOpt = fields.Status.options['In progress'];
        else statusOpt = fields.Status.options['Todo'];
        if (statusOpt) updateItemField(projectId, itemId, fields.Status.id, statusOpt);
    }

    // Set Complexity
    if (fields.Complexity) {
        let opt = fields.Complexity.options['M - Medium'];
        if (task.complexity === 'S') opt = fields.Complexity.options['S - Small'];
        if (task.complexity === 'L') opt = fields.Complexity.options['L - Large'];
        if (opt) updateItemField(projectId, itemId, fields.Complexity.id, opt);
    }

    // Set Priority
    if (fields.Priority) {
        const opt = fields.Priority.options['P1 - High'] || Object.values(fields.Priority.options)[0];
        if (opt) updateItemField(projectId, itemId, fields.Priority.id, opt);
    }

    // Set Phase
    if (fields.Phase) {
        let phase = 'Phase 2';
        if (task.milestone?.includes('3') || task.milestone?.includes('Release')) phase = 'Phase 3';
        if (task.milestone?.includes('1') || task.milestone?.includes('Foundation')) phase = 'Phase 1';
        const opt = fields.Phase.options[phase];
        if (opt) updateItemField(projectId, itemId, fields.Phase.id, opt);
    }

    return itemId;
}

// Main
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const singleProject = args.find(a => !a.startsWith('--'));

console.log('🔄 Syncing ALL tasks to GitHub Projects\n');

const projectsPath = path.join(process.env.HOME, 'projects');
let totalSynced = 0;

for (const [name, project] of Object.entries(PROJECTS)) {
    if (singleProject && singleProject !== name) continue;

    const tasksFile = path.join(projectsPath, project.dir, '.claude', 'tasks', 'tasks.json');
    if (!fs.existsSync(tasksFile)) {
        console.log(`⚠️  ${name}: No tasks.json found`);
        continue;
    }

    const data = JSON.parse(fs.readFileSync(tasksFile, 'utf-8'));
    const tasks = data.tasks || [];

    if (tasks.length === 0) {
        console.log(`⚪ ${name}: No tasks`);
        continue;
    }

    const completed = tasks.filter(t => t.status === 'completed').length;
    const pending = tasks.filter(t => t.status === 'pending').length;

    console.log(`📦 ${name}: ${tasks.length} tasks (${completed} done, ${pending} pending)`);

    if (dryRun) {
        for (const task of tasks) {
            console.log(`   ${task.status === 'completed' ? '✅' : '⏳'} [${task.complexity || 'M'}] ${task.title}`);
        }
        continue;
    }

    // Get fields for this project
    const fields = getProjectFields(project.id);

    // Sync each task
    for (const task of tasks) {
        const itemId = syncTask(task, project.id, fields);
        if (itemId) {
            console.log(`   ${task.status === 'completed' ? '✅' : '⏳'} ${task.title}`);
            totalSynced++;
        }
    }
}

if (!dryRun) {
    console.log(`\n✅ Synced ${totalSynced} tasks total`);
    console.log('\n📊 Project URLs:');
    for (const [name, project] of Object.entries(PROJECTS)) {
        console.log(`   ${name}: https://github.com/orgs/jadecli/projects/${project.number}`);
    }
    console.log(`\n🌐 Ecosystem Roadmap: https://github.com/orgs/jadecli/projects/4`);
}
