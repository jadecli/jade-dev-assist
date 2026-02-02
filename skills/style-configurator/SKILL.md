---
name: style-configurator
description: Configure and apply response styles for different development contexts including code review, debugging, documentation, and more
dependencies: []
---

# Style Configurator Skill

## Overview

Manages Claude's response styles with IDE-optimized presets and custom style creation.

## Built-in Style Presets

### Claude Default Styles

| Style | Description |
|-------|-------------|
| `normal` | Balanced responses (default) |
| `concise` | Shorter, direct answers |
| `formal` | Polished, professional |
| `explanatory` | Educational, detailed |

### JADE-DEV-ASSIST IDE Styles

| Style | Description | Best For |
|-------|-------------|----------|
| `developer-concise` | Code-first, minimal prose | Daily coding |
| `code-review` | Structured feedback format | PR reviews |
| `debugging` | Step-by-step analysis | Bug fixing |
| `documentation` | Clean prose, API-ready | READMEs, docs |
| `refactoring` | Before/after comparisons | Code cleanup |
| `architecture` | Diagrams, trade-offs | System design |
| `learning` | Detailed explanations | New concepts |

## Usage

### List Available Styles

```bash
/jade:styles --list
```

### Apply a Style

```bash
# Apply built-in style
/jade:styles --apply developer-concise

# Apply for current message only
/jade:styles --apply code-review --once
```

### Create Custom Style

```bash
# From description
/jade:styles --create my-style --description "Short responses, lots of code examples"

# From writing sample
/jade:styles --create my-style --sample ./writing-sample.md

# Interactive creation
/jade:styles --create --interactive
```

### Preview Style

```bash
/jade:styles --preview developer-concise
```

## Style Definition Format

### Basic Style (Markdown)

```markdown
# Style: developer-concise

## Instructions
- Provide code first, explanations second
- Use minimal comments in code
- Skip preamble and pleasantries
- Prefer examples over prose

## Format
- Code blocks with language tags
- One-line summaries before code
- No bullet points in explanations

## Avoid
- Long introductions
- Obvious explanations
- Redundant confirmations
```

### Advanced Style (YAML + Markdown)

```yaml
---
name: code-review
description: Structured feedback for code reviews
basedOn: concise
tags: [development, review, quality]
---

# Code Review Style

## Structure
1. Summary (1-2 sentences)
2. Issues (categorized by severity)
3. Suggestions (optional improvements)
4. Approval status

## Issue Categories
- 🔴 Critical: Must fix before merge
- 🟡 Warning: Should fix, not blocking
- 🔵 Info: Nice to have improvements

## Format Template
```
## Summary
[Brief assessment]

## Issues
### Critical
- [ ] Issue description (file:line)

### Warnings
- [ ] Issue description (file:line)

## Suggestions
- Consider [improvement]

## Status
[APPROVED / CHANGES REQUESTED / NEEDS DISCUSSION]
```
```

## IDE Style Definitions

### developer-concise.md

```markdown
# Style: developer-concise

## Core Principles
- Code speaks louder than words
- Every character should earn its place
- Examples beat explanations

## Response Format
1. One-line summary (if needed)
2. Code block with solution
3. Brief notes on edge cases (if any)

## Code Style
- Include file path in code block header
- Use language-appropriate conventions
- Show complete, runnable code
- Minimal inline comments

## Avoid
- "Sure, I can help with that"
- "Here's how you can..."
- Explaining basic concepts
- Multiple alternative approaches (unless asked)
```

### code-review.md

```markdown
# Style: code-review

## Review Structure
1. **Quick Assessment** (1 line)
2. **Critical Issues** (blocking)
3. **Warnings** (should fix)
4. **Suggestions** (nice to have)
5. **Positive Notes** (what's good)
6. **Verdict** (approve/request changes)

## Issue Format
```
- 🔴 [CRITICAL] `filename:line` - Description
  ```suggestion
  // Suggested fix
  ```
```

## Severity Guidelines
- 🔴 Critical: Security, data loss, crashes, wrong behavior
- 🟡 Warning: Performance, maintainability, conventions
- 🔵 Suggestion: Style, optimization, alternatives

## Tone
- Direct but constructive
- Focus on code, not author
- Explain the "why" briefly
```

### debugging.md

```markdown
# Style: debugging

## Investigation Format
1. **Understanding the Problem**
   - Restate the error/behavior
   - Identify the symptom vs root cause

2. **Hypothesis**
   - Most likely cause
   - Evidence supporting this

3. **Diagnostic Steps**
   - Specific commands/code to verify
   - What to look for

4. **Solution**
   - Fix with explanation
   - How to verify it works

5. **Prevention**
   - How to avoid this in future

## Code Format
- Show before/after when relevant
- Include debug output examples
- Highlight the key lines
```

### documentation.md

```markdown
# Style: documentation

## Writing Guidelines
- Write for the reader who will use this in 6 months
- Lead with the "what" and "why" before "how"
- Use consistent terminology
- Include examples for every feature

## Structure (README)
1. One-paragraph overview
2. Quick start (working example in <5 min)
3. Installation
4. Usage with examples
5. Configuration
6. API reference (if applicable)
7. Contributing

## Code Examples
- Complete and runnable
- Include expected output
- Show common use cases first

## Formatting
- Headers for navigation
- Tables for options/parameters
- Code blocks with syntax highlighting
```

## Custom Style Creation

### Method 1: Interactive Creation

```bash
/jade:styles --create --interactive
```

The wizard will ask:
1. Style name
2. Base style (optional)
3. Primary use case
4. Verbosity preference
5. Code vs prose ratio
6. Format preferences
7. Things to avoid

### Method 2: From Sample

```bash
/jade:styles --create my-style --sample ./sample.md
```

Claude analyzes the sample for:
- Sentence structure and length
- Technical vocabulary level
- Code/prose ratio
- Formatting patterns
- Tone and voice

### Method 3: From Description

```bash
/jade:styles --create my-style --description "
Technical but friendly. Heavy on code examples.
Explain edge cases but skip obvious stuff.
Use TypeScript conventions.
"
```

## Style Location

| Scope | Location |
|-------|----------|
| User styles | `~/.claude/output-styles/` |
| Project styles | `.claude/styles/` |
| Plugin styles | `./config/styles/` |

## Best Practices

1. **Start with a preset** - Modify rather than create from scratch
2. **Be specific** - Vague instructions produce inconsistent results
3. **Test with examples** - Preview before committing
4. **Keep it focused** - One style per use case
5. **Document context** - Note when to use each style
