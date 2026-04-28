# Model API Performance Dialogue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add OpenAI-compatible API-key model support as the default path while improving dialogue continuity, persona, options, and local runtime performance diagnostics.

**Architecture:** Runtime settings become the provider source of truth. `runMainlineTurn` chooses a remote OpenAI-compatible dependency when API settings are configured, otherwise falls back to existing local GGUF dependencies. Prompt construction owns persona, continuity, and single-player address rules; adapters only stream text.

**Tech Stack:** Electron, Vue 3, TypeScript, Zod, Vitest, node-llama-cpp, native `fetch` streaming.

---

## File Map

- Modify `src/runtime/runtimeState.ts`: settings schema for provider/API fields and defaults.
- Modify `src/runtime/runtimeStateFacade.ts`, `src/shared/types/desktop.ts`, `src/shared/types/desktop.schemas.ts`: IPC/runtime shape sync.
- Create `src/modeling/openAiCompatibleDialogueDependencies.ts`: OpenAI-format streaming adapter.
- Modify `src/modeling/mainlineTurnRunner.ts`: choose remote vs local dependency and preserve context.
- Modify `src/modeling/storyPromptBuilder.ts`: persona `昆仑子`, single-player wording, compressed prior reply context.
- Modify `src/modeling/optionLabels.ts` and `src/renderer/adapters/rendererDialogueDependencies.ts`: natural align/challenge labels.
- Modify `src/modeling/realLlamaSession.ts`: quiet logger, GPU/device diagnostics, performance-minded context/options.
- Modify `src/renderer/components/SettingsModelSection.vue`, `SettingsPanel.vue`, `SettingsPanel.types.ts`, `src/renderer/App.vue`: API-key settings UI and local fallback guidance.
- Update docs: `docs/model-runtime.md`, `docs/runtime-state.md`.

## Tasks

### Task 1: Runtime Settings Contract

- [x] Add failing tests in `tests/runtimeState.test.ts`, `tests/runtimeStateFacade.test.ts`, and `tests/desktopBridgeClient.test.ts` for provider defaults and API fields.
- [x] Implement `modelProvider`, `openAiCompatible`, and local fallback settings in runtime and desktop schemas.
- [x] Run the targeted tests until green.

### Task 2: Prompt And Option Quality

- [x] Add failing tests in `tests/storyPromptBuilder.test.ts` and `tests/optionLabels.test.ts` for `昆仑子`, no `你们`, prior-reply continuity, and align/challenge tone.
- [x] Update prompt rules, continuity sections, and label pools.
- [x] Update mock node-specific labels to avoid plural address and stiff phrasing.
- [x] Run targeted tests until green.

### Task 3: OpenAI-Compatible Adapter

- [x] Add `tests/openAiCompatibleDialogueDependencies.test.ts` with mocked `fetch` validating request shape, SSE stream parsing, missing-key errors, and HTTP error handling.
- [x] Implement the adapter without adding an SDK dependency.
- [x] Run the new adapter tests until green.

### Task 4: Mainline Provider Selection

- [x] Add failing `tests/mainlineTurnRunner.test.ts` coverage for remote provider selection and local fallback.
- [x] Wire `runMainlineTurn` to create remote dependencies when `modelProvider === 'openai-compatible'` and API key/model are set.
- [x] Ensure local model-missing checks are skipped for remote turns.
- [x] Run targeted tests until green.

### Task 5: Settings UI And Guidance

- [x] Add/extend DOM tests for model provider controls and API fields.
- [x] Update settings panel components to make API key the default/recommended path and keep local model controls as fallback.
- [x] Persist user edits through existing runtime state save flow.
- [x] Run component/DOM tests until green.

### Task 6: Local Runtime Diagnostics And Performance

- [x] Add unit-testable helper coverage for quiet llama warning filtering and local runtime option resolution.
- [x] Update `realLlamaSession` to suppress benign control-token warning, log backend/device diagnostics, use bounded context, enable flash attention where supported, and reduce default local output tokens.
- [x] Update docs with GPU diagnosis and recommended API models.
- [x] Add `pnpm smoke:openai` for real OpenAI-compatible mainline smoke via environment variables, without logging API keys.
- [x] Run typecheck and the full test suite.

### Task 7: Release Hardening Sweep

- [x] Add regression coverage for future-node fact terms in anti-spoiler boundaries.
- [x] Normalize accidental plural player address in final reply cleanup.
- [x] Make settings UI explicitly state that only OpenAI-compatible `/chat/completions` streaming is supported and that Base URL must be the API root.
- [x] Run real API smoke with the user's configured OpenRouter key through ignored `.env.local`: `pnpm smoke:openai` completed with `qwen/qwen3-next-80b-a3b-instruct:free`, produced a 317-character first-node reply and two contextual options, and log scan found no API key or Authorization header in `logs/dialogue-smoke/`.

## Acceptance

- Default new saves recommend API-key model usage.
- Remote OpenAI-compatible streaming preserves prompt system/user separation and returns incremental chunks.
- Local path remains usable and emits actionable GPU diagnostics.
- Options feel like player responses: align means wonder/acceptance; challenge means questioning evidence/reasoning.
- Main prompt no longer frames the guide as a sister and forbids addressing one player as `你们`.
- Previous model output is retained as compressed continuity context instead of being dropped.
- Settings UI and docs tell users that API keys must target an OpenAI-compatible chat-completions endpoint.
- `pnpm smoke:openai` can verify real API dialogue output without storing the key in logs.