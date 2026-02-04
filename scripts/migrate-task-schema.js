#!/usr/bin/env node
/**
 * migrate-task-schema.js
 *
 * Migrates task files from various schema formats to Schema A (v1).
 *
 * Handles:
 * - jade-claude-settings: T1-T13 format with minimal metadata
 * - jade-docker: Schema B (v1.0.0) with priority/dependencies/blocks
 *
 * Usage:
 *   node scripts/migrate-task-schema.js <task-file-path>
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Generates deterministic task ID from project and title
 */
function generateTaskId(project, title) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const hash = crypto
    .createHash('sha256')
    .update(title)
    .digest('hex')
    .slice(0, 6);

  return `${project}/${slug}-${hash}`;
}

/**
 * Maps priority to complexity
 */
function priorityToComplexity(priority) {
  const map = {
    'critical': 'XL',
    'high': 'L',
    'medium': 'M',
    'low': 'S'
  };
  return map[priority] || 'M';
}

/**
 * Extracts acceptance criteria from description
 */
function extractAcceptanceCriteria(description) {
  // Look for bullet points, numbered lists, or "should" statements
  const lines = description.split('\n').map(l => l.trim()).filter(Boolean);
  const criteria = [];

  for (const line of lines) {
    if (line.match(/^[-*•]\s/) || line.match(/^\d+\.\s/)) {
      criteria.push(line.replace(/^[-*•]\s/, '').replace(/^\d+\.\s/, ''));
    } else if (line.toLowerCase().includes('should')) {
      criteria.push(line);
    }
  }

  return criteria.length > 0 ? criteria : ['Implementation complete and tested'];
}

/**
 * Migrates jade-claude-settings format (T1-T13)
 */
function migrateJadeClaudeSettings(data) {
  const project = data.metadata.project;
  const migratedTasks = [];

  for (const task of data.tasks) {
    const title = task.title;
    const taskId = generateTaskId(project, title);

    // jade-claude-settings has minimal info, need to infer
    migratedTasks.push({
      id: taskId,
      title: title,
      description: task.subtasks_file
        ? `See ${task.subtasks_file} for detailed subtasks`
        : title,
      status: task.status,
      complexity: 'M',  // Default, can't infer from minimal data
      blocked_by: task.blocked_by ? task.blocked_by.map(id => {
        // Convert T1 → actual task IDs
        const blockerTask = data.tasks.find(t => t.id === id);
        return blockerTask ? generateTaskId(project, blockerTask.title) : id;
      }) : [],
      unlocks: [], // Will be computed later
      feature: {
        description: title,
        benefit: task.phase ? `Phase ${task.phase} milestone completion` : 'System improvement',
        acceptance_criteria: ['Task completed as specified']
      },
      relevant_files: [],
      created_at: new Date().toISOString(),
      ...(task.completed_at && { completed_at: task.completed_at }),
      ...(task.notes && { notes: task.notes })
    });
  }

  // Compute unlocks from blocked_by
  for (const task of migratedTasks) {
    for (const blocker of task.blocked_by) {
      const blockerTask = migratedTasks.find(t => t.id === blocker);
      if (blockerTask) {
        if (!blockerTask.unlocks.includes(task.id)) {
          blockerTask.unlocks.push(task.id);
        }
      }
    }
  }

  return {
    version: 1,
    project: project,
    milestone: {
      name: data.metadata.milestone,
      target_date: data.metadata.target_date,
      description: data.metadata.plan_file
        ? `See ${data.metadata.plan_file}`
        : data.metadata.milestone
    },
    tasks: migratedTasks
  };
}

/**
 * Migrates jade-docker format (Schema B)
 */
function migrateJadeDocker(data) {
  const project = data.project;
  const migratedTasks = [];

  for (const task of data.tasks) {
    migratedTasks.push({
      id: task.id,  // Already in correct format
      title: task.title,
      description: task.description,
      status: task.status,
      complexity: task.complexity,
      blocked_by: task.dependencies || [],
      unlocks: task.blocks || [],
      feature: {
        description: task.description,
        benefit: task.impact
          ? `Impact: ${task.impact}`
          : 'Improves infrastructure capabilities',
        acceptance_criteria: extractAcceptanceCriteria(task.description)
      },
      relevant_files: [],
      created_at: task.created ? `${task.created}T00:00:00Z` : new Date().toISOString(),
      ...(task.completed && { completed_at: `${task.completed}T00:00:00Z` }),
      ...(task.notes && { notes: task.notes }),
      ...(task.tags && { tags: task.tags })
    });
  }

  return {
    version: 1,
    project: project,
    milestone: {
      name: data.milestone,
      target_date: data.target_date,
      description: data.milestone
    },
    tasks: migratedTasks
  };
}

/**
 * Main migration function
 */
function migrateTaskFile(filePath) {
  console.log(`\nMigrating: ${filePath}`);

  // Read original file
  const originalData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Detect format and migrate
  let migratedData;
  if (originalData._schema && originalData._schema.includes('jade-claude-settings')) {
    console.log('  Detected: jade-claude-settings format (T1-T13)');
    migratedData = migrateJadeClaudeSettings(originalData);
  } else if (originalData.version === '1.0.0' && originalData.tasks[0]?.priority) {
    console.log('  Detected: Schema B (jade-docker)');
    migratedData = migrateJadeDocker(originalData);
  } else if (originalData.version === 1) {
    console.log('  Already Schema A v1 - skipping');
    return;
  } else {
    console.error('  Unknown schema format');
    return;
  }

  // Create backup
  const backupPath = `${filePath}.backup-${Date.now()}`;
  fs.copyFileSync(filePath, backupPath);
  console.log(`  Backup created: ${backupPath}`);

  // Write migrated file
  fs.writeFileSync(
    filePath,
    JSON.stringify(migratedData, null, 2) + '\n',
    'utf8'
  );
  console.log(`  ✓ Migrated to Schema A v1`);
  console.log(`    Tasks: ${migratedData.tasks.length}`);
  console.log(`    Completed: ${migratedData.tasks.filter(t => t.status === 'completed').length}`);
  console.log(`    Pending: ${migratedData.tasks.filter(t => t.status === 'pending').length}`);
}

/**
 * CLI entry point
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node migrate-task-schema.js <task-file-path>');
    process.exit(1);
  }

  for (const filePath of args) {
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      continue;
    }

    try {
      migrateTaskFile(filePath);
    } catch (error) {
      console.error(`  Error migrating ${filePath}:`, error.message);
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { migrateTaskFile, generateTaskId };
