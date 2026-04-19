# AGENTS.md

## Repo overview
- Airport is an Electron + React + TypeScript desktop app for running multiple AI coding CLI sessions side by side.
- Main runtime layers:
  - `src/main/` — Electron main process, PTY/session lifecycle, backend orchestration, window/bootstrap logic.
  - `src/renderer/` — React UI, hooks, Zustand state, terminal/session views.
  - `src/shared/` — shared protocol, constants, and types used across main/renderer.
  - `src/preload/` — minimal preload target; keep it minimal unless a real preload need exists.
- Supporting areas:
  - `scripts/` — build, packaging, install, and hook setup automation.
  - `hooks/` — Claude hook scripts used by Airport status integration.
  - `macos/Airport/` — native Swift macOS wrapper around bundled app/runtime.
  - `windows/` — native Go/WebView2 Windows wrapper.
  - `docs/` — static site/install assets, not deep engineering docs.
  - `bin/` — CLI entrypoints for launching/spawning Airport sessions.
  - `homebrew/` — Homebrew cask packaging.
  - `.github/workflows/` — release automation.

## Where to make changes
- UI behavior, layout, session tiles, terminal interactions: work in `src/renderer/`.
- App lifecycle, PTY/session management, WebSocket/backend orchestration: work in `src/main/`.
- Shared contracts or constants used by multiple layers: update `src/shared/` first, then consumers.
- Preload changes are uncommon; prefer the existing main/backend + renderer flow unless preload is truly required.
- Hook installation or Claude integration logic: check `scripts/setup-hooks.mjs`, `hooks/`, and `bin/airport.js`.
- Platform packaging/wrapper changes:
  - macOS: `macos/Airport/`
  - Windows: `windows/`
  - release/build scripts: `scripts/`

## Commands
Run commands from the repository root.

```bash
npm install --legacy-peer-deps
npm start
npm run lint
npm run package
npm run make
npm run publish
npm run build:standalone
./scripts/build-native.sh
./scripts/build-windows.ps1
```

## Validation
- Install dependencies with `npm install --legacy-peer-deps`.
- Use `npm run lint` for code validation.
- Use `npm start` for local app verification.
- Use `npm run package` or `npm run make` when validating Electron packaging changes.
- Use `npm run build:standalone` when validating standalone backend/renderer output.
- Use `./scripts/build-native.sh` for macOS native packaging checks.
- Use `./scripts/build-windows.ps1` for Windows packaging checks.
- There is no dedicated test script in this repository. Do not invent one.

## Hook / Claude integration
- Hook setup is automatic:
  - `npm start` runs `prestart`, which executes `scripts/setup-hooks.mjs`.
  - `bin/airport.js` also runs the same setup so `npx`/CLI launches are covered.
- Hook setup is idempotent. It is safe to run repeatedly.
- Hook setup preserves non-Airport hook entries in `~/.claude/settings.json`.
- Hook setup manages Airport-owned hook entries for:
  - `UserPromptSubmit`
  - `PreToolUse`
  - `PostToolUse`
  - `Stop`
  - `Notification`
- Hook setup also updates Airport-managed blocks in `~/.claude/CLAUDE.md` rather than replacing unrelated content.
- Worktree compatibility exists in `scripts/setup-hooks.mjs`:
  - it can detect worktrees
  - it may symlink `node_modules` from the main repo when appropriate
- Dev-mode compatibility logic also exists there:
  - older branches may be patched so dev/prod instances can coexist cleanly
- Hooks are no-ops outside Airport. If the `AIRPORT` environment variable is absent, hook scripts exit silently.

## Release / platform notes
- This repo is not just an Electron app; it also contains native wrapper/distribution logic.
- Electron packaging paths use the standard npm scripts in `package.json`.
- Standalone build flow uses `npm run build:standalone`.
- macOS distribution relies on the native Swift wrapper plus `./scripts/build-native.sh`.
- Windows distribution relies on the Go/WebView2 wrapper plus `./scripts/build-windows.ps1`.
- Homebrew packaging metadata lives in `homebrew/`.
- Release automation lives in `.github/workflows/`.

## Docs alignment
- Keep documentation concise, practical, and command-oriented.
- Prefer updating `README.md` for user-facing build/install/run changes.
- Keep AGENTS guidance aligned with actual scripts and repository structure.
- Do not document commands, tests, or workflows that do not exist in the repo.

## Critical rules
- Use real repository commands and file paths only.
- Keep changes scoped to the relevant runtime layer (`src/main`, `src/renderer`, `src/shared`, minimal `src/preload`).
- Do not add heavy preload logic if the existing backend/WebSocket architecture already covers the use case.
- Do not remove or overwrite user-managed Claude hook entries.
- Treat `scripts/setup-hooks.mjs` as idempotent, compatibility-sensitive infrastructure.
- Validate with existing lint/build/package commands relevant to the files you changed.
- If you change packaging or platform wrappers, verify the corresponding platform build path as far as the environment allows.
