# GitHub Actions Setup

## Installation (No API Key Required!)

This workflow uses the Claude Code GitHub App - no paid API keys needed.

### Option 1: GitHub App (Recommended)

1. Install the Claude Code GitHub App:
   - Visit: https://github.com/apps/claude-code
   - Click "Install"
   - Select repositories to enable

2. That's it! The workflow uses your Claude Code subscription via GitHub App authentication.

### Option 2: Self-Hosted with Docker/Ollama

For free/self-hosted models:

1. Set up Docker MCP or Ollama locally
2. Configure webhook endpoint in repo settings
3. Point to your self-hosted Claude Code instance

## Testing the Workflow

1. Create an issue: `node scripts/create-issues-from-tasks.js jade-dev-assist`
2. Add comment: `@claude please implement this`
3. Claude will analyze and create a PR using your subscription

## Authentication

- ✅ **GitHub App**: Uses your Claude Code subscription (recommended)
- ✅ **Docker/Ollama**: Free local models
- ❌ **API Keys**: Not needed - we don't use paid API keys
