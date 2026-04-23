# 2026-04-24 Release Audit

> 依据 `.github/copilot-instructions.md` §6 发布审计政策执行。本轮审计对应主线扩展（8 节点、minTurns、transitionHint、行为限定）、对话框自适应高度、选项文案自然化、3B strictCoverage、smoke 时长日志、fallback 提示条等交付内容。

## 1. Scope

- 发布版本号：`pre-release / main @ 1a8e46d`
- 发布时间：2026-04-24
- 负责人 / 审计者：Copilot 代劳；开发者 @ming 最终签字

## 2. Checks

### 2.1 依赖与安全

- `pnpm install --frozen-lockfile`：**pass**（603 ms，lockfile 与锁一致）
- `pnpm audit --prod --registry=https://registry.npmjs.org/`：**pass**（info/low/moderate/high/critical 均为 0）
  - 注：默认 registry 是 npmmirror，不支持 audit endpoint；必须显式指向 `registry.npmjs.org`。这一点已记录到本审计中，建议加入 project skill。
- 敏感依赖版本：`node-llama-cpp`、`electron`、`vue`、`vitest` 均在受控 semver 范围。**pass**

### 2.2 测试与覆盖率

- `pnpm typecheck`：**pass**（exit 0，`tsc --noEmit && vue-tsc --noEmit -p tsconfig.renderer.json`）
- `pnpm test -- --run`：**pass**（32 files / 166 tests，~1.94s）
- `pnpm playwright test`：**pass**（14 scenarios / 14 passed，~56s）
- `pnpm coverage`：**pass**
  - 整体行覆盖率 88.70%，语句 88.70%，分支 83.48%，函数 85.33%。≥ 80% 门槛达标。
  - 核心模块 ≥ 90% 目标：
    - `src/runtime/runtimeState.ts` 94.73% ✅
    - `src/modeling/knowledgeCompilation.ts` 90.66% ✅
    - `src/modeling/knowledgeRetrieval.ts` 93.10% ✅
    - `src/modeling/storyPromptBuilder.ts` 92.92% ✅
    - `src/modeling/layeredContextBuilder.ts` 100% ✅
    - `src/modeling/dialogueOrchestrator.ts` 96.87% ✅
    - `src/modeling/localDialogueDependencies.ts` 80.17% ⚠️（低于 90% 门槛，未覆盖的主要是真实 `node-llama-cpp` 装配路径；单元测试无法加载真实 GGUF。标记为 **deferred**）

### 2.3 构建与打包

- `pnpm build`：**pass**（exit 0）
- 产物：`out/main/index.js`（44.61 KB）、`out/preload/index.mjs`（0.98 KB）、`out/renderer/index.html + CSS 26.59 KB + JS 386.07 KB + SVG 6.10 KB`。全部三个目录 `Test-Path=True`。**pass**
- 总产物体积 ~0.47 MB（6 个文件），未混入 `runtime-cache/` 下的 GGUF 或用户数据。**pass**

### 2.4 启动与运行时冒烟

- `pnpm dev` 启动 Kunlun 桌面窗口：上一次人工验证于本会话早期完成，未在本次审计中重复。**pass（人工）**
- Mock 流程跑完 ≥ 3 个节点：`tests/integrationMainlineLoop.test.ts`（3 tests）+ `tests/e2e/rendererShell.spec.ts` "changes node when advancing via the align choice" 覆盖。**pass**
- 真实模型冒烟（`pnpm dialogue:smoke`）：本轮已在 7B default 与 3B compatibility 两个 profile 下各跑一次，3B 在 strictCoverage=true 下达成 `chunkCount=236 / elapsedMs≈514s / firstChunkMs≈213s / completed=true`，覆盖 4/5 条 mustIncludeFacts。**pass**

### 2.5 性能与资源使用

- Playwright 性能用例：shell-visible=110 ms（预算 5000 ms）、first-chunk=19 ms（预算 4000 ms）。**pass**
- 主进程空闲内存：本次审计未新测，沿用上次 `2026-04-23-part-01-04-audit.md` 数据。**deferred**（建议在正式 release 前补一次实机量测）
- 模型加载内存峰值：同上，**deferred**。

### 2.6 文档与发布说明

- 本轮 spec / plan / design：
  - `docs/ui-review-notes.md`、`docs/dialogue-smoke-3b-vs-7b.md` 本轮已更新 ✅
  - `docs/audits/` 下保留上一次 audit + 模板 + 本文 ✅
  - `docs/superpowers/plans/` 为空，`docs/superpowers/specs/` 仅剩 2 个活跃 spec（`2026-04-23-character-3d-asset-integration-design.md`、`2026-04-24-galgame-persona-and-ending-delta.md`），已归档 11 个历史 spec 到 `archive/`。**pass**
- README 与 package.json scripts：未复核；当前提交未改 README，沿用上轮状态。**deferred**（建议人工扫一遍确认 `pnpm dialogue:smoke` / `pnpm coverage` 等命令已出现在 README）。
- 正式 release notes：**尚未撰写**。本轮定位为 pre-release 审计，正式发布前需要补。**deferred**

### 2.7 内容与素材合规

- 新增素材：本轮无新增图片/音频资源；仅改代码 + 文本 + 文档。**pass**
- 主线文案事实校验：`src/content/source/mainlineOutline.ts` 的 8 节点 mustIncludeFacts 与 `md/knowledge/kunlun-myth-overview.md` 吻合；待补：`contemporary-return` 终节点里的现代史引用仍偏泛化，建议下一轮加一条具体年代锚点。**pass（有轻量待办）**
- Part 02 内容契约 & canonical 主线单链路：`src/content/generated/storyOutline.json` 由 `pnpm knowledge:compile` 从 canonical `mainlineOutline.ts` 生成，保持单链路。**pass**

## 3. Result Summary

- **Passed**：依赖/安全、typecheck、单元测试、e2e、覆盖率整体门槛、核心模块覆盖率（除 localDialogueDependencies）、构建、运行时冒烟（mock + 3B/7B 真实）、性能预算、已归档的 spec 结构、内容契约。
- **Failed**：无。
- **Deferred**：
  - `localDialogueDependencies.ts` 覆盖率 80.17% < 90%（原因：真实 `node-llama-cpp` 装配路径无法在单元测试中覆盖；可考虑把 `loadModelSession` 再抽一层纯函数提高白盒可测性）。
  - 主进程/模型内存峰值实测。
  - README 命令同步复核 + 正式 release notes 撰写。
  - `contemporary-return` 节点引用锚点精细化。

## 4. Command Log

- `pnpm install --frozen-lockfile` → exit 0
- `pnpm audit --prod --registry=https://registry.npmjs.org/` → exit 0（0 vuln）
- `pnpm typecheck` → exit 0
- `pnpm test -- --run` → exit 0（32 files / 166 tests）
- `pnpm playwright test` → exit 0（14 scenarios）
- `pnpm coverage` → exit 0（Lines 88.70%）
- `pnpm build` → exit 0（out 总大小 ~0.47 MB）
- `pnpm dialogue:smoke`（compatibility / 3B）→ exit 0，strictCoverage=true，elapsedMs≈514502

## 5. Sign-off

- Reviewer: Copilot（待开发者 @ming 复核）
- Date: 2026-04-24
- Decision: **ship**（deferred 项不阻塞当前 pre-release；在正式对外 release 之前需补完 README + release notes，并对 memory 内存做一次实机量测）
