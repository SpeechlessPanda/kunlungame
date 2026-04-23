# 本地模型运行时方案

## 目标

当前项目采用双模型方案：

1. 默认模式：Qwen2.5-7B-Instruct GGUF 4-bit。
2. 兼容模式：Qwen2.5-3B-Instruct GGUF 4-bit。

## 推理与分发策略

1. 默认推理运行时为内置 llama.cpp 类 Node 侧运行时。
2. 软件安装包不直接塞入模型权重文件。
3. 用户安装后，由应用首次启动或设置页触发模型自动下载。
4. 开发态缓存目录使用 `runtime-cache/models`。
5. 打包后缓存目录使用用户级 app data 目录下的 `models` 子目录。

## 模型文件

默认模式：

1. 仓库：`Qwen/Qwen2.5-7B-Instruct-GGUF`
2. 文件：
   - `qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf`
   - `qwen2.5-7b-instruct-q4_k_m-00002-of-00002.gguf`

兼容模式：

1. 仓库：`Qwen/Qwen2.5-3B-Instruct-GGUF`
2. 文件：
   - `qwen2.5-3b-instruct-q4_k_m.gguf`

## 分层上下文

每轮送入模型的上下文固定按以下顺序组装：

1. 固定规则。
2. 当前节点。
3. 检索知识。
4. 历史摘要。
5. 最近对话。

## 主线 prompt 约束

1. 当前 prompt builder 会把 system prompt 固定为中文输出、陪伴式表达、单主线不分叉、二选一语义固定映射。
2. 当前节点会显式带入 `coreQuestion`、`summary`、`mustIncludeFacts`。
3. `forbiddenFutureTopics` 会被写入 prompt，作为反剧透边界。
4. 当前玩家倾向会被翻译为 `附和型` 或 `反驳型`，但不会改变主线事实或节点顺序。

## 对话事件契约

当前对话编排 facade 已固定以下事件类型：

1. `chunk`：流式文本片段。
2. `options`：两个动态中文选项，分别映射 `align` 与 `challenge`。
3. `complete`：本轮输出正常结束。
4. `error`：本轮输出失败，并带 `retryable` 标记。

事件顺序约束：

1. 文本片段先于选项事件。
2. 选项事件晚于所有 `chunk`。
3. 成功路径最后必须是 `complete`。
4. 失败路径不得伪装成 `complete`。

## 打包适配要求

1. 安装包内需要包含下载器、模型清单和缓存目录逻辑。
2. 安装包不应强依赖用户手工安装 Ollama。
3. 应用应支持默认模式与兼容模式切换。
4. 没有合适 GPU 时，可以给用户显式选择继续低速运行或切换兼容模式。
5. 桌面壳启动时应先根据用户偏好、可用显存和打包状态生成 runtime bootstrap plan，再决定当前加载哪个模型以及是否触发下载。

## 当前已落地的适配点

1. 已有双模型清单。
2. 已有开发态与打包态模型缓存路径解析。
3. 已有分层上下文构造器。
4. 已有模型下载脚本与清单写入逻辑，Windows 侧统一使用 `curl.exe` 顺序下载并支持断点续传，不再依赖 BITS 或 `Invoke-WebRequest` 回退链。
5. 下载脚本现在会在文件下载后执行完整性校验，优先使用远端 `content-length` 与 `x-linked-etag` 做大小和 SHA256 校验。
6. 每个模型 profile 下载完成后会自动执行一次本地冒烟测试；若失败，会清理该 profile 文件并自动重下一次后再测。
7. 清单记录已扩展为可写入 `verifiedAt` 与 `smokeTestedAt` 时间戳，供后续用户端设置页或诊断页消费。
8. 已有 runtime bootstrap plan，可供后续 Electron 启动阶段直接消费。
9. 已有桌面壳模型检查编排器 `src/modeling/modelSetupPlanner.ts`，可在首次启动和设置页入口统一生成启动动作、模型可用性状态和 UI 事件契约。
10. 已有 `src/modeling/storyPromptBuilder.ts` 与 `src/modeling/dialogueOrchestrator.ts`，可为后续真实模型流式接入提供稳定的 prompt 和事件边界。
11. 已有 `src/modeling/localDialogueDependencies.ts`，可把 `node-llama-cpp` 封装为可注入的本地流式依赖，并在首个文本 chunk 发出前失败时执行一次受控自动重试。
12. 已有 `desktop:run-dialogue-smoke` bridge 与 `pnpm dialogue:smoke` 命令，可触发主线首节点、知识检索、prompt builder、orchestrator 和本地 llama adapter 的单轮联调。

## 当前已验证状态

1. 3B 模型已通过最小中文对话冒烟测试。
2. 7B 模型先前的运行失败已定位为第一分片文件损坏；重新下载并校验后，7B 模型也已通过最小中文对话冒烟测试。
3. 当前下载链路需要在用户端保留主源失败后自动切镜像的恢复路径，这在本地修复过程中已经被实际触发验证。
4. 当前仓库已对白盒验证本地流式对话适配器，确认 chunk 可按顺序转发，且仅在首个 chunk 发出前失败时执行自动重试，避免半途重放导致重复文本。
5. `pnpm dialogue:smoke` 当前会显式检查开发态与用户目录两组模型路径；在本次工作机上，由于四个候选路径都没有 GGUF 文件，真实联调被准确阻塞在模型资产缺失，而非代码异常。

## 下载执行约束

1. 同一时刻只允许一条模型下载链运行。
2. 下载脚本会在模型缓存目录下创建临时锁文件，防止重复启动导致同一模型文件被多个进程同时写入。
3. 如果锁文件残留，应先确认没有存活的下载进程，再手工清理锁文件并重试。
4. 若主下载源失败，应自动切换镜像重试。
5. 若完整性校验失败，应删除坏文件并重新下载，不能把校验失败的文件写入 manifest。
6. 若模型冒烟测试失败，应把该 profile 视为不可用并触发一次自动修复重下；若仍失败，则向上层报告明确错误而不是静默通过。

## 桌面壳与设置页接口保留

当前仓库已经落下最小 Electron/Vue 桌面壳，但仍未进入正式 UI 实现阶段，因此本轮只把壳层与后续设置页需要消费的接口接通，不展开视觉和交互细节。

1. 首次启动与设置页都应通过 `buildModelSetupPlan()` 获取当前模型模式、已下载状态、默认动作和设置页落点。
2. 首次启动在 `shellAction = auto-download-required` 时应自动触发下载，不再等待二次确认。
3. 设置页在 `shellAction = settings-download-required` 时只进入模型页检查态，由用户主动点击开始或重试。
4. UI 层需要监听以下固定通道：`model-download:start`、`model-download:progress`、`model-download:status`、`model-download:issue`、`model-download:cancel`。
5. UI 需要覆盖以下阶段：`checking`、`queued`、`downloading`、`switching-to-mirror`、`completed`、`failed`。
6. 失败态需要直接展示恢复动作：重试下载、切换镜像、打开网络帮助；默认模式下还应允许切换兼容模式。
7. 当前最小桌面壳已暴露 `desktop:ping` 与 `desktop:get-startup-snapshot` IPC，并在预加载层以白名单 `window.kunlunDesktop` 形式提供给渲染层。
