# GitHub App Setup

## Install Claude Code GitHub App

To enable @claude automation on this repository:

1. Visit: https://github.com/apps/claude-code
2. Click "Install" or "Configure"
3. Select the `jadecli/jade-dev-assist` repository
4. Grant required permissions:
   - Read access to issues
   - Write access to pull requests
   - Read access to repository contents

## Verify Installation

Check that the app appears in:
- Repository Settings → Integrations → GitHub Apps
- Should show "Claude Code" as installed

## Testing the Workflow

After installation, test with:
```bash
node scripts/create-issues-from-tasks.js jade-dev-assist
```

Then add an `@claude` mention to the created issue to trigger automation.

## Troubleshooting

If @claude doesn't respond:
- Check GitHub Actions logs (.github/workflows/claude-assist.yml)
- Verify app has required permissions
- Check issue has @claude mention in comment (not issue body)
