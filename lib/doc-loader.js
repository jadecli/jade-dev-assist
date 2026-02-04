'use strict';

const fs = require('fs');
const path = require('path');
const { createLogger } = require('./logger');

const logger = createLogger('doc-loader');

/**
 * DocLoader: Manages documentation loading, searching, and caching.
 *
 * Features:
 * - Lazy loading: summaries loaded on-demand from JSON files
 * - Aggressive caching: summaries cached in memory
 * - Token-aware: tracks token usage for cost estimation
 * - Fast searching: case-insensitive keyword and content search
 * - Auto-discovery: finds all available summaries automatically
 */
class DocLoader {
    /**
     * Initialize DocLoader with a docs root directory.
     * @param {string} docsRoot - Root path to documentation directory
     */
    constructor(docsRoot) {
        this.docsRoot = docsRoot;
        this.summariesDir = path.join(docsRoot, 'generated', 'summaries');
        this.cache = new Map(); // { docName: summary object }
        this.stats = {
            cached: 0,
            hits: 0,
            misses: 0
        };
    }

    /**
     * Load a documentation summary by name.
     * Returns cached version if available.
     *
     * @param {string} docName - Name of doc (e.g., 'uv', 'ruff')
     * @returns {Object|null} Summary object or null if not found
     */
    loadSummary(docName) {
        // Check cache first
        if (this.cache.has(docName)) {
            this.stats.hits++;
            return this.cache.get(docName);
        }

        this.stats.misses++;

        // Try to load from JSON
        const summaryPath = path.join(this.summariesDir, `${docName}.json`);

        try {
            if (!fs.existsSync(summaryPath)) {
                logger.debug(`Summary file not found: ${summaryPath}`);
                return null;
            }

            const content = fs.readFileSync(summaryPath, 'utf8');
            const summary = JSON.parse(content);

            // Cache it
            this.cache.set(docName, summary);
            this.stats.cached = this.cache.size;

            logger.debug(`Loaded summary: ${docName} (${content.length} bytes)`);
            return summary;
        } catch (error) {
            logger.warn(`Failed to load summary ${docName}: ${error.message}`);
            return null;
        }
    }

    /**
     * Search all available summaries by keyword or content.
     * Case-insensitive search across title, description, keywords, and summary.
     *
     * @param {string} query - Search query
     * @returns {Array} Array of matching summaries
     */
    search(query) {
        const normalizedQuery = query.toLowerCase();
        const results = [];

        // Load all summaries if not already cached
        const allSummaries = this.listSummaries();

        for (const summary of allSummaries) {
            const matchScore = this._calculateMatchScore(summary, normalizedQuery);
            if (matchScore > 0) {
                results.push({
                    ...summary,
                    _matchScore: matchScore
                });
            }
        }

        // Sort by match score (highest first)
        results.sort((a, b) => b._matchScore - a._matchScore);

        // Remove score from final results
        return results.map(r => {
            const { _matchScore, ...rest } = r;
            return rest;
        });
    }

    /**
     * Calculate relevance score for a summary against a query.
     * @private
     */
    _calculateMatchScore(summary, query) {
        let score = 0;

        // Keywords are most relevant (weight: 3)
        if (Array.isArray(summary.keywords)) {
            for (const keyword of summary.keywords) {
                if (keyword.toLowerCase().includes(query)) {
                    score += 3;
                }
            }
        }

        // Title is important (weight: 2)
        if (summary.title && summary.title.toLowerCase().includes(query)) {
            score += 2;
        }

        // Description is secondary (weight: 1.5)
        if (summary.description && summary.description.toLowerCase().includes(query)) {
            score += 1.5;
        }

        // Summary text is least important (weight: 1)
        if (summary.summary && summary.summary.toLowerCase().includes(query)) {
            score += 1;
        }

        return score;
    }

    /**
     * List all available documentation summaries.
     *
     * @returns {Array} Array of summary objects
     */
    listSummaries() {
        const results = [];

        try {
            if (!fs.existsSync(this.summariesDir)) {
                logger.debug(`Summaries directory not found: ${this.summariesDir}`);
                return results;
            }

            const files = fs.readdirSync(this.summariesDir);

            for (const file of files) {
                if (!file.endsWith('.json')) continue;

                const docName = file.replace('.json', '');
                const summary = this.loadSummary(docName);

                if (summary) {
                    results.push(summary);
                }
            }
        } catch (error) {
            logger.warn(`Failed to list summaries: ${error.message}`);
        }

        return results;
    }

    /**
     * Get cache statistics.
     *
     * @returns {Object} Cache stats { cached, hits, misses }
     */
    getCacheStats() {
        return {
            cached: this.stats.cached,
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate: this.stats.hits + this.stats.misses > 0
                ? (this.stats.hits / (this.stats.hits + this.stats.misses)).toFixed(2)
                : 'N/A'
        };
    }

    /**
     * Clear the cache.
     */
    clearCache() {
        this.cache.clear();
        this.stats.cached = 0;
        logger.debug('Cache cleared');
    }

    /**
     * Estimate token usage for a summary.
     * Uses rough approximation: ~4 characters per token.
     *
     * @param {Object} summary - Summary object
     * @returns {number} Estimated token count
     */
    estimateTokens(summary) {
        if (!summary) return 0;

        let content = '';
        if (summary.title) content += summary.title;
        if (summary.description) content += summary.description;
        if (summary.keywords) content += summary.keywords.join(' ');
        if (summary.summary) content += summary.summary;

        // Rough approximation: 4 characters ≈ 1 token
        return Math.ceil(content.length / 4);
    }

    /**
     * Get relevant docs for a task context.
     * Searches based on keywords from task description.
     *
     * @param {Object} task - Task object with description
     * @param {number} [limit=3] - Max docs to return
     * @returns {Array} Array of relevant summaries
     */
    getRelevantDocs(task, limit = 3) {
        if (!task || !task.description) {
            return [];
        }

        // Extract potential keywords from description
        const words = task.description
            .toLowerCase()
            .split(/[\s\-\.,:;\/\(\)\[\]]+/)
            .filter(w => w.length > 2);

        // Build a set of unique results
        const results = new Set();
        const added = new Map(); // Track which docs we've added

        for (const word of words) {
            if (results.size >= limit) break;

            const matches = this.search(word);
            for (const match of matches) {
                if (added.has(match.title)) continue;
                results.add(match);
                added.set(match.title, true);
                if (results.size >= limit) break;
            }
        }

        return Array.from(results);
    }
}

module.exports = DocLoader;
