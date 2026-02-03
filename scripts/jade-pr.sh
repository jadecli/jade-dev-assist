#!/usr/bin/env bash
# jade-pr -- Unified pre-release branch script for the jadecli ecosystem
#
# Usage:
#   jade-pr [branch-name]        Create branch, run checks, open PR
#   jade-pr --check              Run checks only (no branch, no PR)
#   jade-pr --dry-run            Run checks and show what would happen
#   jade-pr --help               Show usage
#
# Reads project metadata from ~/.jade/projects.json

set -euo pipefail

PROJECTS_JSON="$HOME/.jade/projects.json"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || { echo "ERROR: Not in a git repo"; exit 1; })"
REPO_NAME="$(basename "$REPO_ROOT")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Parse args
BRANCH_NAME=""
CHECK_ONLY=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --check) CHECK_ONLY=true; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        --help|-h)
            echo "Usage: jade-pr [options] [branch-name]"
            echo ""
            echo "Options:"
            echo "  --check      Run verification checks only"
            echo "  --dry-run    Run checks, show PR preview, don't create"
            echo "  --help       Show this help"
            echo ""
            echo "Examples:"
            echo "  jade-pr feat/add-search       Create branch and open PR"
            echo "  jade-pr --check               Just run local checks"
            echo "  jade-pr                       Open PR from current branch"
            exit 0
            ;;
        -*) echo "Unknown option: $1"; exit 1 ;;
        *) BRANCH_NAME="$1"; shift ;;
    esac
done

# Look up project in registry
if [ ! -f "$PROJECTS_JSON" ]; then
    echo -e "${RED}ERROR: $PROJECTS_JSON not found${NC}"
    exit 1
fi

# Extract project metadata using python3 (jq fallback if available)
_lookup_field() {
    local field="$1"
    local default="$2"
    local result
    if command -v jq &>/dev/null; then
        result=$(jq -r ".projects[] | select(.name == \"$REPO_NAME\" or .path == \"$REPO_NAME\" or (.path | endswith(\"/$REPO_NAME\"))) | .$field // \"$default\"" "$PROJECTS_JSON" 2>/dev/null)
    else
        result=$(python3 -c "
import json, sys
with open('$PROJECTS_JSON') as f:
    data = json.load(f)
for p in data.get('projects', []):
    if p.get('name') == '$REPO_NAME' or p.get('path') == '$REPO_NAME' or p.get('path','').endswith('/$REPO_NAME'):
        val = p.get('$field')
        print(val if val is not None else '$default')
        sys.exit(0)
print('$default')
" 2>/dev/null)
    fi
    echo "${result:-$default}"
}

LANGUAGE=$(_lookup_field "language" "unknown")
BASE_BRANCH=$(_lookup_field "base_branch" "main")
TEST_CMD=$(_lookup_field "test_command" "")

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  jade-pr -- $REPO_NAME${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "  Language:    ${GREEN}$LANGUAGE${NC}"
echo -e "  Base branch: ${GREEN}$BASE_BRANCH${NC}"
echo -e "  Test cmd:    ${GREEN}${TEST_CMD:-'(none)'}${NC}"
echo ""

# Create branch if requested
if [ -n "$BRANCH_NAME" ] && ! $CHECK_ONLY; then
    CURRENT_BRANCH=$(git branch --show-current)
    if [ "$CURRENT_BRANCH" != "$BASE_BRANCH" ]; then
        echo -e "${YELLOW}Switching to $BASE_BRANCH...${NC}"
        git checkout "$BASE_BRANCH"
        git pull origin "$BASE_BRANCH" 2>/dev/null || true
    fi
    echo -e "${CYAN}Creating branch: $BRANCH_NAME${NC}"
    git checkout -b "$BRANCH_NAME"
    echo ""
fi

# Run verification checks
echo -e "${CYAN}=== Verification Checks ===${NC}"
echo ""
CHECKS_PASSED=true
TEST_OUTPUT=""

run_check() {
    local name="$1"
    local cmd="$2"
    echo -n "  $name... "
    if output=$(eval "$cmd" 2>&1); then
        echo -e "${GREEN}PASS${NC}"
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        echo "    $output" | head -5
        CHECKS_PASSED=false
        return 1
    fi
}

case "$LANGUAGE" in
    python)
        run_check "Lint (ruff)" "cd '$REPO_ROOT' && uv run ruff check" || true
        run_check "Type check (ty)" "cd '$REPO_ROOT' && uv run ty check 2>/dev/null" || true
        run_check "Tests (pytest)" "cd '$REPO_ROOT' && uv run pytest -v --tb=short" || true
        TEST_OUTPUT=$(cd "$REPO_ROOT" && uv run pytest -v --tb=short 2>&1 | tail -20)
        COVERAGE_OUTPUT=$(cd "$REPO_ROOT" && uv run pytest --cov --cov-report=term-missing 2>&1 | tail -15)
        ;;
    typescript)
        run_check "Type check (tsc)" "cd '$REPO_ROOT' && npx tsc --noEmit" || true
        run_check "Tests" "cd '$REPO_ROOT' && $TEST_CMD" || true
        TEST_OUTPUT=$(cd "$REPO_ROOT" && eval "$TEST_CMD" 2>&1 | tail -20)
        ;;
    javascript)
        run_check "Tests" "cd '$REPO_ROOT' && npm test" || true
        TEST_OUTPUT=$(cd "$REPO_ROOT" && npm test 2>&1 | tail -20)
        ;;
    docker)
        run_check "Docker Compose" "cd '$REPO_ROOT' && docker compose config --quiet" || true
        run_check "Shell syntax" "cd '$REPO_ROOT' && shopt -s nullglob && for f in scripts/*.sh; do bash -n \"\$f\"; done" || true
        TEST_OUTPUT="Docker Compose config validated. Shell scripts syntax checked."
        ;;
    markdown)
        echo -e "  ${YELLOW}Docs-only repo -- no checks to run${NC}"
        TEST_OUTPUT="Documentation repo -- no automated tests."
        ;;
    *)
        echo -e "  ${YELLOW}Unknown language: $LANGUAGE -- skipping checks${NC}"
        ;;
esac

echo ""

if $CHECKS_PASSED; then
    echo -e "${GREEN}=== All checks passed ===${NC}"
else
    echo -e "${RED}=== Some checks failed ===${NC}"
    if ! $DRY_RUN && ! $CHECK_ONLY; then
        echo -e "${YELLOW}Proceeding anyway. Fix failures before merge.${NC}"
    fi
fi
echo ""

# Generate ecosystem impact diagram
generate_diagram() {
    local current="$1"
    local diagram=""

    # Mark the current project with [*]
    local ide="   jade-ide       "
    local assist=" jade-dev-assist  "
    local swarm="  jade-swarm-     "
    local cli="   jade-cli       "
    local objects=" claude-objects   "
    local roadmap=" jadecli-roadmap  "
    local index="   jade-index     "
    local infra=" jadecli-infra    "

    case "$current" in
        jade-ide)              ide="[*]jade-ide      " ;;
        jade-dev-assist)       assist="[*]jade-dev-assist" ;;
        jade-swarm-superpowers) swarm="[*]jade-swarm-    " ;;
        jade-cli)              cli="[*]jade-cli      " ;;
        claude-objects)        objects="[*]claude-objects " ;;
        jadecli-roadmap*)      roadmap="[*]jadecli-roadmap" ;;
        jade-index)            index="[*]jade-index    " ;;
        jadecli-infra)         infra="[*]jadecli-infra  " ;;
    esac

    cat <<EOF
jadecli Ecosystem -- PR Impact Map
===================================

+------------------+     +------------------+     +------------------+
|$ide|     |$assist|     |$swarm|
|   (TS/Electron)  |---->| (orchestrator)   |---->|  superpowers     |
+------------------+     +------------------+     +------------------+
        |                        |                        |
        v                        v                        v
+------------------+     +------------------+     +------------------+
|$cli|     |$objects|     |$roadmap|
|   (TS/React Ink) |     | (Python/FastMCP) |     | (docs/ADRs)      |
+------------------+     +------------------+     +------------------+
        |                        |
        v                        v
+------------------+     +------------------+
|$index|     |$infra|
|   (Python/GPU)   |     | (Docker Compose) |
+------------------+     +------------------+
EOF
}

# If check-only, stop here
if $CHECK_ONLY; then
    exit 0
fi

# Show diagram
echo -e "${CYAN}=== Ecosystem Impact ===${NC}"
echo ""
DIAGRAM=$(generate_diagram "$REPO_NAME")
echo "$DIAGRAM"
echo ""

# If dry-run, show what would happen but don't create PR
if $DRY_RUN; then
    echo -e "${YELLOW}=== DRY RUN -- would create PR with: ===${NC}"
    echo "  Base: $BASE_BRANCH"
    echo "  Branch: $(git branch --show-current)"
    echo "  Title: (from commit messages)"
    echo ""
    echo "Test output preview:"
    echo "$TEST_OUTPUT" | head -10
    exit 0
fi

# Create PR via gh
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" = "$BASE_BRANCH" ]; then
    echo -e "${RED}ERROR: Cannot create PR from $BASE_BRANCH to $BASE_BRANCH${NC}"
    echo "Create a feature branch first: jade-pr feat/my-feature"
    exit 1
fi

# Push branch
echo -e "${CYAN}Pushing branch to origin...${NC}"
git push -u origin "$CURRENT_BRANCH" 2>/dev/null || git push origin "$CURRENT_BRANCH"

# Get commit summary for PR title
COMMIT_COUNT=$(git log "$BASE_BRANCH..$CURRENT_BRANCH" --oneline 2>/dev/null | wc -l)
if [ "$COMMIT_COUNT" -eq 1 ]; then
    PR_TITLE=$(git log "$BASE_BRANCH..$CURRENT_BRANCH" --oneline --format="%s" | head -1)
else
    PR_TITLE="$CURRENT_BRANCH"
fi

echo -e "${CYAN}Creating PR...${NC}"
gh pr create \
    --base "$BASE_BRANCH" \
    --title "$PR_TITLE" \
    --body "$(cat <<BODY
## Summary

<!-- What changed and why -->

**Type:** <!-- feat | fix | refactor | docs | infra | test | chore -->

## Changes

<!-- auto-generated from commits -->
$(git log "$BASE_BRANCH..$CURRENT_BRANCH" --oneline --format="- %s" 2>/dev/null)

## Ecosystem Architecture Impact

\`\`\`
$DIAGRAM
\`\`\`

## Testing Evidence

<details>
<summary>Test output</summary>

\`\`\`
${TEST_OUTPUT:-'No test output captured'}
\`\`\`

</details>

<details>
<summary>Coverage summary</summary>

\`\`\`
${COVERAGE_OUTPUT:-'No coverage data'}
\`\`\`

</details>
BODY
)"

echo ""
echo -e "${GREEN}=== PR created successfully ===${NC}"
