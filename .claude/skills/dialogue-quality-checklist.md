# 对话输出质量检查清单

在修改提示词、知识库或对话编排后，使用此清单验证输出质量。

## 触发条件
- 修改了 `src/modeling/storyPromptBuilder.ts`
- 修改了 `src/modeling/replyCleanup.ts`
- 修改了 `src/content/source/mainlineOutline.ts`
- 运行 `pnpm smoke:openai` 验证输出

## 检查项

### 长度控制
- [ ] 输出在 200-340 字之间（模型目标 200-320，清理后上限 340）
- [ ] 超长输出被 `truncateToMaxChars` 截断到句号/问号处
- [ ] 截断不会在段落中间切断

### 结尾追问
- [ ] 输出以问号（？）结尾
- [ ] 追问是昆仑子自然说出的，不是百科式发问
- [ ] 追问只问一个问题，不同时问两个

### 角色语气
- [ ] 第一人称"我"，称呼玩家"您"
- [ ] 无英文单词混入（`ENGLISH_WORD_PATTERN` 自动过滤）
- [ ] 无 "不是…而是…" 格式（`FORBIDDEN_PATTERNS` 自动替换）
- [ ] 无破折号（——）
- [ ] 无编号列表、Markdown 标题、角色标注
- [ ] 语气词（嗯、你看、唔）每种最多出现一次

### 态度响应
- [ ] align 选择后语气更轻快、亲近
- [ ] challenge 选择后语气更认真，先承认疑问再补论据
- [ ] 态度分值 -3~+3 范围内变化正常
- [ ] 态度不会在后续轮次漂移回中性

### 内容准确性
- [ ] 每轮覆盖 `mustIncludeFacts` 中的 2-3 个事实（不是全部 6 个）
- [ ] 不提前涉及后续节点的专有名词（`forbiddenFutureTopics`）
- [ ] 史实准确，无虚构典籍名、人物、朝代
- [ ] 节点间过渡自然（`transitionHint` 被正确使用）

### 知识库检索
- [ ] 每轮检索到 `retrievalLimit` 条知识条目
- [ ] 不同轮次间知识条目有轮换（`turnSalt` 机制）
- [ ] 检索到的条目与当前节点的 `allowedKnowledgeTopics` 匹配

## 已知问题
- API 提供商（kimi-for-coding via vaa.la）间歇性超时，重试逻辑最多 3 次
- 文化知识库部分条目摘要是小标题（如"秦始皇"），不影响使用但可改进
- mock 模式下选项不会随 turnIndex 变化（仅预览用途）
