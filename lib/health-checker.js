'use strict';

/**
 * Health Checker Module for jade-dev-assist.
 *
 * Provides infrastructure health aggregation functions for checking:
 * - Docker Compose services
 * - GPU availability and utilization
 * - Database connectivity (PostgreSQL, MongoDB, Dragonfly)
 * - Disk space
 */

const { execSync, exec } = require('child_process');
const { promisify } = require('util');
const { createLogger } = require('./logger');

const execAsync = promisify(exec);
const logger = createLogger('health-checker');

// ── Docker Services Check ────────────────────────────────────────────

/**
 * Check Docker Compose services status.
 *
 * @param {Object} [options]
 * @param {string} [options.composePath] - Path to docker-compose.yml directory.
 * @returns {Promise<{ healthy: boolean, services: Array<{ name: string, status: string }>, error: string|null }>}
 */
async function checkDockerServices(options = {}) {
  const result = {
    healthy: false,
    services: [],
    error: null,
  };

  try {
    // Try docker compose ps first (newer syntax), then docker-compose ps
    let output;
    try {
      const cmd = options.composePath
        ? `docker compose -f "${options.composePath}/docker-compose.yml" ps --format json`
        : 'docker compose ps --format json';
      const { stdout } = await execAsync(cmd, { timeout: 10000 });
      output = stdout;
    } catch {
      // Fall back to docker-compose (legacy)
      try {
        const cmd = options.composePath
          ? `docker-compose -f "${options.composePath}/docker-compose.yml" ps --format json`
          : 'docker-compose ps --format json';
        const { stdout } = await execAsync(cmd, { timeout: 10000 });
        output = stdout;
      } catch (fallbackErr) {
        result.error = 'Docker not available or no compose project found';
        return result;
      }
    }

    // Parse JSON output (each line is a JSON object)
    const lines = output.trim().split('\n').filter((l) => l);
    for (const line of lines) {
      try {
        const service = JSON.parse(line);
        result.services.push({
          name: service.Name || service.Service || 'unknown',
          status: service.State || service.Status || 'unknown',
          health: service.Health || null,
        });
      } catch {
        // Skip malformed lines
      }
    }

    // Consider healthy if at least one service is running
    result.healthy = result.services.some(
      (s) => s.status === 'running' || s.status.includes('Up')
    );
  } catch (err) {
    logger.warn('Docker check failed', { error: err.message });
    result.error = err.message;
  }

  return result;
}

// ── GPU Availability Check ───────────────────────────────────────────

/**
 * Check GPU availability and utilization using nvidia-smi.
 *
 * @returns {Promise<{ available: boolean, name: string|null, memory: { total: number, used: number }|null, utilization: number|null }>}
 */
async function checkGpuAvailability() {
  const result = {
    available: false,
    name: null,
    memory: null,
    utilization: null,
  };

  try {
    const { stdout } = await execAsync(
      'nvidia-smi --query-gpu=name,memory.total,memory.used,utilization.gpu --format=csv,noheader,nounits',
      { timeout: 5000 }
    );

    const lines = stdout.trim().split('\n');
    if (lines.length > 0 && lines[0]) {
      const parts = lines[0].split(', ').map((s) => s.trim());
      if (parts.length >= 4) {
        result.available = true;
        result.name = parts[0];
        result.memory = {
          total: parseInt(parts[1], 10),
          used: parseInt(parts[2], 10),
        };
        result.utilization = parseInt(parts[3], 10);
      }
    }
  } catch (err) {
    // nvidia-smi not available or no GPU
    logger.debug('GPU check failed (nvidia-smi not available)', { error: err.message });
  }

  return result;
}

// ── Database Connectivity Check ──────────────────────────────────────

/**
 * Check database connectivity for PostgreSQL, MongoDB, and Dragonfly.
 *
 * @param {Object} [options]
 * @param {Object} [options.postgresql] - PostgreSQL connection options { host, port }.
 * @param {Object} [options.mongodb] - MongoDB connection options { host, port }.
 * @param {Object} [options.dragonfly] - Dragonfly/Redis connection options { host, port }.
 * @returns {Promise<{ postgresql: Object, mongodb: Object, dragonfly: Object }>}
 */
async function checkDatabaseConnectivity(options = {}) {
  const pgOpts = options.postgresql || { host: 'localhost', port: 5432 };
  const mongoOpts = options.mongodb || { host: 'localhost', port: 27017 };
  const dfOpts = options.dragonfly || { host: 'localhost', port: 6379 };

  const results = {
    postgresql: { connected: false, latency: null, error: null },
    mongodb: { connected: false, latency: null, error: null },
    dragonfly: { connected: false, latency: null, error: null },
  };

  // Check PostgreSQL using pg_isready or nc
  const pgStart = Date.now();
  try {
    await execAsync(`pg_isready -h ${pgOpts.host} -p ${pgOpts.port}`, { timeout: 5000 });
    results.postgresql.connected = true;
    results.postgresql.latency = Date.now() - pgStart;
  } catch {
    // Try netcat as fallback
    try {
      await execAsync(`nc -z -w1 ${pgOpts.host} ${pgOpts.port}`, { timeout: 2000 });
      results.postgresql.connected = true;
      results.postgresql.latency = Date.now() - pgStart;
    } catch (err) {
      results.postgresql.error = 'Connection refused or timeout';
    }
  }

  // Check MongoDB using mongosh or nc
  const mongoStart = Date.now();
  try {
    await execAsync(`mongosh --host ${mongoOpts.host}:${mongoOpts.port} --eval "db.runCommand({ping:1})" --quiet`, { timeout: 5000 });
    results.mongodb.connected = true;
    results.mongodb.latency = Date.now() - mongoStart;
  } catch {
    // Try netcat as fallback
    try {
      await execAsync(`nc -z -w1 ${mongoOpts.host} ${mongoOpts.port}`, { timeout: 2000 });
      results.mongodb.connected = true;
      results.mongodb.latency = Date.now() - mongoStart;
    } catch (err) {
      results.mongodb.error = 'Connection refused or timeout';
    }
  }

  // Check Dragonfly/Redis using redis-cli or nc
  const dfStart = Date.now();
  try {
    await execAsync(`redis-cli -h ${dfOpts.host} -p ${dfOpts.port} ping`, { timeout: 5000 });
    results.dragonfly.connected = true;
    results.dragonfly.latency = Date.now() - dfStart;
  } catch {
    // Try netcat as fallback
    try {
      await execAsync(`nc -z -w1 ${dfOpts.host} ${dfOpts.port}`, { timeout: 2000 });
      results.dragonfly.connected = true;
      results.dragonfly.latency = Date.now() - dfStart;
    } catch (err) {
      results.dragonfly.error = 'Connection refused or timeout';
    }
  }

  return results;
}

// ── Disk Space Check ─────────────────────────────────────────────────

/**
 * Check disk space usage.
 *
 * @param {Object} [options]
 * @param {number} [options.threshold=90] - Unhealthy threshold percentage.
 * @param {string[]} [options.paths] - Specific paths to check (default: /).
 * @returns {Promise<{ healthy: boolean, mounts: Array<{ path: string, total: number, used: number, percent: number }> }>}
 */
async function checkDiskSpace(options = {}) {
  const threshold = options.threshold ?? 90;
  const paths = options.paths || ['/'];

  const result = {
    healthy: true,
    mounts: [],
  };

  try {
    // Use df command to get disk usage
    const { stdout } = await execAsync('df -B1 --output=target,size,used,pcent', { timeout: 5000 });
    const lines = stdout.trim().split('\n').slice(1); // Skip header

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 4) {
        const mountPath = parts[0];
        const total = parseInt(parts[1], 10);
        const used = parseInt(parts[2], 10);
        const percent = parseInt(parts[3].replace('%', ''), 10);

        // Only include requested paths or all if paths contains '/'
        if (paths.includes('/') || paths.some((p) => mountPath.startsWith(p))) {
          result.mounts.push({
            path: mountPath,
            total,
            used,
            percent,
          });

          if (percent > threshold) {
            result.healthy = false;
          }
        }
      }
    }

    // If no mounts found for specific paths, try to get them individually
    if (result.mounts.length === 0 && !paths.includes('/')) {
      for (const p of paths) {
        try {
          const { stdout: pStdout } = await execAsync(`df -B1 --output=target,size,used,pcent "${p}"`, { timeout: 5000 });
          const pLines = pStdout.trim().split('\n').slice(1);
          if (pLines.length > 0) {
            const parts = pLines[0].trim().split(/\s+/);
            if (parts.length >= 4) {
              const percent = parseInt(parts[3].replace('%', ''), 10);
              result.mounts.push({
                path: p,
                total: parseInt(parts[1], 10),
                used: parseInt(parts[2], 10),
                percent,
              });
              if (percent > threshold) {
                result.healthy = false;
              }
            }
          }
        } catch {
          // Skip paths that don't exist
        }
      }
    }
  } catch (err) {
    logger.warn('Disk space check failed', { error: err.message });
    result.healthy = false;
  }

  return result;
}

// ── Aggregated Health Checks ─────────────────────────────────────────

/**
 * Run all health checks and aggregate results.
 *
 * @param {Object} [options]
 * @param {boolean} [options.skipDocker] - Skip Docker check.
 * @param {boolean} [options.skipGpu] - Skip GPU check.
 * @param {boolean} [options.skipDatabases] - Skip database checks.
 * @param {boolean} [options.skipDisk] - Skip disk check.
 * @returns {Promise<Object>}
 */
async function runHealthChecks(options = {}) {
  const timestamp = new Date().toISOString();

  const [docker, gpu, databases, disk] = await Promise.all([
    options.skipDocker ? Promise.resolve({ skipped: true }) : checkDockerServices(),
    options.skipGpu ? Promise.resolve({ skipped: true }) : checkGpuAvailability(),
    options.skipDatabases ? Promise.resolve(null) : checkDatabaseConnectivity(),
    options.skipDisk ? Promise.resolve({ skipped: true }) : checkDiskSpace(),
  ]);

  // Determine overall health
  let overallHealthy = true;

  if (docker && !docker.skipped && !docker.healthy) {
    overallHealthy = false;
  }
  if (disk && !disk.skipped && !disk.healthy) {
    overallHealthy = false;
  }
  if (databases) {
    const anyDbDown = !databases.postgresql.connected ||
      !databases.mongodb.connected ||
      !databases.dragonfly.connected;
    if (anyDbDown) {
      overallHealthy = false;
    }
  }

  return {
    docker: options.skipDocker ? null : docker,
    gpu: options.skipGpu ? null : gpu,
    databases: options.skipDatabases ? null : databases,
    disk: options.skipDisk ? null : disk,
    timestamp,
    overallHealthy,
  };
}

// ── Report Formatting ────────────────────────────────────────────────

/**
 * Format health check results as a human-readable report.
 *
 * @param {Object} healthData - Results from runHealthChecks().
 * @returns {string}
 */
function formatHealthReport(healthData) {
  const lines = [];
  const checkMark = '\u2713';
  const crossMark = '\u2717';
  const warnMark = '\u26A0';

  lines.push('');
  lines.push('=== Infrastructure Health Report ===');
  lines.push(`Timestamp: ${healthData.timestamp}`);
  lines.push('');

  // Docker section
  lines.push('## Docker Services');
  if (healthData.docker === null || healthData.docker.skipped) {
    lines.push(`  ${warnMark} Skipped`);
  } else if (healthData.docker.error) {
    lines.push(`  ${crossMark} Error: ${healthData.docker.error}`);
  } else if (healthData.docker.services.length === 0) {
    lines.push(`  ${warnMark} No services found`);
  } else {
    for (const svc of healthData.docker.services) {
      const status = svc.status === 'running' || svc.status.includes('Up') ? checkMark : crossMark;
      lines.push(`  ${status} ${svc.name}: ${svc.status}`);
    }
  }
  lines.push('');

  // GPU section
  lines.push('## GPU');
  if (healthData.gpu === null || healthData.gpu.skipped) {
    lines.push(`  ${warnMark} Skipped`);
  } else if (!healthData.gpu.available) {
    lines.push(`  ${warnMark} No GPU available`);
  } else {
    lines.push(`  ${checkMark} ${healthData.gpu.name}`);
    if (healthData.gpu.memory) {
      const memUsed = Math.round(healthData.gpu.memory.used / 1024 * 100) / 100;
      const memTotal = Math.round(healthData.gpu.memory.total / 1024 * 100) / 100;
      lines.push(`    Memory: ${memUsed}GB / ${memTotal}GB`);
    }
    if (healthData.gpu.utilization !== null) {
      lines.push(`    Utilization: ${healthData.gpu.utilization}%`);
    }
  }
  lines.push('');

  // Database section
  lines.push('## Databases');
  if (healthData.databases === null) {
    lines.push(`  ${warnMark} Skipped`);
  } else {
    for (const [name, info] of Object.entries(healthData.databases)) {
      const status = info.connected ? checkMark : crossMark;
      const latency = info.latency !== null ? ` (${info.latency}ms)` : '';
      lines.push(`  ${status} ${name}${latency}`);
    }
  }
  lines.push('');

  // Disk section
  lines.push('## Disk Space');
  if (healthData.disk === null || healthData.disk.skipped) {
    lines.push(`  ${warnMark} Skipped`);
  } else if (healthData.disk.mounts.length === 0) {
    lines.push(`  ${warnMark} No mounts found`);
  } else {
    for (const mount of healthData.disk.mounts) {
      const status = mount.percent < 90 ? checkMark : crossMark;
      const totalGB = Math.round(mount.total / 1073741824 * 100) / 100;
      const usedGB = Math.round(mount.used / 1073741824 * 100) / 100;
      lines.push(`  ${status} ${mount.path}: ${usedGB}GB / ${totalGB}GB (${mount.percent}%)`);
    }
  }
  lines.push('');

  // Overall status
  const overall = healthData.overallHealthy ? `${checkMark} HEALTHY` : `${crossMark} UNHEALTHY`;
  lines.push(`Overall Status: ${overall}`);
  lines.push('');

  return lines.join('\n');
}

module.exports = {
  checkDockerServices,
  checkGpuAvailability,
  checkDatabaseConnectivity,
  checkDiskSpace,
  runHealthChecks,
  formatHealthReport,
};
