export interface LayeredContextInput {
  systemRules: string[]
  currentNode: {
    title: string
    summary: string
  }
  retrievedKnowledge: string[]
  memorySummary: string
  recentTurns: string[]
}

export const buildLayeredContext = (input: LayeredContextInput): string => {
  const sections = [
    ['固定规则', input.systemRules.join('\n')],
    ['当前节点', `${input.currentNode.title}\n${input.currentNode.summary}`],
    ['检索知识', input.retrievedKnowledge.join('\n')],
    ['历史摘要', input.memorySummary],
    [
      '你（昆仑）刚才说过的内容【仅用于避免重复，不要拿来改写或拼接】',
      input.recentTurns.length === 0
        ? '还没有历史输出，这是本节点第一轮。'
        : input.recentTurns.map((turn, i) => `历史轮 ${i + 1}: ${turn}`).join('\n---\n')
    ]
  ]

  return sections
    .map(([title, content]) => `${title}\n${content}`.trim())
    .join('\n\n')
}
