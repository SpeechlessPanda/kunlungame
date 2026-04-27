# Electron Preload Streaming

Use this checklist when a desktop IPC stream appears to fall back to mock mode or only updates after the whole turn completes.

## Failure Signatures

- Built Electron UI shows `预览脚本模式` even though `window.kunlunDesktop` should exist.
- Console reports `Unable to load preload script` or `Cannot use import statement outside a module`.
- Exposing an `AsyncIterable` from preload through `contextBridge` throws `An object could not be cloned`.
- UI state enters `streaming`, but visible dialogue text does not grow until choices appear.

## Verified Fixes

1. Build sandboxed preload as CommonJS and point the main process at `out/preload/index.cjs`.
2. Do not return `AsyncIterable` objects across `contextBridge`; expose a callback-style stream API from preload.
3. In the renderer, wrap callback events into a local queue/async generator for the orchestrator.
4. Start the dialogue reveal timer when the first chunk arrives, not after the stream completes.
5. For real UAT, use Playwright Electron plus a DOM `MutationObserver` to confirm text length grows before choice buttons appear.
