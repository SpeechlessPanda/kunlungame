# Part 02 Spec: 主线、内容与素材契约层

## 1. 目标

定义所有后续部分必须共同遵守的数据契约，包括主线节点、知识条目、背景图模式、素材占位规则和内容作者输入格式。

## 2. 范围

1. Story node 结构。
2. Knowledge entry 结构。
3. 背景图 `fictional`、`photographic`、`composite` 三种模式定义。
4. 素材占位、命名、资源位规则。
5. 内容 Markdown 原始来源的基础格式要求。

## 3. 明确不做

1. 不写死正式主线剧情文案。
2. 不导入真实图片、角色立绘或音频文件。
3. 不实现检索、存档、AI 请求和 UI 渲染。

## 4. 依赖与前置

1. 依赖 Part 01 提供的工程基座。
2. 为 Part 03 至 Part 08 提供共享契约。

## 5. 契约定义

每个 story node 至少包含：

1. `id`
2. `title`
3. `era`
4. `theme`
5. `coreQuestion`
6. `summary`
7. `mustIncludeFacts`
8. `retrievalKeywords`
9. `recommendedFigures`
10. `allowedKnowledgeTopics`
11. `forbiddenFutureTopics`
12. `backgroundMode`
13. `backgroundHint`
14. `toneHint`
15. `characterCueIds`
16. `minTurns`
17. `nextNodeId`

每个 knowledge entry 至少包含：

1. `id`
2. `topic`
3. `source`
4. `summary`
5. `extension`
6. `storyNodeIds`
7. `keywords`

素材契约至少包含：

1. 背景图资源位可为空，但键名必须稳定。
2. 角色资源位可为空，但必须预留静态占位或空态渲染策略。
3. 背景图模式必须由主线节点显式选择，不能在 UI 层自由猜测。
4. 主线节点只声明稳定的 `characterCueIds`，不直接绑定真实素材路径。
5. 角色资源位需要同时兼容现有 portrait 槽位和未来 runtime-3d 槽位。

## 6. 关键流程

1. 内容作者整理 Markdown 原文。
2. 设计者配置固定 8 节点单主线 story outline。
3. 每个节点声明背景图模式、必经事实、允许知识主题和角色 cue。
4. 后续系统消费这些契约，而不是自行发明新字段。

## 7. 错误处理要求

1. 缺少必填字段时，编译或校验必须失败。
2. `backgroundMode` 出现未定义值时，不能静默接受。
3. `nextNodeId` 指向不存在节点时，要在校验阶段暴露。

## 8. 测试策略

黑盒测试：

1. 给出一份最小 story node 配置时，系统能识别为合法。
2. 给出一份最小知识条目时，内容管线能识别为合法。
3. 给出 canonical 8 节点主线配置时，系统能识别为合法且保持单链路。

白盒测试：

1. 类型定义与 JSON 校验规则一致。
2. 枚举值、可选项、空值策略符合设计约束。
3. 主线节点链路可被静态校验遍历。
4. `allowedKnowledgeTopics`、`forbiddenFutureTopics`、`characterCueIds` 与 `minTurns` 必须进入合同校验范围。

## 9. 验收条件

1. 已存在一份最小 story node 示例配置。
2. 已存在一份最小 knowledge entry 示例。
3. 已存在 canonical 8 节点主线源数据。
4. 已存在素材资源位命名规则说明。
5. 背景图模式与主线节点绑定关系在文档中明确写死。

## 10. 交付物

1. 共享类型定义。
2. 最小配置示例与 canonical 主线源。
3. 内容格式说明文档。
4. 素材占位规则说明。

## 11. 执行状态

Status: completed

Audit:

1. See `docs/audits/2026-04-23-part-01-04-audit.md`

已完成：

1. 已建立 story node、knowledge entry、story outline、background mode 的共享 schema 与类型。
2. 已建立最小示例配置，覆盖单节点主线与最小知识条目。
3. 已补充真实主线所需字段，包括 `coreQuestion`、`mustIncludeFacts`、`allowedKnowledgeTopics`、`forbiddenFutureTopics`、`characterCueIds` 与 `minTurns`。
4. 已建立 canonical 8 节点主线源数据，覆盖从昆仑神话到当代文化自觉的单链路。
5. 已建立主线链路静态校验，可检查重复 id、缺失入口、缺失 nextNodeId 目标、环与断链。
6. 已建立背景与角色素材槽位命名规则的代码级辅助函数，并在文档中预留 portrait 与 runtime-3d 并行消费边界。
7. 已补充内容 Markdown 原始来源格式说明与素材占位规则说明。
8. 已完成白盒与黑盒验证，确认 schema、最小示例与 canonical 主线源一致。

明确延期：

1. 暂不导入正式主线内容、真实图片、角色立绘或音频文件。
2. 暂不在本部分实现 Markdown 编译管线，本部分只先定死输入合同、canonical 主线源与作者格式。

## 12. 风险与回滚边界

1. 若本部分字段定义频繁变化，后续 6 个部分都会反复返工。
2. 若背景模式不在这里定死，后续主线内容和素材策略会分家。
3. 若 `allowedKnowledgeTopics` 与 `forbiddenFutureTopics` 缺失，后续 Part 03 与 Part 05 将难以建立稳定的反剧透边界。
