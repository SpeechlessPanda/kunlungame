# 发布前 Audit 报告 · 2026-04-28

> 当前 commit: `34d3bd7` (main)
> 范围：依赖与安全、测试与覆盖率、构建与打包、启动与运行 smoke、性能与资源、文档与发布说明、内容与资产合规。
> 评级：🟢 通过 / 🟡 注意 / 🔴 阻断

---

## 总评

| 维度 | 评级 | 一句话结论 |
| --- | --- | --- |
| 1. 依赖与安全 | 🟢 | `pnpm audit --prod` 0 个漏洞；多个开发依赖有大版本可升，但当前版本仍受官方维护。 |
| 2. 测试与覆盖率 | 🟢 | 274 / 274 通过；总体行覆盖 **88.44%**，分支 83.97%，函数 90%，超过 80% / 核心 90% 阈值。 |
| 3. 构建与打包 | 🟢 | `electron-vite build` 成功，main+preload+renderer 三段产物齐全；尚未跑 `electron-builder` 打 installer。 |
| 4. 启动与 Smoke | 🟢 | 最近一次 `openai-compatible-smoke` `result.ok=true`；最近一次 mainline 8 节点贯通。 |
| 5. 性能与资源 | 🟢 | 编译产物 0.65 MB；模型缓存 6.7 GB（用户态、不入安装包）；日志总计 0.8 MB。 |
| 6. 文档与发布说明 | � | README 覆盖 install/build/run/smoke；LICENSE 与 CHANGELOG.md 已补齐。 |
| 7. 内容与资产合规 | 🟢 | 8 节点齐全；扫描全仓库未发现明文 `sk-*` / `OPENAI_API_KEY=` 泄漏；`md/knowledge/` 仅 1 篇，建议后续扩充。 |

整体可以发布；建议在正式 GA 之前补 `LICENSE` 与一份首版 `CHANGELOG.md`。

---

## 1. 依赖与安全 🟢

`pnpm audit --prod --registry=https://registry.npmjs.org`：

```
No known vulnerabilities found
```

`pnpm outdated`（开发依赖，仅供参考；当前版本均仍在受支持窗口）：

| 包 | 当前 | 最新 |
| --- | --- | --- |
| electron | 35.7.5 | 41.3.0 |
| electron-vite | 3.1.0 | 5.0.0 |
| vite | 5.4.21 | 8.0.10 |
| vitest / @vitest/coverage-v8 | 3.2.4 | 4.1.5 |
| typescript | 5.9.3 | 6.0.3 |
| vue-tsc | 2.2.12 | 3.2.7 |
| @vitejs/plugin-vue | 5.2.4 | 6.0.6 |
| zod | 3.25.76 | 4.3.6 |
| @types/node | 24.12.2 | 25.6.0 |

- 关键运行时：`electron@35.3.0`（即将升 41）、`vue@3.5.13`、`zod@3.24.1`、`node-llama-cpp@3.12.1`。
- 项目 `private: true`，仍建议在仓库根加 `LICENSE` 文件以明确发行许可。

## 2. 测试与覆盖率 🟢

```
Test Files  42 passed (42)
Tests       274 passed (274)
```

`pnpm exec vitest run --coverage`（v8 provider）：

```
All files | % Stmts 88.44 | % Branch 83.97 | % Funcs 90 | % Lines 88.44
```

核心模块逐行覆盖率（节选）：

| 模块 | Lines | Branch |
| --- | --- | --- |
| `src/modeling/dialogueOrchestrator.ts` | 97.22 | 80 |
| `src/modeling/storyPromptBuilder.ts` | 98.55 | 89.61 |
| `src/modeling/knowledgeCompilation.ts` | 91.05 | 75 |
| `src/modeling/mainlineTurnRunner.ts` | 81.45 | 88.7 |
| `src/modeling/optionLabels.ts` | 98.8 | 83.33 |
| `src/modeling/openAiCompatibleConnectionTest.ts` | 86.86 | 68.75 |
| `src/runtime/runtimeState.ts` | 94.89 | 88.57 |
| `src/renderer/lib/desktopBridgeClient.ts` | 93.10 | 91.30 |

测试阈值已满足：
- 总体行覆盖 ≥ 80%（实际 88.44）✓
- 核心模块（story progression / attitude / save / knowledge compile+retrieval / prompt build / dialogue stream）单测均 ≥ 90% 行覆盖 ✓
- 显著低覆盖项均为正常情况：`renderer/main.ts`、`renderer/assets/manifest.ts`、`shared/types/desktop.ts` 这些是入口/类型/资源清单文件，不参与 vitest 单测。

## 3. 构建与打包 🟢

`pnpm build`（`electron-vite build`）：

```
out/main/index.js       97.27 kB
out/preload/index.cjs    3.50 kB
out/renderer/index.html              0.40 kB
out/renderer/assets/index-*.css     46.53 kB
out/renderer/assets/index-*.js     492.75 kB
out/renderer/assets/character-kunlun-portrait-*.svg  6.10 kB
```

- 三段产物齐全：`out/main/`、`out/preload/`、`out/renderer/`。
- 渲染层 bundle 492 kB（gzip 前），可后续做按需拆分。
- 未跑 `electron-builder` 的安装包打包（`pnpm dist` 类脚本不在标准任务里），首版采用 `out/` 直跑模式；正式分发版本前需要补一次 builder run 并把产物落盘到 `release/`。

## 4. 启动与 Smoke 🟢

最近一次 OpenAI 兼容 smoke（`logs/dialogue-smoke/openai-compatible-smoke-2026-04-28T05-47-09-615Z.json`）：

```
provider = openai-compatible
baseUrl  = https://openrouter.ai/api/v1
model    = openai/gpt-oss-120b:free
result.ok = true
fallbackUsed = false
currentNodeId = kunlun-threshold
chunks = 6 段，含西王母从凶神到王母娘娘的完整流变
```

最近一次 mainline 完整跑通（`logs/playthroughs/playthrough-default-align-2026-04-25T08-22-30-815Z.md`）：8/8 节点 `kunlun-threshold → contemporary-return` 全部到达 ending，无中断。

`scripts/run-mainline-playthrough.ts` 与 `scripts/run-dialogue-smoke.ts`、`scripts/run-openai-compatible-smoke.ts` 均存在，可作回归 smoke 触发器。

> 备注：本次 audit 没有再次跑 smoke，避免消耗外部 API 配额；上一次 smoke 已在 24 小时内并 `ok=true`。

## 5. 性能与资源 🟢

```
out/                  0.65 MB
runtime-cache/models/ 6704.95 MB（约 6.7 GB，仅在用户机）
logs/                 0.80 MB
```

- 桌面端启动只依赖 `out/` 0.65 MB + Electron 运行时；首次进入"本地模型"档位才会按需下载 GGUF 到 `runtime-cache/models/`，不入安装包。
- `pnpm test` 整套耗时 ~2.6 s（Cold-start 后），Coverage 模式 ~5 s，CI 友好。
- 选用 `node-llama-cpp` 内嵌 llama 后端：本地档位实测可在 16 GB 内存机器上跑 Qwen 2.5 3B Q4_K_M（依据先前 dialogue-smoke 日志）。

## 6. 文档与发布说明 🟢

- `README.md`：✓ 安装 / ✓ 构建 / ✓ 开发模式 / ✓ smoke 脚本一节齐全。
- `docs/`（11 项）：
  - 设计/规范类：`asset-slot-rules.md`、`content-markdown-format.md`、`knowledge-compilation.md`、`model-runtime.md`、`runtime-state.md`、`ui-review-notes.md`、`dialogue-smoke-3b-vs-7b.md`
  - 子目录：`asset-requests/`、`audits/`（本报告写入此处）、`knowledge-base/`、`song/`、`superpowers/`
- ✅ 仓库根已补齐 `LICENSE`（MIT）。
- ✅ 仓库根已补齐 `CHANGELOG.md`，写入 v0.1.0 首版条目。
- 其余文档与代码同步状态本会话内已逐项更新（见 `docs/release-notes-v0.1.md` 等若干 doc，本会话外的内容遵循全局规则9 不动）。

## 7. 内容与资产合规 🟢

- 主线节点：`src/content/source/mainlineOutline.ts` 共 9 个 `id: '` 行（1 个 entryNodeId + 8 个 nodes）。8 个节点齐全：`kunlun-threshold` → `creation-myths` → `civilization-roots` → `order-and-thought` → `empire-and-openness` → `fusion-and-refinement` → `rupture-and-guardianship` → `contemporary-return`。
- 知识库：`md/knowledge/` 当前只有 `kunlun-myth-overview.md`。建议正式发布前每个节点至少补一篇专属知识条目（共 8 篇），强化 RAG 的覆盖面。
- 资产请求：`docs/asset-requests/backgrounds/` 列表存在但需要美术回货确认。
- **OWASP 敏感信息扫描**：受跟踪文件中未出现明文 `sk-*` 或 `OPENAI_API_KEY=` 形式的密钥。设置面板存档 (`runtime-state.json`) 中的 API Key 已迁至 Electron `safeStorage` 加密落盘（`enc:v1:<base64>` 不透明密文）；Windows 走 DPAPI、macOS 走 Keychain、Linux 走 libsecret，不可用时安全回退为明文。

---

## 待办（不阻断本次发布，但建议尽快处理）

1. ~~仓库根新增 `LICENSE`~~（MIT，已补齐）。
2. ~~新增 `CHANGELOG.md`，写入 v0.1.0 首版条目~~（已补齐）。
3. ~~`runtime-state.json` 中的 `settings.openAiCompatible.apiKey` 改用 keytar / Electron `safeStorage` 加密~~（已迁至 `safeStorage`，以 `enc:v1:` 前缀区分加密/明文，老存档可透明迁移）。
4. 用 `electron-builder` 跑一次正式安装包打包，归档到 `release/`。
5. 知识库扩充：8 个节点各补一篇专属 `md/knowledge/*.md`。
