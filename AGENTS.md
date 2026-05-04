# AGENTS.md

Guidance for AI agents working in this repository.

## Scope

Applies to the whole repo unless a deeper `AGENTS.md` overrides it.

## Project overview

Airport is a desktop terminal multiplexer for AI coding CLIs.

This repository includes:

- Electron + TypeScript application code in `src/`
- React renderer UI in `src/renderer/`
- Electron main-process/backend code in `src/main/`
- shared TypeScript contracts in `src/shared/`
- macOS native wrapper code in `macos/Airport/`
- Windows native launcher code in `windows/`
- setup/build/release scripts in `scripts/`
- Claude hook scripts in `hooks/`
- CLI helpers in `bin/`
- static site/docs in `docs/`
- release automation in `.github/workflows/release.yml`

Key technologies in use:

- TypeScript
- React 19
- Zustand
- Electron / Electron Forge
- Vite and esbuild
- node-pty
- WebSocket (`ws`)
- xterm
- Swift Package Manager
- Go 1.22
- WebView2
- ESLint

## Core architecture

### Runtime split

- `src/main/`: Electron main process, PTY lifecycle, IPC handlers, hook watching, session discovery, persistence
- `src/renderer/`: React UI, components, hooks, Zustand store, terminal rendering, plan review UI
- `src/shared/`: shared types and IPC contracts used across layers
- `src/preload/`: preload entrypoint for renderer bridge

### Native/platform wrappers

- `macos/Airport/`: Swift wrapper app that packages and launches Airport on macOS
- `windows/`: Go + WebView2 launcher for standalone Windows builds

### Agent-relevant behavior

Airport is tightly integrated with Claude workflow support:

- installs Claude hooks via `scripts/setup-hooks.mjs`
- uses the `AIRPORT` environment variable to detect when commands run inside Airport
- exposes `airport-spawn` helpers for opening parallel sessions
- surfaces plan files from `~/.claude/plans/`
- tracks hook status and plan review state through status files and `.plan` sidecar files

If your task touches hooks, spawning, plan review, session state, or Claude integration, read these files first:

- `scripts/setup-hooks.mjs`
- `hooks/airport-busy.sh`
- `hooks/airport-done.sh`
- `src/main/ipc-handlers.ts`
- `src/main/index.ts`
- `src/renderer/hooks/usePtyBridge.ts`
- `src/shared/types.ts`

## Repository structure

Top-level directories of interest:

- `src/main/` — Electron backend and app lifecycle
- `src/preload/` — preload bridge entrypoint
- `src/renderer/` — React components, hooks, state, renderer helpers
- `src/shared/` — shared types and IPC contracts
- `scripts/` — packaging, setup, and build automation
- `hooks/` — Claude hook scripts for busy/done status
- `bin/` — CLI launch/spawn helpers
- `macos/Airport/` — Swift package for the macOS app wrapper
- `windows/` — Go launcher for Windows
- `docs/` — static docs/install site
- `.github/workflows/` — CI and release automation
- `homebrew/` — cask metadata only; do not treat it as canonical release truth

## Source conventions

### Naming and organization

- React components use PascalCase filenames.
- Runtime/service/helper modules use kebab-case filenames.
- Shared contracts live in `src/shared/`.
- Renderer logic is split into `components/`, `hooks/`, `lib/`, and `store/`.

### TypeScript conventions

- Keep types explicit and aligned with `src/shared/types.ts`.
- Prefer updating shared contracts first when changing cross-layer behavior.
- Avoid duplicating IPC or payload shapes independently in renderer and main code.

### State and messaging

Main/renderer communication is contract-driven. Session data, hook status, spawn requests, plan files, and terminal lifecycle are coordinated across:

- `src/main/ipc-handlers.ts`
- `src/main/ws-server.ts`
- `src/main/hook-watcher.ts`
- `src/renderer/hooks/usePtyBridge.ts`
- `src/renderer/store/terminal-store.ts`
- `src/shared/*`

When changing session behavior, verify both main and renderer assumptions.

## Commands

Use repo-defined commands where possible.

### Install dependencies

```bash
npm install --legacy-peer-deps
```

### Start in dev mode

```bash
npm start
```

Notes:

- `npm start` runs `scripts/setup-hooks.mjs` first via `prestart`.
- That setup is idempotent and may modify `~/.claude/settings.json` and `~/.claude/CLAUDE.md`.
- The setup script also contains worktree support and dev-instance patching logic.

### Lint

```bash
npm run lint
```

### Electron packaging commands

```bash
npm run package
npm run make
npm run publish
```

### Standalone build

```bash
npm run build:standalone
```

### Native packaging

macOS:

```bash
./scripts/build-native.sh
```

Windows:

```powershell
./scripts/build-windows.ps1
```

## Version and tooling rules

Prefer repository automation over README wording when documenting exact build automation.

- `README.md` says source builds require Node `20+`.
- `.nvmrc` contains `20`.
- release automation uses Node `22`.
- native build scripts pin Node `22.14.0`.
- Windows release builds also use Go `1.22`.
- `macos/Airport/Package.swift` declares `swift-tools-version: 5.9` and `.macOS(.v13)`.

When updating build, release, or packaging guidance, use the scripts and workflow files as the source of truth.

## Platform-specific notes

### macOS

`./scripts/build-native.sh`:

- builds the standalone renderer with Vite
- builds the backend with `node esbuild.backend.mjs`
- downloads Node `22.14.0`
- rebuilds `node-pty`
- builds the Swift app in `macos/Airport`
- assembles `dist/Airport.app`
- creates:
  - `dist/Airport-<arch>.tar.gz`
  - `dist/Airport-<arch>.dmg`

### Windows

`./scripts/build-windows.ps1`:

- builds renderer and backend
- downloads Node `22.14.0`
- downloads Node headers
- rebuilds `node-pty`
- builds the Go launcher in `windows/`
- assembles `dist/Airport/`
- creates `dist/Airport-x64.zip`

Do not document Homebrew metadata as canonical version truth; `package.json`, scripts, and workflow automation are more authoritative.

## Hooks and Claude integration

Airport installs hooks for these Claude events:

- `UserPromptSubmit`
- `PreToolUse`
- `PostToolUse`
- `Stop`
- `Notification`

Busy hooks and done hooks are chosen by platform:

- Unix-like: `hooks/airport-busy.sh`, `hooks/airport-done.sh`
- Windows: `hooks/airport-busy.js`, `hooks/airport-done.js`

Important behavior:

- Hooks are no-ops unless `AIRPORT` is set.
- Hook scripts also require `AIRPORT_STATUS_FILE`.
- Hook scripts write status to `AIRPORT_STATUS_FILE`.
- Plan file paths are written to `${AIRPORT_STATUS_FILE%.status}.plan`.
- The main process exposes plan file discovery and reads from `~/.claude/plans/`.
- `scripts/setup-hooks.mjs` preserves non-Airport hook entries and updates only Airport-managed blocks.

If you change hook behavior, verify compatibility with:

- `scripts/setup-hooks.mjs`
- `src/main/hook-watcher.ts`
- `src/main/ipc-handlers.ts`
- renderer status/plan handling

## Airport-specific agent workflow

These instructions matter only when running inside Airport.

### Respect `AIRPORT`

Only apply Airport-specific spawning and plan-review behavior when the `AIRPORT` environment variable is set.

If `AIRPORT` is not set, ignore Airport-only workflow instructions.

### Spawning parallel agents

Use spawned sessions only when explicitly asked to parallelize work.

Do not spawn agents on your own initiative just because there are multiple tasks.

The setup script injects guidance into `~/.claude/CLAUDE.md` showing this pattern:

```bash
git worktree add .claude/worktrees/<branch-name> -b <branch-name>
airport-spawn \
  --cwd "$(pwd)/.claude/worktrees/<branch-name>" \
  --command "claude --dangerously-skip-permissions '<task prompt>. Create a plan first and wait for my approval before implementing.'"
```

Agent rules inferred from repo automation:

- Prefer a dedicated git worktree per spawned session.
- Pass the full prompt as a normal Claude argument, not `-p`.
- Do not rely on `--title`; Airport can infer repo/branch display from worktree context.
- Only use this flow when the user explicitly requests spawning or parallel execution.
- `bin/airport-spawn` supports `--title`, but the managed Airport guidance explicitly says not to rely on it.

### Plan review integration

When running inside Airport and you create or update a Claude plan, notify Airport by writing the latest plan path:

```bash
echo "$(ls -t ~/.claude/plans/*.md 2>/dev/null | head -1)" > "${AIRPORT_STATUS_FILE%.status}.plan"
```

Do this after plan creation or update so Airport can show the review UI.

## Development guidelines

### When editing app behavior

Check whether the change also requires updates in:

- shared types
- IPC channels
- main-process handlers
- renderer hooks/store logic
- hook watcher behavior
- platform packaging scripts

### When editing build or release logic

Validate against:

- `package.json` scripts
- the native build scripts
- `.github/workflows/release.yml`
- native wrapper entrypoints if packaging layout changes

Prefer the scripted automation over README prose if they conflict.

### When editing hooks or Claude integration

Preserve these expectations unless intentionally changing product behavior:

- no-op outside Airport
- idempotent hook installation
- preservation of non-Airport Claude hook entries
- plan review integration via `.plan` files
- worktree-friendly behavior
- best-effort setup on app start

## Quality standards

There is no dedicated automated test suite visible in this repo. Validation is primarily lint/build/manual-run oriented.

Minimum validation should usually include the most relevant of:

```bash
npm run lint
npm start
npm run build:standalone
```

For packaging-related work, validate with the platform-specific build script when feasible.

## Reference examples

Simple reference files:

- `src/shared/types.ts` — concise shared contract file
- `src/preload/index.ts` — minimal preload target
- `esbuild.backend.mjs` — small backend build config
- `bin/airport-spawn.js` — simple spawn helper

Complex reference files:

- `src/main/index.ts` — app bootstrap, single-instance lock, dev/prod instance naming, state-save on quit
- `src/main/ipc-handlers.ts` — IPC surface, PTY control, session info discovery, plan file access
- `src/renderer/App.tsx` — main UI composition and shortcuts
- `src/renderer/hooks/usePtyBridge.ts` — renderer bridge between PTY events, hooks, heuristics, persistence
- `scripts/setup-hooks.mjs` — idempotent user-environment setup, CLAUDE.md block management, worktree/dev patching

Cross-platform and packaging references:

- `scripts/build-native.sh`
- `scripts/build-windows.ps1`
- `macos/Airport/Package.swift`
- `windows/main.go`
- `.github/workflows/release.yml`
- `docs/index.html`

## Critical rules

- Do not assume this is a pure web app; it is a desktop app plus native wrappers and release tooling.
- Do not treat `homebrew/airport.rb` as canonical release truth.
- Do not overwrite user Claude configuration wholesale.
- Preserve shared contract alignment across `src/main`, `src/renderer`, and `src/shared`.
- Preserve cross-platform behavior when touching hooks, spawn helpers, packaging code, or path handling.
- Keep Airport-only workflow guidance gated on the `AIRPORT` environment variable.

## Additional resources

- `README.md` — user-facing install/build/shortcut overview
- `docs/index.html` — product-facing static site content
- `.github/workflows/release.yml` — authoritative release artifact flow
