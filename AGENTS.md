# AGENTS.md

Practical guide for AI agents working in this repository.

## Repo Summary

Airport is a desktop app for running multiple AI coding CLI sessions side-by-side.

This repo is a mixed product/codebase with:
- Electron + React + TypeScript app code under `src/`
- Native app wrappers for macOS (`macos/Airport/`) and Windows (`windows/`)
- Packaging and setup scripts under `scripts/`
- Claude Code hook integration under `hooks/`
- CLI entrypoints under `bin/`
- Static marketing/install site under `docs/`
- Release automation under `.github/workflows/`

## Primary Structure

- `src/main/` — Electron main process: app lifecycle, PTY/session management, WebSocket bridge, hooks, persistence
- `src/renderer/` — React UI, hooks, Zustand store, terminal views, plan review UI
- `src/shared/` — shared contracts for session data, API surface, IPC/channel constants
- `src/preload/` — intentionally minimal preload target kept for build compatibility
- `scripts/` — local setup and native packaging scripts
- `hooks/` — Claude Code busy/done hooks used for Airport session status
- `bin/` — CLI launchers and session spawn helpers
- `macos/Airport/` — native Swift wrapper for the macOS app bundle
- `windows/` — native Go wrapper for the Windows app
- `docs/` — hosted static landing/install page
- `homebrew/` — Homebrew cask metadata
- `.github/workflows/release.yml` — tagged release pipeline

## How the App Is Wired

- Main process code creates the app window, manages PTY sessions, starts the local WebSocket server, and coordinates shutdown/state save.
- Renderer code connects to that local WebSocket bridge and assigns `window.airport` after connection. The preload layer is intentionally empty.
- Shared types in `src/shared/types.ts` define the public contract between the UI and runtime.
- Claude hook scripts in `hooks/` write status/plan signals so Airport can show live session state.
- Spawn helpers in `bin/airport-spawn*` request a new Airport tab by writing `.spawn` files into the runtime spawn directory.

## Key Commands

Use the repo scripts from `package.json`:

```bash
npm install --legacy-peer-deps
npm run lint
npm start
npm run package
npm run make
npm run publish
npm run build:standalone
```

## Environment and Tooling Facts

- `.nvmrc` is `20`
- README says local builds require Node 20+
- Native packaging scripts pin Node `22.14.0` for standalone/native distribution builds
- Release workflow uses Node `22`
- Windows release build also requires Go `1.22`
- macOS native wrapper uses Swift Package Manager and targets macOS 13+

If you touch packaging/release behavior, validate against both `README.md` and the scripts in `scripts/` / `.github/workflows/` instead of assuming one Node version applies everywhere.

## Validation Expectations

There is no dedicated automated test suite in this repo.

Primary validation is:
- `npm run lint`
- relevant build/package script for the area you changed

Examples:
- UI/main-process TypeScript changes: `npm run lint`
- Electron packaging changes: `npm run package` or `npm run make`
- Standalone bundle changes: `npm run build:standalone`
- Native distribution changes: `./scripts/build-native.sh` on macOS or `./scripts/build-windows.ps1` on Windows

Do not claim tests were run unless you actually ran them.

## Repo Conventions

- Most TypeScript module filenames use kebab-case
- React component filenames use PascalCase
- Shared cross-process constants/types live in `src/shared/`
- Comments are sparse; add them only when explaining non-obvious behavior
- Keep platform-specific logic near the affected code instead of abstracting it too early

## Agent Guidance

### When editing app code

- Check whether the change belongs in `src/main/`, `src/renderer/`, or `src/shared/` before editing.
- Keep the `window.airport` contract aligned with `src/shared/types.ts`.
- Do not add preload-driven APIs unless the architecture actually requires it; this repo currently uses a WebSocket bridge from the renderer.

### When editing hook or spawn behavior

- Read `scripts/setup-hooks.mjs` and the relevant files in `hooks/` / `bin/` first.
- Preserve no-op behavior outside Airport where applicable.
- Be careful with user files under `~/.claude/`; setup is designed to be idempotent and preserve non-Airport entries.

### When editing packaging/release code

- Check both platform wrappers if the change affects distribution structure.
- Keep copied runtime assets in sync with what the native build scripts assemble.
- Verify release assumptions against `.github/workflows/release.yml`.
- Releases are triggered by pushing tags matching `v*`.

### When editing docs

- Keep tone concise and practical.
- `README.md` is user-facing.
- `AGENTS.md` should stay focused on repository-specific guidance for coding agents.
- `docs/index.html` is a product/marketing page, not internal engineering documentation.

## Important Files

- `README.md` — user-facing install/build instructions and hook behavior
- `package.json` — source of truth for npm scripts
- `forge.config.ts` — Electron Forge packaging config
- `scripts/build-native.sh` — macOS native packaging pipeline
- `scripts/build-windows.ps1` — Windows packaging pipeline
- `scripts/setup-hooks.mjs` — hook installation and Claude integration setup
- `.github/workflows/release.yml` — tagged release automation
- `src/main/index.ts` — app entry/lifecycle composition
- `src/renderer/index.tsx` — renderer bootstrap and WebSocket bridge init
- `src/preload/index.ts` — placeholder preload target explanation
- `src/shared/types.ts` and `src/shared/ipc-channels.ts` — shared app contract

## Change Checklist

Before finishing a task:
- confirm the file belongs in the right layer
- update shared types if the public bridge/API changed
- run the smallest meaningful validation available
- keep docs and commands factual
- avoid inventing test coverage or release behavior
