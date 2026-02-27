# Airport

A terminal multiplexer built for AI coding CLIs. Run multiple [Claude Code](https://docs.anthropic.com/en/docs/claude-code) sessions side-by-side with live status previews, so you always know which session needs your attention.

## Quick Start

```bash
npx airport
```

## Install & Build from Source

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

**Hooks are installed automatically** into `~/.claude/settings.json` when you run `npm start`. The setup is idempotent and won't overwrite your existing hooks.

To remove them, delete the Airport entries from `~/.claude/settings.json` under the `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, and `Notification` events.

The hooks are no-ops outside Airport — they check for the `AIRPORT` environment variable and exit silently when it's absent.

## License

[MIT](LICENSE)
