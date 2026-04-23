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
