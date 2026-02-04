#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function readTasksFromRepo(repoName) {
  const projectsRoot = path.join(process.env.HOME, 'projects');
  const tasksFile = path.join(
    projectsRoot,
    repoName,
    '.claude',
    'tasks',
    'tasks.json'
  );

  if (!fs.existsSync(tasksFile)) {
    return [];
  }

  const data = JSON.parse(fs.readFileSync(tasksFile, 'utf-8'));
  return (data.tasks || []).filter((t) => t.status === 'pending');
}

function formatIssueBody(task) {
  const lines = [];

  if (task.description) {
    lines.push(task.description);
    lines.push('');
  }

  // Metadata
  lines.push('---');
  lines.push('');
  lines.push(`**Task ID:** \`${task.id}\``);
  lines.push(`**Complexity:** ${task.complexity || 'M'}`);

  if (task.project) {
    lines.push(`**Project:** ${task.project}`);
  }

  if (task.milestone) {
    lines.push(`**Milestone:** ${task.milestone}`);
  }

  if (task.blocked_by && task.blocked_by.length > 0) {
    lines.push(`**Blocked By:** ${task.blocked_by.join(', ')}`);
  }

  // Acceptance Criteria
  if (task.feature && task.feature.acceptance_criteria) {
    lines.push('');
    lines.push('## Acceptance Criteria');
    lines.push('');
    task.feature.acceptance_criteria.forEach((criterion) => {
      lines.push(`- [ ] ${criterion}`);
    });
  }

  lines.push('');
  lines.push('---');
  lines.push('*Generated from tasks.json*');

  return lines.join('\n');
}

function createIssue(repoName, task, options = {}) {
  const { dryRun = false } = options;

  const title = task.title;
  const body = formatIssueBody(task);
  const labels = ['from-tasks-json', ...(task.labels || [])];

  const cmd = [
    'gh',
    'issue',
    'create',
    '--repo',
    `jadecli/${repoName}`,
    '--title',
    title,
    '--body',
    body,
    '--label',
    labels.join(','),
  ];

  if (dryRun) {
    console.log(`[DRY RUN] Would create: ${title}`);
    return null;
  }

  const url = execSync(cmd.join(' '), { encoding: 'utf-8' }).trim();
  return url;
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const repoName = args.find((a) => !a.startsWith('--')) || 'jade-dev-assist';

  console.log(`Creating issues for ${repoName}...`);

  const tasks = readTasksFromRepo(repoName);
  console.log(`Found ${tasks.length} pending tasks\n`);

  for (const task of tasks) {
    const url = createIssue(repoName, task, { dryRun });
    if (url) {
      console.log(`✅ Created: ${url}`);
    }
  }
}

module.exports = { readTasksFromRepo, formatIssueBody, createIssue };
