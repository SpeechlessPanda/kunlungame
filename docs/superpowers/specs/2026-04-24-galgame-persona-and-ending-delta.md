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
- **Pro Mode（可选）**：`qwen2.5-7b-instruct-q4km` 分片 ~4.5GB，
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
