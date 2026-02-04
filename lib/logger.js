'use strict';

/**
 * Structured Logger Module for the jade-dev-assist orchestrator.
 *
 * Provides JSON-formatted logging with configurable log levels.
 * Output format: { timestamp, level, module, message, ...extra }
 *
 * Supports LOG_LEVEL environment variable to control verbosity:
 * - debug: all messages
 * - info: info, warn, error (default)
 * - warn: warn, error
 * - error: error only
 */

// ── Log Level Configuration ──────────────────────────────────────────

/**
 * Log level priority values. Lower number = more verbose.
 */
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Get the current log level from environment variable.
 * Defaults to 'info' if not set or invalid.
 *
 * @returns {string} The current log level.
 */
function getLogLevel() {
  const level = (process.env.LOG_LEVEL || 'info').toLowerCase();
  return LOG_LEVELS[level] !== undefined ? level : 'info';
}

/**
 * Check if a given log level should be emitted based on current configuration.
 *
 * @param {string} level - The log level to check ('debug', 'info', 'warn', 'error').
 * @returns {boolean} True if the message should be logged.
 */
function shouldLog(level) {
  const currentLevel = getLogLevel();
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

// ── Log Entry Formatting ─────────────────────────────────────────────

/**
 * Format a log entry as a JSON string.
 *
 * @param {string} level   - Log level ('debug', 'info', 'warn', 'error').
 * @param {string} module  - Module name (e.g., 'scanner', 'dispatcher').
 * @param {string} message - The log message.
 * @param {Object} [extra] - Additional fields to include in the log entry.
 * @returns {string} JSON-formatted log entry.
 */
function formatLogEntry(level, module, message, extra) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
  };

  // Merge extra fields if provided
  if (extra && typeof extra === 'object') {
    Object.assign(entry, extra);
  }

  return JSON.stringify(entry);
}

// ── Log Output ───────────────────────────────────────────────────────

/**
 * Write a log entry to the appropriate output stream.
 *
 * - error and warn go to stderr
 * - info and debug go to stdout
 *
 * @param {string} level - Log level.
 * @param {string} jsonEntry - JSON-formatted log entry.
 */
function writeLog(level, jsonEntry) {
  if (level === 'error' || level === 'warn') {
    process.stderr.write(jsonEntry + '\n');
  } else {
    process.stdout.write(jsonEntry + '\n');
  }
}

// ── Logger Factory ───────────────────────────────────────────────────

/**
 * Create a logger instance for a specific module.
 *
 * Returns an object with debug(), info(), warn(), and error() methods.
 * Each method accepts a message string and optional extra fields object.
 *
 * @param {string} moduleName - The name of the module using this logger.
 * @returns {{ debug: Function, info: Function, warn: Function, error: Function }}
 *
 * @example
 * const logger = createLogger('scanner');
 * logger.info('Scanning projects', { count: 5 });
 * // Output: {"timestamp":"...","level":"info","module":"scanner","message":"Scanning projects","count":5}
 */
function createLogger(moduleName) {
  const log = (level, message, extra) => {
    if (shouldLog(level)) {
      const entry = formatLogEntry(level, moduleName, message, extra);
      writeLog(level, entry);
    }
  };

  return {
    /**
     * Log a debug message. Only emitted when LOG_LEVEL=debug.
     * @param {string} message - The log message.
     * @param {Object} [extra] - Additional fields.
     */
    debug: (message, extra) => log('debug', message, extra),

    /**
     * Log an info message. Emitted when LOG_LEVEL is debug or info.
     * @param {string} message - The log message.
     * @param {Object} [extra] - Additional fields.
     */
    info: (message, extra) => log('info', message, extra),

    /**
     * Log a warning message. Emitted when LOG_LEVEL is debug, info, or warn.
     * @param {string} message - The log message.
     * @param {Object} [extra] - Additional fields.
     */
    warn: (message, extra) => log('warn', message, extra),

    /**
     * Log an error message. Always emitted regardless of LOG_LEVEL.
     * @param {string} message - The log message.
     * @param {Object} [extra] - Additional fields.
     */
    error: (message, extra) => log('error', message, extra),
  };
}

// ── Standalone Functions ─────────────────────────────────────────────

/**
 * Log a debug message without a module context.
 * @param {string} message - The log message.
 * @param {Object} [extra] - Additional fields.
 */
function debug(message, extra) {
  if (shouldLog('debug')) {
    const entry = formatLogEntry('debug', 'app', message, extra);
    writeLog('debug', entry);
  }
}

/**
 * Log an info message without a module context.
 * @param {string} message - The log message.
 * @param {Object} [extra] - Additional fields.
 */
function info(message, extra) {
  if (shouldLog('info')) {
    const entry = formatLogEntry('info', 'app', message, extra);
    writeLog('info', entry);
  }
}

/**
 * Log a warning message without a module context.
 * @param {string} message - The log message.
 * @param {Object} [extra] - Additional fields.
 */
function warn(message, extra) {
  if (shouldLog('warn')) {
    const entry = formatLogEntry('warn', 'app', message, extra);
    writeLog('warn', entry);
  }
}

/**
 * Log an error message without a module context.
 * @param {string} message - The log message.
 * @param {Object} [extra] - Additional fields.
 */
function error(message, extra) {
  if (shouldLog('error')) {
    const entry = formatLogEntry('error', 'app', message, extra);
    writeLog('error', entry);
  }
}

module.exports = {
  createLogger,
  debug,
  info,
  warn,
  error,
  // Exposed for testing
  LOG_LEVELS,
  getLogLevel,
  shouldLog,
  formatLogEntry,
};
