# jade-dev-assist

Claude Code plugin being built into the central orchestrator for the 8-repo jadecli ecosystem.

## Status

BUILDABLE -- Orchestrator MVP complete. 14 commands, 6 skills, 3 agents. Core lib modules (scanner, scorer, presenter, dispatcher) implemented with full TDD test suites.

- **Dashboard:** `bin/dashboard.py` (Python + rich, 201 lines) -- `jade-dashboard` to launch
- **Implementation blueprint:** `~/docs/plans/2026-02-02-jade-dev-assist-orchestrator-design.md` (1199 lines). Read Section 10 for milestones.

## Getting Started

```bash
npm test                          # run tests
node scripts/validate-plugin.js . # validate plugin structure
bin/jade-dashboard                # launch dashboard (needs ~/.jade/projects.json)
```

## Project Structure

```
commands/        14 .md files (plan, review, learn, init, fix, subagent, orchestrate, etc.)
skills/          6 dirs, each with SKILL.md (roadmap-updater, style-configurator,
                 personalization-manager, workflow-orchestrator, ide-scaffold, capability-toggler)
agents/          config-wizard.md, style-analyzer.md, workflow-planner.md
                 (all model: opus, max_turns: 25)
hooks/           hooks.json + scripts/ (track-progress, session-summary, validate-conventions)
bin/             dashboard.py (live task dashboard)
lib/             scanner.js    -- reads/merges task files from all 8 projects
                 scorer.js     -- priority scoring algorithm (5-factor weighted)
                 presenter.js  -- terminal table display of ranked tasks
                 dispatcher.js -- worker prompt construction + dispatch
tests/           test-plugin.js, test-scanner.js, test-scorer.js, test-presenter.js, test-dispatcher.js
config/styles/   developer-concise.md, learning.md
docs/research/   claude-documentation-summary, workflow-methodologies, boris-cherny-tips
```

## Conventions

- **Language:** JavaScript/Node.js (Node >= 18)
- **Commits:** Conventional commits (`feat:`, `fix:`, `test:`, `docs:`)
- **Testing:** TDD -- write tests first in `tests/`, then implement in `lib/`
- **Dependency chain:** scanner -> scorer -> presenter -> orchestrate command
- **Context budgets:** 35K orchestrator, 60K worker prompt, 200K worker total, 25K retry

## Current Tasks

Source: `.claude/tasks/tasks.json` | Milestone: Orchestrator MVP (2026-03-15) -- ALL COMPLETE

| ID | Title | Status |
|----|-------|--------|
| implement-scanner | Implement lib/scanner.js | DONE |
| implement-scorer | Implement lib/scorer.js | DONE |
| implement-presenter | Implement lib/presenter.js | DONE |
| create-orchestrate-command | Create orchestrate command | DONE |
| implement-dispatcher | Implement lib/dispatcher.js | DONE |
| write-scanner-scorer-tests | Write TDD tests for scanner + scorer | DONE |

Next milestone: status-updater.js and milestone-tracker.js (post-MVP).

## GitHub Workflow

We follow Anthropic's build-first philosophy:

1. Tasks seed into tasks.json via swarm agents
2. Create GitHub issues: `node scripts/create-issues-from-tasks.js`
3. Tag @claude when ready to implement
4. Claude creates PR automatically
5. Review and merge

See docs/guides/anthropic-workflow.md for complete guide.

## Anti-Collision

Only one Claude Code session should work in this project at a time. The orchestrator design doc is the single source of truth for architecture decisions.

## Ecosystem

Part of jadecli ecosystem (8 repos). See `~/.jade/projects.json` for the full registry.
