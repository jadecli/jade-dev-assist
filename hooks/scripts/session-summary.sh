#!/bin/bash
# hooks/scripts/session-summary.sh
# Generate conventional-commit-style summary of changes
CHANGES=$(git diff --stat HEAD~5..HEAD 2>/dev/null || echo "No recent changes")
echo "{\"hookSpecificOutput\":{\"additionalContext\":\"Session ended. Recent changes: $CHANGES\"}}"
