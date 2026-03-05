#!/bin/bash
# Airport hook: signals that Claude Code finished processing.
[ -z "$AIRPORT" ] || [ -z "$AIRPORT_STATUS_FILE" ] && exit 0

# Read the last busy message so we can show "X — finished"
last=""
if [ -f "$AIRPORT_STATUS_FILE" ]; then
  content=$(cat "$AIRPORT_STATUS_FILE" 2>/dev/null || true)
  # Extract the message part after "busy;"
  case "$content" in
    busy\;*) last="${content#busy;}" ;;
  esac
fi

if [ -n "$last" ]; then
  echo "done;${last} — finished" > "$AIRPORT_STATUS_FILE"
else
  echo "done;Finished" > "$AIRPORT_STATUS_FILE"
fi

# Check for plan files created during this session.
# Claude Code's plan mode writes to ~/.claude/plans/ internally (not via Write tool),
# so the busy hook won't catch them. Scan for recently modified plan files.
plan_file="${AIRPORT_STATUS_FILE%.status}.plan"
if [ ! -f "$plan_file" ]; then
  plans_dir="$HOME/.claude/plans"
  if [ -d "$plans_dir" ]; then
    # Find the most recently modified .md file (within last 5 minutes)
    newest=$(find "$plans_dir" -name '*.md' -type f -mmin -5 2>/dev/null | while read f; do
      echo "$(stat -f '%m' "$f" 2>/dev/null || stat -c '%Y' "$f" 2>/dev/null) $f"
    done | sort -rn | head -1 | cut -d' ' -f2-)
    if [ -n "$newest" ]; then
      echo "$newest" > "$plan_file"
    fi
  fi
fi
