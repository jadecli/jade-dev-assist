---
name: ide-scaffold
description: Scaffold new jadecli org repos with conventional commits, Graphite, release-please, and Claude Code configuration.
---

## What It Creates

For a new repo:

1. **Conventional commits setup:**
   - commitlint.config.cjs
   - .husky/commit-msg hook
   - package.json with commitlint devDependencies

2. **Release-please workflow:**
   - .github/workflows/release-please.yml

3. **Graphite initialization:**
   - gt init (selects trunk branch)

4. **Claude Code directory:**
   - .claude/settings.json (project-level)
   - CLAUDE.md (project context file)

5. **Quality tooling (language-dependent):**
   - pyproject.toml with ruff + ty config (Python projects)
   - .github/workflows/ci.yml with quality gate

## Templates
- python-uv (default for Python)
- typescript-node
- generic (minimal, language-agnostic)
