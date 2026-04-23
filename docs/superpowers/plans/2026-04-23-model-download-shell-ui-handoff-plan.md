# Model Download Shell And UI Handoff Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect model readiness checks and auto-download triggers into the desktop shell, while handing UI implementation teams a fixed contract for progress, mirror fallback, failure reasons, and retry guidance.

**Architecture:** Keep all model download orchestration decisions in a shell-safe TypeScript planner under `src/modeling`, and let future Electron main/preload/renderer layers consume that planner through explicit IPC/event contracts. UI work remains deferred, but event names, states, actions, and error surfaces are fixed now so separate implementers can proceed without redefining behavior.

**Tech Stack:** TypeScript, Node file system APIs, `curl.exe`, future Electron IPC, future Vue renderer.

---

## Scope Of This Handoff

1. Reserve the shell-facing startup and settings entry behavior.
2. Reserve the UI-facing progress, status, mirror, and repair action contract.
3. Document what the future Electron main process, preload layer, and renderer each need to implement.
4. Avoid implementing actual renderer UI in this handoff.

## Files That Already Carry The Contract

- [src/modeling/modelSetupPlanner.ts](src/modeling/modelSetupPlanner.ts)
- [docs/model-runtime.md](docs/model-runtime.md)

## Desktop Shell Integration Tasks

### 1. Main Process Startup Gate

Future owner: Electron main process.

1. Call `buildModelSetupPlan()` during app bootstrap before opening the narrative shell.
2. If `shellAction = launch-ready`, continue startup normally.
3. If `shellAction = auto-download-required`, open the startup loading shell and dispatch `model-download:start` immediately.
4. If the selected default profile is incomplete but compatibility mode is already ready, the shell may surface a fast-path switch, but must keep the default action deterministic.

### 2. Settings Page Model Panel

Future owner: preload + renderer settings module.

1. Open the settings page directly to the `models` tab using `settingsEntryPoint.defaultTab`.
2. Highlight `settingsEntryPoint.highlightProfileId` as the current recommended mode.
3. Do not auto-start downloads when the user merely opens settings.
4. Bind the primary button to `model-download:start` and the cancel button to `model-download:cancel`.

## UI Contract To Implement

### 1. Required Channels

1. `model-download:start`
2. `model-download:progress`
3. `model-download:status`
4. `model-download:issue`
5. `model-download:cancel`

### 2. Required Download Stages

1. `checking`
2. `queued`
3. `downloading`
4. `switching-to-mirror`
5. `completed`
6. `failed`

### 3. Required Recovery Actions

1. `retry-download`
2. `switch-to-mirror`
3. `open-network-help`
4. `switch-to-compatibility` when the default model is the active target

### 4. Required User-Facing Information

1. Active model mode and profile ID.
2. Current file name.
3. Downloaded bytes, total bytes when known, and computed percentage when possible.
4. Whether the current source is `primary` or `mirror`.
5. Raw failure reason transformed into a readable headline and detail block.
6. Repair suggestions that the user can act on without reading logs.

## Suggested UI Layout For The Team Taking Over

1. Startup page: one blocking card with headline, progress bar, active source badge, and a compact repair panel.
2. Settings page: one persistent model management panel with mode cards, storage path, manifest health, and a download history row.
3. Error state: one primary retry action, one mirror switch action, one expandable diagnostics area, and one compatibility mode fallback action when applicable.

## Non-Goals For This Handoff

1. No concrete Vue component implementation.
2. No visual design finalization.
3. No direct Electron IPC wiring yet.
4. No downloader refactor beyond the current `curl.exe`-based script.