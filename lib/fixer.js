'use strict';

/**
 * Autonomous Bug Fixer Module for jade-dev-assist
 *
 * Implements Boris Cherny Tip #5: "Claude fixes most bugs by itself"
 *
 * Workflow:
 * 1. Detect bug (from CI, logs, or description)
 * 2. Parse errors and extract context
 * 3. Analyze root cause
 * 4. Generate fix prompt for Claude
 * 5. Apply fix
 * 6. Verify with tests
 * 7. Iterate if needed
 *
 * See commands/fix.md for usage patterns.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createLogger } = require('./logger');
const ciIntegrations = require('./ci-integrations');

const logger = createLogger('fixer');

// ── Error Parsing ────────────────────────────────────────────────────

/**
 * Parse test failure output and extract individual failures.
 *
 * Supports common test frameworks:
 * - Jest
 * - Mocha
 * - Pytest
 * - Node.js built-in test runner
 *
 * @param {string} output - Raw test output
 * @returns {Array<Object>} Array of failure objects
 */
function parseTestFailures(output) {
    if (!output || typeof output !== 'string') {
        return [];
    }

    const failures = [];
    const seenErrors = new Set();

    // Pattern for Jest/Vitest failures - more specific
    // Matches: FAIL tests/file.ts, then ● test name, then error
    const lines = output.split('\n');
    let currentFile = null;
    let currentTest = null;
    let collectingError = false;
    let errorLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Detect FAIL line
        if (line.trim().startsWith('FAIL ')) {
            currentFile = line.replace(/^FAIL\s+/, '').trim();
            continue;
        }

        // Detect test name (● marker)
        if (line.includes('●') && !line.includes('●●')) {
            // Save previous error if any
            if (currentFile && currentTest && errorLines.length > 0) {
                const errorText = errorLines.join('\n').trim();
                const errorKey = `${currentFile}:${errorText.substring(0, 50)}`;

                if (!seenErrors.has(errorKey)) {
                    failures.push({
                        file: currentFile,
                        test: currentTest,
                        error: errorText,
                        framework: 'jest'
                    });
                    seenErrors.add(errorKey);
                }
            }

            // Start new test
            currentTest = line.replace(/.*●\s*/, '').trim();
            errorLines = [];
            collectingError = true;
            continue;
        }

        // Collect error lines until we hit stack trace
        if (collectingError) {
            if (line.trim().startsWith('at ') || line.trim().startsWith('Test Suites:')) {
                // End of error, save it
                if (currentFile && currentTest && errorLines.length > 0) {
                    const errorText = errorLines.join('\n').trim();
                    const errorKey = `${currentFile}:${errorText.substring(0, 50)}`;

                    if (!seenErrors.has(errorKey)) {
                        failures.push({
                            file: currentFile,
                            test: currentTest,
                            error: errorText,
                            framework: 'jest'
                        });
                        seenErrors.add(errorKey);
                    }
                }
                collectingError = false;
                errorLines = [];
            } else if (line.trim()) {
                errorLines.push(line);
            }
        }
    }

    // Save last error if any
    if (currentFile && currentTest && errorLines.length > 0) {
        const errorText = errorLines.join('\n').trim();
        const errorKey = `${currentFile}:${errorText.substring(0, 50)}`;

        if (!seenErrors.has(errorKey)) {
            failures.push({
                file: currentFile,
                test: currentTest,
                error: errorText,
                framework: 'jest'
            });
        }
    }

    return failures;
}

/**
 * Parse stack trace and extract file paths with line numbers.
 *
 * @param {string} stackTrace - Stack trace string
 * @returns {Array<Object>} Array of stack frames
 */
function parseStackTrace(stackTrace) {
    if (!stackTrace || typeof stackTrace !== 'string') {
        return [];
    }

    const frames = [];
    const lines = stackTrace.split('\n');

    // Pattern: at Function (file:line:col) or at file:line:col
    const framePattern = /at\s+(?:.*?\s+\()?([^:)]+):(\d+):(\d+)/;

    for (const line of lines) {
        const match = line.match(framePattern);
        if (match) {
            const [, file, lineNum, col] = match;
            frames.push({
                file: file.trim(),
                line: parseInt(lineNum, 10),
                column: parseInt(col, 10),
                raw: line.trim()
            });
        }
    }

    return frames;
}

/**
 * Extract common error patterns from output.
 *
 * @param {string} output - Error output
 * @returns {Array<Object>} Array of error patterns
 */
function extractErrorPatterns(output) {
    if (!output || typeof output !== 'string') {
        return [];
    }

    const patterns = [];

    // Common error types
    const errorTypes = [
        'TypeError',
        'ReferenceError',
        'SyntaxError',
        'ValidationError',
        'AssertionError',
        'Error'
    ];

    for (const errorType of errorTypes) {
        const regex = new RegExp(`${errorType}:([^\n]+)`, 'g');
        let match;

        while ((match = regex.exec(output)) !== null) {
            patterns.push({
                type: errorType,
                message: match[1].trim(),
                fullMatch: match[0]
            });
        }
    }

    return patterns;
}

// ── Log Analysis ─────────────────────────────────────────────────────

/**
 * Parse log output and extract errors and warnings.
 *
 * Supports common log formats:
 * - JSON logs
 * - Syslog
 * - Custom timestamp formats
 *
 * @param {string} logOutput - Raw log output
 * @returns {Object} Parsed logs with errors and warnings
 */
function parseLogOutput(logOutput) {
    if (!logOutput || typeof logOutput !== 'string') {
        return { errors: [], warnings: [] };
    }

    const errors = [];
    const warnings = [];
    const lines = logOutput.split('\n');

    for (const line of lines) {
        if (!line.trim()) continue;

        // Try JSON parse first
        try {
            const json = JSON.parse(line);
            if (json.level === 'error' || json.level === 'ERROR') {
                errors.push({
                    timestamp: json.timestamp || json.time,
                    message: json.message || json.msg,
                    level: 'error',
                    raw: line
                });
            } else if (json.level === 'warn' || json.level === 'WARNING') {
                warnings.push({
                    timestamp: json.timestamp || json.time,
                    message: json.message || json.msg,
                    level: 'warning',
                    raw: line
                });
            }
            continue;
        } catch (e) {
            // Not JSON, continue with pattern matching
        }

        // Pattern matching for standard log formats
        const errorPattern = /\b(ERROR|FATAL|CRITICAL)\b[:\s]*(.+)/i;
        const warnPattern = /\b(WARN|WARNING)\b[:\s]*(.+)/i;

        const errorMatch = line.match(errorPattern);
        if (errorMatch) {
            errors.push({
                timestamp: extractTimestamp(line),
                message: errorMatch[2].trim(),
                level: errorMatch[1].toLowerCase(),
                raw: line
            });
            continue;
        }

        const warnMatch = line.match(warnPattern);
        if (warnMatch) {
            warnings.push({
                timestamp: extractTimestamp(line),
                message: warnMatch[2].trim(),
                level: 'warning',
                raw: line
            });
        }
    }

    return { errors, warnings };
}

/**
 * Extract timestamp from log line.
 *
 * @param {string} line - Log line
 * @returns {string|null} Timestamp or null
 */
function extractTimestamp(line) {
    // ISO 8601 timestamp
    const isoMatch = line.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    if (isoMatch) return isoMatch[0];

    // Standard timestamp formats
    const stdMatch = line.match(/\d{2}:\d{2}:\d{2}/);
    if (stdMatch) return stdMatch[0];

    return null;
}

// ── Root Cause Analysis ──────────────────────────────────────────────

/**
 * Analyze test failures to identify root cause.
 *
 * @param {Array<Object>} failures - Array of failure objects
 * @returns {Object} Analysis with summary and likely files
 */
function analyzeRootCause(failures) {
    if (!failures || failures.length === 0) {
        return {
            summary: 'No failures to analyze',
            likelyFiles: [],
            confidence: 0
        };
    }

    // Extract all mentioned files
    const fileMap = {};
    for (const failure of failures) {
        if (failure.file && failure.file !== 'unknown') {
            fileMap[failure.file] = (fileMap[failure.file] || 0) + 1;
        }
    }

    // Sort by frequency
    const likelyFiles = Object.entries(fileMap)
        .sort((a, b) => b[1] - a[1])
        .map(([file]) => file);

    // Analyze error patterns
    const errorTypes = failures.map(f => {
        const match = f.error.match(/^(\w+Error):/);
        return match ? match[1] : 'UnknownError';
    });

    const uniqueErrors = [...new Set(errorTypes)];

    // Generate summary
    let summary = '';
    if (failures.length === 1) {
        summary = `Single test failure: ${failures[0].test || 'unknown test'}`;
    } else {
        summary = `${failures.length} test failures across ${likelyFiles.length || 'unknown'} file(s)`;
    }

    if (uniqueErrors.length > 0) {
        summary += `. Primary error types: ${uniqueErrors.join(', ')}`;
    }

    // Confidence based on how clear the failures are
    let confidence = 0.5;
    if (likelyFiles.length > 0) confidence += 0.2;
    if (failures.every(f => f.error && f.error.length > 10)) confidence += 0.2;
    if (uniqueErrors.length === 1) confidence += 0.1;

    return {
        summary,
        likelyFiles,
        errorTypes: uniqueErrors,
        confidence: Math.min(confidence, 1.0)
    };
}

// ── Fix Generation ───────────────────────────────────────────────────

/**
 * Generate a detailed prompt for Claude to fix the bug.
 *
 * @param {Object} options
 * @param {Array<Object>} options.failures - Test failures
 * @param {Object} options.analysis - Root cause analysis
 * @param {string} options.projectPath - Project root path
 * @param {string} [options.context] - Additional context
 * @param {boolean} [options.useExtendedThinking] - Use extended thinking for complex bugs
 * @returns {string} Fix prompt for Claude
 */
function generateFixPrompt(options) {
    const { failures, analysis, projectPath, context, useExtendedThinking } = options;

    let prompt = `# Autonomous Bug Fix

You are tasked with fixing bugs in a ${context || 'software project'}.

## Analysis Summary

${analysis.summary}

Confidence: ${(analysis.confidence * 100).toFixed(0)}%

## Test Failures

`;

    // Add detailed failure information
    for (let i = 0; i < failures.length; i++) {
        const failure = failures[i];
        prompt += `### Failure ${i + 1}

**File:** ${failure.file}
**Test:** ${failure.test}
**Error:**
\`\`\`
${failure.error}
\`\`\`

`;
    }

    // Add likely problem files
    if (analysis.likelyFiles && analysis.likelyFiles.length > 0) {
        prompt += `## Likely Problem Files

`;
        for (const file of analysis.likelyFiles.slice(0, 5)) {
            prompt += `- ${file}\n`;
        }
        prompt += '\n';
    }

    // Add instructions
    prompt += `## Your Task

1. **Analyze** the test failures and error messages
2. **Identify** the root cause of the failures
3. **Read** the relevant source files
4. **Implement** a fix
5. **Verify** the fix by running tests

`;

    // Add extended thinking note for complex bugs
    if (useExtendedThinking || analysis.confidence < 0.5) {
        prompt += `**Note:** This appears to be a complex bug requiring extended thinking. Take your time to analyze thoroughly before implementing a fix. Consider using extended thinking mode for deeper analysis.

`;
    }

    prompt += `## Project Context

**Project Path:** ${projectPath}

`;

    if (context) {
        prompt += `**Additional Context:** ${context}\n\n`;
    }

    prompt += `## Approach

- Read the test files and understand what they're testing
- Examine the source code in the likely problem files
- Look for common patterns: null checks, undefined values, type mismatches
- Make minimal, targeted changes
- Run tests to verify the fix works

Don't micromanage how - just fix the bug.
`;

    return prompt;
}

// ── Fix Verification ─────────────────────────────────────────────────

/**
 * Verify that a fix works by running tests.
 *
 * @param {Object} options
 * @param {string} options.projectPath - Project root path
 * @param {string} [options.testCommand] - Test command to run (default: npm test)
 * @returns {Object} Verification result
 */
function verifyFix(options) {
    const { projectPath, testCommand = 'npm test' } = options;

    logger.info('Verifying fix', { projectPath, testCommand });

    try {
        const output = execSync(testCommand, {
            cwd: projectPath,
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: 120000 // 2 minute timeout
        });

        logger.info('Tests passed', { output: output.substring(0, 200) });

        return {
            success: true,
            output,
            message: 'All tests passed'
        };
    } catch (err) {
        logger.warn('Tests failed', { error: err.message });

        return {
            success: false,
            output: err.stdout || err.stderr || err.message,
            message: 'Tests still failing',
            error: err.message
        };
    }
}

// ── Main Fix Workflow ────────────────────────────────────────────────

/**
 * Main bug fixing workflow.
 *
 * @param {Object} options
 * @param {string} options.source - Bug source: 'ci', 'logs', 'description'
 * @param {string} [options.description] - Bug description (for 'description' source)
 * @param {string} [options.logFile] - Log file path (for 'logs' source)
 * @param {string} options.projectPath - Project root path
 * @param {string} [options.testCommand] - Test command
 * @param {boolean} [options.dryRun] - Generate prompt but don't apply fix
 * @param {boolean} [options.skipCiCheck] - Skip CI check (for testing)
 * @param {boolean} [options.skipLogRead] - Skip log reading (for testing)
 * @returns {Promise<Object>} Fix result
 */
async function fixBug(options) {
    const {
        source,
        description,
        logFile,
        projectPath,
        testCommand,
        dryRun = false,
        skipCiCheck = false,
        skipLogRead = false
    } = options;

    logger.info('Starting bug fix workflow', { source, projectPath, dryRun });

    let failures = [];
    let logData = null;
    let ciData = null;

    // Step 1: Gather information based on source
    try {
        if (source === 'ci' && !skipCiCheck) {
            logger.info('Fetching CI failure information');
            ciData = ciIntegrations.getLatestCiFailure({
                branch: options.branch
            });

            if (!ciData.hasFailure) {
                return {
                    success: false,
                    message: 'No CI failures found',
                    source
                };
            }

            failures = parseTestFailures(ciData.logs);
            logger.info('Parsed CI failures', { count: failures.length });

        } else if (source === 'logs' && !skipLogRead) {
            logger.info('Analyzing log file', { logFile });

            if (!logFile || !fs.existsSync(logFile)) {
                throw new Error(`Log file not found: ${logFile}`);
            }

            const logContent = fs.readFileSync(logFile, 'utf8');
            logData = parseLogOutput(logContent);

            // Convert log errors to failure format
            failures = logData.errors.map(err => ({
                file: 'unknown',
                test: 'log analysis',
                error: err.message,
                timestamp: err.timestamp
            }));

            logger.info('Parsed log errors', { count: failures.length });

        } else if (source === 'description') {
            logger.info('Using bug description', { description });

            // Create a synthetic failure from description
            failures = [{
                file: 'unknown',
                test: 'described issue',
                error: description,
                synthetic: true
            }];
        }

        // Step 2: Analyze root cause
        const analysis = analyzeRootCause(failures);
        logger.info('Root cause analysis complete', analysis);

        // Step 3: Generate fix prompt
        const useExtendedThinking = analysis.confidence < 0.5 || failures.length > 3;
        const fixPrompt = generateFixPrompt({
            failures,
            analysis,
            projectPath,
            context: options.context,
            useExtendedThinking
        });

        // Step 4: Return results (actual fix application would be done by orchestrator)
        const result = {
            source,
            analyzed: true,
            failures,
            analysis,
            fixPrompt,
            fixesGenerated: true,
            dryRun,
            ciData,
            logData
        };

        if (dryRun) {
            logger.info('Dry run complete - not applying fixes');
            return result;
        }

        // In a real scenario, this would call the Claude API or orchestrator
        // to actually apply the fix. For now, just return the analysis.
        logger.info('Fix workflow complete');
        return result;

    } catch (err) {
        logger.error('Bug fix workflow failed', { error: err.message });
        throw err;
    }
}

// ── Exports ──────────────────────────────────────────────────────────

module.exports = {
    // Parsing
    parseTestFailures,
    parseStackTrace,
    extractErrorPatterns,
    parseLogOutput,

    // Analysis
    analyzeRootCause,

    // Fix generation
    generateFixPrompt,
    verifyFix,

    // Main workflow
    fixBug
};
