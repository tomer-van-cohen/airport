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
