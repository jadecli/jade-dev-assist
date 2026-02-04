# Anthropic-Style GitHub Workflow Guide

Based on research from Anthropic's engineering blog and practices.

## Philosophy: Build-First, Ship-to-Learn

- Prototype in hours, not weeks
- Internal dogfooding drives feedback
- Planning is the bottleneck → we removed it

## The Simple Flow

```
tasks.json → GitHub Issue → @claude → PR → Review → Merge
```

### Step 1: Tasks Seed Automatically

Swarm agents brainstorm and seed into tasks.json:
- jade-dev-assist/.claude/tasks/tasks.json
- jade-cli/.claude/tasks/tasks.json
- ... all 13 repos

### Step 2: Create Issues

```bash
# Single repo
node scripts/create-issues-from-tasks.js jade-cli

# All repos
for repo in jade-*; do
  node scripts/create-issues-from-tasks.js $(basename $repo)
done
```

### Step 3: Work with @claude

Open the issue and add:
```
@claude please implement this following our TDD approach
```

Claude will:
1. Read the issue description
2. Check CLAUDE.md for project standards
3. Write tests first (TDD)
4. Implement minimal code
5. Run tests
6. Create PR

### Step 4: Review & Merge

- Check the PR diff
- Verify tests pass
- Merge if good, comment for changes

## What We Removed

❌ 500 lines of Projects API sync code
❌ Draft issues in Projects
❌ Complex field mapping
❌ Manual workflow scripts

## What We Kept

✅ tasks.json as single source of truth
✅ CLAUDE.md per repo
✅ TDD approach
✅ Swarm agent brainstorming

## GitHub Actions Workflow

Responds to:
- `@claude` mentions in issue comments
- Issues labeled `claude-assist`

Configuration: `.github/workflows/claude-assist.yml`

## Troubleshooting

**Workflow not triggering?**
- Install Claude Code GitHub App: https://github.com/apps/claude-code
- Verify issue has @claude mention or label
- Check repository is selected in GitHub App settings

**Claude not responding?**
- Check Actions log: `gh run view --log`
- Verify CLAUDE.md exists in repo
- Ensure GitHub App has repository access

**No API keys needed!**
- Uses Claude Code subscription via GitHub App
- Or use free Docker/Ollama local models

**Want to test without creating issues?**
```bash
node scripts/create-issues-from-tasks.js --dry-run
```

## References

- [How Anthropic Builds Products](https://aakashgupta.medium.com/the-way-anthropic-builds-products-is-wild-8909a1149fbd)
- [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions)
- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
