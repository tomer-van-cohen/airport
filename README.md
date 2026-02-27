# Airport

A terminal multiplexer built for AI coding CLIs. Run multiple [Claude Code](https://docs.anthropic.com/en/docs/claude-code) sessions side-by-side with live status previews, so you always know which session needs your attention.

## Install & Build

Requires Node 20+ (see `.nvmrc`).

```bash
npm install --legacy-peer-deps
npm start          # dev mode
npm run make       # build distributable
```

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+T` | New session |
| `Cmd+W` | Close session |
| `Cmd+1`–`Cmd+9` | Switch to session 1–9 |
| `Cmd+[` / `Cmd+]` | Previous / next session |
| `Cmd+Shift+[` / `Cmd+Shift+]` | Previous / next session (alt) |
| `Cmd+J` | Jump to next waiting session |
| `Cmd+K` | Clear terminal |

On Linux / Windows, substitute `Ctrl` for `Cmd`.

## Claude Code Hooks

Airport ships two shell scripts in `hooks/` that let it show real-time Claude Code activity (e.g. "Reading `App.tsx`", "Running agent: fix tests") inside each session tile.

To wire them up, add the following to your Claude Code **settings** file (`~/.claude/settings.json` or the project-level `.claude/settings.json`):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/airport/hooks/airport-busy.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/airport/hooks/airport-done.sh"
          }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/airport/hooks/airport-done.sh"
          }
        ]
      }
    ]
  }
}
```

Replace `/path/to/airport` with the actual clone location. Airport sets the `AIRPORT` and `AIRPORT_STATUS_FILE` environment variables for sessions it spawns — the hooks are no-ops when those variables are absent, so they won't interfere with Claude Code sessions outside Airport.

## License

[MIT](LICENSE)
