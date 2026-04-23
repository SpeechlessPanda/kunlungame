import { buildLayeredContext } from './layeredContextBuilder.js'
import type { KnowledgeEntry, StoryNode } from '../shared/contracts/contentContracts.js'
import type { RuntimeState, PlayerAttitudeChoice } from '../runtime/runtimeState.js'

export interface StoryPromptBuilderInput {
  currentNode: StoryNode
  retrievedEntries: KnowledgeEntry[]
  runtimeState: RuntimeState
  attitudeChoiceMode: PlayerAttitudeChoice
  recentTurns: string[]
}

export interface StoryPrompt {
  system: string
  user: string
}

const describeAttitudeChoiceMode = (choiceMode: PlayerAttitudeChoice): string => {
  return choiceMode === 'align' ? '附和型' : '反驳型'
}

export const buildStoryPrompt = (input: StoryPromptBuilderInput): StoryPrompt => {
  const forbiddenTopics = input.currentNode.forbiddenFutureTopics.join('、') || '无'
  const systemRules = [
    '你是《昆仑谣》的文化陪伴者。',
    '始终使用中文回答。',
    '保持陪伴式、清楚、现代中文表达。',
    '玩家只有两个选项：附和型与反驳型。',
    '这两个选项只影响语气，不影响主线事实和节点顺序。',
    '不得剧透后续节点，也不得提前泄露被禁止的未来主题。'
  ]

  const user = buildLayeredContext({
    systemRules: [
      `玩家当前倾向：${describeAttitudeChoiceMode(input.attitudeChoiceMode)}`,
      `禁止提前涉及：${forbiddenTopics}`
    ],
    currentNode: {
      title: input.currentNode.title,
      summary: [
        `核心问题：${input.currentNode.coreQuestion}`,
        `节点摘要：${input.currentNode.summary}`,
        `必须包含的事实：${input.currentNode.mustIncludeFacts.join('；')}`
      ].join('\n')
    },
    retrievedKnowledge: input.retrievedEntries.map(
      (entry) => `${entry.summary}\n${entry.extension}`
    ),
    memorySummary: input.runtimeState.historySummary,
    recentTurns: input.recentTurns
  })

  return {
    system: systemRules.join('\n'),
    user
  }
}