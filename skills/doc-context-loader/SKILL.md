---
name: doc-context-loader
description: Automatically loads and injects relevant documentation from jadecli-codespaces into worker agent prompts. Provides fast, token-optimized doc context injection.
---

# Skill: doc-context-loader

Automatically loads and injects relevant documentation into worker agent prompts.

## Purpose

Ensures that worker agents always have access to accurate documentation context without requiring manual lookups. Reduces hallucination and improves code quality by providing authoritative references.

## How It Works

1. **Task Analysis**: Extracts keywords from task description and title
2. **Doc Search**: Uses DocLoader to find relevant documentation
3. **Ranking**: Orders results by relevance and token cost
4. **Injection**: Adds top-K docs to worker prompt context window
5. **Tracking**: Logs token usage for budget monitoring

## Integration Points

### In Dispatcher

When constructing worker prompts, the doc-context-loader runs automatically:

```javascript
// From lib/dispatcher.js
const relevantDocs = docLoader.getRelevantDocs(task, 3);
const docContext = formatDocContext(relevantDocs);
workerPrompt += docContext;
```

### In Worker Agents

Worker agents receive doc context as part of their system prompt:

```
## Available Documentation

[Injected doc summaries with keyword indices]

Use these references when implementing the task to ensure compliance
with official guidelines and best practices.
```

## Implementation Details

### Configuration

```json
{
  "maxDocs": 3,
  "maxTokens": 500,
  "minRelevance": 0.5,
  "cacheEnabled": true,
  "cacheExpiry": 3600
}
```

### Matching Algorithm

1. **Keyword Extraction**: Parse task description for meaningful terms
2. **Weighted Scoring**:
   - Keywords match: +3 points
   - Title match: +2 points
   - Description match: +1.5 points
   - Content match: +1 point
3. **Token Budget**: Stop adding docs when token limit reached
4. **Deduplication**: Avoid returning same doc twice

### Token Estimation

Uses 4-character-per-token approximation:
```
tokens = Math.ceil(content.length / 4)
```

This is conservative and safe for most LLM token counters.

## Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| Load summary | <100ms | From cache after first load |
| Search (1 term) | <50ms | O(n) with n = num docs |
| Get relevant (task) | <150ms | Multiple searches + ranking |
| Token estimate | <10ms | Simple string length calculation |

## Example Usage

### Direct Access

```javascript
const DocLoader = require('../lib/doc-loader');

// Initialize
const loader = new DocLoader(docsRoot);

// Get docs for a task
const task = { description: 'Implement linting configuration with ruff' };
const docs = loader.getRelevantDocs(task, 3);

// Format for injection
docs.forEach(doc => {
    console.log(`## ${doc.title}`);
    console.log(doc.summary);
});
```

### In Dispatcher

```javascript
// dispatcher.js automatically uses this skill
const relevantDocs = docContextLoader.loadForTask(task);
const docInjection = docContextLoader.formatForPrompt(relevantDocs);
const enhancedPrompt = systemPrompt + docInjection + taskPrompt;
```

## Cache Management

### In-Memory Cache

- Automatically populated on first load
- Cleared on SIGTERM/SIGHUP (safe shutdown)
- Cache statistics available via `getCacheStats()`

### Cache Hit Rates

Typical performance:
- First run: 0% (all cache misses)
- Subsequent runs: >90% (mostly hits)
- Search operations: 100% hits (summaries cached)

## Testing

All functionality covered by tests in `tests/test-doc-loader.js`:

- Summary loading and caching
- Search (case-insensitive, multi-field)
- Relevance ranking
- Token estimation
- Cache statistics
- Error handling (malformed JSON, missing files)

Run tests:
```bash
node tests/test-doc-loader.js
```

## Troubleshooting

### No docs found for task

Check:
1. Summary files exist in `docs/generated/summaries/`
2. Keywords in task description match available docs
3. Use `/jade:docs list` to verify available docs

### Token budget exceeded

Solution: Reduce `maxDocs` or `maxTokens` in config

### Slow searches

Check cache hit rate via `getCacheStats()`. If misses are high:
1. May need to warm up cache
2. Check disk I/O performance
3. Increase cache size if available RAM allows

## Roadmap

- [ ] Fuzzy matching for typos
- [ ] Learn from user feedback (which docs were helpful?)
- [ ] Cross-reference detection (link related docs)
- [ ] Auto-update summaries from source docs
- [ ] Metrics: doc usage patterns, most helpful docs
- [ ] Integration with doc versioning system

## See Also

- `lib/doc-loader.js` - Core documentation loader
- `commands/jade-docs.md` - Command-line interface
- `jadecli-codespaces/docs/generated/summaries/` - Documentation sources
