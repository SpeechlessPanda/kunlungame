# Release Audit Template

> 本模板对应 `docs/copilot-instructions.md` 第 6 节“发布审计政策”。每次正式发布前复制该文件为 `YYYY-MM-DD-release-audit.md`，并按条目填入实际检查结果。

## 1. Scope

- 发布版本号：`<填写>`
- 发布时间：`<填写>`
- 负责人 / 审计者：`<填写>`

## 2. Checks

### 2.1 依赖与安全

- `pnpm install --frozen-lockfile` 是否干净通过：`pass / fail`
- `pnpm audit --prod`（或等价扫描）有无高危项：`pass / fail`
- `node-llama-cpp`、`electron` 等原生 / 安全敏感依赖是否在受控版本范围：`pass / fail`

### 2.2 测试与覆盖率

- `pnpm typecheck`：`pass / fail`
- `pnpm test`：`<N> files / <M> tests` → `pass / fail`
- `pnpm test:e2e`：`<N> scenarios` → `pass / fail`
- `pnpm coverage`：
  - 整体行覆盖率 ≥ 80%：`pass / fail`
  - 核心模块行覆盖率 ≥ 90%：`pass / fail`
  - 核心模块范围：story progression（`src/runtime/runtimeState.ts`）、attitude state（同上）、save system（`src/runtime/saveRepository.ts`）、knowledge compilation（`src/modeling/knowledgeCompilation.ts`）、knowledge retrieval（同上）、prompt building（`src/modeling/storyPromptBuilder.ts` + `layeredContextBuilder.ts`）、AI stream orchestration（`src/modeling/dialogueOrchestrator.ts` + `localDialogueDependencies.ts`）。

### 2.3 构建与打包

- `pnpm build`：`pass / fail`
- `out/main/**`、`out/preload/**`、`out/renderer/**` 是否完整：`pass / fail`
- 构建产物里是否漏带占位资源或混入用户数据：`pass / fail`

### 2.4 启动与运行时冒烟

- `pnpm dev` 是否可弹出 Kunlun 桌面窗口并挂载主界面：`pass / fail`
- 从“进入昆仑”按钮开始的 mock 流程是否可在没有真实模型文件时完整走完 ≥ 3 个节点：`pass / fail`
- 真实模型（本地 GGUF 文件就绪时）是否可跑通一轮真实协作，且时长 ≥ 5 分钟：`pass / fail / blocked`

### 2.5 性能与资源使用

- Playwright 性能用例（shell 可见 < 5000ms、首段 chunk < 4000ms）：`pass / fail`
- 主进程空闲内存占用是否在预算内：`pass / fail`
- 模型加载内存峰值是否在预算内：`pass / fail`

### 2.6 文档与发布说明

- 本轮涉及修改的 spec / plan / design 文档是否同步更新：`pass / fail`
- README 的开发命令与当前实际 scripts 一致：`pass / fail`
- 发布说明（release notes / delivery notes）是否已撰写：`pass / fail`

### 2.7 内容与素材合规

- 加入仓库的素材许可证是否已记录：`pass / fail`
- 主线文案 / 知识库 Markdown 是否有事实性错漏待修复项：`pass / fail`
- Part 02 内容契约与 canonical 主线源是否保持单链路单主线：`pass / fail`

## 3. Result Summary

- Passed: `<枚举>`
- Failed: `<枚举 + 影响 + 责任人>`
- Deferred: `<枚举 + 原因 + 预期补齐时间>`

## 4. Command Log

- `pnpm typecheck` → exit `<N>`
- `pnpm test` → exit `<N>`, details `<N files / N tests>`
- `pnpm test:e2e` → exit `<N>`, details `<N scenarios>`
- `pnpm build` → exit `<N>`, artifact manifest `<path>`
- `pnpm coverage` → exit `<N>`, coverage report `<path>`
- `pnpm knowledge:compile` → exit `<N>`

## 5. Sign-off

- Reviewer: `<填写>`
- Date: `<填写>`
- Decision: `ship / hold / hotfix-required`
