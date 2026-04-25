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

## 检索排序

1. 第一优先级：显式 `storyNodeIds` 命中当前节点。
2. 第二优先级：`keywords` 与查询关键词的匹配数。
3. 第三优先级：`topic` 与查询主题的包含关系。
4. 检索层只返回有限条目，不负责提示词拼装或语言风格控制。

## 空结果降级

1. 检索器会先把候选条目限制在当前 `storyNodeIds` 与 `allowedTopics` 内。
2. 当当前节点边界内完全没有候选条目时，检索层返回空数组并显式标记 `fallbackUsed = true`。
3. 降级不会跨到未来节点，也不会偷渡被禁止的主题。