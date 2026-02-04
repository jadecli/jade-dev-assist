'use strict';

/**
 * MCP Aggregator Module for jade-dev-assist
 *
 * Orchestrates data fetching from multiple MCP servers (Slack, GitHub, Asana, Google Drive).
 * Handles MCP connection errors gracefully and returns normalized data structures.
 *
 * Design: This is a stub implementation that returns mock data since MCP servers
 * require actual API credentials and connections. In production, this would:
 * 1. Connect to MCP servers via Claude's MCP protocol
 * 2. Use MCP tools to fetch data with date filters
 * 3. Normalize responses into consistent formats
 */

const { createLogger } = require('./logger');

const logger = createLogger('mcp-aggregator');

// ── MCP Source Fetchers ──────────────────────────────────────────────

/**
 * Fetch Slack messages from the last N days.
 *
 * In production: Would use Slack MCP server to fetch:
 * - Messages from subscribed channels
 * - Direct mentions
 * - Thread participation
 *
 * @param {number} days - Number of days to look back.
 * @returns {Promise<Array>} Array of slack message objects.
 */
async function fetchSlackData(days) {
    logger.debug('Fetching Slack data', { days });

    try {
        // In production: Call MCP Slack server
        // const mcpResult = await mcp.call('slack', 'search_messages', { days });

        // Mock implementation
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        logger.info('Slack data fetch completed', { count: 0 });
        return [];
    } catch (err) {
        logger.warn('Failed to fetch Slack data', {
            error: err.message,
            days
        });
        return [];
    }
}

/**
 * Fetch GitHub activity from the last N days.
 *
 * In production: Would use GitHub MCP server to fetch:
 * - Pull requests (created, reviewed, merged)
 * - Issues (created, assigned, commented)
 * - Code review requests
 *
 * @param {number} days - Number of days to look back.
 * @returns {Promise<Array>} Array of GitHub activity objects.
 */
async function fetchGitHubData(days) {
    logger.debug('Fetching GitHub data', { days });

    try {
        // In production: Call MCP GitHub server
        // const mcpResult = await mcp.call('github', 'user_activity', { days });

        // Mock implementation
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        logger.info('GitHub data fetch completed', { count: 0 });
        return [];
    } catch (err) {
        logger.warn('Failed to fetch GitHub data', {
            error: err.message,
            days
        });
        return [];
    }
}

/**
 * Fetch Asana tasks from the last N days.
 *
 * In production: Would use Asana MCP server to fetch:
 * - Tasks assigned to user
 * - Tasks user is following
 * - Task comments and updates
 *
 * @param {number} days - Number of days to look back.
 * @returns {Promise<Array>} Array of Asana task objects.
 */
async function fetchAsanaData(days) {
    logger.debug('Fetching Asana data', { days });

    try {
        // In production: Call MCP Asana server
        // const mcpResult = await mcp.call('asana', 'user_tasks', { days });

        // Mock implementation
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        logger.info('Asana data fetch completed', { count: 0 });
        return [];
    } catch (err) {
        logger.warn('Failed to fetch Asana data', {
            error: err.message,
            days
        });
        return [];
    }
}

/**
 * Fetch Google Drive activity from the last N days.
 *
 * In production: Would use Google Drive MCP server to fetch:
 * - Recently modified documents
 * - Comments on user's documents
 * - Shared document updates
 *
 * @param {number} days - Number of days to look back.
 * @returns {Promise<Array>} Array of Google Drive document objects.
 */
async function fetchGoogleDriveData(days) {
    logger.debug('Fetching Google Drive data', { days });

    try {
        // In production: Call MCP Google Drive server
        // const mcpResult = await mcp.call('gdrive', 'recent_activity', { days });

        // Mock implementation
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        logger.info('Google Drive data fetch completed', { count: 0 });
        return [];
    } catch (err) {
        logger.warn('Failed to fetch Google Drive data', {
            error: err.message,
            days
        });
        return [];
    }
}

// ── Source Mapping ───────────────────────────────────────────────────

/**
 * Map of source names to their fetch functions.
 */
const SOURCE_FETCHERS = {
    slack: fetchSlackData,
    github: fetchGitHubData,
    asana: fetchAsanaData,
    gdrive: fetchGoogleDriveData
};

// ── Aggregation ──────────────────────────────────────────────────────

/**
 * Aggregate data from multiple MCP sources in parallel.
 *
 * @param {string[]} sources - Array of source names to fetch from.
 * @param {number} days - Number of days to look back.
 * @returns {Promise<Object>} Object with keys for each source and their data arrays.
 *
 * @example
 * const result = await aggregateFromSources(['slack', 'github'], 7);
 * // Returns: { slack: [...], github: [...] }
 */
async function aggregateFromSources(sources, days) {
    logger.info('Starting aggregation', { sources, days });

    const fetchPromises = sources
        .filter(source => SOURCE_FETCHERS[source] !== undefined)
        .map(async source => {
            const fetcher = SOURCE_FETCHERS[source];
            const data = await fetcher(days);
            return { source, data };
        });

    const results = await Promise.all(fetchPromises);

    // Convert array of {source, data} to object with source keys
    const aggregated = {};
    for (const { source, data } of results) {
        aggregated[source] = data;
    }

    logger.info('Aggregation completed', {
        sources: Object.keys(aggregated),
        totalItems: Object.values(aggregated).reduce((sum, arr) => sum + arr.length, 0)
    });

    return aggregated;
}

// ── Exports ──────────────────────────────────────────────────────────

module.exports = {
    fetchSlackData,
    fetchGitHubData,
    fetchAsanaData,
    fetchGoogleDriveData,
    aggregateFromSources,
    // Exposed for testing
    SOURCE_FETCHERS
};
