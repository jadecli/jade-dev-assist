# Claude Code Prompt: Create JADE-DEV-ASSIST GitHub Repository

## Instructions for Claude Code CLI

Copy and paste this entire prompt into Claude Code to create the private GitHub repository.

---

## Prompt

```
I need you to help me create a private GitHub repository for JADE-DEV-ASSIST in the jadecli organization using the alex-jadecli GitHub profile.

## Repository Details

- **Organization**: jadecli
- **Repository Name**: jade-dev-assist
- **Visibility**: Private
- **Description**: Advanced Claude Code plugin for JADE-IDE development workflow management with three-tier personalization

## Steps to Execute

1. **Verify GitHub CLI is authenticated**:
   ```bash
   gh auth status
   ```
   If not authenticated, run: `gh auth login`

2. **Create the private repository**:
   ```bash
   gh repo create jadecli/jade-dev-assist --private --description "Advanced Claude Code plugin for JADE-IDE development workflow management with three-tier personalization"
   ```

3. **Clone the repository locally**:
   ```bash
   cd ~/projects  # or your preferred directory
   gh repo clone jadecli/jade-dev-assist
   cd jade-dev-assist
   ```

4. **Initialize with the JADE-DEV-ASSIST files**:
   
   The complete project structure should be copied from the provided files. Key directories:
   - `.claude-plugin/` - Plugin manifest
   - `commands/` - Slash commands
   - `skills/` - Skill definitions
   - `agents/` - Agent configurations
   - `hooks/` - Event hooks
   - `scripts/` - Utility scripts
   - `docs/research/` - Research documentation
   - `config/` - Configuration templates

5. **Set up the initial commit**:
   ```bash
   git add .
   git commit -m "feat: initial JADE-DEV-ASSIST plugin structure

   - Add three-tier personalization architecture (profile, project, styles)
   - Add capability toggles (thinking, search, artifacts, skills)
   - Add IDE-optimized style presets
   - Add workflow integration (Superpowers, GSD, Ralph patterns)
   - Add comprehensive research documentation
   - Add plugin manifest and validation
   
   Co-Authored-By: Claude <noreply@anthropic.com>"
   
   git push -u origin main
   ```

6. **Configure repository settings**:
   ```bash
   # Enable issues
   gh repo edit jadecli/jade-dev-assist --enable-issues
   
   # Add topics
   gh repo edit jadecli/jade-dev-assist --add-topic claude-code --add-topic plugin --add-topic jade-ide --add-topic personalization --add-topic workflow
   ```

7. **Create initial labels**:
   ```bash
   gh label create "personalization" --description "Profile, project, and style configurations" --color "0052CC"
   gh label create "capability" --description "Extended thinking, search, artifacts" --color "006B75"
   gh label create "skill" --description "Skill definitions and templates" --color "5319E7"
   gh label create "workflow" --description "Superpowers, GSD, Ralph integration" --color "B60205"
   gh label create "documentation" --description "Docs and research" --color "0E8A16"
   ```

8. **Verify the repository**:
   ```bash
   gh repo view jadecli/jade-dev-assist
   ```

## Files to Reference

The project files are available from these sources:

1. **Plugin created in previous session**: `/mnt/user-data/outputs/JADE-DEVELOPER-ASSIST-CLAUDE-PLUGIN/`

2. **Research documentation**: The comprehensive Claude documentation summary covering:
   - Three-tier personalization architecture
   - Styles system configuration
   - Capability toggles (thinking, search, artifacts)
   - Skills system and SKILL.md structure
   - Projects and RAG features
   - IDE integration patterns

3. **Workflow methodologies**: Analysis of Superpowers, GSD, Ralph, and Tasks systems

## After Creation

Once the repository is created:

1. **Install the plugin locally for testing**:
   ```bash
   claude plugin install ./jade-dev-assist --scope user
   ```

2. **Verify commands are available**:
   ```bash
   claude /help
   # Should show jade: commands
   ```

3. **Test initialization**:
   ```bash
   mkdir test-project && cd test-project
   claude /jade:init test-project --template basic
   ```

Let me know when you're ready to proceed, and I'll execute these steps.
```

---

## Alternative: Manual GitHub Web UI Steps

If you prefer to create the repo via the GitHub web interface:

1. Go to https://github.com/organizations/jadecli/repositories/new
2. Repository name: `jade-dev-assist`
3. Description: `Advanced Claude Code plugin for JADE-IDE development workflow management with three-tier personalization`
4. Visibility: **Private**
5. Do NOT initialize with README (we'll push our own)
6. Click "Create repository"
7. Follow the "push an existing repository" instructions

Then in your terminal:
```bash
cd /path/to/JADE-DEV-ASSIST
git init
git add .
git commit -m "feat: initial JADE-DEV-ASSIST plugin structure"
git branch -M main
git remote add origin git@github.com:jadecli/jade-dev-assist.git
git push -u origin main
```

---

## Quick Reference: File Locations

| Content | Location |
|---------|----------|
| Plugin ZIP | `/mnt/user-data/outputs/JADE-DEVELOPER-ASSIST-CLAUDE-PLUGIN.zip` |
| Research Summary | `docs/research/claude-documentation-summary.md` |
| Workflow Analysis | `docs/research/workflow-methodologies.md` |
| Plugin Manifest | `.claude-plugin/plugin.json` |
| Commands | `commands/*.md` |
| Skills | `skills/*/SKILL.md` |
| Style Templates | `config/styles/*.md` |
