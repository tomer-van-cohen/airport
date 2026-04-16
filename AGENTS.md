# AGENTS.md

## Project overview

Airport is a desktop terminal multiplexer for AI coding CLIs. The main app is an Electron + React + TypeScript codebase, with separate native standalone hosts for macOS (`macos/Airport`, Swift) and Windows (`windows`, Go).

Architecture highlights verified in code:
- The renderer talks to the backend over a localhost WebSocket bridge (`src/main/ws-server.ts`, `src/renderer/index.tsx`, `src/preload/index.ts`).
- PTY creation, process inspection, session discovery, hook watching, and persistence live in the main process (`src/main/`).
- Renderer state is centralized in a Zustand store (`src/renderer/store/terminal-store.ts`).
- Claude integration is file-based: hook scripts live in `hooks/`, while `scripts/setup-hooks.mjs` installs hooks idempotently and manages Airport-owned blocks in `~/.claude/CLAUDE.md`.
- Releases are built from Git tags matching `v*` via `.github/workflows/release.yml`.

## Repository structure

- `src/main/` — Electron/main-process services: PTY lifecycle, WebSocket server, menu, hook watcher, persistence, app startup.
- `src/renderer/` — React UI, terminal views, onboarding, plan review UI, hooks, utilities, Zustand store.
- `src/shared/` — shared TypeScript contracts for sessions, workspaces, plans, and bridge APIs.
- `src/preload/` — intentionally minimal preload target; the real bridge is not exposed here.
- `scripts/` — hook setup plus native/standalone build scripts.
- `hooks/` — Airport busy/done hook scripts used by Claude Code integration.
- `windows/` — Go-based Windows host and updater logic.
- `macos/Airport/` — Swift package for the macOS standalone app and updater.
- `.github/workflows/` — release automation.
- `docs/` — install-site assets and screenshots.
- `homebrew/` — Homebrew cask assets.
- `bin/` — CLI helpers such as Airport spawn commands.

## Development guidelines and architecture notes

### Main app flow
- `src/main/index.ts` creates the Electron window, starts the WebSocket server, registers handlers, watches hooks, and saves state on close/quit.
- `src/main/ipc-handlers.ts` is the backend API surface for PTY actions, session info, plan files, terminal discovery, and state save/load.
- `src/main/state-manager.ts` persists session state to `session-state.json` inside `AIRPORT_DATA_DIR` or the platform default app-data location.

### Renderer flow
- `src/renderer/App.tsx` composes the shell UI, onboarding, plan review panel, workspace switching, and keyboard shortcuts.
- `src/renderer/hooks/usePtyBridge.ts` is the central renderer orchestration point for PTY events, hook events, session restoration, state saving, and git/CWD polling.
- `src/renderer/store/terminal-store.ts` holds the source of truth for sessions, plan view state, workspaces, and session actions.

### Bridge model
- Do not assume a rich preload API. `src/preload/index.ts` is intentionally empty except for the required build target comment.
- Renderer/backend communication is routed through the localhost WebSocket bridge and shared IPC channel/types definitions.

### Claude hooks and plan integration
- `scripts/setup-hooks.mjs` runs automatically through `npm start` via `prestart`.
- Hook installation is idempotent: it preserves non-Airport entries in `~/.claude/settings.json` and only inserts or updates Airport-managed hook entries.
- The same script manages marker-delimited Airport sections in `~/.claude/CLAUDE.md`, including Airport-specific agent spawning and plan review instructions.
- Hook events map to Airport busy/done status and plan-file associations consumed by the renderer.

### Native standalone builds
- `scripts/build-native.sh` builds the standalone macOS app: renderer, backend, bundled Node runtime, rebuilt `node-pty`, Swift shell, `.app`, tarball, and DMG.
- `scripts/build-windows.ps1` builds the standalone Windows distribution: renderer, backend, bundled Node runtime, rebuilt `node-pty`, Go shell, hooks/scripts, and zip archive.
- `windows/main.go` sets up environment variables, runs hook setup best-effort, starts the Node backend, and hosts the UI in WebView2.
- `macos/Airport/Sources/Updater.swift` checks GitHub releases for updates and performs in-place macOS app replacement.

## Code patterns and naming conventions

- Main-process modules generally use hyphenated filenames such as `pty-manager.ts`, `hook-watcher.ts`, and `state-manager.ts`.
- React components use PascalCase filenames such as `MainTerminal.tsx`, `PlanReviewPanel.tsx`, and `OnboardingScreen.tsx`.
- Shared contracts are defined explicitly in `src/shared/types.ts`; prefer extending shared types there instead of duplicating shapes across layers.
- Session/workspace state flows through the Zustand store; avoid bypassing store actions when changing renderer state.
- The repo favors practical, feature-oriented modules over deep abstraction layers.

## Validation guidance

This repository does **not** include a dedicated automated test suite.

Primary validation commands verified in `package.json`:

```bash
npm run lint
npm run start
npm run package
npm run make
npm run publish
npm run build:standalone
```

Notes:
- `npm run lint` runs ESLint across `.ts` and `.tsx` files.
- `npm run start` triggers `scripts/setup-hooks.mjs` first.
- `npm run build:standalone` builds the backend with `esbuild.backend.mjs` and the renderer with `vite.standalone.config.ts`.
- Native packaging commands also exist as direct scripts:
  - `./scripts/build-native.sh [arch]`
  - `./scripts/build-windows.ps1`
- Prefer lint plus the smallest relevant build path for the area you changed.

## Critical rules and constraints for agents

- Stay consistent with the existing split between `src/main`, `src/renderer`, and `src/shared`.
- Do not introduce preload-heavy communication patterns unless the architecture is intentionally being changed; current code expects the WebSocket bridge model.
- Preserve best-effort shutdown/state-save behavior in `src/main/index.ts`.
- Preserve idempotency in `scripts/setup-hooks.mjs`; do not replace unrelated user Claude hook config.
- When editing hook or plan behavior, verify both the script-managed `~/.claude/CLAUDE.md` blocks and the renderer consumers in `usePtyBridge.ts`.
- Keep native wrapper changes platform-specific unless the change truly belongs in shared JS/TS code.
- Do not add or reference test commands that do not exist.

## Common tasks

### Run the app for development
```bash
npm install --legacy-peer-deps
npm run start
```

### Lint the codebase
```bash
npm run lint
```

### Build the standalone app bundle used outside Electron Forge
```bash
npm run build:standalone
```

### Build native distributions
macOS:
```bash
./scripts/build-native.sh
```

Windows:
```powershell
./scripts/build-windows.ps1
```

### Update Claude hook integration
- Edit `hooks/` for hook behavior.
- Edit `scripts/setup-hooks.mjs` for installation logic or managed `~/.claude/CLAUDE.md` instructions.
- Keep setup safe to rerun.

## Reference examples

### Simple references
- `src/shared/types.ts` — shared contracts and `window.airport` API shape.
- `src/main/state-manager.ts` — minimal persistence layer.
- `src/preload/index.ts` — minimal preload convention.

### Central / complex references
- `src/main/index.ts` — main process lifecycle and save-on-quit behavior.
- `src/main/ipc-handlers.ts` — backend bridge surface.
- `src/renderer/hooks/usePtyBridge.ts` — renderer/backend/session orchestration.
- `src/renderer/store/terminal-store.ts` — renderer state model.
- `src/renderer/App.tsx` — top-level UI composition and shortcuts.

### Build and release references
- `scripts/build-native.sh` — macOS standalone packaging flow.
- `scripts/build-windows.ps1` — Windows standalone packaging flow.
- `.github/workflows/release.yml` — tag-driven macOS/Windows release pipeline.
- `windows/main.go` and `macos/Airport/Sources/Updater.swift` — native host/update behavior.

## Additional resources

- `README.md` — product overview, install flow, source build instructions, keyboard shortcuts, and Claude hook behavior.
- `.github/workflows/release.yml` — authoritative source for release trigger and packaged artifacts.
- `scripts/setup-hooks.mjs` — authoritative source for Claude hook installation, Airport CLAUDE.md managed blocks, and worktree/dev conveniences.
