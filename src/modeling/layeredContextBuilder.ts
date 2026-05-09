export interface LayeredContextInput {
  systemRules: string[]
  currentNode: {
    title: string
    summary: string
  }
  retrievedKnowledge: string[]
  memorySummary: string
  recentTurns?: string[]
  forbiddenProperNouns?: string[]
}

export const buildLayeredContext = (input: LayeredContextInput): string => {
  const forbiddenNounsBlock =
    input.forbiddenProperNouns != null && input.forbiddenProperNouns.length > 0
      ? `严禁提到以下后续节点的专有名词/人物/事件：${input.forbiddenProperNouns.join('、')}。`
      : '（本节点没有额外需要避开的后续专有名词。）'

  const continuityBlock = input.recentTurns != null && input.recentTurns.length > 0
    ? [
        '以下是已经发生过的对话记录，用于保持逻辑连续：',
        ...input.recentTurns.map((turn, index) => `[第${index + 1}轮] ${turn}`)
      ].join('\n')
    : '（暂无历史对话记录。）'

  const sections: Array<[string, string]> = [
    ['# 角色校准', input.systemRules.join('\n')],
    ['# 当前节点', `${input.currentNode.title}\n${input.currentNode.summary}`],
    [
      '# 可用的知识条目',
      input.retrievedKnowledge.length === 0
        ? '（暂无专门检索到的条目，依靠节点必须包含的事实即可。）'
        : input.retrievedKnowledge.join('\n\n')
    ],
    ['# 历史摘要', input.memorySummary],
    ['# 上文回顾', continuityBlock],
    ['# 剧情边界', forbiddenNounsBlock]
  ]

  return sections
    .map(([title, content]) => `${title}\n${content}`.trim())
    .join('\n\n')
}
