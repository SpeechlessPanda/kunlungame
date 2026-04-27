# 知识编译与检索说明

本阶段已经把知识层收敛成一个可运行的双产物闭环：原始文化知识库保留在单一 Markdown 源中，编译脚本输出稳定的 story outline 与 knowledge entries，运行时检索模块只负责在当前节点边界内匹配与排序，不承担生成职责。

## Source Of Truth

1. 原始文化知识源是 `docs/knowledge-base/cultural-knowledge.md`。
2. canonical 主线源是 `src/content/source/mainlineOutline.ts`。
3. 编译阶段不会把 `## 十、叙事素材与对话设计` 直接写入事实检索条目。

## 编译输入形状

1. 编译器读取 cultural knowledge 的一级章节与二级小节。
2. 一级章节映射到固定 topic 层，例如 `myth-origin`、`order-and-thought`、`contemporary-return`。
3. 二级小节会被拆成稳定 knowledge entry，并绑定允许消费它的 `storyNodeIds`。
4. 对话示例章节只保留为 prompt 示例源，不进入事实检索数据。

## 输出文件

1. `src/content/generated/storyOutline.json`
2. `src/content/generated/knowledgeEntries.json`
3. 如果编译结果为空，脚本会失败，而不是写出空文件。

## 输出约束

1. `storyOutline.json` 直接来自 Part 02 的 canonical mainline outline。
2. `knowledgeEntries.json` 目前按章节小节稳定生成，当前编译结果为 43 条知识条目。
3. 每条 knowledge entry 都必须绑定至少一个 `storyNodeIds`，供运行时建立反剧透边界。
4. 每条 knowledge entry 的 `source` 使用仓库相对引用（例如 `docs/knowledge-base/cultural-knowledge.md#昆仑山的神圣地位`），避免在 worktree、CI 或不同机器上生成绝对路径差异。
5. 编译器会清理摘要和扩展内容中的 Markdown 粗体、斜体、行首列表符号与多余空白，避免模型在知识段输出里复刻百科式排版。

## 检索排序

1. 第一优先级：显式 `storyNodeIds` 命中当前节点。
2. 第二优先级：`keywords` 与查询关键词的匹配数。
3. 第三优先级：`topic` 与查询主题的包含关系。
4. 检索层只返回有限条目，不负责提示词拼装或语言风格控制。
5. 主线回合会把 `turnsInCurrentNode` 作为轮换盐传给检索器；同一节点多轮对话会拿到不同的候选窗口，减少每轮内容完全相同的概率。

## Prompt RAG Cards

1. `src/modeling/ragKnowledgeCards.ts` 会把检索结果转换成 `RAG-K1`、`RAG-K2` 这样的卡片。
2. 每张卡包含 `来源`、`主题`、`事实要点` 和 `讲述方式`，让模型知道哪些内容是事实材料、哪些内容需要用当前口吻重新组织。
3. RAG cards 只作为事实输入，不是最终台词；`layeredContextBuilder` 会明确要求知识段继续保持角色人格与玩家当前风格，而不是突然切成固定百科介绍。
4. 如果检索结果为空，prompt 会保留空知识段并遵守当前节点边界，不跨未来节点补材料。

## 输出质量门槛

1. `src/modeling/replyCleanup.ts` 会删除角色标签、内部标签、重复句，以及包含后续节点专有名词或“上几个节点”等越界时间线的句子。
2. `src/modeling/replyQuality.ts` 会检查清洗后文本长度、段落数和当前节点关键词覆盖。
3. 如果 3B 首答过短或事实覆盖不足，主线 runner 会用同一个本地模型触发一次 coverage repair prompt，再把修复后的文本返回给 UI。
4. UI 消费的 `chunks` 与日志里的 `combinedText` 使用同一份清洗/修复结果，避免界面显示未清洗的越界内容。

## 空结果降级

1. 检索器会先把候选条目限制在当前 `storyNodeIds` 与 `allowedTopics` 内。
2. 当当前节点边界内完全没有候选条目时，检索层返回空数组并显式标记 `fallbackUsed = true`。
3. 降级不会跨到未来节点，也不会偷渡被禁止的主题。