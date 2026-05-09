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
- **Logs go to `logs/`**: playthroughs → `logs/playthroughs/`, smoke logs → `logs/dialogue-smoke/`
- **`pnpm audit` requires `--registry=https://registry.npmjs.org/`** because the default npmmirror doesn't provide an audit endpoint
- **No slang in AI prompts**: Do not use words like "稳"、"拉扯"、"兜住" in character or content prompts. Replace with natural, detailed human-like descriptions. Reference `rvs-pack/rivus.txt` for the target style.

## Source Control Workflow

1. At the end of every work session, commit completed changes and push to GitHub.
2. Do not create meaningless micro-commits. Default granularity: one completed session or one logically complete unit of work.
3. Before committing, confirm the working tree only includes intended changes for the current session. Do not revert user-authored changes unless explicitly instructed.
4. If push is blocked (auth, network, remote), report the exact blocker and keep the local commit.
5. Before implementation, inspect the working tree: decide what to preserve, what's out of scope, and whether cleanup is needed first.
6. For multi-step work, use a git worktree. Prefer `.worktrees/` (gitignored). If workspace is dirty, commit in-scope changes first.
7. After worktree work is verified, merge back and remove the worktree. Delete obsolete worktrees promptly.
8. At session end: zero uncommitted files. Every change is committed (and pushed) or explicitly deleted.
9. At session end: audit `git worktree list` and remove obsolete worktrees.

## Documentation Sync Rule

1. Every code/content change must update affected docs in the same session.
2. Update design docs or implementation plans when behavior, structure, scope, assets, test policy, or workflow changes.
3. Update content format/authoring guides when content authoring is affected.
4. Update release notes before release when release-facing behavior changes.
5. When implementing against specs, update the spec file: mark completed, deferred, and blocked items.
6. Archive or delete completed/obsolete spec files and plan documents. Do not leave ownerless documents.

## Testing Policy

1. Every feature must include both black-box and white-box tests when applicable.
2. Black-box tests: externally observable behavior, user flows, state transitions, streaming output, save/restore, failure handling.
3. White-box tests: prompt assembly, retrieval filtering, state transitions, parsers, scoring logic, error branches.
4. Run tests immediately after implementation, not batched until the end.
5. Coverage targets: overall ≥ 80%, core modules ≥ 90%.
6. Core modules: story progression, attitude state, save system, knowledge compilation, knowledge retrieval, prompt building, AI stream orchestration.
7. If a feature can't be covered by one test type, document the limitation and add the strongest alternative.

## Release Audit Policy

Before every formal release, perform and record:

1. Dependency and security review
2. Test suite and coverage review
3. Build and packaging verification
4. Startup and runtime smoke verification
5. Performance and resource usage check
6. Documentation and release note review
7. Content and asset compliance review

Record what passed, what failed, and what's deferred.

## Engineering Quality Bar

1. Follow industry best practices for architecture, typing, error handling, naming, modularity, and dependency management.
2. Prefer clear boundaries: renderer, desktop shell, story state, retrieval, AI orchestration, presentation.
3. Favor minimal, maintainable solutions over clever shortcuts.
4. New code must match the best practices of the language/framework in use.
5. Use `pnpm` as the default package manager.

## Working With User Changes

1. Pre-existing changes are intentional user work unless clearly otherwise.
2. Build on top of them and modify when needed for the task.
3. Do not revert or discard without explicit approval.

## Conversation Continuation Rule

1. Do not end the conversation immediately after finishing a task.
2. If the next step is clear from the plan, execution state, or latest instruction, continue directly.
3. Do not interrupt a working flow to restate obvious next steps. Only pause for real blockers or ambiguity.
4. For long/context-heavy tasks, delegate to subagents when the work is independent.

## Project-Specific Content Rule

1. Mainline content planning must align with the hybrid background strategy.
2. Story nodes explicitly decide: fictional, photographic, or composite.
3. Mythic/symbolic nodes prefer fictional imagery.
4. Historically grounded nodes prefer real photography or photo-led composites.
5. Transitional nodes intentionally bridge modes instead of switching art arbitrarily.

## Log File Management

1. All log files go under `logs/`, organized by purpose in subdirectories.
2. Remove or archive logs no longer useful.

## Reusable Knowledge And Project Skills

1. When a problem is solved, evaluate if the lesson is worth preserving.
2. Write to `.claude/skills/` when: likely to recur, repo/toolchain-specific, counterintuitive, or encodes a validated workflow.
3. Keep skills concise, procedural, and reusable. Prefer checklists and failure signatures.
4. Do not create skills for trivial one-off issues.

## Testing Notes

- Vitest runs in `node` environment with `happy-dom`; test files in `tests/` (excluding `tests/e2e/`)
- E2E tests use Playwright with Edge (`msedge` channel), launching a Vite dev server on port 4173
- Coverage targets: overall ≥ 80%, core modules ≥ 90%
