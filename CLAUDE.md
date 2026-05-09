# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kunlungame ("昆仑谣") is a Windows desktop narrative game built with Electron 35 + Vue 3 + TypeScript 5. It tells the story of Kunlun mythology and Chinese civilization through an 8-node mainline driven by OpenAI-compatible APIs. The protagonist "昆仑子" is a gentle, dignified, and adorable girl who guides the player through Chinese cultural history.

## Commands

```bash
pnpm install              # install dependencies (pnpm 10, Node ≥ 20)
pnpm dev                  # start Electron desktop shell (runs electron-vite dev)
pnpm build                # build main process, preload, and renderer
pnpm typecheck            # tsc --noEmit + vue-tsc --noEmit (renderer tsconfig)
pnpm test                 # Vitest unit/integration tests (run once)
pnpm test:watch           # Vitest in watch mode
pnpm test -- path/to.test.ts   # run a single test file
pnpm test:e2e             # Playwright e2e tests (launches Vite dev server + Edge)
pnpm coverage             # coverage report (V8 provider)
pnpm knowledge:compile    # compile knowledge-base markdown → generated JSON
pnpm smoke:openai         # end-to-end smoke with OpenAI-compatible API (requires .env.local)
pnpm playthrough -- --pattern=alt --maxNodes=8   # full 8-node playthrough replay
pnpm dist:win             # production Windows NSIS installer
```

## Architecture

### Layered structure under `src/`

- **`src/modeling/`** — AI orchestration: prompt building, knowledge retrieval, dialogue orchestration, OpenAI-compatible adapter (`openAiCompatibleDialogueDependencies`), option labels. This is the "brain" of the game.
- **`src/renderer/`** — Vue 3 renderer: components, composables, adapters. `rendererDialogueDependencies.ts` adapts the modeling layer to the renderer via the desktop bridge. `desktopBridgeClient.ts` validates IPC responses with Zod schemas.
- **`src/presentation/`** — Pure-logic UI helpers: asset slot resolution, BGM controller, dialogue stream buffer, UI state machine. No Vue dependency.
- **`src/runtime/`** — Save/load system: runtime state schema (Zod), state facade for desktop serialization, save repository with optional encryption.
- **`src/content/`** — Story content: `source/mainlineOutline.ts` defines the 8-node story outline; `generated/` holds compiled knowledge entries JSON.
- **`src/shared/`** — Cross-boundary contracts: Zod schemas for IPC (`desktop.schemas.ts`), content types (`contentContracts.ts`), asset manifest types.

### Electron shell (`electron/`)

- **`electron/main/index.ts`** — Main process: registers IPC handlers (`desktop:*`), bootstraps BrowserWindow with context isolation + sandbox. Dev mode loads `.env.local` for API key preloading.
- **`electron/preload/index.ts`** — Preload: creates `DesktopBridge` via `contextBridge.exposeInMainWorld('kunlunDesktop', ...)`.

### IPC boundary pattern

All IPC goes through `desktop:*` channels. The preload exposes a typed `DesktopBridge` object. The renderer's `desktopBridgeClient.ts` validates every IPC response with Zod schemas before passing to consuming code.

### Dialogue flow

1. Renderer calls `desktop:stream-mainline-turn` via `DesktopBridge`
2. Main process's `runDesktopMainlineTurn` loads node + retrieves knowledge entries + builds prompt via `storyPromptBuilder`
3. Delegates to `openAiCompatibleDialogueDependencies` (HTTP streaming)
4. Text streams back chunk-by-chunk; options (align/challenge) generated alongside
5. Full result returned for save-state update

### Runtime state

`runtimeState.ts` defines the Zod-validated state schema including attitude score (-3 to +3), current node, turn index, read nodes, and settings (API keys). Saved to `%APPDATA%/kunlungame/runtime-state.json` with optional safeStorage encryption for API keys.

### Character design

昆仑子 is a gentle, dignified girl with a love for knowledge. She:
- Uses modern Chinese, not classical or archaic style
- Calls the player "您" with respectful affection
- Tries to be serious but occasionally reveals her adorable side
- Gets a bit nervous or shy at important moments
- Adjusts her tone based on the player's attitude (trust score)

## Key Conventions

- **Conventional Commits**: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `build:`
- **Language**: Code comments and commit messages are in Chinese; variable names in English
- **Zod schemas as single source of truth**: TS types are derived via `z.infer<>()` from Zod schemas, not hand-written
- **API-only model**: The game connects via OpenAI-compatible API only. No local model support.
- **Logs go to `logs/`**: playthroughs → `logs/playthroughs/`
- **`pnpm audit` requires `--registry=https://registry.npmjs.org/`** because the default npmmirror doesn't provide an audit endpoint

## Testing Notes

- Vitest runs in `node` environment with `happy-dom`; test files in `tests/` (excluding `tests/e2e/`)
- E2E tests use Playwright with Edge (`msedge` channel), launching a Vite dev server on port 4173
- Coverage targets: overall ≥ 80%, core modules ≥ 90%
