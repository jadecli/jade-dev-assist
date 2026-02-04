'use strict';

/**
 * Context Sync Module for jade-dev-assist
 *
 * Implements multi-source context aggregation from Slack, GitHub, Asana, and Google Drive.
 * Provides focus filtering and executive summary generation using Claude API patterns.
 *
 * Design principles:
 * - Use extended thinking for context analysis (reference-index.md)
 * - Follow tool use patterns for MCP integration
 * - Apply error handling patterns from Ruff section
 * - Use pre-filling for structured markdown output
 */

const { createLogger } = require('./logger');
const { aggregateFromSources } = require('./mcp-aggregator');

const logger = createLogger('context-sync');

// ── Default Configuration ────────────────────────────────────────────

const DEFAULT_OPTIONS = {
    days: 7,
    sources: ['slack', 'github', 'asana', 'gdrive'],
    output: null, // stdout
    focus: null
};

// ── Option Parsing ───────────────────────────────────────────────────

/**
 * Parse command-line arguments into options object.
 *
 * @param {string[]} args - Command-line arguments (excluding command name).
 * @returns {Object} Options object with parsed values.
 *
 * @example
 * parseOptions(['--days', '14', '--focus', 'auth'])
 * // Returns: { days: 14, sources: [...], output: null, focus: 'auth' }
 */
function parseOptions(args) {
    const options = { ...DEFAULT_OPTIONS };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--days' && i + 1 < args.length) {
            const days = parseInt(args[i + 1], 10);
            if (!isNaN(days) && days > 0) {
                options.days = days;
            } else {
                logger.warn('Invalid --days value, using default', {
                    value: args[i + 1],
                    default: DEFAULT_OPTIONS.days
                });
            }
            i++;
        } else if (arg === '--sources' && i + 1 < args.length) {
            options.sources = args[i + 1].split(',').map(s => s.trim());
            i++;
        } else if (arg === '--output' && i + 1 < args.length) {
            options.output = args[i + 1];
            i++;
        } else if (arg === '--focus' && i + 1 < args.length) {
            options.focus = args[i + 1];
            i++;
        }
    }

    logger.debug('Parsed options', options);
    return options;
}

// ── Focus Filtering ──────────────────────────────────────────────────

/**
 * Filter items by focus keyword (case insensitive).
 *
 * Searches in both title and body/message/description fields.
 *
 * @param {Array} items - Array of items to filter.
 * @param {string|null} focus - Focus keyword to search for.
 * @returns {Array} Filtered items (or all items if focus is null).
 */
function filterByFocus(items, focus) {
    if (!focus) {
        return items;
    }

    const focusLower = focus.toLowerCase();

    return items.filter(item => {
        // Check title
        const title = item.title || item.message || item.name || '';
        if (title.toLowerCase().includes(focusLower)) {
            return true;
        }

        // Check body/description
        const body = item.body || item.description || item.text || '';
        if (body.toLowerCase().includes(focusLower)) {
            return true;
        }

        return false;
    });
}

// ── Summary Generation ───────────────────────────────────────────────

/**
 * Generate executive summary from aggregated context data.
 *
 * In production: Would use Claude API with extended thinking to analyze
 * the context and extract key themes, decisions, and action items.
 *
 * Design: Follow patterns from reference-index.md:
 * - Use extended thinking for deep analysis
 * - Temperature = 1 for thinking mode
 * - Pre-fill response format for structured output
 *
 * @param {Object} contextData - Aggregated context data from all sources.
 * @returns {string} Executive summary text.
 */
function generateSummary(contextData) {
    logger.debug('Generating summary');

    // Count total items
    const totalItems = Object.values(contextData).reduce((sum, arr) => {
        return sum + (Array.isArray(arr) ? arr.length : 0);
    }, 0);

    if (totalItems === 0) {
        return 'No activity found in the specified time range.';
    }

    // In production: Call Claude API with extended thinking
    // const response = await client.messages.create({
    //     model: 'claude-sonnet-4-5',
    //     max_tokens: 4096,
    //     temperature: 1,
    //     thinking: { type: 'enabled', budget_tokens: 2000 },
    //     messages: [
    //         { role: 'user', content: `Analyze this context and provide a summary...` },
    //         { role: 'assistant', content: '## Executive Summary\n\n' } // Pre-fill
    //     ]
    // });

    // Mock implementation
    const summary = [
        `Found ${totalItems} items across ${Object.keys(contextData).length} sources.`,
        '',
        'Key themes and patterns would be extracted here using Claude API with extended thinking.',
        'This includes: active work streams, key decisions, blockers, and next actions.'
    ].join('\n');

    logger.info('Summary generated', { length: summary.length });
    return summary;
}

// ── Output Formatting ────────────────────────────────────────────────

/**
 * Format aggregated context data as markdown.
 *
 * @param {Object} contextData - Context data with summary and source arrays.
 * @param {Object} options - Options including days and sources.
 * @returns {string} Formatted markdown output.
 */
function formatOutput(contextData, options) {
    logger.debug('Formatting output');

    const lines = [];
    const today = new Date().toISOString().split('T')[0];
    const sources = options.sources || [];

    // Header
    lines.push(`# Context Sync: ${today}`);
    lines.push(`**Time range:** Last ${options.days} days`);
    lines.push('');

    // Executive Summary
    lines.push('## Executive Summary');
    lines.push('');
    lines.push(contextData.summary || 'No summary available');
    lines.push('');

    // Slack section
    if (sources.includes('slack') && contextData.slack) {
        lines.push('## Slack');
        lines.push('');

        if (contextData.slack.length === 0) {
            lines.push('*No Slack activity found*');
        } else {
            for (const msg of contextData.slack) {
                lines.push(`### ${msg.channel || 'DM'}`);
                lines.push(`- **[${msg.timestamp}]** ${msg.message}`);
                lines.push('');
            }
        }
        lines.push('');
    }

    // GitHub section
    if (sources.includes('github') && contextData.github) {
        lines.push('## GitHub');
        lines.push('');

        if (contextData.github.length === 0) {
            lines.push('*No GitHub activity found*');
        } else {
            const prs = contextData.github.filter(item => item.type === 'PR');
            const issues = contextData.github.filter(item => item.type === 'issue');

            if (prs.length > 0) {
                lines.push('### Pull Requests');
                for (const pr of prs) {
                    lines.push(`- #${pr.number} - ${pr.title} [${pr.status}]`);
                }
                lines.push('');
            }

            if (issues.length > 0) {
                lines.push('### Issues');
                for (const issue of issues) {
                    lines.push(`- #${issue.number} - ${issue.title} [${issue.status}]`);
                }
                lines.push('');
            }
        }
        lines.push('');
    }

    // Asana section
    if (sources.includes('asana') && contextData.asana) {
        lines.push('## Asana');
        lines.push('');

        if (contextData.asana.length === 0) {
            lines.push('*No Asana activity found*');
        } else {
            for (const task of contextData.asana) {
                lines.push(`- **[${task.status}]** ${task.title}`);
            }
        }
        lines.push('');
    }

    // Google Drive section
    if (sources.includes('gdrive') && contextData.gdrive) {
        lines.push('## Google Drive');
        lines.push('');

        if (contextData.gdrive.length === 0) {
            lines.push('*No Google Drive activity found*');
        } else {
            for (const doc of contextData.gdrive) {
                lines.push(`- **${doc.title}** - Modified: ${doc.modified}`);
            }
        }
        lines.push('');
    }

    const output = lines.join('\n');
    logger.info('Output formatted', { lines: lines.length, chars: output.length });
    return output;
}

// ── Main Sync Function ───────────────────────────────────────────────

/**
 * Synchronize context from multiple sources.
 *
 * Main entry point for the context sync operation. Orchestrates:
 * 1. Data fetching from MCP sources
 * 2. Focus filtering
 * 3. Summary generation
 * 4. Output formatting
 *
 * @param {Object} options - Options object from parseOptions().
 * @param {Object} [mcpAdapter] - Optional MCP adapter for testing (injects mock MCP).
 * @returns {Promise<Object>} Context data with summary and source arrays.
 */
async function syncContext(options, mcpAdapter) {
    logger.info('Starting context sync', options);

    const sources = options.sources || DEFAULT_OPTIONS.sources;

    // Fetch data from sources
    const aggregated = mcpAdapter
        ? await Promise.all(
              sources.map(async source => {
                  const data = mcpAdapter[source] ? await mcpAdapter[source](options.days) : [];
                  return { source, data };
              })
          ).then(results =>
              results.reduce((acc, { source, data }) => {
                  acc[source] = data;
                  return acc;
              }, {})
          )
        : await aggregateFromSources(sources, options.days);

    // Apply focus filter if specified
    const contextData = {};
    for (const [source, items] of Object.entries(aggregated)) {
        contextData[source] = filterByFocus(items, options.focus);
    }

    // Generate summary
    contextData.summary = generateSummary(contextData);

    logger.info('Context sync completed', {
        sources: Object.keys(contextData),
        totalItems: Object.values(contextData).reduce((sum, val) => {
            return sum + (Array.isArray(val) ? val.length : 0);
        }, 0)
    });

    return contextData;
}

// ── Exports ──────────────────────────────────────────────────────────

module.exports = {
    syncContext,
    parseOptions,
    filterByFocus,
    generateSummary,
    formatOutput,
    DEFAULT_OPTIONS
};
