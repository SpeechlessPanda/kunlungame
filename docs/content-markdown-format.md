# 内容 Markdown 原始格式

本项目的内容 Markdown 仍会在后续编译阶段进入正式管线，但作者输入格式从现在开始固定，避免后续字段反复漂移。

## 目标

1. 让内容作者在 Markdown 中显式写出 story node 所需字段。
2. 让背景模式、检索关键词与主线链接在源头就可审阅。
3. 为后续 Part 03 的编译与校验提供稳定输入形状。

## 推荐结构

1. 文件头使用 YAML front matter。
2. 正文按固定小节展开，不在自由段落里埋关键字段。
3. 一个 story node 对应一个 Markdown 文件。

## Front Matter 字段

必填字段：

1. `id`
2. `title`
3. `era`
4. `theme`
5. `coreQuestion`
6. `retrievalKeywords`
7. `mustIncludeFacts`
8. `recommendedFigures`
9. `allowedKnowledgeTopics`
10. `backgroundMode`
11. `nextNodeId`

建议字段：

1. `forbiddenFutureTopics`
2. `characterCueIds`
3. `minTurns`
4. `sourceRefs`
5. `draftStatus`
6. `assetNotes`

## 正文小节

1. `## Summary`
2. `## Background Hint`
3. `## Tone Hint`
4. `## Knowledge Hooks`
5. `## Author Notes`

## 最小模板

```md
---
id: kunlun-prologue
title: 昆仑开篇
era: myth-origin
theme: 神话源流
coreQuestion: 我们为什么要从昆仑开始重新理解中国文化？
retrievalKeywords:
  - 昆仑
  - 西王母
  - 山海经
mustIncludeFacts:
  - 昆仑被视为世界中心
  - 西王母形象体现昆仑文化的长期演化
recommendedFigures:
  - 西王母
allowedKnowledgeTopics:
  - myth-origin
forbiddenFutureTopics:
  - civilization-origin
characterCueIds:
  - guide.kunlun
backgroundMode: fictional
minTurns: 1
nextNodeId: null
sourceRefs:
  - 待补充
draftStatus: outline
assetNotes:
  - 背景保持神话感，不落真实摄影
---

## Summary

玩家从昆仑神话入口进入主线，先建立世界观和文化方向。

## Background Hint

云海、雪山与远古宫阙构成的神话边界。

## Tone Hint

庄严、清醒、带一点邀请感。

## Knowledge Hooks

- 西王母
- 山海经
- 周穆王

## Author Notes

后续可扩展到更具体的神话角色与文化源流。
```

## 约束

1. `backgroundMode` 只能是 `fictional`、`photographic`、`composite`。
2. `nextNodeId` 即使为终点也必须出现，终点统一写 `null`。
3. `retrievalKeywords` 至少保留一个值，禁止留空数组。
4. `Summary`、`Background Hint`、`Tone Hint` 这三个正文小节必须存在。
5. `allowedKnowledgeTopics` 只能写当前节点可引用的主题层，不能提前放入后续章节主题。
6. `characterCueIds` 只写稳定 cue，不直接绑定真实 2D 或 3D 文件路径。