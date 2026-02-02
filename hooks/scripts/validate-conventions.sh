#!/bin/bash
# hooks/scripts/validate-conventions.sh
# Check code conventions on file write
FILE="$1"
EXT="${FILE##*.}"

if [ "$EXT" = "py" ]; then
  RESULT=$(ruff check "$FILE" 2>&1 | head -5)
  if [ -n "$RESULT" ]; then
    echo "{\"hookSpecificOutput\":{\"additionalContext\":\"Ruff warnings: $RESULT\"}}"
  fi
fi
