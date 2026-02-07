#!/usr/bin/env node
/**
 * consolidate-task-discoveries.js
 *
 * Merges .jsonl task discoveries from 20 parallel agents into structured tasks.json files.
 *
 * Features:
 * - Deduplication by title similarity (0.85 threshold)
 * - Task ID generation (deterministic hash)
 * - Feature enrichment (benefit, acceptance criteria)
 * - Atomic writes (tmp + rename)
 * - Preserves existing completed tasks
 *
 * Usage:
 *   node scripts/consolidate-task-discoveries.js <run-id>
 *   node scripts/consolidate-task-discoveries.js --dry-run <run-id>
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Levenshtein distance for fuzzy string matching
 */
function levenshtein(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Computes similarity ratio between two strings
 */
function similarityRatio(a, b) {
  const distance = levenshtein(a.toLowerCase(), b.toLowerCase());
  const maxLen = Math.max(a.length, b.length);
  return 1 - (distance / maxLen);
}

/**
 * Generates deterministic task ID
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
 * Infers benefit from tags and source
 */
function inferBenefit(task) {
  const { tags, source } = task;

  if (tags.includes('performance') || tags.includes('optimization')) {
    return 'Improves system performance and efficiency';
  }
  if (tags.includes('bug') || tags.includes('fix')) {
    return 'Resolves defect and improves stability';
  }
  if (tags.includes('feature') || tags.includes('enhancement')) {
    return 'Adds new capability or enhances existing functionality';
  }
  if (tags.includes('testing') || tags.includes('qa')) {
    return 'Increases test coverage and code quality';
  }
  if (tags.includes('documentation') || tags.includes('docs')) {
    return 'Improves developer experience and onboarding';
  }
  if (tags.includes('security')) {
    return 'Enhances security posture and reduces vulnerabilities';
  }
  if (source.startsWith('code:TODO') || source.startsWith('code:FIXME')) {
    return 'Addresses technical debt noted in codebase';
  }
  if (source.startsWith('github:issue')) {
    return 'Resolves reported issue from GitHub tracker';
  }

  return 'Improves codebase quality and maintainability';
}

/**
 * Extracts acceptance criteria from description
 */
function extractAcceptanceCriteria(description) {
  const lines = description.split('\n').map(l => l.trim()).filter(Boolean);
  const criteria = [];

  for (const line of lines) {
    // Bullet points
    if (line.match(/^[-*•]\s/)) {
      criteria.push(line.replace(/^[-*•]\s/, ''));
    }
    // Numbered lists
    else if (line.match(/^\d+\.\s/)) {
      criteria.push(line.replace(/^\d+\.\s/, ''));
    }
    // "should" statements
    else if (line.toLowerCase().includes('should') || line.toLowerCase().includes('must')) {
      criteria.push(line);
    }
  }

  if (criteria.length === 0) {
    // Generate default criteria based on source
    criteria.push('Implementation complete and tested');
    criteria.push('Code passes linting (ruff check)');
    criteria.push('All tests pass (pytest)');
  }

  return criteria;
}

/**
 * Reads all .jsonl files for a project
 */
function readJsonlFiles(discoveryDir, project) {
  const pattern = new RegExp(`^${project}-\\d+\\.jsonl$`);
  const files = fs.readdirSync(discoveryDir).filter(f => pattern.test(f));

  const discoveries = [];
  for (const file of files) {
    const filePath = path.join(discoveryDir, file);
    const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);

    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.type === 'task') {
          discoveries.push(obj);
        }
      } catch (error) {
        console.warn(`  Warning: Malformed JSON in ${file}: ${error.message}`);
      }
    }
  }

  return discoveries;
}

/**
 * Deduplicates tasks by title similarity
 */
function deduplicateTasks(tasks, threshold = 0.85) {
  const unique = [];
  const duplicates = [];

  for (const task of tasks) {
    let isDuplicate = false;

    for (const existing of unique) {
      const similarity = similarityRatio(task.title, existing.title);
      if (similarity >= threshold) {
        isDuplicate = true;
        // Merge tags and sources
        existing.tags = [...new Set([...existing.tags, ...task.tags])];
        existing.sources = existing.sources || [existing.source];
        if (!existing.sources.includes(task.source)) {
          existing.sources.push(task.source);
        }
        duplicates.push({ original: task, mergedInto: existing });
        break;
      }
    }

    if (!isDuplicate) {
      unique.push(task);
    }
  }

  return { unique, duplicates };
}

/**
 * Enriches task with Schema A fields
 */
function enrichTask(task, project) {
  const taskId = generateTaskId(project, task.title);

  return {
    id: taskId,
    title: task.title,
    description: task.description,
    status: 'pending',
    complexity: task.complexity || 'M',
    blocked_by: [],
    unlocks: [],
    feature: {
      description: task.description,
      benefit: inferBenefit(task),
      acceptance_criteria: extractAcceptanceCriteria(task.description)
    },
    relevant_files: task.file ? [task.file] : [],
    created_at: new Date().toISOString(),
    ...(task.tags && { tags: task.tags }),
    ...(task.notes && { notes: task.notes }),
    ...(task.issue_number && { github_issue: task.issue_number }),
    ...(task.line && { source_line: task.line }),
    source: task.source
  };
}

/**
 * Merges new tasks with existing tasks.json
 */
function mergeWithExisting(tasksFilePath, newTasks) {
  if (!fs.existsSync(tasksFilePath)) {
    console.warn(`  Warning: ${tasksFilePath} not found, skipping merge`);
    return newTasks;
  }

  const existing = JSON.parse(fs.readFileSync(tasksFilePath, 'utf8'));

  // Preserve completed/in_progress tasks
  const preservedTasks = existing.tasks.filter(
    t => t.status === 'completed' || t.status === 'in_progress'
  );

  // Remove old pending tasks (will be replaced by discoveries)
  const pendingIds = new Set(existing.tasks.filter(t => t.status === 'pending').map(t => t.id));

  // Add new tasks
  const mergedTasks = [...preservedTasks, ...newTasks];

  // Sort by ID
  mergedTasks.sort((a, b) => a.id.localeCompare(b.id));

  console.log(`  Preserved ${preservedTasks.length} completed/in-progress tasks`);
  console.log(`  Replaced ${pendingIds.size} pending tasks`);
  console.log(`  Added ${newTasks.length} new tasks`);

  return mergedTasks;
}

/**
 * Writes updated tasks.json atomically
 */
function writeTasksFile(tasksFilePath, data, dryRun = false) {
  const tmpPath = `${tasksFilePath}.tmp`;

  const content = JSON.stringify(data, null, 2) + '\n';

  if (dryRun) {
    console.log(`  [DRY-RUN] Would write ${content.length} bytes to ${tasksFilePath}`);
    return;
  }

  // Write to tmp file
  fs.writeFileSync(tmpPath, content, 'utf8');

  // Atomic rename
  fs.renameSync(tmpPath, tasksFilePath);

  console.log(`  ✓ Written: ${tasksFilePath}`);
}

/**
 * Consolidates discoveries for a single project
 */
function consolidateProject(discoveryDir, project, projectsRoot, dryRun = false) {
  console.log(`\n=== Consolidating: ${project} ===`);

  // Read all .jsonl files for project
  const discoveries = readJsonlFiles(discoveryDir, project);
  console.log(`  Discovered: ${discoveries.length} tasks (from .jsonl files)`);

  if (discoveries.length === 0) {
    console.log(`  No discoveries found, skipping`);
    return;
  }

  // Deduplicate by title similarity
  const { unique, duplicates } = deduplicateTasks(discoveries, 0.85);
  console.log(`  Deduplicated: ${unique.length} unique tasks (${duplicates.length} duplicates merged)`);

  // Enrich tasks with Schema A fields
  const enrichedTasks = unique.map(t => enrichTask(t, project));

  // Merge with existing tasks.json
  const tasksFilePath = path.join(projectsRoot, project, '.claude', 'tasks', 'tasks.json');
  const mergedTasks = mergeWithExisting(tasksFilePath, enrichedTasks);

  // Read existing file for milestone info
  let existingData;
  if (fs.existsSync(tasksFilePath)) {
    existingData = JSON.parse(fs.readFileSync(tasksFilePath, 'utf8'));
  } else {
    existingData = {
      version: 1,
      project: project,
      milestone: {
        name: 'Task Discovery',
        target_date: '2026-03-31',
        description: 'Discovered tasks from automated scanning'
      }
    };
  }

  // Write updated file
  const updatedData = {
    ...existingData,
    tasks: mergedTasks
  };

  writeTasksFile(tasksFilePath, updatedData, dryRun);

  console.log(`  Total tasks in ${project}: ${mergedTasks.length}`);
  console.log(`    Completed: ${mergedTasks.filter(t => t.status === 'completed').length}`);
  console.log(`    In Progress: ${mergedTasks.filter(t => t.status === 'in_progress').length}`);
  console.log(`    Pending: ${mergedTasks.filter(t => t.status === 'pending').length}`);
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  let dryRun = false;
  let runId;

  // Parse args
  if (args.includes('--dry-run')) {
    dryRun = true;
    runId = args[args.indexOf('--dry-run') + 1];
  } else {
    runId = args[0];
  }

  if (!runId) {
    console.error('Usage: node consolidate-task-discoveries.js [--dry-run] <run-id>');
    process.exit(1);
  }

  const discoveryDir = path.join(process.env.HOME, '.jade-swarm', 'runs', runId, 'task-discovery');
  const projectsRoot = path.join(process.env.HOME, 'projects');

  if (!fs.existsSync(discoveryDir)) {
    console.error(`Discovery directory not found: ${discoveryDir}`);
    process.exit(1);
  }

  console.log(`Consolidating discoveries from: ${discoveryDir}`);
  console.log(`Projects root: ${projectsRoot}`);
  if (dryRun) {
    console.log('[DRY-RUN MODE] No files will be modified\n');
  }

  // Get list of projects from .jsonl files
  const jsonlFiles = fs.readdirSync(discoveryDir).filter(f => f.endsWith('.jsonl'));
  const projects = [...new Set(jsonlFiles.map(f => f.replace(/-\d+\.jsonl$/, '')))];

  console.log(`Found ${projects.length} projects with discoveries:\n  ${projects.join(', ')}`);

  // Consolidate each project
  for (const project of projects) {
    try {
      consolidateProject(discoveryDir, project, projectsRoot, dryRun);
    } catch (error) {
      console.error(`Error consolidating ${project}:`, error.message);
    }
  }

  console.log('\n✓ Consolidation complete');
}

if (require.main === module) {
  main();
}

module.exports = { consolidateProject, generateTaskId, deduplicateTasks };
