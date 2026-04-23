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
    ['最近对话', input.recentTurns.join('\n')]
  ]

  return sections
    .map(([title, content]) => `${title}\n${content}`.trim())
    .join('\n\n')
}
