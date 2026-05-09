# 知识库编译与质量维护

## 编译流程
- 运行 `pnpm knowledge:compile` 从 `docs/knowledge-base/cultural-knowledge.md` 和 `md/knowledge/*.md` 编译
- 输出到 `src/content/generated/knowledgeEntries.json`（52 条）和 `storyOutline.json`
- `cultural-knowledge.md` 的二级/三级标题结构被自动拆分为条目
- `md/knowledge/` 下的独立 MD 文件有更好的摘要质量

## 条目质量标准
- `summary`：一段完整描述，≥20 字，不含 asterisk
- `extension`：具体事实要点，用换行分隔，3-5 条
- `storyNodeIds`：正确关联到 1-2 个游戏节点
- `keywords`：3-5 个检索关键词

## 已知 bug（已修复）
- `cleanMarkdownInline` 的 list-item regex (`^[-*+]\s*`) 会误剥离 bold 标记的首个 `*`
- 修复方法：将 bold/italic 清理移到 list-item 清理之前

## 添加新知识条目
1. 编辑 `docs/knowledge-base/cultural-knowledge.md`（结构化条目）
   - 或在 `md/knowledge/` 下创建新 MD 文件（自定义条目）
2. 运行 `pnpm knowledge:compile`
3. 运行 `pnpm smoke:openai` 验证检索效果
4. 检查 `nodeId` 和 `keywords` 是否正确匹配

## 检索逻辑
- `knowledgeRetrieval.ts`：先按 `storyNodeIds` 过滤，再按关键词匹配排序
- `retrievalLimit`：每轮检索 3 条（`mainlineTurnRunner.ts` 默认值）
- `turnSalt`：同一节点不同轮次间轮换条目，避免重复
