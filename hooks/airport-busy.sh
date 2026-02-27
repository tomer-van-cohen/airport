#!/bin/bash
# Airport hook: signals that Claude Code is busy.
# Writes status to the file Airport watches for this session.
[ -z "$AIRPORT" ] || [ -z "$AIRPORT_STATUS_FILE" ] && exit 0

# Read stdin (hook JSON)
input=$(cat 2>/dev/null || true)

if [ -z "$input" ]; then
  echo "busy;Thinking" > "$AIRPORT_STATUS_FILE"
  exit 0
fi

tool=$(echo "$input" | jq -r '.tool_name // empty' 2>/dev/null)

if [ -z "$tool" ]; then
  # UserPromptSubmit — no tool_name, extract prompt preview
  prompt=$(echo "$input" | jq -r '.prompt // empty' 2>/dev/null)
  if [ -n "$prompt" ]; then
    short=$(echo "$prompt" | head -1 | cut -c1-50)
    [ ${#short} -lt ${#prompt} ] && short="$short…"
    echo "busy;Thinking about: $short" > "$AIRPORT_STATUS_FILE"
  else
    echo "busy;Thinking" > "$AIRPORT_STATUS_FILE"
  fi
  exit 0
fi

case "$tool" in
  Read)
    fp=$(echo "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
    if [ -n "$fp" ]; then
      desc="Reading \`$(basename "$fp")\`"
    else
      desc="Reading files"
    fi
    ;;
  Glob)
    pat=$(echo "$input" | jq -r '.tool_input.pattern // empty' 2>/dev/null)
    if [ -n "$pat" ]; then
      desc="Searching for \`$pat\`"
    else
      desc="Searching files"
    fi
    ;;
  Grep)
    pat=$(echo "$input" | jq -r '.tool_input.pattern // empty' 2>/dev/null)
    if [ -n "$pat" ]; then
      desc="Searching for \`$pat\`"
    else
      desc="Searching code"
    fi
    ;;
  Write)
    fp=$(echo "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
    if [ -n "$fp" ]; then
      desc="Writing \`$(basename "$fp")\`"
    else
      desc="Writing file"
    fi
    ;;
  Edit)
    fp=$(echo "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
    if [ -n "$fp" ]; then
      desc="Editing \`$(basename "$fp")\`"
    else
      desc="Editing file"
    fi
    ;;
  NotebookEdit)
    fp=$(echo "$input" | jq -r '.tool_input.notebook_path // empty' 2>/dev/null)
    if [ -n "$fp" ]; then
      desc="Editing \`$(basename "$fp")\`"
    else
      desc="Editing notebook"
    fi
    ;;
  Bash)
    cmd=$(echo "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)
    if [ -n "$cmd" ]; then
      # Truncate long commands
      short=$(echo "$cmd" | head -1 | cut -c1-60)
      [ ${#short} -lt ${#cmd} ] && short="$short…"
      desc="Running \`$short\`"
    else
      desc="Running command"
    fi
    ;;
  WebSearch)
    q=$(echo "$input" | jq -r '.tool_input.query // empty' 2>/dev/null)
    if [ -n "$q" ]; then
      desc="Searching web for \`$q\`"
    else
      desc="Searching web"
    fi
    ;;
  WebFetch)
    url=$(echo "$input" | jq -r '.tool_input.url // empty' 2>/dev/null)
    if [ -n "$url" ]; then
      desc="Fetching \`$url\`"
    else
      desc="Fetching URL"
    fi
    ;;
  Task)
    d=$(echo "$input" | jq -r '.tool_input.description // empty' 2>/dev/null)
    if [ -n "$d" ]; then
      desc="Running agent: $d"
    else
      desc="Running agent"
    fi
    ;;
  *)
    desc="$tool"
    ;;
esac

echo "busy;$desc" > "$AIRPORT_STATUS_FILE"
