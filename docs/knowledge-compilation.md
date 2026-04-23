# 知识编译与检索说明

本阶段已经把知识层收敛成一个最小闭环：作者写受约束 Markdown，脚本输出稳定 JSON，运行时检索模块只负责匹配与排序，不承担生成职责。

## 输入目录

1. 原始知识 Markdown 默认放在 `md/knowledge`。
2. 每个文件对应一个 knowledge entry。
3. 当前最小样例文件是 `md/knowledge/kunlun-myth-overview.md`。

## Markdown 格式

必填 front matter：

1. `id`
2. `topic`
3. `source`
4. `storyNodeIds`
5. `keywords`

必填正文小节：

1. `## Summary`
2. `## Extension`

## 最小模板

```md
---
id: kunlun-myth-overview
topic: 昆仑神话
source: 内容占位：待作者补充文献来源
storyNodeIds:
  - kunlun-prologue
keywords:
  - 昆仑
  - 西王母
---

## Summary

概述昆仑在中国古代文化想象中的地位。

## Extension

后续可延伸到西王母、周穆王与山海经中的昆仑意象。
```

## 输出文件

1. 编译脚本默认输出到 `src/content/generated/knowledgeEntries.json`。
2. 输出结构遵循 Part 02 的 knowledge entry 契约。
3. 如果目录没有任何合法条目，编译会失败，而不是写出空文件。

## 检索排序

1. 第一优先级：显式 `storyNodeIds` 命中当前节点。
2. 第二优先级：`keywords` 与查询关键词的匹配数。
3. 第三优先级：`topic` 与查询主题的包含关系。
4. 检索层只返回有限条目，不负责提示词拼装或语言风格控制。

## 空结果降级

1. 当没有条目命中当前节点、关键词或主题时，检索层返回有限数量的通用条目。
2. 降级行为会显式标记 `fallbackUsed = true`，便于后续上层流程做诊断或 UI 提示。