# Delta 2026-04-24：Galgame 小妹妹人格 + 结局收束 + 可爱风 UI

本文记录 2026-04-24 这一轮对「Part 04 / Part 05 / Part 06 / Part 07」的
增量修改。正式规范不再单独重写，所有新增行为以本文件为准，直到被后续
spec 合入或取代。

## 1. 运行时层（Part 04 增量）

1. `runtimeState` 新增 `isCompleted: boolean` 字段，默认值 `false`。
2. `applyPlayerChoice`：当 `currentNode.nextNodeId === null` 时，落点节点
   保持不变（仍然停留在终章节点），但把 `isCompleted` 置为 `true`。
3. 存档层（`saveRepository` + 桌面 bridge）必须无损地序列化/反序列化
   `isCompleted`。现有快照如果没有这个字段，应默认 `false`（由 zod 默认值
   接管）。
4. UI 层对结局有两种处理：
   - 正常主线轮：和以前一致。
   - 结局轮（`isCompleted === true`）：玩家点击选项后不再进入下一节点，
     而是调用 `beginMainline()` 重新开始一轮旅程，作为"再走一次"。

## 2. AI 编排（Part 05 增量）

1. 系统提示重写为"昆仑——十六七岁可爱小妹妹文化陪伴者"的人格：
   - 第一人称"我"，称呼玩家"你"，轻撒娇语气（诶呀 / 唔 / 嘻嘻 每段最多一次）。
   - 短句、逗号停顿、小动作描写每段最多一处；讲到文化史实立刻收紧、认真、准确。
   - 每轮开场禁止与上一轮雷同（即使节点重启也要换个切入点）。
   - 结尾自然抛出一个追问，引出两个玩家回应之一。
   - 总长度 180–260 字，3–5 段。
2. 用户提示按轮次 / 态度分层注入：
   - `describeFamiliarity(turnIndex)`：拘谨 → 放松 → 朋友闲聊。
   - `describeAttitudeScore(attitudeScore)`：共同视角 / 中性 / 补史实。
   - `describeToneForAttitude(choiceMode)`：align=亲昵，challenge=先承认对方 + 补史实 + 一点委屈小情绪。
   - 追加 `禁止提前涉及：…` 字样，避免越过节点边界剧透。

## 3. Mock 流 & Bridge 工厂（Part 05 / Part 08 增量）

1. `buildMockDialogueDependencies` 新增选项 `turnIndex / attitudeScore /
   attitudeChoiceMode / isEnding`。
2. 普通轮：基于 `turnIndex + attitudeScore + attitudeChoiceMode` 挑开场 / 结尾
   变体（`ALIGN_OPENERS` / `CHALLENGE_OPENERS` / `SOFT_TAIL_VARIANTS`），
   确保"开始游戏输出一样"的问题消失。
3. 结局轮：读取 `ENDING_POSITIVE / NEUTRAL / SKEPTICAL` 中的一条，并把选项
   标签替换成"再走一次 / 收下结局"。
4. `createDefaultDialogueDependenciesFactory` 把
   `runtimeState.turnIndex / attitudeScore / isCompleted` 透传给 mock。
5. 真机 Bridge 工厂在 `isCompleted === true` 时不再调用本地模型，直接走
   mock 的结局分支，避免为"谢幕"再起一次 llama 推理。

## 4. UI 与视觉（Part 06 / Part 07 增量）

1. 设计令牌（`src/renderer/styles/tokens.css`）整体从深色转向 galgame
   可爱风：奶油底 + 樱粉 + 薄荷 + 珊瑚，圆角半径升到 18 / 28 / pill，
   字体族新增 `--font-display`（LXGW WenKai 优先）。
2. `DialogPanel`：对话框上方新增 galgame 风「名字牌」（圆角 pill，粉色
   渐变，内含爱心符号 + 角色名），空态 / 错误态文案换成小妹妹语气。
3. `ChoicePanel`：
   - 去掉"顺从 / 反驳"这种设计语言暴露。只保留 `1` / `2` 数字 chip，`aria-label`
     改为"第一个回应 / 第二个回应"。
   - 按钮改成大圆角 + 柔和阴影 + 弹性 hover（`--ease-bouncy`），align 用薄荷绿、
     challenge 用珊瑚橙。
4. `prefers-reduced-motion` 和 `prefers-contrast: more` 下均降级。

## 5. 测试覆盖

1. 新增白盒：`storyPromptBuilder.test.ts` 增加 "challenge + 后期轮" 用例，
   断言提示包含"怀疑或反驳 / 主动调侃、打趣 / 具体的史实、时间、地名"。
2. 回归：所有既有单元 / Vue 组件 / Playwright e2e 测试在 pnpm test + pnpm
   playwright test 全绿通过（155 单测 / 12 e2e）。
3. 覆盖策略：保持 Part 04 的运行时总行覆盖 ≥80% 的要求；新增分支
   （`isCompleted` + opener 变体）由既有集成测用例覆盖。

## 6. 未完 / 延迟

1. 立绘资源仍未替换为正式的可爱风昆仑立绘。当前 `CharacterSlot` 采用占位样式，
   待美术资产就位后再换文件名 / 语义槽即可。
2. UI 文案里"昆仑"既是世界名又是角色名，后续如果起一个更贴近"小妹妹"
   的昵称（例如"琨琨"），需要同时更新 `storyPromptBuilder` 的人设和 DialogPanel
   名字牌默认值。

## 7. 2026-04-24 Round 2：提示层第二次收敛

首轮真机 3B 游玩日志（`test-results/playthroughs/playthrough-compatibility-alt-2026-04-24T10-44-35-810Z.md`）
暴露出三个新问题：

1. **跨轮复述**：3 轮开场几乎完全一致，中段人物/地名列表被逐字复制。
2. **人设只守前两句**：小妹妹语气只在开头一两段生效，后面迅速退化为百科条目。
3. **傲娇/好感度基本不影响风格**：挑选 align 还是 challenge 输出差异极小。

### 7.1 修复策略

1. **彻底不再把"上一轮正文"发给模型**。
   - 新 `LayeredContextInput` 删除 `recentTurns`，改为
     `recentTurnFingerprints?: string[]` + `avoidOpeners?: string[]` +
     `forbiddenProperNouns?: string[]`。
   - `storyPromptBuilder` 通过 `collectTurnFingerprints` 只抽取每轮头 24 字 /
     尾 26 字 / 一个中段整句（正则 `/[。！？?!]([^。！？?!]{6,40})[。！？?!]/`），
     作为"禁句"列表注入，不再给模型看成型段落。
2. **禁用专名显式化**。
   - `collectForbiddenProperNouns(currentNode)` 沿 `forbiddenFutureTopics →
     mainlineStoryOutline → retrievalKeywords + recommendedFigures` 解析出
     具体人物/事件/典籍名，以"禁止提前出现的专名"段插入提示（从"话题 id"
     升级到"盘古 / 女娲 / 大禹 / …"）。
3. **态度即时校准**。
   - `describeAttitudeScore` 改为 7 档（+3/+2/+1/0/-1/-2/-3），每档给出具体
     语气动作指令。
   - 系统提示新增 `## 本轮态度即时校准 (score=X, 选择=Y)` 段，明确要求
     贯穿每一段而非仅首段。
4. **采样层加压**。
   - `realLlamaSession`：`temperature 0.88`、`topP 0.92`、`repeatPenalty
     { penalty: 1.22, lastTokens: 640, frequencyPenalty: 0.55,
     presencePenalty: 0.55 }`。
5. **格式防泄漏**。
   - 系统提示末尾显式列出禁止输出：`[[PREV_REPLY`、`历史轮`、`---`、`===`、
     markdown 标题、`System:` / `User:` 前缀。

### 7.2 测试

- `layeredContextBuilder.test.ts` 重写：校验新段落顺序与负样本注入，断言
  不再出现 `[[PREV_REPLY_\d+]]` 形式的块（字面串允许出现在禁用清单里）。
- `storyPromptBuilder.test.ts` 新增两条：指纹 + 专名注入用例、7 档态度
  专属语气子句用例。
- 全量 `pnpm test -- --run` 通过：32 test files / 176 tests。

### 7.3 相关 skill

`.copilot/skills/small-llm-prior-reply-trap.md` 记录"不要把上一轮原文喂给
小模型"的失败信号 / 根因 / 已验证修复，便于未来类似任务复用。

### 7.4 保底 sanitizer（`src/modeling/replyCleanup.ts`）

即使 prompt 层做到极致，7B 仍会偶发地带出：
- 行首角色标签 `昆仑：`、`kunlun:`；
- `---` / `===` / markdown 标题 / `[[PREV_REPLY_N]]` / `System:` 前缀；
- 某一句话在多轮之间被一模一样地重复。

`sanitizeMainlineReply(raw, { recentTurns })` 在 `mainlineTurnRunner` 组装
`combinedText` 之前跑一次：
- 逐行剥离角色标签与结构性噪声；
- 以句末符号切句，任何长度 ≥10 字且与 `recentTurns` 任一轮完全相同的句子
  整句删除（短插入词如"嘻嘻"不会被误删）；
- 折叠连续空行，最终 `trim`。

测试：`tests/replyCleanup.test.ts` 覆盖角色标签、markdown 标题、行内 PREV_REPLY
tag、跨轮复读、短语保留、空行折叠 6 条。与主要 runner 组合后全量单测
33 files / 182 tests 通过。


## 8. 2026-04-24 Round 3：模型瘦身 + GPU 自动侦测 + 三档切换

### 8.1 问题

7B Q4_K_M 在纯 CPU 上实测单轮 6 分钟（mainline loop 里多次观察到超时），
即便通过 Vulkan 打到 RTX 4060 Laptop 上也仍要 ~18 秒/轮。面向最终用户时
不能假设每台 Windows PC 都有独显 + 8GB VRAM，需要把默认体验压到"接近
即时对话"（单轮 3-5 秒）。

### 8.2 三档 profile 重组

- **Instant Mode（新默认）**：`qwen2.5-1.5b-instruct-q4km`，单文件 ~1.12GB，
  `recommendedGpuVramGb: 0`，纯 CPU 目标 ~3-5 秒/轮。
- **Quality Mode（兜底升级）**：`qwen2.5-3b-instruct-q4km`，单文件 ~2GB，
  `recommendedGpuVramGb: 4`。原"Compatibility Mode"重命名。
- **Pro Mode（可选）**：`qwen2.5-7b-instruct-q3km` 单文件 ~3.81GB，
  `recommendedGpuVramGb: 8`，只对有独显的玩家开放。
- `getAllModelProfiles()` 只返回 Instant + Quality；Pro 通过
  `getOptionalModelProfiles()` 暴露，`pnpm models:download` 默认不拉 Pro。

### 8.3 GPU 自动侦测

- `src/modeling/realLlamaSession.ts`：之前硬编码 `gpu: false`（CPU 独占，
  导致 7B 体验塌方）。改为 `const forceCpu = process.env.KUNLUN_FORCE_CPU === '1';
  const llama = await getLlama({ gpu: forceCpu ? false : 'auto' })`。
  node-llama-cpp 的 Vulkan 后端会自动识别独显；环境变量作为调试 / 降级开关。

### 8.4 strictCoverage 语义更新

- `mainlineTurnRunner` / `dialogueSmokeTest` 原逻辑：仅 3B fallback 启用
  strictCoverage。现改为"非 Pro 档位一律 strict"——1.5B 比 3B 指令遵循
  更弱，更需要"必须按顺序覆盖 mustIncludeFacts"的强约束。

### 8.5 渲染层

- `App.vue` 里 `isFallbackModel` 原意是"运行在非首选档位时提示叙事密度压缩"。
  新语义：只要不在 Pro Mode，都算轻量模型，StatusBar 会继续显示压缩胶囊。

### 8.6 测试

- `tests/modelProfiles.test.ts` 全部重写：断言 1.5B Instant 默认 / 3B Quality
  fallback / 7B Pro 可选 / `getAllModelProfiles` 不含 Pro。
- `tests/runtimeBootstrap.test.ts`、`tests/modelSetupPlanner.test.ts`、
  `tests/dialogueSmokeTest.test.ts` 同步更新预期 profileId 到 1.5B。
- 全量：33 test files / 184 tests 绿。

### 8.7 未完成（当前网络阻塞）

- 本地 `pnpm models:download` 尚未成功拉取 1.5B——HF 主源与 hf-mirror
  在本机当前都返回 fetch timeout；同一个网络问题此前已导致 `git push`
  失败。网络恢复后需补：
  1. `pnpm models:download` 取到 `qwen2.5-1.5b-instruct-q4_k_m.gguf`；
  2. 重跑 `pnpm playthrough --pattern=alt --maxNodes=1 --turnsPerNode=3`
     实测单轮 <= 5 秒、AI 仍能读节点 + 知识库并按态度分档输出；
  3. 若 GPU 档跑 1.5B 出现显存浪费，可在 `realLlamaSession` 里加
     `vramPadding` 上限；
  4. 把 7B Pro 档做成 UI 里的"可选升级"入口（下载触发 + 占位 placeholder
     告知体积 / 硬件要求）。

### 8.8 Round 3 修正：1.5B 实测质量不足，回退 3B 默认 + 1.5B 降级 Lite

1.5B 下载成功后做了一次 `pnpm playthrough --pattern=alt --maxNodes=1
--turnsPerNode=3`（日志：`test-results/playthroughs/playthrough-default-alt-2026-04-24T14-30-07-142Z.md`）。
观察到的质量退化：

- **延迟达标**：3 轮 elapsed 分别 9585 / 9861 / 5504 ms，确实接近"即时"。
- **复述被禁用开场**：轮 2 正文出现「记得上次我跟你说过为什么我们从这里
  开始回望自己吗」—— 这是在 persona system prompt 里被明确列为 `forbiddenOpeners`
  的句式。3B 档位在相同 prompt 下从不破防。
- **scrubbed 口癖漏出**：轮 2 出现「对嘛」等被 `sanitizeMainlineReply`
  在 7B/3B 档位已压下去的口癖。
- **截断**：轮 3 只有 88 字，低于 mustIncludeFacts 需要的覆盖密度，
  strictCoverage 无法校验完整。

根因：Qwen2.5-1.5B 对 fingerprint 负样本清单 + `forbiddenOpeners` +
`mustIncludeFacts` 的多重约束指令遵循显著弱于 3B，小模型上限就在这里，
单靠 prompt / sanitizer 不能补齐。

**决策（2026-04-24）**：

- 把 **3B Quality Mode 恢复为默认档位**（`qwen2.5-3b-instruct-q4km`）。
  GPU 档 ~6-15 秒/轮，纯 CPU 30-60 秒/轮，相对"即时"做了取舍但质量稳定
  （同一 playthrough pattern=alt 下轮 1/2/3 chars 392/309/44，典故引用
  正确，无复述 forbiddenOpeners）。
- 把 **1.5B 降级为 Lite Mode 可选档位**，保留在 `getAllModelProfiles()`
  里作为真·纯 CPU 老旧机器的兜底（`preferredMode: 'compatibility'` 时选用），
  文档上标注"可能复述禁用开场 / mustIncludeFacts 不全"，用户自觉取舍。
- 7B Pro 档维持通过 `getOptionalModelProfiles()` 暴露、默认不下载。
- strictCoverage 语义保持"非 Pro 一律 strict"，1.5B / 3B 都走 strict 路径。

配套同步：

- `src/modeling/modelProfiles.ts` 三档 default/fallback/pro 重排并更新注释。
- `tests/modelProfiles.test.ts`、`tests/runtimeBootstrap.test.ts`、
  `tests/modelSetupPlanner.test.ts`、`tests/dialogueSmokeTest.test.ts`
  断言同步到"3B 默认 / 1.5B fallback / 7B 可选"。
- 全量 `pnpm test -- --run`：33 test files / 184 tests 绿。
- 3B 默认档 playthrough 复跑通过（`test-results/playthroughs/playthrough-default-alt-2026-04-24T14-33-17-713Z.md`）。


## 9. 2026-04-24 Round 4：Settings 面板新增模型档位选择器

### 9.1 动机

§8.8 决策下来后，3B Quality Mode 是默认，1.5B Lite 作为纯 CPU 兜底、7B Pro
可选。但这三档在运行时完全靠 preferredMode 硬编码为 'default' 开机，
玩家不能在不改环境变量的前提下切换档位。这一节把三档显式暴露到 Settings
UI，交给用户在游戏内自主选择。

### 9.2 类型 / 状态 / bootstrap 联动

- `src/modeling/runtimeBootstrap.ts`: `preferredMode` 从
  `'default' | 'compatibility'` 扩展为 `'default' | 'compatibility' | 'pro'`，
  导出 `PreferredModelMode` 类型。`buildRuntimeBootstrapPlan` 里
  `'pro'` 强制选 `getProModelProfile()`，其它路径保持原逻辑。
- `src/runtime/runtimeState.ts`: `runtimeSettingsSchema` 新增
  `preferredModelMode`，zod 默认值 `'default'`，旧存档加载时自动补齐。
- `src/shared/types/desktop.ts`: `DesktopSerializedRuntimeState.settings`
  同步加 `preferredModelMode` 字段。
- `src/renderer/adapters/rendererDialogueDependencies.ts` 的
  `serializeRuntimeState` 把 `preferredModelMode` 也串到桥。
- `electron/main/index.ts` 的 `runDesktopMainlineTurn` 解析完
  `request.runtimeState` 后，用 `settings.preferredModelMode` 覆写
  `startupInput.preferredMode`，这样下一轮 `runMainlineTurn` 的
  bootstrap 就会按新档位重算 modelPath。
- `modelSetupPlanner.buildUiContract` 把"default 才建议降到 compatibility"
  改为"非 compatibility 都建议降级"，以便 Pro 下载失败时也能推荐降级。

### 9.3 UI

- `src/renderer/components/SettingsPanel.vue`: 新增『模型档位』分区，
  三个 `role=radio` 按钮展示 Quality / Lite / Pro，每个按钮给出 tagline 和
  hint（显存 / 纯 CPU 表现 / 需手动下载等说明），当前加载的档位挂一个
  "当前加载" 徽标（通过 `selectedProfileId === profile.id` 匹配）。
- `GameShell.vue` 透传 `preferredModelMode` / `selectedProfileId` /
  `set-model-mode` 事件；`App.vue` 在 `onSetModelMode` 里把用户选择
  写入 `runtimeState.settings`，立刻 `persistState()` 落盘。生效点是
  下一轮 `runMainlineTurn`，不中断当前 streaming。

### 9.4 测试

- `tests/runtimeBootstrap.test.ts` 新增 Pro 档用例：
  `preferredMode: 'pro'` 且 `availableGpuVramGb = 2` 时仍选 7B。
- `tests/runtimeState.test.ts` 默认 state 断言增加
  `preferredModelMode === 'default'`。
- `tests/composables/settingsPanel.dom.test.ts` （新文件，happy-dom）覆盖：
  - 三档 radio 正确渲染 aria-checked；
  - 点击非当前档位 emit 对应 `set-model-mode`，点击当前档位不 re-emit；
  - `selectedProfileId` 正确驱动 "当前加载" 徽标位置。
- 配套：`vitest.config.ts` 接入 `@vitejs/plugin-vue`，让 vitest 能加载
  真实 `.vue` SFC 进行 DOM 测试（之前 dom 测试只覆盖 composables）。
- 全量：`pnpm test --run` 34 test files / 188 tests 绿。

### 9.5 未完成 / 后续

- 当前切换到 Pro 但缺权重时，下一轮会收到 `model-missing` 错误，UI 上
  虽然已经把 message 曝出来，但缺一个"切换到 Pro 时立即触发下载"的直达
  按钮。后续建议把 SettingsPanel 里的 Pro 选项挂上一个"下载权重"次级按钮，
  复用 `modelSetupPlanner` 已有的下载 UI 契约。
- 性能：切换档位后首次 `runMainlineTurn` 会冷启动新 GGUF，约 10-20s 首
  字；可以考虑 idle 时预热下一档位的 session——但不是首版必需。


## 10. 2026-04-24 Round 5：Pro 档位「下载权重」直达按钮

完成 §9.5 遗留项：在 Settings UI 的每个档位旁提供"下载权重"直达按钮，
并在下载过程中实时显示阶段性进度。

### 10.1 新增模块

- `src/modeling/profileDownloader.ts`: 导出 `downloadProfileWeights`
  （纯函数 + 全量 DI：fetchArtifactMetadata / downloadFile / verifyFile /
  removeFile / ensureDirectory / readManifest / writeManifest / now），以及
  `buildDefaultProfileDownloaderDependencies` 供 main/CLI 绑定真实实现。
  与 `scripts/download-models.ts` 的差异：单 profile 运行、不做冒烟测试、
  不抢 `.download.lock` 文件——冒烟测试交由 bootstrap 自然覆盖，锁文件
  换成主进程侧的 `activeDesktopDownloads` Set 防并发。
- `src/modeling/modelProfiles.ts`: 导出 `getAllKnownModelProfiles`
  （含 Pro）与 `findModelProfileById`，供 UI 枚举 / 按 id 查找。
- `src/modeling/modelSetupPlanner.ts`: 导出
  `evaluateSingleProfileAvailability`，供 IPC `get-profile-availability`
  走最短路径而无需构建完整 setup plan。

### 10.2 IPC / bridge

- `desktop:get-profile-availability(profileId) → DesktopProfileAvailability`
  （status + present/missing files + manifest 时间）。
- `desktop:download-profile(profileId) → DesktopDownloadProfileResult`，
  过程事件通过 `event.sender.send('desktop:profile-download-progress', …)`
  逐阶段推送（starting / fetching-metadata / downloading / verifying /
  file-done / manifest-updated / completed / failed）。
- Preload `DesktopBridge` 补 `getProfileAvailability` / `downloadProfile`
  / `onProfileDownloadProgress`，后者返回 unsubscribe 函数给渲染侧在
  onBeforeUnmount 时释放。

### 10.3 UI

- `SettingsPanel.vue` 每个档位底部：
  - 当该 profile 非 ready 时，显示 "权重未下载 / 不完整 / 状态未知" + 一个
    `下载权重` 按钮（`data-testid="settings-model-download-{mode}"`）；
  - 下载中（phase ∉ completed/failed）显示一行 `(fileIndex/totalFiles)
    + 阶段消息`，CTA 在此时隐藏以避免重复点击。
- `App.vue` 负责：
  - 启动时 `refreshProfileAvailability()` 拉三档状态；
  - 通过 `onProfileDownloadProgress` 维护 `downloadStatus` ref；
  - `onDownloadProfile` 调用 IPC，完成/失败后再次刷新该档可用性，
    2 秒后清空 `downloadStatus` 让 CTA 恢复。

### 10.4 测试

- `tests/profileDownloader.test.ts` (4 用例): 成功路径、全镜像失败、校验
  失败时删除文件、manifest 记录替换。
- `tests/desktopShell.test.ts` 追加 4 用例：
  `getDesktopProfileAvailability` 在空目录返回 `missing`、未知 id 回空；
  `runDesktopProfileDownload` 拒绝未知 id、注入 deps 下成功发送 completed
  事件。
- `tests/composables/settingsPanel.dom.test.ts` 扩到 5 用例：新增 CTA
  可见性 + `@download-profile` emit 与 radio onclick 隔离、下载中隐藏
  CTA 并渲染进度行。
- Preload bridge keys 期望值同步更新。
- 全量：`pnpm test --run` → 35 test files / 198 tests 绿。

### 10.5 仍未完成 / 后续

- `scripts/download-models.ts` 尚未迁移到 `profileDownloader` 模块，
  仍保有自己的 `downloadWithFallbacks` 实现。两者功能一致但重复，后续可
  做一次去重重构。
- ~~当前进度是"阶段级"（phase + fileIndex/totalFiles + 文本），没有 byte-
  level 百分比。~~ **已在 §10.7 接入：**`downloadFile` 改走 `fetch + ReadableStream`，
  Content-Length 与逐 chunk 累计通过 `onByteProgress` 回传，上层以 250ms
  节流转成 `ProfileDownloadProgressEvent.bytesDownloaded / totalBytes`。
- 切换到 Pro 且下载完成后，首次 `runMainlineTurn` 仍是冷启动（~10-20s）。
  后续可考虑 idle 预热。

### 10.6 端到端 QA

- 在 commit `483be96` 上跑 `pnpm playthrough -- --pattern=alt --maxNodes=8`，
  29 轮跨 8 节点全部通过，`isCompleted=true`，最终 `attitudeScore=1`，
  终节点 `contemporary-return`，墙钟 6.35 min。详见
  [docs/audits/2026-04-24-playthrough-8node.md](../../audits/2026-04-24-playthrough-8node.md)。
- 结论：权重下载 CTA 合入后无主线回归，可作为后续增强（byte-level
  百分比 / 脚本去重 / idle 预热）的基线。

### 10.7 byte-level 下载百分比（本次新增）

- `ProfileDownloadProgressEvent` 新增可选 `bytesDownloaded` / `totalBytes`
  字段；`downloadFile(url, path, onByteProgress?)` 通过回调每 ≥ 250 ms
  推送一次已接收字节 + Content-Length 总量。
- 默认实现从 `curl.exe` 子进程切换为原生 `fetch + response.body.getReader()`，
  边读边写文件；断点续传由 `Range: bytes=<existing>-` 头 + 文件 append
  flag 组合处理；`416 Range Not Satisfiable` 视作已完成。重试上限 3 次，
  指数退避。
- `DesktopProfileDownloadProgressEvent` 增补同名字段，主进程 mapper
  透传。`SettingsPanel` 新增 `settings-model-progress-bytes-{mode}` 行，
  显示 `{下载}MB / {总}MB · {N}%`，`totalBytes=0` 时回退为 `{下载}MB 已下载`。
- 测试补充：`profileDownloader.test.ts` 追加"byte progress 回传"用例；
  `settingsPanel.dom.test.ts` 追加"bytes 行 + 百分比渲染"用例。全量
  `pnpm test --run` → 35 files / 200 tests 绿。
