# UI 视觉审查笔记（2026-04 扩展版）

截图来源：`test-results/ui-review/*.png`（由 `tests/e2e/ui-review.spec.ts` 生成）。
评审维度：布局密度、文字对比度、状态可读性、浅色调和谐度、可交互元素可达性。

本轮评审主要回答两个问题：
1. 对话框在不同内容量（空/流式/抉择/续写/设置）下是否保持稳定、可读；
2. 背景、装饰与叙述者头牌的色调是否与"淡雅 galgame"整体调性一致。

---

## 01-empty · 首屏空态
- 背景层在当前配色下已从原本偏冷的压色调，转到淡粉-米色系，屏幕混合的柔光与 `saturate(0.78)` 一起让画面整体从"冷峻纪录片"转向"清晨阳台"，叙事门槛明显降低。
- `.background-stage::after` 叠加的两道淡粉径向光位于左上与右下，视觉不会把玩家注意力从对话框引开。
- 叙述者头牌（"昆仑"）已替换为正确角色名，字距、行高在首屏空态下可读性良好。
- 建议后续：空态仍缺一条"按任意键开始"的柔提示，可在 `App.vue` 或 `DialogPanel.vue` 的空分支补一条半透明占位。

## 02-streaming · 流式输出中段
- 对话框采用 `min-height: clamp(180px, 22vh, 240px)`；在当前截图的中等文字量下，面板不会跳变高度，保证流式输入时视觉稳定。
- 内容超出 `max-height: min(55vh, 520px)` 时，`body` 区会进入内部纵向滚动；webkit 滚动条被染成淡粉色，既告知"这里可滚"，又不破坏整体米色调。
- 阅读条带宽度对 1920×1080 截图友好，建议在下一次 UI 审查时补一张 1366×768 的窄屏截图，确认 `clamp()` 上下界仍合理。

## 03-choices · 抉择阶段
- 选项区整体贴在对话框底部，按钮之间间距稳定，未出现拥挤。
- 选项文案由新加入的 `buildGalgameOptionLabels` 生成：不再是以前"顺着『文明原点』继续听下去"这种机械拼接，而是从 align/challenge 两池里随节点轮次取出不同句式（例如"嗯，我也是这么想的"/"不见得吧？"）；视觉上长度更接近两段自然口语。
- 仍需注意：当 `currentNode.nextNodeId === null` 时，`mainlineTurnRunner` 会传 `isEnding: true`，结局节点会改用 ENDING 池文案；下次审查建议覆盖到 `contemporary-return` 结局态截图。

## 04-next-turn · 推进到下一轮
- 当前 `minTurns` 已统一回退到 1；推进到下一节点时，对话框高度平滑，没有因为"文本瞬间变短"出现塌陷或跳动。
- `turnsInCurrentNode` 合同仍保留给后续节点内多轮策略使用；当前 UI 主要通过 `transitionHint` 在节点切换时自然衔接下一段开场。
- 建议后续：截图文件名没有体现"第几轮 / 哪个节点"，可把节点 id 和 turnIndex 印在右下角角标，方便审查。

## 05-settings · 设置面板
- 设置面板的圆角、阴影、按钮间距与主对话框同一套 design token，视觉一致。
- 模式指示 chip 的 `rgba(255,250,247,0.78)` + `border-radius: var(--radius-pill)` 在淡色背景上的对比度达到 AA 级别，文字在 1x / 2x DPI 截图中都清楚可辨。
- 体积最大的风险仍是"字段过多时纵向滚动"，目前截图里尚未出现；当设置项继续扩张时建议把面板改成可分页/折叠结构。

---

## 结论与下一步建议

- 淡色调重构与对话框自适应高度在当前 5 张截图里视觉表现已达预期，没有发现需要立刻回滚的问题。
- 后续 e2e 已随 2026-04-25 策略调整为 `minTurns = 1` 的推进断言；若再次启用节点内多轮，应恢复循环点击 `kunlun-threshold.minTurns` 次后再断言节点切换。
- 勤务注记：`test-results/ui-review/*.png` 本轮并未被 Playwright 重写（文件 mtime 仍停在 2026/4/23）。下次有意要刷新截图时，需要手动删掉这个目录再跑 `pnpm playwright test tests/e2e/uiReviewScreenshots.spec.ts`，或者在 spec 里给 `page.screenshot({ path, ... })` 明确传入覆盖逻辑。
- 建议接下来的 UI 迭代：
  1. 空态加上"按任意键开始"柔提示；
  2. 补一张窄屏（1366×768）与一张结局（`contemporary-return`）截图；
  3. 截图右下角加调试角标（节点 id + turnsInCurrentNode），让后续 review 能在不跑游戏的情况下定位"这是哪个节点的第几轮"；
  4. 当 UI 检测到当前运行的是 3B fallback 时，在 `BackgroundStage` 或状态栏加一条半透明提示：「轻量模型 · 叙事密度已压缩」，配合新加入的 `strictCoverage` prompt 模式一起告知玩家。

## 2026-04-25 离线字体修正

- 渲染入口已移除 Google Fonts 外链，改用 `tokens.css` 中的本机中文字体栈；这符合离线桌面定位，也避免 Playwright 在网络字体请求上随机卡住 `page.goto`。
