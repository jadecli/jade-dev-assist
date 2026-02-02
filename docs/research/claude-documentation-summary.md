# Claude Documentation Summary for JADE-DEV-ASSIST

> Comprehensive analysis of 26 Claude support documentation articles covering personalization, settings, and capabilities

## Executive Summary

This document synthesizes Claude's official documentation to inform JADE-DEV-ASSIST plugin development. It covers the three-tier personalization architecture, style system, capability toggles, file handling, projects with RAG, skills system, Cowork features, and existing IDE integrations.

---

## 1. Three-Tier Personalization Architecture

Claude implements a **hierarchical personalization system** with three distinct layers:

### Layer 1: Profile Preferences (Account-Wide)

**Scope**: All conversations across the account
**Location**: `~/.claude/CLAUDE.md`, Settings → Profile

**Best for**:
- Preferred programming languages
- Coding conventions and style preferences
- Common terminology and domain knowledge
- General development context

**Configuration**:
```markdown
# ~/.claude/CLAUDE.md

## About Me
- Senior TypeScript/React developer
- Prefer functional programming patterns
- Use Prettier + ESLint for formatting

## Preferences
- Always use async/await over .then()
- Prefer named exports over default exports
- Use descriptive variable names
```

### Layer 2: Project Instructions (Workspace-Scoped)

**Scope**: All chats within a specific project
**Location**: `.claude/CLAUDE.md`, Project settings

**Best for**:
- Repository-specific context
- Tech stack definitions
- Team coding standards
- API documentation references

**Configuration**:
```markdown
# .claude/CLAUDE.md

## Project Context
This is a Next.js 14 application using:
- TypeScript 5.3
- Tailwind CSS
- Prisma ORM with PostgreSQL
- tRPC for type-safe APIs

## Conventions
- Components in PascalCase
- Hooks prefixed with 'use'
- API routes follow REST conventions
```

### Layer 3: Response Styles (Per-Conversation)

**Scope**: Current conversation or applied explicitly
**Location**: Settings → Styles, `~/.claude/output-styles/`

**Built-in Presets**:
| Style | Description | Best For |
|-------|-------------|----------|
| Normal | Balanced responses | General use |
| Concise | Shorter, direct answers | Quick questions |
| Formal | Polished, professional | Documentation |
| Explanatory | Educational, detailed | Learning |

---

## 2. Styles System

### Creating Custom Styles

**Method 1: Writing Samples**
- Upload PDF, DOC, or TXT files
- Claude analyzes and matches patterns
- Best for matching existing documentation style

**Method 2: Description + Starting Point**
- Describe desired characteristics
- Optionally select a preset as base
- Best for specific technical requirements

### Style Management

```javascript
// Style configuration schema
{
  "name": "developer-concise",
  "description": "Optimized for code-focused responses",
  "instructions": [
    "Provide code first, explanations second",
    "Use minimal comments in code",
    "Prefer examples over prose",
    "Skip preamble and pleasantries"
  ],
  "basedOn": "concise"
}
```

### IDE-Optimized Style Presets

| Style | Use Case |
|-------|----------|
| `code-review` | Reviewing PRs and code quality |
| `debugging` | Step-by-step problem solving |
| `documentation` | API docs and READMEs |
| `refactoring` | Code improvement suggestions |
| `learning` | Teaching new concepts |

---

## 3. Model Selection

### Available Models

| Model | Strengths | Token Limit |
|-------|-----------|-------------|
| Claude Opus 4.5 | Complex reasoning, spreadsheets, financial | 200K |
| Claude Sonnet 4.5 | Balanced speed/capability, coding | 200K |
| Claude Sonnet 4 | Fast, efficient coding | 200K |
| Claude Haiku 4.5 | Quick responses, simple tasks | 200K |

### Selection Guidelines

- **Opus 4.5**: Mathematical proofs, competition coding, complex analysis
- **Sonnet 4.5/4**: Daily coding tasks, refactoring, testing
- **Haiku 4.5**: Quick lookups, simple generations, cost-sensitive

### Extended Thinking Requirements

- Requires Claude 4 models or Claude 3.7 Sonnet
- Not available on Haiku
- Token budget: 1,024 to 31,999 tokens

---

## 4. Extended Thinking

### Configuration

**UI Toggle**: Settings → Search and tools → Extended thinking

**API Configuration**:
```python
response = client.messages.create(
    model="claude-sonnet-4-5-20250929",
    max_tokens=16000,
    thinking={
        "type": "enabled",
        "budget_tokens": 10000  # Min: 1,024
    },
    messages=[...]
)
```

**Claude Code Environment Variable**:
```bash
export MAX_THINKING_TOKENS=16000
```

### Best Practices

**Use Extended Thinking For**:
- Mathematical proofs and derivations
- Competition-level coding problems
- Complex system design
- Multi-step analysis
- Project planning and architecture

**Avoid For**:
- Simple factual questions
- Basic code generation
- Quick lookups
- Conversational responses

### Verbose Mode (Claude Code)

- Toggle with **Ctrl+O**
- Shows thinking process in real-time
- Useful for debugging reasoning

---

## 5. Web Search & Research

### Web Search

**Availability**: Opus 4.5, Sonnet 4.5/4, Haiku 4.5

**Characteristics**:
- 1-2 tool calls per query
- Real-time information retrieval
- Automatic citation generation
- Domain filtering support

**API Configuration**:
```json
{
  "type": "web_search_20250305",
  "name": "web_search",
  "max_uses": 5,
  "allowed_domains": ["docs.example.com"],
  "blocked_domains": ["untrusted.com"],
  "user_location": {
    "type": "approximate",
    "city": "San Francisco",
    "region": "California",
    "country": "US"
  }
}
```

### Research Mode

**Availability**: Paid plans only

**Characteristics**:
- 5+ tool calls over 1-3 minutes
- Comprehensive multi-source analysis
- Automatically enables extended thinking
- Integrates with Gmail, Calendar, Docs

**Best For**:
- Competitor analysis
- Comprehensive reports
- Market research
- Technical deep dives

---

## 6. File Handling

### Input Limits

| Category | Limit |
|----------|-------|
| File size | 30 MB per file |
| Files per chat | 20 files |
| Image dimensions | 8000×8000 max |
| Recommended image | 1000×1000+ |

### Supported Input Formats

**Documents**: PDF, DOCX, CSV, TXT, HTML, ODT, RTF, EPUB, JSON, XLSX

**Images**: JPEG, PNG, GIF, WebP

### PDF Processing Tiers

| Pages | Processing Mode |
|-------|-----------------|
| < 100 | Full multimodal (text + visual) |
| > 1000 | Text-only |
| > 30MB | Computing environment (no context) |

### Output File Creation

**Supported Formats**:
- Excel (.xlsx) with formulas
- PowerPoint (.pptx)
- Word (.docx)
- PDF
- Python scripts
- PNG visualizations
- LaTeX
- GIF animations

### Network Egress (Team/Enterprise)

| Setting | Access |
|---------|--------|
| OFF | Pre-installed packages only |
| Package managers (default) | npm, PyPI, GitHub |
| Custom domains | Whitelisted sites |
| All domains | Full internet |

---

## 7. Projects & RAG

### Project Features

**Availability**: Paid plans (Free: max 5 projects)

**Context Windows**:
| Plan | Context |
|------|---------|
| Standard | 200K tokens |
| Enterprise (Sonnet 4.5) | 500K tokens |
| Enterprise (Claude Code/API) | 1M tokens (beta) |

### Automatic RAG

**Activation**: Automatic when project knowledge approaches limits

**Capacity**: Up to 10x expansion

**Features**:
- "Project knowledge search tool"
- Contextual Retrieval enhancement
- Visual indicator when active
- No manual setup required

### Best Practices

1. Use clear, descriptive filenames
2. Organize related content together
3. Reference specific documents in queries
4. Segment documents under 100 pages
5. Avoid duplicate content

---

## 8. Skills System

### Overview

Skills are dynamic capability modules that Claude loads based on relevance.

**Availability**:
- Feature preview: Pro/Max/Team/Enterprise
- Beta: Claude Code

**Standard**: Agent Skills Specification (agentskills.io)

### SKILL.md Structure

```yaml
---
name: Brand Guidelines
description: Apply Acme Corp brand guidelines to all content
dependencies: python>=3.8, pandas>=1.5.0
---

## Overview
Apply company brand guidelines consistently.

## Instructions
1. Use approved color palette (#1A73E8, #34A853)
2. Follow tone guidelines (professional, friendly)
3. Include required disclaimers

## Resources
- brand-colors.json
- tone-guide.md
```

### Skill Locations

| Scope | Path |
|-------|------|
| User | `~/.claude/skills/` |
| Project | `.claude/skills/` |

### Built-in Anthropic Skills

- Excel processing
- Word document creation
- PowerPoint generation
- PDF handling

### API Beta Headers

```python
betas=[
    "code-execution-2025-08-25",
    "skills-2025-10-02", 
    "files-api-2025-04-14"
]
```

---

## 9. Artifacts

### Creation Criteria

Claude creates artifacts when content is:
- Significant (15+ lines)
- Self-contained
- Editable
- Reusable

### Supported Types

- Code snippets
- Markdown documents
- Single-page HTML
- SVG images
- Diagrams
- Interactive React components

### Storage Limits

| Limit | Value |
|-------|-------|
| Per artifact | 20 MB |
| Input type | Text only |
| Persistence | Published artifacts only |

### MCP Integration

**Availability**: Pro, Max, Team, Enterprise

**Supported Services**: Asana, Google Calendar, Slack, and more

**Authentication**: Per-user, even for shared artifacts

### Plan Feature Matrix

| Feature | Free | Pro | Max | Team | Enterprise |
|---------|------|-----|-----|------|------------|
| Basic artifacts | ✓ | ✓ | ✓ | ✓ | ✓ |
| AI-powered | ✓ | ✓ | ✓ | ✓ | ✓ |
| MCP integration | ✗ | ✓ | ✓ | ✓ | ✓ |
| Persistent storage | ✗ | ✓ | ✓ | ✓ | ✓ |
| Public publishing | ✓ | ✓ | ✓ | ✗ | ✗ |
| Internal sharing | ✗ | ✗ | ✗ | ✓ | ✓ |

---

## 10. Cowork

### Overview

Cowork provides agentic architecture for desktop knowledge work.

**Environment**: Virtual Machine on macOS Claude Desktop

**Availability**: Pro/Max/Team/Enterprise (research preview)

### Features

- Direct local file access
- Sub-agent coordination
- Extended execution without timeouts
- Plugin system for extensions

### Built-in Plugins

- Productivity
- Enterprise search
- Sales
- Finance
- Plugin Create

### Limitations

**Not Captured**:
- Audit Logs
- Compliance API
- Data Exports

**Not Supported**:
- Projects
- Memory
- Chat sharing
- GSuite

**Warning**: Do not use for regulated workloads

---

## 11. IDE Integrations

### Xcode (Native Apple Integration)

**Requirements**: Xcode 26+, Pro/Max or premium Team/Enterprise

**Features**:
- Natural language questions
- Project context awareness
- Conversation memory
- Inline code changes
- Automatic error fixes
- Documentation generation
- SwiftUI preview creation

### Excel Add-in (Beta)

**Requirements**: Max/Team/Enterprise

**Model**: Claude Opus 4.5 (fixed)

**Features**:
- Cell-level citations
- Formula debugging
- Model building
- Action confirmations for high-risk operations

**Shortcuts**: Ctrl+Option+C (Mac) / Ctrl+Alt+C (Windows)

### Microsoft Foundry

**Status**: Public preview

**Models**: Haiku 4.5, Sonnet 4.5, Opus 4.1

**Features**:
- Extended thinking
- Prompt caching
- PDF support
- Files API
- Skills
- Tool use

**SDKs**: Python, TypeScript, C#

---

## 12. Implementation Checklist for JADE-DEV-ASSIST

### Core Personalization Layers

- [ ] Global profile preferences (`~/.claude/CLAUDE.md`)
- [ ] Workspace/project instructions (`.claude/CLAUDE.md`)
- [ ] Response styles directory (`~/.claude/output-styles/`)
- [ ] Settings sync mechanism

### Capability Toggles

- [ ] Model selection (Opus, Sonnet, Haiku)
- [ ] Extended thinking with budget config (1,024–31,999)
- [ ] Web search with domain filtering
- [ ] Research mode integration
- [ ] Artifacts with MCP support

### File Handling

- [ ] Input format validation (30MB limit)
- [ ] Output file generation
- [ ] Context window awareness
- [ ] RAG activation monitoring

### Skills System

- [ ] User skills: `~/.claude/skills/`
- [ ] Project skills: `.claude/skills/`
- [ ] SKILL.md template generator
- [ ] Skills validation
- [ ] Beta header injection

### Configuration Files

- [ ] `~/.claude/settings.json`
- [ ] `~/.claude/CLAUDE.md`
- [ ] `.claude/CLAUDE.md`
- [ ] `.claude/settings.local.json`
- [ ] `~/.claude/output-styles/*.md`
- [ ] `~/.claude/commands/*.md`

### Safety & Security

- [ ] Confirmation dialogs for high-risk ops
- [ ] Domain whitelisting/blacklisting
- [ ] Sandboxed code execution
- [ ] Network egress controls
- [ ] No hardcoded credentials

### API Patterns

- [ ] `thinking` parameter for reasoning
- [ ] `web_search_20250305` tool
- [ ] Skills beta headers
- [ ] Container ID for session persistence

---

## References

### Official Documentation

- [Understanding Claude's Personalization Features](https://support.claude.com/en/articles/10185728)
- [Configuring and Using Styles](https://support.claude.com/en/articles/10181068)
- [What are Skills?](https://support.claude.com/en/articles/12512176)
- [Using Extended Thinking](https://support.claude.com/en/articles/using-extended-thinking)
- [What are Artifacts?](https://support.claude.com/en/articles/9487310)

### Agent Skills Specification

- [agentskills.io](https://agentskills.io)

### Related Projects

- [Superpowers](https://github.com/obra/superpowers)
- [Get Shit Done](https://github.com/glittercowboy/get-shit-done)
- [Ralph](https://github.com/frankbria/ralph-claude-code)
