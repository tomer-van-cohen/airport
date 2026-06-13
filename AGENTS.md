# AGENTS.md

## Overview

Airport is a mixed desktop-app repository, not just a React UI. The main product is an Electron app for running multiple AI coding terminal sessions side by side, with live Claude hook status and plan awareness. The repo also contains Claude hook automation, standalone native packaging for macOS and Windows, install/docs assets, and release automation.

This file is for coding agents working inside this repository. Favor operational guidance over product summary.

## Repository Structure

### Primary app paths
- `src/main/` — Electron main-process code, PTY/session orchestration, IPC registration, hook watching, persistence, backend runtime behavior.
- `src/renderer/` — React 19 UI, Zustand-driven state, xterm integration, workspace/session UX.
- `src/shared/` — shared TypeScript contracts used across layers; this is the source of truth for cross-process payloads.
- `src/preload/` — intentionally minimal preload target.

### Claude/Airport integration paths
- `hooks/` — shell/JS hook scripts invoked by Claude Code events.
- `scripts/setup-hooks.mjs` — installs and updates Claude hook config and Airport-managed `~/.claude/CLAUDE.md` blocks; also contains worktree/dev-environment mutation logic.
- `bin/airport-spawn` and `bin/airport.js` — CLI entrypoints/helpers.

### Packaging and platform-specific paths
- `.github/workflows/release.yml` — tagged release pipeline for macOS and Windows artifacts.
- `scripts/build-native.sh` — standalone macOS packaging path.
- `scripts/build-windows.ps1` — standalone Windows packaging path.
- `macos/Airport/` — native Swift wrapper for the standalone macOS app.
- `windows/` — Go/WebView2 wrapper for the standalone Windows app.

### Docs and site assets
- `README.md` — concise user/developer setup notes.
- `docs/` — install/landing page assets, not the source of runtime behavior.

## Working Rules

- Use `npm install --legacy-peer-deps` before linting or build work. Both the README and release workflow use that install mode.
- Treat `src/shared/types.ts` as the canonical contract file before changing event payloads, persisted state, or session/workspace models.
- Preserve the separation between Electron app code (`src/**`) and standalone native wrapper code (`macos/**`, `windows/**`). A UI/runtime fix usually belongs in `src/**`; packaging-shell changes belong in the native wrapper paths or build scripts.
- Keep preload changes minimal unless a task explicitly requires widening the Electron boundary.
- When changing hook- or plan-related behavior, inspect both the producer side (`hooks/`, `scripts/setup-hooks.mjs`, `bin/airport-spawn`) and the consumer side (`src/main/hook-watcher.ts`, renderer store/hooks/components).

## Validation

- There is no dedicated automated test suite in this repo and no `test` script in `package.json`.
- `npm run lint` is the primary routine validation command.
- Additional validation may use targeted builds when relevant:
  - `npm run build:standalone` for the standalone backend/renderer bundle path.
  - packaging commands such as `npm run package`, `npm run make`, `./scripts/build-native.sh`, or `./scripts/build-windows.ps1` only when the task specifically touches those flows.
- Do not claim test coverage from nonexistent suites; call out lint/build validation honestly.

## Critical Side Effects and Pitfalls

### `npm start` is not side-effect free
`npm start` runs `prestart`, which executes `node scripts/setup-hooks.mjs` first. That script is intentionally idempotent, but it still mutates developer state. It can:
- modify `~/.claude/settings.json` to install/update Airport Claude hooks,
- add or update Airport-managed blocks inside `~/.claude/CLAUDE.md`,
- symlink `node_modules` in a git worktree to the main repo's `node_modules`,
- patch `src/main/index.ts` on older branches to enforce dev/prod user-data separation.

Because of those side effects, do **not** use `npm start` as a casual verification command unless the task specifically requires exercising the interactive Electron app startup path.

### Hook/plan behavior is file-based
Airport's Claude integration is driven by files, not only by in-memory events:
- session status files: `.status`
- plan pointer files: `.plan`
- spawn request files: `.spawn`
- Claude plan documents: `~/.claude/plans/*.md`

`src/main/hook-watcher.ts` watches those files and rebroadcasts typed events into the app. If hook UI seems wrong, debug the file producer and the watcher together.

### Electron path vs standalone wrapper path
Do not mix these paths conceptually:
- **Electron app path:** `src/main`, `src/renderer`, `src/shared`, `src/preload`, plus forge/vite config. This is the core product runtime used during normal app development.
- **Standalone native wrapper path:** `macos/Airport`, `windows/`, and OS-specific build scripts. These wrap/bundle the app for platform-native distribution and should only be touched when the issue is packaging, install/runtime shell integration, or platform-specific distribution behavior.

## Architecture and Code Patterns

### Shared contracts first
`src/shared/types.ts` defines the cross-layer shapes for:
- workspaces and terminal sessions,
- persisted state (`SavedState`, `SavedSession`),
- PTY events,
- hook status/plan events,
- spawn request payloads,
- the renderer-facing `AirportApi`.

When you add fields or rename payloads, update all producers and consumers together.

### Main-process orchestration pattern
The main process owns long-lived runtime concerns: PTY/session management, filesystem-backed hook watching, transport/IPC bridging, and save/load behavior. `src/main/hook-watcher.ts` is a key integration point for Claude status, plan review, and spawned sessions.

### Renderer pattern
The renderer is a React + Zustand application with integration-heavy hooks and store logic rather than a feature-folder architecture. For behavior changes, expect coordination between:
- components in `src/renderer/components/`,
- integration hooks in `src/renderer/hooks/`,
- transport/helpers in `src/renderer/lib/`,
- state transitions in `src/renderer/store/`.

### File-driven Claude integration pattern
Claude hooks write status or completion messages and plan/spawn sidecar files; Airport watches them and translates them into app events. This means fixes often span shell scripts, watcher logic, shared types, and renderer presentation.

## Common Tasks

### Change session/workspace metadata
1. Update `src/shared/types.ts` first.
2. Update the main-process producer or persistence layer.
3. Update renderer store mutations/selectors.
4. Update UI components that read the changed fields.
5. Run `npm run lint`.

### Change Claude hook status or plan handling
1. Inspect `hooks/` and `scripts/setup-hooks.mjs` for producer behavior.
2. Inspect `src/main/hook-watcher.ts` for file ingestion and rebroadcast.
3. Inspect renderer hook/store/components for display and state propagation.
4. Validate with lint; only run interactive flows if the task truly needs end-to-end confirmation.

### Change spawn/session creation behavior
1. Check `bin/airport-spawn` and any `.spawn` request assumptions.
2. Check `src/main/hook-watcher.ts` spawn forwarding.
3. Check renderer session creation logic and PTY bridge/store integration.

### Change packaging or release behavior
1. Decide whether the change is Electron-forge packaging or standalone native packaging.
2. For release automation, inspect `.github/workflows/release.yml`.
3. For macOS standalone packaging, inspect `scripts/build-native.sh` and `macos/Airport/`.
4. For Windows standalone packaging, inspect `scripts/build-windows.ps1` and `windows/`.

## Reference Files

Use these as starting points instead of searching blindly:
- `package.json` — scripts and validation entry points.
- `README.md` — install/build expectations and hook behavior notes.
- `scripts/setup-hooks.mjs` — high-impact side effects and Claude integration setup.
- `src/shared/types.ts` — cross-layer contracts.
- `src/main/hook-watcher.ts` — status/plan/spawn file watcher.
- `src/main/ipc-handlers.ts` — central IPC hub for PTY/session/state interactions.
- `src/renderer/hooks/usePtyBridge.ts` — renderer integration layer with backend/session behavior.
- `src/renderer/store/terminal-store.ts` — session/workspace/backlog state model.
- `.github/workflows/release.yml` — canonical CI release build steps.

## Agent Notes

- Prefer narrow, factual documentation and code changes over broad repo rewrites.
- If a task only touches Electron runtime behavior, avoid incidental edits to native wrapper code.
- If a task only touches docs/site assets, do not infer product behavior from `docs/` when the source code disagrees.
- Be explicit in reports about whether validation was lint-only, because that is the normal baseline in this repo.
