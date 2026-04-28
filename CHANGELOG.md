# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added · 新增

- **dev 环境 OpenAI 凭据预加载**：`pnpm dev` 启动时若仓库根目录有 `.env.local`（或 `.env`），主进程会读取 `KUNLUN_OPENAI_API_KEY` / `KUNLUN_OPENAI_BASE_URL` / `KUNLUN_OPENAI_MODEL` / `KUNLUN_MODEL_PROVIDER`，自动覆盖到 runtime-state 的 `settings.openAiCompatible`，渲染层加载即看到值已就位。仅在 `app.isPackaged === false` 时生效；安装包不读 `.env`。模板见 `.env.example`。
- **Windows 安装包**：接入 `electron-builder@26`，新增 `pnpm dist:win` 脚本，输出 NSIS 安装包到 `release/`。首版包大小约 111 MB，含 Electron 35 + node-llama-cpp 原生二进制，支持选择安装路径、在桌面与开始菜单创建快捷方式。配置在 `electron-builder.yml`，`runtime-cache/` 与 `runtime-state.json` 均指向 `app.getPath('userData')`，不进安装包。
- 8 个节点各补一篇专属 RAG 补充条目在 `md/knowledge/`（全部 `enc:v1:` 不相关，是语料本身）：昂仑天柱、盘古女娲共工、三皇五帝与仰韶考古、礼乐周易与诸子、长安丝路与胡风、宋元明清与心学、学衔南迁与文物护送、费孝通与国风复兴。合并后语料总入口从 43 条增至 52 条，所有节点劤耳多与却 4 条。
- `scripts/compile-knowledge.ts` 现合并主源 `docs/knowledge-base/cultural-knowledge.md` 与 `md/knowledge/*.md` 补充条目，同 id 优先读补充依据，输出同一份 `knowledgeEntries.json`。

### Security · 安全

- `settings.openAiCompatible.apiKey` 现在通过 Electron `safeStorage` 加密落盘（Windows DPAPI / macOS Keychain / Linux libsecret），磁盘上的 `runtime-state.json` 只保存 `enc:v1:<base64>` 不透明密文。
- 旧版本的明文 apiKey 在加载时透明回明文，下一次保存自动升级为加密形式（向前兼容、零迁移脚本）。
- 当 OS 加密不可用（例如 Linux 无 libsecret 后端），自动回退为明文存储并保留功能可用。

## [0.1.0] - 2026-04-28

首版桌面应用。Electron 35 + Vue 3.5 + TypeScript 5 + electron-vite + Vite 5。

### Added · 新增

- **8 节点主线**：`kunlun-threshold` → `creation-myths` → `civilization-roots` → `order-and-thought` → `empire-and-openness` → `fusion-and-refinement` → `rupture-and-guardianship` → `contemporary-return`，可一次走通到升华结局。
- **昆仑子叙事人格**：序章 + 8 节点 transition + 结局升华，全部以"风、盐湖、古羊皮气味"作为叙事锚点。
- **双档位 LLM 后端**：本地 `node-llama-cpp` GGUF（默认 Qwen 2.5 3B Q4_K_M）与 OpenAI 兼容的远端 API，可在设置面板切换。
- **设置面板"测试连接"按钮**：用 `max_tokens=1` 非流式打一次 `/chat/completions`，一次性验证 API Key、Base URL、模型名是否能跑通；错误分类为 `auth` / `model-not-found` / `http-error` / `timeout` / `network` / `missing-input` / `invalid-base-url` 并以中文提示展示。
- **8 节点定制化选项池**：每个节点带 4 条 align + 4 条 challenge 文案，分别引用节点专属意象（昆仑→天柱/西王母；近代→西南联大/故宫南迁；当代→文化自觉/B 站国风等）。
- **galgame 风格三段式呈现**：人物立绘 + 流式对话气泡 + 双语义选项（顺听 / 质疑）。
- **知识检索（RAG）**：`md/knowledge/*.md` 编译产物在 prompt 注入前按节点 `allowedKnowledgeTopics` 过滤，避免越界。
- **保存与续读**：`runtime-state.json` 以节点粒度保存进度；启动可恢复到上次节点。
- **运行时模型管理**：从 HuggingFace mirror 下载 GGUF 到 `runtime-cache/models/`，含完整性校验与断点续传。
- **背景音乐控制器**：节点切换时按 `bgmController` 平滑切换轨道。
- **可访问性**：键盘控制（`useKeyboardControls`）与焦点陷阱（`useFocusTrap`）覆盖核心交互。
- **测试**：274 个单元测试 + DOM 测试，行覆盖 88.44%，核心模块（剧情推进、态度状态、保存系统、知识编译/检索、prompt 构造、AI 流编排）单测均 ≥ 90%。
- **smoke 脚本**：`pnpm smoke:dialogue`、`pnpm smoke:openai`、`pnpm playthrough` 三个手测入口。
- **文档**：架构与契约文档、资产请求清单、UI review 笔记、首版发布前 audit 报告，全部归档在 `docs/`。

### Security · 安全

- 渲染层走 `sandbox: true` + `nodeIntegration: false`；所有原生能力通过 7 层 IPC 契约（schema → type → main handler → preload bridge → 渲染层 zod 校验包装器）访问。
- `pnpm audit --prod` 0 漏洞。
- 仓库内未发现明文 API Key 泄漏。

### Known Limitations · 已知限制

- `runtime-state.json` 中的 `settings.openAiCompatible.apiKey` 仍为明文存储；下一版将迁入 Electron `safeStorage` / OS keychain。
- 仅 `kunlun-myth-overview.md` 一篇知识库条目；后续每个节点至少补一篇专属条目。
- 安装包：本版以 `pnpm dev` / `pnpm start` 直跑模式发布；后续将用 `electron-builder` 出 Windows 安装包。
- 美术资产：`docs/asset-requests/backgrounds/` 仍待回货，目前部分节点使用占位 SVG。

[0.1.0]: https://github.com/SpeechlessPanda/kunlungame/releases/tag/v0.1.0
