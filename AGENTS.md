# AGENTS.md

## Purpose
- Airport is an Electron + Vite + TypeScript desktop app for running multiple AI coding CLI sessions side-by-side.
- The codebase is split by runtime boundary: Electron/main-process backend, preload bridge, renderer UI, and shared contracts.
- Start with the files that define those boundaries before changing behavior across layers.

## Where to Start
- `package.json` — canonical scripts, runtime dependencies, packaging entrypoints, and the fact that validation is mostly lint/build based.
- `src/main/index.ts` — Electron app lifecycle, single-instance behavior, WebSocket startup, IPC registration, and hook watcher startup.
- `src/renderer/App.tsx` — top-level UI composition, onboarding flow, workspace/session shortcuts, and plan review entry points.
- `src/renderer/hooks/usePtyBridge.ts` — renderer orchestration layer that connects preload APIs, PTY events, hook status, saved state, and session metadata.
- `src/main/ipc-handlers.ts` — main-process request/response surface for PTY actions, cwd/git discovery, terminal adoption, plan files, and persisted state.
- `src/shared/types.ts` — shared session/workspace/plan/state contracts used across main, preload, and renderer.

## Runtime Boundaries
- `src/main/`
  - Owns PTY/session lifecycle, IPC handlers, state persistence, Electron window lifecycle, and hook/spawn watching.
  - If a change touches process management, filesystem watching, git/cwd detection, or shutdown/save sequencing, start here.
- `src/preload.ts` and `src/preload/`
  - Exposes the safe renderer-facing bridge on `window.airport`.
  - Keep renderer/main communication going through shared IPC/contracts rather than ad hoc globals.
- `src/renderer/`
  - Owns React UI, keyboard shortcuts, layout/workspace UX, terminal rendering, and Zustand-driven client state.
  - `usePtyBridge.ts` is the key integration point; many cross-cutting UI bugs are best understood there first.
- `src/shared/`
  - Holds the canonical types and IPC channel definitions. Update shared contracts here before wiring both sides.

## Important Repo-Specific Flows
- Claude integration is file-driven, not API-driven.
  - `hooks/airport-busy.*` and `hooks/airport-done.*` write `.status` sidecar files.
  - `bin/airport-spawn` writes `.spawn` request files.
  - `src/main/hook-watcher.ts` consumes `.status`, `.plan`, and `.spawn` files and rebroadcasts events into the app.
- Session metadata is derived dynamically.
  - `src/main/ipc-handlers.ts` walks the PTY process tree to resolve the deepest foreground cwd, then uses `git -C` to infer repo and branch without spawning in protected directories.
- Renderer state is reconstructed from backend + shadow terminals.
  - `usePtyBridge.ts` maintains hook-derived state, waiting/question detection, process polling, cwd/git/title updates, and save/restore behavior.
- There are two packaging modes.
  - Electron Forge app flow: `npm start`, `npm run package`, `npm run make`.
  - Standalone/native flow: `npm run build:standalone`, `scripts/build-native.sh`, and `scripts/build-windows.ps1`.

## Validation and Build Guidance
- Install dependencies with `npm install --legacy-peer-deps`.
  - This is how the README and release workflow install successfully.
- Prefer these validations:
  - `npm run lint` — primary static validation configured in the repo.
  - `npm run build:standalone` — useful when touching standalone backend/renderer packaging.
  - `npm start` — relevant for Electron app/runtime changes, but it also runs hook setup first.
- There is no dedicated automated test suite in this repo. Do not assume Jest/Vitest/Playwright coverage exists.
- If you change packaging/release code, inspect `.github/workflows/release.yml` and the platform scripts rather than relying only on `package.json` script names.

## Build and Runtime Caveats
- `scripts/setup-hooks.mjs` does more than install hooks.
  - It updates `~/.claude/settings.json`, manages Airport blocks in `~/.claude/CLAUDE.md`, supports git worktrees by symlinking `node_modules`, and patches older branches for dev/prod userData separation.
  - Be careful when changing startup/setup behavior because `npm start` and the CLI launcher depend on it.
- `bin/airport.js` performs first-run native-module recovery for `node-pty` and runs hook setup before launching Electron.
- `forge.config.ts` sets Electron fuses and modifies the dev app bundle display name/identifier in `preStart`; packaging/security changes should preserve those hardening choices.
- `scripts/build-native.sh` and `scripts/build-windows.ps1` pin Node `22.14.0` for standalone distributions even though the README only says Node 20+ for source builds.
- `esbuild.backend.mjs` currently bundles `src/main/server.ts` for standalone mode targeting Node 20 and externalizes `node-pty` and websocket native helpers.

## High-Value Reference Files
- `src/main/index.ts` — Electron lifecycle and app bootstrap.
- `src/main/server.ts` — standalone HTTP/WebSocket backend, static serving, shutdown token flow, and path traversal protection.
- `src/main/ipc-handlers.ts` — deepest backend integration layer.
- `src/main/hook-watcher.ts` — status/plan/spawn file watcher behavior.
- `src/renderer/hooks/usePtyBridge.ts` — renderer orchestration and session state synchronization.
- `src/renderer/store/terminal-store.ts` — Zustand state shape and mutations.
- `scripts/setup-hooks.mjs` — operational startup behavior and worktree support.
- `scripts/build-native.sh` / `scripts/build-windows.ps1` — native distribution assembly.
- `.github/workflows/release.yml` — what CI actually builds and publishes.

## Change Tips for Future Agents
- When a change crosses main/preload/renderer boundaries, update shared types/contracts first, then wire preload exposure, then backend and renderer behavior.
- For session-title, waiting-state, plan-review, or Claude-status bugs, inspect `usePtyBridge.ts`, `hook-watcher.ts`, and the hook scripts together.
- For standalone-only issues, compare `src/main/index.ts` against `src/main/server.ts` and follow the standalone bundling path through `esbuild.backend.mjs` and `vite.standalone.config.ts`.
- For launch/setup issues in worktrees or `npx` usage, inspect `bin/airport.js` and `scripts/setup-hooks.mjs` before making narrower fixes.
