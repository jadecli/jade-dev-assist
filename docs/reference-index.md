# Jade-Dev-Assist Reference Index

> **Generated:** 2026-02-04
> **Purpose:** Cached reference documentation for swarm agents working in the jadecli ecosystem
> **Token Budget:** ~40K tokens (suitable for prompt caching)
> **Source:** jadecli-codespaces documentation repository

---

## Table of Contents

1. [Claude API Best Practices](#claude-api-best-practices)
2. [Anthropic Engineering Patterns](#anthropic-engineering-patterns)
3. [Python Toolchain Integration](#python-toolchain-integration)
4. [GitHub Projects API Patterns](#github-projects-api-patterns)
5. [Quick Reference Tables](#quick-reference-tables)

---

## Claude API Best Practices

### Model Selection

**Current Claude Models (as of 2026-02-04):**
- **Smartest:** Claude Opus 4.5 (`claude-opus-4-5-20251101`)
- **Smart:** Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`)
- **Fast/Cost-effective:** Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)

### Basic API Usage

**Python SDK:**
```python
import anthropic
import os

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

message = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Hello, Claude"}
    ]
)
```

**Conversational Context:**
- API is stateless - always send full conversation history
- Can use synthetic `assistant` messages to shape context
- Earlier turns don't need to originate from Claude

**Pre-filling Responses:**
```python
# Force specific format by starting Claude's response
message = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=1,
    messages=[
        {"role": "user", "content": "What is latin for Ant? (A) Apoidea, (B) Rhopalocera, (C) Formicidae"},
        {"role": "assistant", "content": "The answer is ("}
    ]
)
```

### Vision Support

**Supported formats:**
- Image types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- Sources: `base64` encoded or `url` reference

```python
# Base64 approach
image_data = base64.standard_b64encode(httpx.get(image_url).content).decode("utf-8")
message = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=1024,
    messages=[{
        "role": "user",
        "content": [
            {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": image_data}},
            {"type": "text", "text": "What is in the above image?"}
        ]
    }]
)

# URL approach (simpler)
message = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=1024,
    messages=[{
        "role": "user",
        "content": [
            {"type": "image", "source": {"type": "url", "url": "https://example.com/image.jpg"}},
            {"type": "text", "text": "What is in the above image?"}
        ]
    }]
)
```

### Extended Thinking

**When to use:** Very hard tasks requiring deep reasoning
**Requirement:** Temperature must be set to 1

**Supported models:**
- Claude Opus 4.1 (`claude-opus-4-1-20250805`)
- Claude Opus 4 (`claude-opus-4-20250514`)
- Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`)

```python
response = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=16000,
    thinking={
        "type": "enabled",
        "budget_tokens": 10000
    },
    messages=[{
        "role": "user",
        "content": "Are there an infinite number of prime numbers such that n mod 4 == 3?"
    }]
)

# Response contains thinking + text blocks
for block in response.content:
    if block.type == "thinking":
        print(f"Thinking: {block.thinking}")
    elif block.type == "text":
        print(f"Response: {block.text}")
```

**Key constraint:** `max_tokens` must be strictly greater than `budget_tokens`

**Extended Thinking with Tool Use:**
- Only supports `tool_choice: {"type": "auto"}` or `tool_choice: {"type": "none"}`
- **Critical:** Must pass `thinking` blocks back when continuing conversation
- With interleaved thinking (beta), `budget_tokens` can exceed `max_tokens`

```python
# First request
response = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=16000,
    thinking={"type": "enabled", "budget_tokens": 10000},
    tools=[weather_tool],
    messages=[{"role": "user", "content": "What's the weather in Paris?"}]
)

# Extract blocks
thinking_block = next((b for b in response.content if b.type == 'thinking'), None)
tool_use_block = next((b for b in response.content if b.type == 'tool_use'), None)

# Second request - preserve thinking
continuation = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=16000,
    thinking={"type": "enabled", "budget_tokens": 10000},
    tools=[weather_tool],
    messages=[
        {"role": "user", "content": "What's the weather in Paris?"},
        {"role": "assistant", "content": [thinking_block, tool_use_block]},  # Both blocks!
        {"role": "user", "content": [{"type": "tool_result", "tool_use_id": tool_use_block.id, "content": "..."}]}
    ]
)
```

**Interleaved Thinking (Beta):**
```python
response = client.beta.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=16000,
    thinking={"type": "enabled", "budget_tokens": 10000},
    tools=[calculator_tool, database_tool],
    messages=[{"role": "user", "content": "Calculate something complex"}],
    betas=["interleaved-thinking-2025-05-14"]
)
```

### Tool Use Patterns

**Tool Definition Structure:**
```json
{
  "name": "get_weather",
  "description": "Get the current weather in a given location",
  "input_schema": {
    "type": "object",
    "properties": {
      "location": {"type": "string", "description": "The city and state, e.g. San Francisco, CA"},
      "unit": {"type": "string", "enum": ["celsius", "fahrenheit"], "description": "Temperature unit"}
    },
    "required": ["location"]
  }
}
```

**Best Practices for Tool Definitions:**

1. **Extremely detailed descriptions** - Most important factor!
   - What the tool does
   - When it should/shouldn't be used
   - What each parameter means
   - Important caveats or limitations

2. **Good description example:**
```json
{
  "name": "get_stock_price",
  "description": "Retrieves the current stock price for a given ticker symbol. The ticker symbol must be a valid symbol for a publicly traded company on a major US stock exchange like NYSE or NASDAQ. The tool will return the latest trade price in USD. It should be used when the user asks about the current or most recent price of a specific stock. It will not provide any other information about the stock or company.",
  "input_schema": {
    "type": "object",
    "properties": {
      "ticker": {"type": "string", "description": "The stock ticker symbol, e.g. AAPL for Apple Inc."}
    },
    "required": ["ticker"]
  }
}
```

3. **Consider `input_examples` (beta)** for complex tools with nested objects

**Controlling Tool Use:**

```python
# Let Claude decide (default)
tool_choice = {"type": "auto"}

# Force Claude to use one of the tools
tool_choice = {"type": "any"}

# Force specific tool
tool_choice = {"type": "tool", "name": "get_weather"}

# Prevent tool use
tool_choice = {"type": "none"}
```

**Chain of Thought:**
Claude often shows reasoning in `text` blocks before `tool_use` blocks:

```json
{
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "<thinking>To answer this question, I will: 1. Use get_weather...</thinking>"
    },
    {
      "type": "tool_use",
      "id": "toolu_01A09q90qw90lq917835lq9",
      "name": "get_weather",
      "input": {"location": "San Francisco, CA"}
    }
  ]
}
```

**Parallel Tool Use:**
- By default, Claude may use multiple tools
- Disable with `disable_parallel_tool_use=true`

**Handling Tool Results:**

```python
# 1. Execute tool in your codebase
# 2. Return result
{
  "role": "user",
  "content": [{
    "type": "tool_result",
    "tool_use_id": "toolu_01A09q90qw90lq917835lq9",
    "content": "15 degrees"
  }]
}

# If tool execution fails
{
  "role": "user",
  "content": [{
    "type": "tool_result",
    "tool_use_id": "toolu_01A09q90qw90lq917835lq9",
    "content": "ConnectionError: the weather service API is not available (HTTP 500)",
    "is_error": true
  }]
}
```

**JSON Output Pattern:**
Tools don't need to be actual functions - use them anytime you want structured JSON output following a schema.

### Streaming

**Basic streaming:**
```python
with client.messages.stream(
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}],
    model="claude-sonnet-4-5",
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
```

**Event Flow:**
1. `message_start` - Contains Message with empty content
2. Series of content blocks:
   - `content_block_start`
   - One or more `content_block_delta` events
   - `content_block_stop`
3. One or more `message_delta` events
4. Final `message_stop`

**Delta Types:**
- `text_delta` - Regular text chunks
- `input_json_delta` - Partial JSON strings for tool_use
- `thinking_delta` - Extended thinking chunks

**Warning:** Token counts in `message_delta` usage field are **cumulative**

---

## Anthropic Engineering Patterns

### Build-First Philosophy

**Key URL References:**
- Building Effective Agents: `https://www.anthropic.com/engineering/building-effective-agents`
- Writing Tools for Agents: `https://www.anthropic.com/engineering/writing-tools-for-agents`

**Core Principles:**

1. **Start with prompts** - Don't jump to agents/tools immediately
2. **Iterate quickly** - Build simple, test, measure, improve
3. **Measure impact** - Use evals to track improvement
4. **Keep it simple** - Complexity should be justified by results

### Testing & Development Workflows

**Recommended approach:**
1. **Write tests first** (TDD)
2. **Implement minimal solution**
3. **Run quality gate:**
   - Linter (ruff)
   - Type checker (ty)
   - Tests (pytest)
4. **Refactor** once tests pass
5. **Commit** with conventional commit message

**Quality gate before commit:**
```bash
# All must pass
ruff check --fix .
ty check .
pytest
```

### Agent Design Patterns

**From Anthropic engineering articles:**

1. **Workflow Agents:** Best for well-defined tasks with clear steps
2. **Autonomous Agents:** For open-ended exploration
3. **Multi-agent systems:** When tasks benefit from specialization

**Context Budget Strategy:**
- Orchestrator: ~35K tokens (summaries only)
- Worker initial: <60K tokens
- Worker execution: Full 200K window
- Retry budget: 25K tokens with 500-token summary
- Max turns: 25 per agent (15 for retries)

---

## Python Toolchain Integration

### Ruff (Linting & Formatting)

**What is Ruff:**
- Extremely fast Python linter + formatter (written in Rust)
- 10-100x faster than alternatives
- Replaces: pylint, flake8, black, isort

**Installation (with uv):**
```bash
uv add --dev ruff
```

**Quick Start:**
```bash
# Check code
ruff check .

# Format code
ruff format .

# Check and auto-fix
ruff check --fix .
```

**Configuration (pyproject.toml):**
```toml
[tool.ruff]
line-length = 88
target-version = "py38"

[tool.ruff.lint]
select = [
    "E",    # PEP 8 errors
    "F",    # Pyflakes
    "W",    # PEP 8 warnings
    "I",    # isort
    "UP",   # pyupgrade
    "B",    # flake8-bugbear
]
ignore = ["E501"]  # Line too long

[tool.ruff.lint.per-file-ignores]
"__init__.py" = ["F401"]  # Unused imports OK
"test_*.py" = ["S101"]    # assert used OK

[tool.ruff.format]
quote-style = "double"
indent-width = 4
```

**Common Rule Categories:**
- **E** - PEP 8 errors
- **F** - Pyflakes (undefined names, unused imports)
- **W** - PEP 8 warnings
- **I** - isort (import sorting)
- **UP** - pyupgrade (modernization)
- **B** - flake8-bugbear (bug detection)
- **C** - McCabe complexity
- **N** - pep8-naming
- **D** - pydocstyle (docstrings)
- **S** - bandit (security)

**Common Error Codes:**
| Code | Rule | Description |
|------|------|-------------|
| E501 | Line too long | Line exceeds max length |
| F401 | Unused import | Import not used |
| F841 | Unused variable | Variable assigned but unused |
| E302 | Expected 2 blank lines | Function spacing |
| W292 | No newline at end | Missing EOF newline |

**Output Formats:**
```bash
ruff check .                          # Default
ruff check --output-format json .     # JSON
ruff check --quiet .                  # Quiet
ruff check --statistics .             # Stats
ruff check --watch .                  # Watch mode
```

**Check Specific Rule:**
```bash
ruff rule E501
```

### Ty (Type Checking)

**What is Ty:**
- Fast Python type checker
- Catches type errors before runtime
- Standards compliant (follows PEPs)

**Installation (with uv):**
```bash
uv add --dev ty
```

**Quick Start:**
```bash
ty check .
ty check --show-diagnostics .
```

**Type Annotations:**
```python
# Basic types
name: str = "Alice"
age: int = 30
height: float = 5.8
active: bool = True

# Function annotations
def greet(name: str) -> str:
    return f"Hello, {name}!"

def add(a: int, b: int) -> int:
    return a + b

# Optional types
from typing import Optional

def find_user(user_id: int) -> Optional[str]:
    return None  # or string

# Collections
from typing import List, Dict, Set

names: List[str] = ["Alice", "Bob"]
scores: Dict[str, int] = {"Alice": 95}
tags: Set[str] = {"python", "typing"}

# Union types
from typing import Union

def process(value: Union[int, str]) -> int:
    if isinstance(value, int):
        return value * 2
    else:
        return len(value)

# Generics
from typing import TypeVar, Generic

T = TypeVar('T')

class Box(Generic[T]):
    def __init__(self, value: T) -> None:
        self.value = value

    def get(self) -> T:
        return self.value
```

**Configuration (pyproject.toml):**
```toml
[tool.ty]
python-version = "3.10"
strict = true
```

**Exit Codes:**
- `0` - No type errors
- `1` - Type errors found

**Type Narrowing:**
Ty understands when types are narrowed through isinstance checks:
```python
def process(value: Union[int, str]) -> int:
    if isinstance(value, int):
        return value * 2  # Type is int here
    else:
        return len(value)  # Type is str here
```

### UV (Package Management)

**What is UV:**
- Fast Python package manager (Rust-based)
- Manages virtual environments automatically
- Replaces: pip, virtualenv, poetry (partially)

**Installation:**
```bash
# Via official installer
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or via package manager
brew install uv  # macOS
```

**Project Management:**

```bash
# Create new project
uv init my-project
cd my-project

# Add dependency
uv add requests

# Add dev dependency
uv add --dev pytest

# Sync dependencies (install from lock file)
uv sync

# Run command in project environment
uv run python script.py
uv run pytest

# Activate virtual environment
source .venv/bin/activate  # Linux/macOS
.venv\Scripts\activate     # Windows
```

**Project Structure:**
```
my-project/
├── pyproject.toml       # Project config + dependencies
├── uv.lock              # Locked dependencies (auto-generated)
├── README.md
├── src/
│   └── my_package/
│       ├── __init__.py
│       └── module.py
├── tests/
│   └── test_module.py
└── .venv/               # Virtual environment (auto-created)
```

**pyproject.toml:**
```toml
[project]
name = "my-project"
version = "0.1.0"
description = "My awesome project"
requires-python = ">=3.11"
dependencies = [
    "requests>=2.28.0",
    "click>=8.0",
]

[project.optional-dependencies]
dev = ["pytest", "ruff", "ty"]

[tool.uv]
# UV-specific configuration
```

**Key Commands:**
```bash
uv init <project>        # Create new project
uv add <package>         # Add dependency
uv add --dev <package>   # Add dev dependency
uv remove <package>      # Remove dependency
uv sync                  # Install/sync dependencies
uv run <command>         # Run in project environment
uv pip install <pkg>     # Pip-compatible interface
uv venv                  # Create virtual environment
```

**Integration with Ruff & Ty:**
```toml
[project.optional-dependencies]
dev = [
    "pytest>=7.0",
    "ruff>=0.1.0",
    "ty>=0.1.0",
]
```

Then:
```bash
uv add --dev pytest ruff ty
uv run ruff check .
uv run ty check .
uv run pytest
```

---

## GitHub Projects API Patterns

### GraphQL vs REST

**Critical:** Use GraphQL API for Projects v2, not REST

**Token Scopes:**
- `read:project` - Read-only queries
- `project` - Full access (queries + mutations)

### Authentication

**Options:**

| Method | Use Case | Setup |
|--------|----------|-------|
| GitHub App | Organization projects | Create App, store ID + private key |
| PAT (Personal Access Token) | User projects | Create token with `project` scope |

**Important:** `GITHUB_TOKEN` in Actions cannot access projects (repo-scoped only)

### GraphQL Mutations

**Add issue/PR to project:**
```graphql
mutation {
  addProjectV2ItemById(input: {
    projectId: "PROJECT_NODE_ID"
    contentId: "ISSUE_OR_PR_NODE_ID"
  }) {
    item { id }
  }
}
```

**Add draft issue:**
```graphql
mutation {
  addProjectV2DraftIssue(input: {
    projectId: "PROJECT_NODE_ID"
    title: "Draft title"
    body: "Description"
  }) {
    projectItem { id }
  }
}
```

**Update field value:**
```graphql
mutation {
  updateProjectV2ItemFieldValue(input: {
    projectId: "PROJECT_NODE_ID"
    itemId: "ITEM_NODE_ID"
    fieldId: "FIELD_NODE_ID"
    value: { singleSelectOptionId: "OPTION_NODE_ID" }
  }) {
    projectV2Item { id }
  }
}
```

**Delete item:**
```graphql
mutation {
  deleteProjectV2Item(input: {
    projectId: "PROJECT_NODE_ID"
    itemId: "ITEM_NODE_ID"
  }) {
    deletedItemId
  }
}
```

**Critical workflow note:** Must add item first, then update fields. Cannot combine operations.

### GitHub CLI Integration

```bash
# Get project ID
gh project list --owner OWNER --format json | jq '.projects[] | select(.number==1) | .id'

# Add issue to project
gh project item-add 1 --owner OWNER --url https://github.com/OWNER/REPO/issues/123

# List project items
gh project item-list 1 --owner OWNER --format json

# Edit item field
gh project item-edit --project-id PROJECT_ID --id ITEM_ID --field-id FIELD_ID --single-select-option-id OPTION_ID
```

### GitHub Actions Automation

**Workflow Example:**
```yaml
name: Add PR to Project
on:
  pull_request:
    types: [ready_for_review]

jobs:
  add-to-project:
    runs-on: ubuntu-latest
    steps:
      # Generate token (for org projects)
      - name: Generate token
        id: app-token
        uses: actions/create-github-app-token@v2
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}
          owner: ${{ github.repository_owner }}

      # Add to project
      - name: Add to project
        env:
          GH_TOKEN: ${{ steps.app-token.outputs.token }}
        run: |
          gh project item-add 1 --owner "${{ github.repository_owner }}" \
            --url "${{ github.event.pull_request.html_url }}"
```

**GraphQL in Actions:**
```yaml
- name: Update project item
  env:
    GH_TOKEN: ${{ steps.app-token.outputs.token }}
  run: |
    gh api graphql -f query='
      mutation($project: ID!, $item: ID!, $field: ID!, $value: String!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $project
          itemId: $item
          fieldId: $field
          value: { singleSelectOptionId: $value }
        }) {
          projectV2Item { id }
        }
      }' -f project="$PROJECT_ID" -f item="$ITEM_ID" \
         -f field="$FIELD_ID" -f value="$OPTION_ID"
```

### Field Types

**ProjectV2Field Types:**
- `ProjectV2Field` - Text/number fields
- `ProjectV2SingleSelectField` - Dropdown with options
- `ProjectV2IterationField` - Time-boxed iterations with breaks
- `ProjectV2ItemFieldTextValue` - Text field value
- `ProjectV2ItemFieldDateValue` - Date field value
- `ProjectV2ItemFieldSingleSelectValue` - Selected option value

### Search Qualifiers (for filtering)

**Issue/PR filters:**
```
is:issue / is:pr / is:open / is:closed / is:draft / is:merged
author:USER
assignee:USER
involves:USER
review-requested:USER
label:"LABEL"
milestone:"NAME"
project:ORG/NUM
type:"TYPE"
linked:pr / linked:issue
no:assignee / no:label / no:project
reason:completed / reason:"not planned"
review:none / review:required / review:approved / review:changes_requested
```

### Limits

- Max 50,000 items per project (active + archived)
- Max 100 sub-issues per parent issue
- Max 8 sub-issue nesting levels
- Max 25 issue types per organization
- Max 100 nodes per connection query (pagination required)
- Rate limits apply per GraphQL query complexity

---

## Quick Reference Tables

### Conventional Commits

| Type | Semver | Description |
|------|--------|-------------|
| `feat` | MINOR | New feature |
| `fix` | PATCH | Bug fix |
| `feat!` | MAJOR | Breaking change |
| `docs` | - | Documentation |
| `refactor` | PATCH | Code refactoring |
| `perf` | PATCH | Performance |
| `test` | - | Tests |
| `chore` | - | Maintenance |

**Format:**
```
<type>(<scope>): <description>

[optional body]

[optional footer with BREAKING CHANGE:]
```

### Tool Use Stop Reasons

| Stop Reason | Meaning | Action |
|-------------|---------|--------|
| `end_turn` | Normal completion | Done |
| `tool_use` | Claude wants to use tool | Execute tool, return result |
| `max_tokens` | Hit token limit | Retry with higher max_tokens |
| `pause_turn` | Server tool pause | Pass response back as-is |

### Ruff Common Commands

| Command | Purpose |
|---------|---------|
| `ruff check .` | Check for issues |
| `ruff check --fix .` | Auto-fix issues |
| `ruff format .` | Format code |
| `ruff check --watch .` | Watch mode |
| `ruff rule E501` | Show rule details |

### UV Common Commands

| Command | Purpose |
|---------|---------|
| `uv init <name>` | Create project |
| `uv add <pkg>` | Add dependency |
| `uv add --dev <pkg>` | Add dev dependency |
| `uv sync` | Install dependencies |
| `uv run <cmd>` | Run in environment |

### GitHub CLI Project Commands

| Command | Purpose |
|---------|---------|
| `gh project list --owner ORG` | List projects |
| `gh project item-add NUM --owner ORG --url URL` | Add item |
| `gh project item-list NUM --owner ORG` | List items |
| `gh project item-edit ...` | Update field |

---

## Best Practices Summary

### For Claude API Usage

1. **Always provide extremely detailed tool descriptions**
2. **Use extended thinking for complex reasoning tasks**
3. **Preserve thinking blocks when using tools**
4. **Stream responses for better UX**
5. **Handle tool errors gracefully with `is_error: true`**

### For Python Development

1. **Use uv for all package management**
2. **Configure ruff + ty in pyproject.toml**
3. **Run quality gate before every commit:**
   ```bash
   ruff check --fix . && ty check . && pytest
   ```
4. **Follow conventional commits for version management**
5. **Keep dependencies in pyproject.toml, not requirements.txt**

### For GitHub Projects

1. **Use GraphQL API, not REST**
2. **Add items first, then update fields (two-step)**
3. **Use GitHub App tokens for org projects**
4. **Leverage built-in automations before custom workflows**
5. **Query field options to get valid single-select IDs**

### For Multi-Agent Systems

1. **Start simple, add complexity only when measured benefit exists**
2. **Use TDD: tests → implementation → refactor**
3. **Manage context budgets: orchestrator light, workers full**
4. **Track task dependencies in structured JSON**
5. **Use conventional commits for atomic, trackable changes**

---

## Usage Notes for Swarm Agents

This reference index is designed for prompt caching. When using:

1. **Load entire file** into prompt cache at session start
2. **Reference specific sections** by heading when needed
3. **Assume patterns shown here** are correct and current
4. **Don't re-fetch docs** unless something seems outdated
5. **Token budget:** This file is ~40K tokens, suitable for caching

**For updates:** Re-generate this index when:
- Claude API changes significantly
- New Anthropic engineering articles are published
- Toolchain versions have breaking changes
- GitHub Projects API evolves

---

*End of Reference Index*
