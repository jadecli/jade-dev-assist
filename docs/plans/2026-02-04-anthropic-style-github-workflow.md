# Anthropic-Style GitHub Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify jadecli GitHub workflow following Anthropic's build-first philosophy - tasks.json → GitHub issues → @claude automation → PRs

**Architecture:** Replace complex sync scripts with simple GitHub CLI commands. Remove draft issue creation in Projects API. Use real GitHub issues + native @claude mentions for automation. Let GitHub's built-in workflows handle project board updates.

**Tech Stack:** GitHub CLI (gh), GitHub Actions, Node.js, Bash

---

## Dependency Chain Analysis

```
Foundation Layer (Parallel):
├── Task 1: Audit & Remove (no dependencies)
└── Task 2: Simple Issue Creator (no dependencies)

Core Workflow (Sequential after Foundation):
└── Task 3: GitHub Actions Setup (depends on Task 2)

Testing & Dogfooding (After Core):
└── Task 4: Test with Real Tasks (depends on Tasks 1-3)

Documentation (Parallel with Testing):
└── Task 5: Update Docs (depends on Tasks 1-3)
```

**Swarm Agent Assignment:**
- **Agent A**: Task 1 (Audit & Remove)
- **Agent B**: Task 2 (Simple Issue Creator)
- **Agent C**: Task 3 (GitHub Actions) - waits for Agent B
- **Agent D**: Task 4 (Testing) - waits for Agents A, B, C
- **Agent E**: Task 5 (Documentation) - waits for Agents A, B, C

---

## Task 1: Audit & Remove Complex Scripts

**Assigned to:** Agent A (Parallel - no dependencies)

**Files:**
- Remove: `scripts/sync-all-tasks.js`
- Remove: `scripts/sync-github-projects.js`
- Remove: `scripts/setup-project-fields.js`
- Modify: `package.json` (remove scripts)
- Review: `lib/github-sync.js` (keep, will refactor later)

**Step 1: List what we're removing**

```bash
ls -lh scripts/sync-*.js scripts/setup-*.js
```

Expected: See 3 files totaling ~500 lines

**Step 2: Check if anything imports these**

```bash
grep -r "sync-all-tasks\|sync-github-projects\|setup-project-fields" . --include="*.js" --include="*.md"
```

Expected: Only references in package.json and READMEs

**Step 3: Remove the scripts**

```bash
git rm scripts/sync-all-tasks.js scripts/sync-github-projects.js scripts/setup-project-fields.js
```

**Step 4: Update package.json**

Remove any npm scripts that reference the deleted files.

**Step 5: Commit**

```bash
git commit -m "refactor: remove complex GitHub Projects sync scripts

Following Anthropic's build-first philosophy - these 500 lines of
Projects API complexity replaced with simple gh CLI + @claude mentions"
```

---

## Task 2: Create Simple Issue Creator

**Assigned to:** Agent B (Parallel - no dependencies)

**Files:**
- Create: `scripts/create-issues-from-tasks.js`
- Create: `tests/create-issues-from-tasks.test.js`

**Step 1: Write failing test for task reading**

```bash
touch tests/create-issues-from-tasks.test.js
```

```javascript
// tests/create-issues-from-tasks.test.js
const test = require('node:test');
const assert = require('node:assert');
const { readTasksFromRepo } = require('../scripts/create-issues-from-tasks');

test('readTasksFromRepo reads pending tasks', () => {
    const tasks = readTasksFromRepo('jade-dev-assist');
    assert.ok(Array.isArray(tasks));
    assert.ok(tasks.every(t => t.status === 'pending'));
});
```

**Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL with "readTasksFromRepo is not a function"

**Step 3: Write minimal implementation**

```javascript
// scripts/create-issues-from-tasks.js
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function readTasksFromRepo(repoName) {
    const projectsRoot = path.join(process.env.HOME, 'projects');
    const tasksFile = path.join(projectsRoot, repoName, '.claude', 'tasks', 'tasks.json');

    if (!fs.existsSync(tasksFile)) {
        return [];
    }

    const data = JSON.parse(fs.readFileSync(tasksFile, 'utf-8'));
    return (data.tasks || []).filter(t => t.status === 'pending');
}

module.exports = { readTasksFromRepo };
```

**Step 4: Run test to verify it passes**

```bash
npm test
```

Expected: PASS

**Step 5: Write failing test for issue creation**

```javascript
test('formatIssueBody creates markdown from task', () => {
    const { formatIssueBody } = require('../scripts/create-issues-from-tasks');

    const task = {
        id: 'test/task-1',
        title: 'Test Task',
        description: 'Test description',
        complexity: 'M',
        labels: ['feature']
    };

    const body = formatIssueBody(task);

    assert.ok(body.includes('Test description'));
    assert.ok(body.includes('**Complexity:** M'));
    assert.ok(body.includes('**Task ID:** `test/task-1`'));
});
```

**Step 6: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL with "formatIssueBody is not a function"

**Step 7: Implement issue formatter**

```javascript
function formatIssueBody(task) {
    const lines = [];

    if (task.description) {
        lines.push(task.description);
        lines.push('');
    }

    // Metadata
    lines.push('---');
    lines.push('');
    lines.push(`**Task ID:** \`${task.id}\``);
    lines.push(`**Complexity:** ${task.complexity || 'M'}`);

    if (task.milestone) {
        lines.push(`**Milestone:** ${task.milestone}`);
    }

    if (task.blocked_by && task.blocked_by.length > 0) {
        lines.push(`**Blocked By:** ${task.blocked_by.join(', ')}`);
    }

    // Acceptance Criteria
    if (task.feature && task.feature.acceptance_criteria) {
        lines.push('');
        lines.push('## Acceptance Criteria');
        lines.push('');
        task.feature.acceptance_criteria.forEach(criterion => {
            lines.push(`- [ ] ${criterion}`);
        });
    }

    lines.push('');
    lines.push('---');
    lines.push('*Generated from tasks.json*');

    return lines.join('\n');
}

module.exports = { readTasksFromRepo, formatIssueBody };
```

**Step 8: Run test to verify it passes**

```bash
npm test
```

Expected: PASS

**Step 9: Add main CLI function**

```javascript
function createIssue(repoName, task, options = {}) {
    const { dryRun = false } = options;

    const title = task.title;
    const body = formatIssueBody(task);
    const labels = ['from-tasks-json', ...(task.labels || [])];

    const cmd = [
        'gh', 'issue', 'create',
        '--repo', `jadecli/${repoName}`,
        '--title', title,
        '--body', body,
        '--label', labels.join(',')
    ];

    if (dryRun) {
        console.log(`[DRY RUN] Would create: ${title}`);
        return null;
    }

    const url = execSync(cmd.join(' '), { encoding: 'utf-8' }).trim();
    return url;
}

// CLI entry point
if (require.main === module) {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const repoName = args.find(a => !a.startsWith('--')) || 'jade-dev-assist';

    console.log(`Creating issues for ${repoName}...`);

    const tasks = readTasksFromRepo(repoName);
    console.log(`Found ${tasks.length} pending tasks\n`);

    for (const task of tasks) {
        const url = createIssue(repoName, task, { dryRun });
        if (url) {
            console.log(`✅ Created: ${url}`);
        }
    }
}

module.exports = { readTasksFromRepo, formatIssueBody, createIssue };
```

**Step 10: Make script executable**

```bash
chmod +x scripts/create-issues-from-tasks.js
```

**Step 11: Test dry-run**

```bash
node scripts/create-issues-from-tasks.js jade-dev-assist --dry-run
```

Expected: Lists pending tasks without creating issues

**Step 12: Commit**

```bash
git add scripts/create-issues-from-tasks.js tests/create-issues-from-tasks.test.js
git commit -m "feat: add simple issue creator from tasks.json

Replaces complex Projects API sync with straightforward gh CLI.
Creates real GitHub issues instead of draft issues in Projects.
Anthropic-style: build fast, ship internally, iterate."
```

---

## Task 3: GitHub Actions Workflow for @claude Automation

**Assigned to:** Agent C (Depends on Task 2)

**Files:**
- Create: `.github/workflows/claude-assist.yml`
- Modify: `README.md` (add workflow docs)

**Step 1: Create workflow directory**

```bash
mkdir -p .github/workflows
```

**Step 2: Write workflow file**

```yaml
# .github/workflows/claude-assist.yml
name: Claude Assist

on:
  issue_comment:
    types: [created]
  issues:
    types: [opened, assigned]

permissions:
  contents: write
  issues: write
  pull-requests: write

jobs:
  claude:
    # Only run if @claude mentioned or issue has 'claude-assist' label
    if: |
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@claude')) ||
      (github.event_name == 'issues' && contains(github.event.issue.labels.*.name, 'claude-assist'))
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Run Claude Code
        uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          claude_args: "--max-turns 10 --model claude-sonnet-4-5-20250929"
```

**Step 3: Create ANTHROPIC_API_KEY secret placeholder doc**

```bash
cat > .github/SETUP.md << 'EOF'
# GitHub Actions Setup

## Required Secrets

Add these to repository Settings → Secrets → Actions:

- `ANTHROPIC_API_KEY`: Your Anthropic API key from console.anthropic.com

## Testing the Workflow

1. Create an issue
2. Add comment: `@claude please implement this`
3. Claude will analyze and create a PR

## Quick Install

From Claude Code terminal:
```
/install-github-app
```

This will guide you through setup.
EOF
```

**Step 4: Commit workflow**

```bash
git add .github/workflows/claude-assist.yml .github/SETUP.md
git commit -m "feat: add GitHub Actions workflow for @claude mentions

Follows Anthropic's pattern:
- @claude in issues/PR comments triggers automation
- Claude reads CLAUDE.md for project standards
- Creates PRs automatically

Setup: Add ANTHROPIC_API_KEY secret, see .github/SETUP.md"
```

---

## Task 4: Test Workflow with Real Task

**Assigned to:** Agent D (Depends on Tasks 1, 2, 3)

**Files:**
- Test: GitHub Actions workflow
- Verify: Issue creation + @claude response

**Step 1: Create issue from a real pending task**

```bash
# Pick one pending task to test
node scripts/create-issues-from-tasks.js jade-dev-assist --dry-run | head -5

# Create issue (real run)
node scripts/create-issues-from-tasks.js jade-dev-assist | head -1
```

Expected: Issue URL printed

**Step 2: Add @claude comment**

```bash
# Get issue number from URL
ISSUE_NUM=$(gh issue list --repo jadecli/jade-dev-assist --limit 1 --json number --jq '.[0].number')

# Add comment
gh issue comment $ISSUE_NUM --repo jadecli/jade-dev-assist --body "@claude Please review this task and create an implementation plan"
```

**Step 3: Monitor Actions run**

```bash
gh run list --repo jadecli/jade-dev-assist --limit 1
gh run view --repo jadecli/jade-dev-assist --log
```

Expected: Workflow runs, Claude responds or creates PR

**Step 4: Document test results**

```bash
cat > docs/testing/2026-02-04-workflow-test.md << 'EOF'
# GitHub Workflow Test Results

## Test Date
2026-02-04

## What We Tested
1. Created real issue from tasks.json
2. Added @claude mention
3. Verified GitHub Actions triggered
4. Checked Claude response/PR creation

## Results
- Issue creation: [PASS/FAIL]
- Workflow trigger: [PASS/FAIL]
- Claude response: [PASS/FAIL]

## Next Steps
[List any issues found or improvements needed]
EOF
```

**Step 5: Commit test results**

```bash
git add docs/testing/2026-02-04-workflow-test.md
git commit -m "test: verify @claude GitHub workflow with real task"
```

---

## Task 5: Update Documentation

**Assigned to:** Agent E (Depends on Tasks 1, 2, 3)

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`
- Create: `docs/guides/anthropic-workflow.md`

**Step 1: Update README with new workflow**

Add section after "Getting Started":

```markdown
## Anthropic-Style Workflow

Following Anthropic's build-first philosophy:

### 1. Tasks Seed Automatically
Swarm agents seed tasks into `.claude/tasks/tasks.json`

### 2. Create GitHub Issues
```bash
node scripts/create-issues-from-tasks.js [repo-name]
```

### 3. Tag @claude When Ready
Add comment to issue: `@claude please implement this`

### 4. Claude Creates PR
Claude analyzes, implements, runs tests, creates PR

### 5. Review & Merge
Quick review, merge, done

See `docs/guides/anthropic-workflow.md` for details.
```

**Step 2: Create comprehensive guide**

```markdown
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
- Check ANTHROPIC_API_KEY secret is set
- Verify issue has @claude mention or label

**Claude not responding?**
- Check Actions log: `gh run view --log`
- Verify CLAUDE.md exists in repo

**Want to test without creating issues?**
```bash
node scripts/create-issues-from-tasks.js --dry-run
```

## References

- [How Anthropic Builds Products](https://aakashgupta.medium.com/the-way-anthropic-builds-products-is-wild-8909a1149fbd)
- [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions)
- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
```

**Step 3: Update CLAUDE.md**

Add workflow section:

```markdown
## GitHub Workflow

We follow Anthropic's build-first philosophy:

1. Tasks seed into tasks.json via swarm agents
2. Create GitHub issues: `node scripts/create-issues-from-tasks.js`
3. Tag @claude when ready to implement
4. Claude creates PR automatically
5. Review and merge

See docs/guides/anthropic-workflow.md for complete guide.
```

**Step 4: Commit documentation**

```bash
git add README.md CLAUDE.md docs/guides/anthropic-workflow.md
git commit -m "docs: add Anthropic-style workflow guide

Documents simplified GitHub workflow following Anthropic practices:
- Build-first philosophy
- @claude automation
- No complex sync scripts
- Dogfooding driven iteration"
```

---

## Swarm Agent Coordination Summary

**Parallel Phase 1:**
- Agent A: Remove old scripts (Task 1)
- Agent B: Build issue creator (Task 2)

**Sequential Phase 2:**
- Agent C: GitHub Actions setup (Task 3) - waits for Agent B

**Parallel Phase 3:**
- Agent D: Test workflow (Task 4) - waits for A, B, C
- Agent E: Documentation (Task 5) - waits for A, B, C

**Estimated Timeline:**
- Phase 1: 15-20 minutes (parallel)
- Phase 2: 10 minutes (sequential)
- Phase 3: 15-20 minutes (parallel)
- **Total: ~40-50 minutes** with 5 agents

---

## Post-Implementation Checklist

After all tasks complete:

- [ ] All old sync scripts removed
- [ ] New issue creator script tested
- [ ] GitHub Actions workflow committed
- [ ] ANTHROPIC_API_KEY secret configured
- [ ] Workflow tested with real task
- [ ] Documentation updated
- [ ] README reflects new workflow
- [ ] Commit all changes with conventional commits

## Success Criteria

✅ Can create GitHub issues from tasks.json in < 5 seconds
✅ @claude mentions trigger workflow successfully
✅ Claude creates working PRs from issues
✅ Documentation explains new workflow clearly
✅ Removed 500+ lines of complex sync code
