## Summary

<!-- What changed and why. Link to issue if applicable. -->

**Issue:** <!-- #123 or N/A -->
**Type:** <!-- feat | fix | refactor | docs | infra | test | chore -->

## Changes

<!-- Bullet list of what this PR does -->

-

## Ecosystem Architecture Impact

<!-- Mark [*] on the project(s) this PR changes. Edit arrows if data flow changes. -->

```
jadecli Ecosystem -- PR Impact Map
===================================

+------------------+     +------------------+     +------------------+
|   jade-ide       |     | jade-dev-assist  |     |  jade-swarm-     |
|   (TS/Electron)  |---->| (orchestrator)   |---->|  superpowers     |
+------------------+     +------------------+     +------------------+
        |                        |                        |
        v                        v                        v
+------------------+     +------------------+     +------------------+
|   jade-cli       |     | claude-objects   |     | jadecli-roadmap  |
|   (TS/React Ink) |     | (Python/FastMCP) |     | (docs/ADRs)      |
+------------------+     +------------------+     +------------------+
        |                        |
        v                        v
+------------------+     +------------------+
|   jade-index     |     | jadecli-infra    |
|   (Python/GPU)   |     | (Docker Compose) |
+------------------+     +------------------+

Data flow: IDE -> orchestrator -> swarm skills
           CLI -> jade-index -> infra (Postgres/pgvector, MongoDB, Dragonfly)
           claude-objects provides MCP servers to all projects
```

### Cross-Project Impact

<!-- Check all that apply -->

- [ ] Self-contained (no cross-project impact)
- [ ] jade-ide (extension/build changes)
- [ ] jade-dev-assist (orchestrator/plugin changes)
- [ ] jade-swarm-superpowers (skill/hook changes)
- [ ] jade-cli (CLI command/store changes)
- [ ] claude-objects (MCP server/agent changes)
- [ ] jadecli-roadmap (docs/ADR/roadmap updates needed)
- [ ] jade-index (embedding/search API changes)
- [ ] jadecli-infra (Docker/DB schema changes)

### Companion PRs

<!-- List companion PRs if this change spans repos. Delete if N/A. -->

| Project | PR | Status |
|---------|-----|--------|
| | | |

## Verification Checklist

<!-- Check items that pass. Mark N/A where not applicable to this project. -->

### Tests
- [ ] Tests pass locally (`npm test` / `uv run pytest` / custom runner)
- [ ] New tests added for new functionality
- [ ] Coverage threshold met (80% where configured)

### Code Quality
- [ ] Lint clean (`ruff check` / `eslint` / `bash -n`)
- [ ] Type check clean (`ty check` / `tsc --noEmit`)
- [ ] No new warnings introduced

### Pre-commit
- [ ] Conventional commit format used
- [ ] Pre-commit hooks pass

### CI/CD
- [ ] CI workflow passes (green check on this PR)
- [ ] No regressions in existing functionality

## Testing Evidence

<details>
<summary>Test output</summary>

```
paste test output here
```

</details>

<details>
<summary>Coverage summary</summary>

```
paste coverage output here
```

</details>

## Reviewer Notes

<!-- Tricky areas, known limitations, follow-up work. Delete if N/A. -->
