# 3B vs 7B 对话 smoke 对照观察（2026-04 扩展版）

脚本：`pnpm dialogue:smoke`，通过 `KUNLUN_SMOKE_MODE=compatibility` 强制 fallback 到 3B profile。

## 7B（`qwen2.5-7b-instruct-q4km`, `preferredMode='default'`）
- 此前观察：输出约 500+ 字，覆盖 `kunlun-threshold.mustIncludeFacts` 的大部分（天柱、山海经、西王母），文风和主线设定较贴合。
- 原先被 maxTokens=120 截在 168 字；本轮已把默认 maxTokens 抬到 512，输出不再被截断。

## 3B（`qwen2.5-3b-instruct-q4km`, `preferredMode='compatibility'`）
- 生成约 120 字，chunkCount=64，completed=true，正常收尾。
- 文本示例：「诶呀，你好呀，你今天心情不错嘛，嘻嘻。……中国有着五千年文明史，其中的诗词歌赋、书法绘画、传统节日、民间故事……你对中国的传统文化感兴趣吗？」
- 问题：
  1. 没有真正用到节点 `mustIncludeFacts`（昆仑/天柱/山海经/西王母/樊桐-玄圃-阆风 等细节完全缺席）。
  2. 泛泛地说"五千年文明"，几乎忽略了 `kunlun-threshold` 节点的具体语境。
  3. 撒娇语气出现，但粘度偏低，落点是"你对中国传统文化感兴趣吗"这种兜底问句。
- 结论：3B 作为降级方案可以跑通流程、能输出合法的开场问句，但节点叙事密度明显弱于 7B；当 GPU 显存不足被迫掉到 3B 时，建议：
  - UI 层加一行弱提示（"当前使用轻量模型，叙事密度可能降低"）；
  - prompt builder 在 compatibility 模式下把 `mustIncludeFacts` 从"建议"变成"按顺序逐条覆盖"，以弥补 3B 的上下文遵循能力。

## 2026-04 第二轮：strictCoverage 开启后的 3B 复测

脚本同上，`KUNLUN_SMOKE_MODE=compatibility`，`storyPromptBuilder` 已按 `strictCoverage=true` 注入「必须逐条覆盖 mustIncludeFacts」的系统约束；`DialogueSmokeTestResult` 新增 `elapsedMs / firstChunkMs / strictCoverage` 字段。

- `selectedProfileId=qwen2.5-3b-instruct-q4km`，`strictCoverage=true`，`completed=true`。
- `chunkCount`: 64 → **236**（×3.7）。
- 正文长度: ~120 字 → **~360 字**。
- 覆盖度：显式点到《山海经》、昆仑三层（樊桐/玄圃/阆风）、天人之轴、西王母豹尾虎齿→王母娘娘演变、周穆王与西王母瑶池相会、"比及三年将复而野"引文——`kunlun-threshold.mustIncludeFacts` 的 5 条中 4 条被覆盖（仅"天柱/不周山折断"未明确出现）。
- 代价：`elapsedMs ≈ 514 s`，`firstChunkMs ≈ 213 s`；对 3B 本地 CPU 推理而言属于可接受上限，但相比 7B 预计会明显偏慢，建议 UI 在 fallback 时告知玩家。
- 选项文案（`optionLabels`）：`嗯，你继续说——` / `这一层我没那么买账，给我个更硬的理由。`，自然度 OK。

结论：
- strictCoverage 开关显著抬高 3B 的叙事密度，基本达到"可发布"质量；
- 后续优化点：（a）把「天柱/不周山」这类关键神话条目放在 mustIncludeFacts 序列前列，让 3B 更早写到；（b）在 UI 层加 fallback 提示；（c）若墙钟时间压力大，可再尝试 `maxTokens=384` 折中。
