#!/usr/bin/env node
/**
 * batch-orchestrate.js
 *
 * Orchestrates parallel execution of multiple tasks via Promise.all.
 *
 * Features:
 * - Scans all projects for pending tasks
 * - Scores and ranks by priority
 * - Dispatches N workers in parallel
 * - Monitors completion
 * - Updates task statuses
 * - Reprioritizes remaining tasks
 *
 * Usage:
 *   node scripts/batch-orchestrate.js --batch 5
 *   node scripts/batch-orchestrate.js --batch 10 --dry-run
 *   node scripts/batch-orchestrate.js --batch 3 --model local
 */

const fs = require('fs');
const path = require('path');
const {exec, spawn} = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Import orchestrator modules
const { scanTasks } = require('../lib/scanner');
const { scoreTasks } = require('../lib/scorer');
const { buildWorkerPrompt } = require('../lib/dispatcher');

/**
 * Load projects registry
 */
function loadProjectRegistry() {
  const registryPath = path.join(process.env.HOME, '.jade', 'projects.json');
  if (!fs.existsSync(registryPath)) {
    throw new Error(`Projects registry not found: ${registryPath}`);
  }
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

/**
 * Update task status in tasks.json
 */
function updateTaskStatus(taskId, status) {
  // Parse project from task ID: "project/task-slug-hash"
  const [project] = taskId.split('/');

  const tasksPath = path.join(process.env.HOME, 'projects', project, '.claude', 'tasks', 'tasks.json');
  if (!fs.existsSync(tasksPath)) {
    console.warn(`Tasks file not found: ${tasksPath}`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
  const task = data.tasks.find(t => t.id === taskId);

  if (!task) {
    console.warn(`Task not found: ${taskId}`);
    return;
  }

  task.status = status;

  // Add history entry
  if (!task.history) {
    task.history = [];
  }
  task.history.push({
    timestamp: new Date().toISOString(),
    from_status: task.status === 'in_progress' ? 'pending' : 'in_progress',
    to_status: status
  });

  // Update timestamps
  if (status === 'in_progress') {
    task.started_at = new Date().toISOString();
  } else if (status === 'completed') {
    task.completed_at = new Date().toISOString();
  } else if (status === 'failed') {
    task.failed_at = new Date().toISOString();
  }

  fs.writeFileSync(tasksPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`  ✓ Updated ${taskId} → ${status}`);
}

/**
 * Execute a single worker task
 */
async function executeWorker(task, workingDir, model = 'opus', dryRun = false) {
  console.log(`\n[Worker] Starting: ${task.id}`);
  console.log(`  Project: ${task._projectName}`);
  console.log(`  Working directory: ${workingDir}`);
  console.log(`  Model: ${model}`);

  if (dryRun) {
    console.log(`  [DRY-RUN] Simulating execution (sleep 5s)`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log(`  [DRY-RUN] Completed: ${task.id}`);
    return { exitCode: 0, stdout: 'dry-run', stderr: '' };
  }

  // Build worker prompt
  const dispatchDescriptor = buildWorkerPrompt(task, {
    includeFiles: true,
    maxTurns: 25
  });

  // Update status to in_progress
  updateTaskStatus(task.id, 'in_progress');

  // Spawn claude subprocess
  const args = ['--print', '--dangerouslySkipPermissions'];
  if (model === 'local') {
    args.push('--model', 'qwen3-coder');
  }

  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, {
      cwd: workingDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...(model === 'local' && {
          ANTHROPIC_AUTH_TOKEN: 'ollama',
          ANTHROPIC_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
        })
      }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    // Write prompt to stdin
    child.stdin.write(dispatchDescriptor.prompt);
    child.stdin.end();

    child.on('close', (code) => {
      console.log(`\n[Worker] Finished: ${task.id} (exit code: ${code})`);

      // Update status based on exit code
      if (code === 0) {
        updateTaskStatus(task.id, 'completed');
      } else {
        updateTaskStatus(task.id, 'failed');
      }

      resolve({ exitCode: code, stdout, stderr });
    });

    child.on('error', (error) => {
      console.error(`[Worker] Error: ${task.id}`, error);
      updateTaskStatus(task.id, 'failed');
      reject(error);
    });
  });
}

/**
 * Main batch orchestration
 */
async function batchOrchestrate(options = {}) {
  const { batchSize = 5, model = 'opus', dryRun = false } = options;

  console.log('=== Batch Orchestrator ===');
  console.log(`Batch size: ${batchSize}`);
  console.log(`Model: ${model}`);
  if (dryRun) {
    console.log('[DRY-RUN MODE] No actual execution\n');
  }

  // Load projects registry
  const registry = loadProjectRegistry();
  console.log(`Projects registry: ${Object.keys(registry.projects).length} projects\n`);

  // Scan all tasks
  console.log('Scanning tasks...');
  const scanResult = scanTasks(registry);
  console.log(`Found ${scanResult.tasks.length} tasks across ${Object.keys(registry.projects).length} projects\n`);

  // Score and rank pending tasks
  console.log('Scoring and ranking tasks...');
  const pendingTasks = scanResult.tasks.filter(t => t.status === 'pending');
  const scoredTasks = scoreTasks(pendingTasks, { registry });
  scoredTasks.sort((a, b) => b._score - a._score);

  console.log(`Pending tasks: ${pendingTasks.length}`);
  console.log(`Top ${batchSize} tasks by priority:\n`);
  scoredTasks.slice(0, batchSize).forEach((task, i) => {
    console.log(`  ${i + 1}. [${task._score}] ${task.id}`);
    console.log(`     ${task.title}`);
  });

  // Select top N tasks
  const tasksToExecute = scoredTasks.slice(0, batchSize);

  if (tasksToExecute.length === 0) {
    console.log('\nNo pending tasks to execute');
    return;
  }

  console.log(`\n=== Dispatching ${tasksToExecute.length} workers in parallel ===\n`);

  // Execute all workers in parallel
  const startTime = Date.now();
  const promises = tasksToExecute.map(task => {
    const workingDir = path.join(process.env.HOME, 'projects', task._projectName);
    return executeWorker(task, workingDir, model, dryRun)
      .catch(error => {
        console.error(`Worker failed: ${task.id}`, error.message);
        return { exitCode: 1, stdout: '', stderr: error.message, error };
      });
  });

  const results = await Promise.all(promises);
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n=== Batch Complete (${duration}s) ===\n`);

  // Summary
  const succeeded = results.filter(r => r.exitCode === 0).length;
  const failed = results.filter(r => r.exitCode !== 0).length;

  console.log(`Results:`);
  console.log(`  ✓ Succeeded: ${succeeded}`);
  console.log(`  ✗ Failed: ${failed}`);

  // Reprioritize remaining tasks
  if (!dryRun && pendingTasks.length > batchSize) {
    console.log(`\nReprioritizing ${pendingTasks.length - batchSize} remaining pending tasks...`);
    const remainingScanResult = scanTasks(registry);
    const remainingPending = remainingScanResult.tasks.filter(t => t.status === 'pending');
    const remainingScored = scoreTasks(remainingPending, { registry });
    remainingScored.sort((a, b) => b._score - a._score);

    console.log(`\nTop 10 remaining tasks:`);
    remainingScored.slice(0, 10).forEach((task, i) => {
      console.log(`  ${i + 1}. [${task._score}] ${task.id}`);
    });
  }

  console.log('\n✓ Batch orchestration complete');
}

/**
 * CLI entry point
 */
function main() {
  const args = process.argv.slice(2);

  const options = {
    batchSize: 5,
    model: 'opus',
    dryRun: false
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--batch' && args[i + 1]) {
      options.batchSize = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--model' && args[i + 1]) {
      options.model = args[i + 1];
      i++;
    } else if (args[i] === '--dry-run') {
      options.dryRun = true;
    } else if (args[i] === '--help') {
      console.log(`Usage: node batch-orchestrate.js [options]

Options:
  --batch <N>       Number of tasks to execute in parallel (default: 5)
  --model <tier>    Model tier: opus or local (default: opus)
  --dry-run         Simulate execution without running actual workers
  --help            Show this help message

Examples:
  node batch-orchestrate.js --batch 5
  node batch-orchestrate.js --batch 10 --model local
  node batch-orchestrate.js --batch 3 --dry-run`);
      return;
    }
  }

  batchOrchestrate(options).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

if (require.main === module) {
  main();
}

module.exports = { batchOrchestrate, executeWorker };
