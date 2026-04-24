# 2026-04-24 端到端主线 Playthrough · 8 节点 QA

> 目的：验证 §10 权重下载 CTA 落地后的 commit `483be96` 下，主线 8 节点完整跑通真模型（3B Quality 默认档），确认剧情推进、节点转场、态度门槛与日志产物均正常。

## 运行环境

- Commit: `483be96`（origin/main）
- 默认 profile: `qwen2.5-3b-instruct-q4km`（3B Quality fallback 档）
- GPU: RTX 4060 Laptop 8 GB · CPU: i9-13980HX · Node 24.13.0 · node-llama-cpp 3.18.1 (Vulkan)
- 命令：`pnpm playthrough -- --pattern=alt --maxNodes=8`

## 结果概览

- **exit code: 0**
- **总墙钟**：6.35 min
- **总轮数**：29 turns · 覆盖全部 8 节点
- **isCompleted**：`true`
- **最终 `attitudeScore`**：`1`（范围 -3 ~ 3）
- **最终 `currentNodeId`**：`contemporary-return`
- 日志：[test-results/playthroughs/playthrough-default-alt-2026-04-24T15-15-01-211Z.md](../../test-results/playthroughs/playthrough-default-alt-2026-04-24T15-15-01-211Z.md)（492 行）

## 节点分布与耗时

| # | 节点 | minTurns | 实际轮数 | 说明 |
|---|------|---------:|---------:|------|
| 1 | kunlun-threshold | 3 | 3 | align/challenge/align |
| 2 | creation-myths | 4 | 4 | 含一条 665 字长回复 |
| 3 | civilization-roots | 3 | 3 | turn 9 仅 33 字（最短） |
| 4 | order-and-thought | 4 | 4 | 正常 |
| 5 | empire-and-openness | 4 | 4 | 正常 |
| 6 | fusion-and-refinement | 4 | 4 | 正常 |
| 7 | rupture-and-guardianship | 4 | 4 | turn 26 为全程最长 elapsed（19877ms） |
| 8 | contemporary-return | 3 | 3 | 正常结束 |

- 每轮 `chars > 0`，无空回复、无超时、无抛错。
- 每轮 `elapsedMs` 区间 `8479 ~ 22458 ms`，中位约 12 s，与 3B Quality 档既往表现一致。
- 每节点都达到 `minTurns`，`turnsInCurrentNode` 门槛生效，没有提前跳节点。

## 验证项

- [x] 8 节点全部按 `mustIncludeFacts` / `transitionHint` 顺序推进，无跳节点。
- [x] align / challenge 交替模式正常切换，态度累积 `attitudeScore` 落在合法区间。
- [x] 终节点 `contemporary-return` 正确落在 `isCompleted = true` 并写出结构化日志。
- [x] 3B fallback 下 strictCoverage 段落注入（参考 turn 5 正文按顺序覆盖盘古→女娲→夸父→大禹）。
- [x] 模型加载/卸载在每轮之间稳定循环，没有 Vulkan OOM、没有崩溃。

## 观察到的遗留 / 不影响通过

1. `llama_context: n_ctx_seq (8192) < n_ctx_train (32768)`：脚本侧每轮重载模型导致 KV cache 反复重建，与模型本身无关；若后续把 session 复用接入 script 会省掉大头时间。
2. turn 9 (civilization-roots / align) 仅 33 字，相对偏短但非空，符合 3B 档「偶发拘束」行为；可在后续密度 prompt 调参时关注。
3. `[node-llama-cpp] load: control-looking token: 128247 '</s>'` 警告贯穿全程，上游 GGUF 元数据问题，已知非阻塞。

## 结论

**PASS**：commit `483be96` 下主线 8 节点在真 3B 模型端到端跑通，无回归。可作为 §10 权重下载 UI 合入后的基线 QA 结果备案。
