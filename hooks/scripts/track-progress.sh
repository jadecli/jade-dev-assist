#!/bin/bash
# hooks/scripts/track-progress.sh
# On file write, check if a GitHub Projects item exists for the current branch
BRANCH=$(git branch --show-current 2>/dev/null)
if [ -z "$BRANCH" ]; then exit 0; fi

ITEMS=$(gh project item-list 4 --owner jadecli --format json 2>/dev/null | \
  python3 -c "import sys,json; items=json.load(sys.stdin).get('items',[]); print(len([i for i in items if '$BRANCH' in str(i)]))" 2>/dev/null)

if [ "$ITEMS" -gt 0 ] 2>/dev/null; then
  echo '{"hookSpecificOutput":{"additionalContext":"Branch has linked Projects item. Status should be In Progress."}}'
fi
