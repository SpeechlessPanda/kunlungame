# 2026-04-24 Release Audit · RC2 (HEAD `92b7652`)

> 依据 `.github/copilot-instructions.md` §6 对 2026-04-24 release 的补充审计。
> 基线：`2026-04-24-release-audit.md`（发布在 `1a8e46d`）。
> 本次范围：`1a8e46d..92b7652` 之间新增的 weight downloader CTA、byte-level
> 下载进度、8 节点端到端 playthrough QA、以及测试与 tsconfig 修复。

## 1. Scope

- 候选 commit：`92b7652 feat(downloader): byte-level progress + fetch/stream impl with Range resume`
- 参考 commits：`483be96`（CTA）、`226190e`（playthrough QA）、`92b7652`（byte-level）
- 发布时间：2026-04-24（内部 RC2）
- 审计者：Copilot，@ming 最终签字

## 2. Checks

### 2.1 依赖与安全

- `pnpm audit --prod`：**blocked**
  - npmmirror 无 audit endpoint（`ERR_PNPM_AUDIT_ENDPOINT_NOT_EXISTS`）；
  - 回退 `registry.npmjs.org` 时本地网络 TLS 连接被断（ECONNRESET），无法
    拉取 advisory 清单。
  - 本 RC 与 RC1（`1a8e46d`）之间**未升级任何运行时依赖**（`package.json` /
    `pnpm-lock.yaml` 未变动），沿用 RC1 的 0 vulnerability 结论。
- `pnpm outdated`：**blocked**（同一网络原因）。延迟到网络恢复后复查。

### 2.2 测试与覆盖率

- `pnpm typecheck`：**pass**（exit 0，tsc + vue-tsc 两步均通过）。
  - RC1 之后首次跑 typecheck 暴露 6 处 TS 错误；本审计已一并修掉：
    - `RuntimeSettings` 新增 `preferredModelMode` 后，`tests/bridgeDialogueDependencies.ts`
      / `tests/desktopShell.ts` / `tests/useDialogueSession.ts` 三个 fixture
      补齐 `preferredModelMode: 'default'`。
    - `tests/profileDownloader.test.ts` 的 `writeManifest` mock 改为显式
      `vi.fn<(file: string, m: ModelManifest) => Promise<void>>`，恢复
      `mock.calls[0][1]` 的类型。
    - `.vue` shim 改放到 `src/shared/vue-shims.d.ts` 并在 `tsconfig.json`
      `include` 里加 `src/shared/**/*.d.ts` + `src/renderer/env.d.ts`，
      让 `tsc --noEmit` 能解析 `.vue` 导入。
- `pnpm test --run`：**pass**（35 files / 200 tests，~2.8 s）
- `pnpm coverage`：**pass**
  - 整体：Stmts 86.82% / Branch 83.97% / Funcs 87.95% / Lines 86.82%。≥ 80% 行
    覆盖率门槛满足。
  - 核心模块覆盖率未单独重测，沿用 RC1 结论；`localDialogueDependencies.ts`
    仍在 80-82% 区间（deferred 同 RC1）。
- Playwright e2e：**deferred**（未在本轮重跑；自 RC1 起没有触及 renderer
  入口结构，仅改了 SettingsPanel progress 行，增量风险低）。

### 2.3 构建与打包

- `pnpm build`：**pass**（exit 0，~0.96 s）
- 产物体积：`out/` 总计 **0.52 MB**（main `index.js` + preload `index.mjs` +
  renderer `index.html` / CSS 29.64 KB / JS 404.10 KB / portrait SVG 6.10 KB）。
  与 RC1 对比 +0.05 MB，主要来自 SettingsPanel 下载 CTA + byte-level 行
  以及 `ProfileDownloadStatus` 类型扩展。**pass**

### 2.4 启动与运行时冒烟

- 最近一次完整 8 节点 playthrough：`2026-04-24-playthrough-8node.md`
  （commit `226190e`，基于 `483be96` 运行时）。29 轮全部成功，
  `isCompleted=true`、`attitudeScore=1`、终节点 `contemporary-return`，
  墙钟 6.35 min，exit 0。
- `483be96 → 92b7652` 两次 commit 均未触达运行时（dialogue / retrieval /
  prompt builder / state machine 保持一致），仅改下载器实现与测试类型，
  冒烟可沿用 `226190e` 的结果。**pass（沿用）**
- 真实 download CTA 下的 byte-level % 显示：单元测试覆盖
  （`profileDownloader.test.ts` + `settingsPanel.dom.test.ts`）；**实机
  点按下载仍需在正式 release 前做一次人工验证**。**deferred**

### 2.5 性能与资源使用

- 从 playthrough 取样的平均每轮 elapsed ~13 s（最长 19.9 s，最短 ~8 s），
  与 RC1 同量级。**pass**
- Byte-level 进度的节流：`emitBytes` 以 ≥ 250 ms 为节流窗口，避免 UI
  抖动；fetch 读 loop 中 `writer.write()` 返回 false 时 `await 'drain'`，
  避免内存堆积。**pass（按实现审查）**
- 主进程/模型内存峰值实测：沿用 RC1 的 deferred，尚未做。**deferred**

### 2.6 文档与发布说明

- `docs/superpowers/specs/2026-04-24-galgame-persona-and-ending-delta.md`
  已同步 §10.5（byte-level 已交付标注）+ §10.6（8 节点 QA）+ §10.7
  （byte-level 交付细节）。**pass**
- `docs/audits/2026-04-24-playthrough-8node.md` 已提交。**pass**
- README / release notes：仍与 RC1 的 deferred 一致，未撰写正式对外
  release notes。**deferred**

### 2.7 内容与素材合规

- 本轮无新增图片/音频/模型权重资源。代码/测试/文档/tsconfig 级变更。**pass**
- 主线文案未变动，canonical `mainlineOutline.ts` 与 `storyOutline.json`
  未触及。**pass**
- 下载 UI 的文案（`"已下载"` / `"下载权重"` / byte 行格式）为中性功能
  文案，无合规风险。**pass**

## 3. Result Summary

- **Passed**：typecheck、单元测试、覆盖率、构建、冒烟（沿用）、性能节流
  审查、文档同步、内容合规。
- **Failed**：无。
- **Blocked**：pnpm audit / outdated（网络限制，非代码缺陷）。
- **Deferred**：
  - 对外 release notes + README 命令复核（自 RC1 起延续）。
  - 主进程 / 模型内存峰值实机量测（自 RC1 起延续）。
  - `localDialogueDependencies.ts` 覆盖率 < 90%（自 RC1 起延续）。
  - 真实 download CTA 的人工点按验证。
  - 网络恢复后重跑 `pnpm audit --prod` 与 `pnpm outdated --long`。

## 4. Command Log

- `pnpm audit --prod` → blocked（网络）
- `pnpm outdated --long` → blocked（网络）
- `pnpm coverage` → exit 0（Lines 86.82%，35 files / 200 tests）
- `pnpm typecheck` → exit 0（含本轮 TS 修复）
- `pnpm build` → exit 0（out 0.52 MB）
- `pnpm test --run` → exit 0（35 files / 200 tests，~2.8 s）

## 5. Sign-off

- Reviewer: Copilot（待 @ming 复核）
- Date: 2026-04-24
- Decision: **ship RC2**（blocked 项为环境限制非代码缺陷；deferred 项
  不阻塞内部 RC，正式对外 release 前需补齐 release notes + 内存实测 +
  audit 重跑 + 人工 CTA 点按）。
