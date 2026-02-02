---
name: jade:query
description: Use Claude for data & analytics - natural language to SQL, no more writing queries
argument-hint: "<natural-language-query> [--db <database>]"
allowed-tools: [Read, Write, Bash, MCP]
---

# Data & Analytics

> "Ask Claude Code to use the 'bq' CLI to pull and analyze metrics on the fly. Personally, I haven't written a line of SQL in 6+ months." — Boris Cherny

## Usage

```bash
/jade:query <natural-language> [options]
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `--db <name>` | Target database | auto-detect |
| `--format <type>` | Output format (table, json, csv) | table |
| `--save <file>` | Save results to file | none |
| `--explain` | Show generated SQL | false |

## Supported Databases

| Database | CLI/MCP | Setup |
|----------|---------|-------|
| BigQuery | `bq` CLI | `gcloud auth` |
| PostgreSQL | `psql` CLI | Connection string |
| MySQL | `mysql` CLI | Connection string |
| SQLite | `sqlite3` CLI | File path |
| Snowflake | Snowflake MCP | MCP config |
| Databricks | Databricks MCP | MCP config |

## Examples

### Natural Language Queries

```bash
/jade:query "How many users signed up last week?"
```

```
📊 Query Results

SQL Generated:
SELECT COUNT(*) as signups
FROM users
WHERE created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY);

┌──────────┐
│ signups  │
├──────────┤
│   1,247  │
└──────────┘
```

### Complex Analysis

```bash
/jade:query "Show me daily active users by platform for the last 30 days"
```

```
📊 Query Results

┌────────────┬─────────┬─────────┬─────────┐
│ date       │ ios     │ android │ web     │
├────────────┼─────────┼─────────┼─────────┤
│ 2026-01-02 │ 12,345  │ 8,901   │ 15,678  │
│ 2026-01-03 │ 12,567  │ 9,012   │ 15,890  │
│ ...        │ ...     │ ...     │ ...     │
└────────────┴─────────┴─────────┴─────────┘

📈 Trend: +5% week-over-week across all platforms
```

### BigQuery Specific

```bash
/jade:query "What are the top 10 error types this week?" --db bigquery
```

Claude uses `bq` CLI:
```bash
bq query --use_legacy_sql=false '
SELECT 
  error_type,
  COUNT(*) as count
FROM `project.logs.errors`
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
GROUP BY error_type
ORDER BY count DESC
LIMIT 10
'
```

### Show SQL

```bash
/jade:query "revenue by product category" --explain
```

```
📝 Generated SQL:

SELECT 
  p.category,
  SUM(o.amount) as revenue,
  COUNT(DISTINCT o.id) as orders
FROM orders o
JOIN products p ON o.product_id = p.id
WHERE o.created_at >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY p.category
ORDER BY revenue DESC;

📊 Results:
┌──────────────┬────────────┬────────┐
│ category     │ revenue    │ orders │
├──────────────┼────────────┼────────┤
│ Electronics  │ $1,234,567 │ 8,901  │
│ Clothing     │ $890,123   │ 12,345 │
│ ...          │ ...        │ ...    │
└──────────────┴────────────┴────────┘
```

### Save Results

```bash
/jade:query "user growth metrics" --save report.csv --format csv
```

## Team Skill Pattern

> "We have a BigQuery skill checked into the codebase, and everyone on the team uses it for analytics queries directly in Claude Code."

### Create Team Analytics Skill

```bash
/jade:skills create analytics --template database
```

Creates `.claude/skills/analytics/SKILL.md`:
```markdown
---
name: analytics
description: Team analytics skill for BigQuery
dependencies: google-cloud-bigquery
---

# Analytics Skill

## Available Tables
- `project.analytics.events` - User events
- `project.analytics.users` - User profiles  
- `project.logs.errors` - Error logs

## Common Queries
- DAU/MAU: Use events table, COUNT DISTINCT user_id
- Revenue: Use orders table, SUM amount
- Errors: Use logs table, filter by severity

## Access
```bash
bq --project_id=your-project query
```
```

### Use Across Team

Commit to git, everyone gets same analytics capability:
```bash
git add .claude/skills/analytics/
git commit -m "Add team analytics skill"
```

## Works With Any Database

> "This works for any database that has a CLI, MCP, or API."

### PostgreSQL

```bash
/jade:query "show me slow queries" --db postgres
```

### MySQL

```bash
/jade:query "table sizes in production" --db mysql
```

### SQLite (Local)

```bash
/jade:query "count records in each table" --db sqlite
```

## Configuration

```json
{
  "query": {
    "defaultDatabase": "bigquery",
    "databases": {
      "bigquery": {
        "project": "your-project",
        "dataset": "analytics"
      },
      "postgres": {
        "connectionString": "$DATABASE_URL"
      },
      "mysql": {
        "connectionString": "$MYSQL_URL"
      }
    },
    "showExplain": false,
    "defaultFormat": "table",
    "cacheResults": true
  }
}
```

## Best Practices

### 1. Be Specific

❌ "Show me data"
✅ "Show me daily signups for the last 30 days"

### 2. Name Your Metrics

```
/jade:query "What's our DAU/MAU ratio this month?"
```

### 3. Ask Follow-ups

```
/jade:query "Break that down by country"
```

### 4. Save Important Queries

```
/jade:query "monthly revenue report" --save reports/revenue.csv
```

## The Result

> "Personally, I haven't written a line of SQL in 6+ months."

## Related Commands

- `/jade:context-sync` - Include analytics in context
- `/jade:subagent` - Parallelize complex analysis
- `/jade:plan` - Plan data-driven features
