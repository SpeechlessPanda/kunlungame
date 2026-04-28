# 本地模型运行时方案

## 目标

当前项目默认推荐 OpenAI-compatible API 模型；三档本地 GGUF 模型保留为离线兜底：

1. API 推荐档：OpenAI-compatible Chat Completions streaming，默认 `https://api.openai.com/v1` + `gpt-4o-mini`。
2. 默认本地质量档：Qwen2.5-3B-Instruct GGUF Q4_K_M。
3. Lite 本地兜底档：Qwen2.5-1.5B-Instruct GGUF Q4_K_M，用于低显存或纯 CPU 机器。
4. Pro 本地可选档：Qwen2.5-7B-Instruct GGUF Q3_K_M，需要用户显式选择。

推荐 API 模型：`gpt-4o-mini` 速度、成本和中文质量平衡最好；`gpt-4.1-mini` 指令遵循更强，适合更重视剧情约束的体验；`gpt-4o` 中文表达更细腻但成本更高。当前只支持 OpenAI-compatible `/chat/completions` 流式格式。

## 推理与分发策略

1. 新存档默认 `settings.modelProvider = openai-compatible`；配置 API key 后主线回合跳过本地 GGUF 文件检查，直接走远程流式适配器。
2. 当 API provider 未配置 key 或显式选择 `local` 时，回落到内置 llama.cpp 类 Node 侧运行时。
3. 软件安装包不直接塞入模型权重文件。
4. 用户安装后，由应用首次启动或设置页触发模型自动下载。
5. 开发态缓存目录使用 `runtime-cache/models`。
6. 打包后缓存目录使用用户级 app data 目录下的 `models` 子目录。

## 模型文件

默认质量档：

1. 仓库：`Qwen/Qwen2.5-3B-Instruct-GGUF`
2. 文件：
   - `qwen2.5-3b-instruct-q4_k_m.gguf`

Lite 兜底档：

1. 仓库：`Qwen/Qwen2.5-1.5B-Instruct-GGUF`
2. 文件：
   - `qwen2.5-1.5b-instruct-q4_k_m.gguf`

Pro 可选档：

1. 仓库：`Qwen/Qwen2.5-7B-Instruct-GGUF`
2. 文件：
   - `qwen2.5-7b-instruct-q3_k_m.gguf`（单文件 ~3.81 GB，Q3_K_M 量化档）

   说明：Pro 档原本使用 Q4_K_M 双分片（~4.5 GB），为了让 7B 在 RTX 4060 8GB 上
   token gen 全量层落入显存，已切换到 Q3_K_M 单文件。中文 ppl 退化 < 3%，galgame
   叙事可接受；速度提升 ~15-20%；下载/校验链路也由分片合并简化为单文件。如需更高
   质量基准，可在开发机上手工拉取 Q4_K_M 或 Q5_K_M 做离线对比。

## 分层上下文

每轮送入模型的上下文固定按以下顺序组装：

1. 固定规则。
2. 当前节点。
3. 检索知识 RAG cards。
4. 历史摘要。
5. 上文连续性：最近模型回复经清洗压缩后进入 prompt，用于保持逻辑衔接。
6. 最近对话的禁用开场/口癖指纹。

## 主线 prompt 约束

1. 当前 prompt builder 会把 system prompt 固定为中文输出、`昆仑子`文化引路人口吻、单主线不分叉、二选一语义固定映射。
2. 当前节点会显式带入 `coreQuestion`、`summary`、`mustIncludeFacts`。
3. 检索条目会被格式化为 RAG cards，包含来源、主题、事实要点和讲述方式提示；模型必须用当前人物口吻重组这些事实，不能照抄条目。
4. `forbiddenFutureTopics` 与当前节点之后所有主线节点的关键词会被写入 prompt，作为反剧透边界。
5. 3B / 1.5B 严格覆盖模式会要求 3-4 个自然段、足够长度和当前节点事实覆盖；如果模型首答太短、段落不足或关键词覆盖不足，会用同一个本地模型再跑一次窄化修复 prompt。
6. 当前玩家倾向会被翻译为 `附和型` 或 `反驳型`，但不会改变主线事实或节点顺序。
7. prompt 明确要求只面对一个玩家说话，称呼为 `你`，不得把玩家称为 `你们`；除非是在引用历史群体或多人场景。

## 本地性能与 GPU 诊断

1. 本地运行仍使用 `getLlama({ gpu: 'auto' })`，`KUNLUN_FORCE_CPU=1` 可强制 CPU 以排查驱动问题。
2. 启动本地会话时会输出一次 `[kunlun:llama] backend=... gpuOffload=... device=... vram=...`，用于确认是否实际用上 CUDA/Vulkan/Metal 与显存。
3. 已知无害的 `control-looking token '</s>' was not control-type` tokenizer warning 会被静默过滤；其他 warning/error 仍会输出。
4. 本地上下文目标从 8192 调整为 3072-4096 bounded range，配合 `gpuLayers.fitContext`、`batchSize: 512` 与 `flashAttention: true`，降低显存压力和首 token 延迟。
5. 本地默认输出上限从 512 token 降到 320 token；远程 API adapter 默认 420 token，以优先保证对话节奏。

## 对话事件契约

当前对话编排 facade 已固定以下事件类型：

1. `chunk`：流式文本片段。
2. `options`：两个动态中文选项，分别映射 `align` 与 `challenge`。
3. `complete`：本轮输出正常结束。
4. `reset`：当前草稿被质量修复回合替换，UI 必须清空已显示文本并继续接收后续 `chunk`。
5. `error`：本轮输出失败，并带 `retryable` 标记。

事件顺序约束：

1. 文本片段先于选项事件。
2. 如果触发质量修复，`reset` 晚于首答 `chunk`、早于修复后的 `chunk`。
3. 选项事件晚于最终保留的所有 `chunk`。
4. 成功路径最后必须是 `complete`。
5. 失败路径不得伪装成 `complete`。

## 桌面 IPC 流式链路

主线对话在桌面模式下优先使用 `streamMainlineTurn()`，把 Node 侧 `node-llama-cpp` token/chunk 通过请求专属 IPC 通道实时送到渲染层。

1. 预加载层为每轮生成 `desktop:mainline-turn-stream:<requestId>` 通道，并通过 callback 把 `DesktopMainlineTurnStreamEvent` 逐个送入渲染层；不要跨 `contextBridge` 返回 `AsyncIterable`，因为带 `Symbol.asyncIterator` 的对象不能被 Electron structured clone。
2. 主进程执行 `desktop:stream-mainline-turn` 时，把模型 chunk 立即发送为 `{ type: 'chunk', text }`，不等待整轮结束。
3. 渲染层 bridge client 逐个校验事件 schema；adapter 在渲染进程内把 callback 事件包装成队列供 orchestrator 消费，缺失流式接口时才回退到旧的 `runMainlineTurn()` 批量结果。
4. 质量修复回合被接受时，主进程先发送 `{ type: 'reset' }`，再发送修复后的 chunk，避免 UI 保留被废弃的短答。
5. 最终结果仍以 `{ type: 'result', result }` 到达，供选项、profile、fallback 状态和持久化摘要使用。

## 打包适配要求

1. 安装包内需要包含下载器、模型清单和缓存目录逻辑。
2. 安装包不应强依赖用户手工安装 Ollama。
3. 应用应支持默认质量档、Lite 兜底档与 Pro 档切换。
4. 没有合适 GPU 时，可以给用户显式选择继续默认 3B 低速运行或切换 Lite 兜底档。
5. 桌面壳启动时应先根据用户偏好、可用显存和打包状态生成 runtime bootstrap plan，再决定当前加载哪个模型以及是否触发下载。

## 当前已落地的适配点

1. 已有默认 3B、Lite 1.5B、Pro 7B 三档模型清单。
2. 已有开发态与打包态模型缓存路径解析。
3. 已有分层上下文构造器。
4. 已有模型下载脚本与清单写入逻辑；CLI 与应用内下载都复用 `src/modeling/profileDownloader.ts` 的 fetch streaming 下载、断点续传、镜像切换与字节级进度能力。
5. 共享下载链路会在文件下载后执行完整性校验，优先使用远端 `content-length` 与 `x-linked-etag` 做大小和 SHA256 校验。
6. 每个模型 profile 下载完成后会自动执行一次本地冒烟测试；若失败，会清理该 profile 文件并自动重下一次后再测。
7. 清单记录已扩展为可写入 `verifiedAt` 与 `smokeTestedAt` 时间戳，供后续用户端设置页或诊断页消费。
8. 已有 runtime bootstrap plan，可供后续 Electron 启动阶段直接消费。
9. 已有桌面壳模型检查编排器 `src/modeling/modelSetupPlanner.ts`，可在首次启动和设置页入口统一生成启动动作、模型可用性状态和 UI 事件契约。
10. 已有 `src/modeling/storyPromptBuilder.ts` 与 `src/modeling/dialogueOrchestrator.ts`，可为后续真实模型流式接入提供稳定的 prompt 和事件边界。
11. 已有 `src/modeling/localDialogueDependencies.ts`，可把 `node-llama-cpp` 封装为可注入的本地流式依赖，并在首个文本 chunk 发出前失败时执行一次受控自动重试。
12. 已有 `desktop:run-dialogue-smoke` bridge 与 `pnpm dialogue:smoke` 命令，可触发主线首节点、知识检索、prompt builder、orchestrator 和本地 llama adapter 的单轮联调。
13. 已有 `desktop:stream-mainline-turn` bridge，可把主进程生成中的文本 chunk 实时推入 UI；旧 `desktop:run-mainline-turn` 保留为兼容回退。
14. 已有 OpenAI-compatible 远程 adapter；配置 API key 时主线会跳过本地模型文件检查，并保留 system/user role 分离与 SSE 增量输出。

## 当前已验证状态

1. 代码级默认档是 `qwen2.5-3b-instruct-q4km`；只有显式切换 Compatibility 或 VRAM 明确低于 4GB 时才会降到 `qwen2.5-1.5b-instruct-q4km`。
2. 当前工作机的 `runtime-cache/models` 下已存在 1.5B、3B、7B 三档 GGUF 文件，可用于真实本地联调。
3. 当前下载链路需要在用户端保留主源失败后自动切镜像的恢复路径，这在本地修复过程中已经被实际触发验证。
4. 当前仓库已对白盒验证本地流式对话适配器，确认 chunk 可按顺序转发，且仅在首个 chunk 发出前失败时执行自动重试，避免半途重放导致重复文本。
5. 当前仓库已对白盒验证桌面 IPC 流式链路，确认 preload 请求通道、renderer adapter、schema guard 与 session reset 都能按事件顺序工作。
6. 2026-04-27 真实 Electron UAT 已确认构建版显示 `本地 AI · Quality Mode`，DOM 文本在选项出现前持续增长：首个可见字符约 6.56s，选项约 15.17s，最终文本 373 字。
7. 渲染层右下角会显示 `API 模型 · <model>`、`本地 AI · Quality Mode · 3B`、`本地 AI · Lite Mode · 1.5B`、`本地 AI · Pro Mode · 7B` 或 `预览脚本模式`，用于区分远程 API、本地 GGUF 与浏览器/Playwright mock 路径。
8. 2026-04-27 真实 smoke 已确认默认运行 `qwen2.5-3b-instruct-q4km`、`fallbackUsed = false`；短答会触发质量修复回合，最终输出覆盖《山海经》、世界中心/天柱、樊桐/玄圃/阆风、西王母等当前节点知识点。

## 下载执行约束

1. 同一时刻只允许一条模型下载链运行。
2. 下载脚本会在模型缓存目录下创建临时锁文件，防止重复启动导致同一模型文件被多个进程同时写入。
3. 如果锁文件残留，应先确认没有存活的下载进程，再手工清理锁文件并重试。
4. 若主下载源失败，应自动切换镜像重试。
5. 若完整性校验失败，应删除坏文件并重新下载，不能把校验失败的文件写入 manifest。
6. 若模型冒烟测试失败，应把该 profile 视为不可用并触发一次自动修复重下；若仍失败，则向上层报告明确错误而不是静默通过。
7. CLI 下载脚本只保留批量 profile、锁文件与 smoke repair 编排；下载、校验、manifest 写入策略不得再在脚本里另起一套实现。

## 桌面壳与设置页接口保留

当前仓库已经落下 Electron/Vue 桌面壳与“玉牍星幕”视觉小说界面，模型设置页直接消费以下接口。

1. 首次启动与设置页都应通过 `buildModelSetupPlan()` 获取当前模型模式、已下载状态、默认动作和设置页落点。
2. 首次启动在 `shellAction = auto-download-required` 时应自动触发下载，不再等待二次确认。
3. 设置页在 `shellAction = settings-download-required` 时只进入模型页检查态，由用户主动点击开始或重试。
4. UI 层需要监听以下固定通道：`model-download:start`、`model-download:progress`、`model-download:status`、`model-download:issue`、`model-download:cancel`。
5. UI 需要覆盖以下阶段：`checking`、`queued`、`downloading`、`switching-to-mirror`、`completed`、`failed`。
6. 失败态需要直接展示恢复动作：重试下载、切换镜像、打开网络帮助；默认模式下还应允许切换兼容模式。
7. 当前最小桌面壳已暴露 `desktop:ping` 与 `desktop:get-startup-snapshot` IPC，并在预加载层以白名单 `window.kunlunDesktop` 形式提供给渲染层。
8. 自 2026-04-25 起预加载桥以同步 `require('electron')` 注册，避免渲染层 `onMounted` 在 `await import('electron')` 之前抢先读取 `window.kunlunDesktop` 而被永久锁在 mock；构建版 preload 必须打成 sandbox 兼容的 CommonJS 产物 `out/preload/index.cjs`，否则 bridge 不会注入；同时 `kunlunDesktop.quitApp()` 已经接到 `desktop:quit-app` 主进程 handler，供主线结尾的"退出游戏"按钮使用。
9. 渲染层在右下角持久显示 `本地 AI · Quality Mode · 3B`、`本地 AI · Lite Mode · 1.5B`、`本地 AI · Pro Mode · 7B` 或 `预览脚本模式` 的小标识（`data-testid="ai-source-chip"`），用于在 `pnpm dev` 中肉眼确认当前一轮对话是否真的走了本地 GGUF 流式接口而非演示脚本。
