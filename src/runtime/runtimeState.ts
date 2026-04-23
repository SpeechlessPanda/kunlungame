import { z } from 'zod'
import type { StoryOutline } from '../shared/contracts/contentContracts.js'

export const SAVE_VERSION = 1 as const
export const ATTITUDE_MIN = -3
export const ATTITUDE_MAX = 3

export const playerAttitudeChoiceSchema = z.enum(['align', 'challenge'])
export const runtimeSettingsSchema = z.object({
  bgmEnabled: z.boolean()
})

export const runtimeStateSchema = z.object({
  saveVersion: z.literal(SAVE_VERSION),
  currentNodeId: z.string().min(1),
  turnIndex: z.number().int().min(0),
  attitudeScore: z.number().int().min(ATTITUDE_MIN).max(ATTITUDE_MAX),
  historySummary: z.string(),
  readNodeIds: z.array(z.string().min(1)),
  // isCompleted=true 表示玩家已经走过最终节点的一轮对话，
  // 此时 UI 应展示升华式结尾而不是再生成新的选项，也不能继续推进节点。
  isCompleted: z.boolean().default(false),
  settings: runtimeSettingsSchema
})

export type PlayerAttitudeChoice = z.infer<typeof playerAttitudeChoiceSchema>
export type RuntimeState = z.infer<typeof runtimeStateSchema>

export interface ApplyPlayerChoiceInput {
  state: RuntimeState
  storyOutline: StoryOutline
  choice: PlayerAttitudeChoice
}

const clampAttitude = (value: number): number => {
  return Math.min(ATTITUDE_MAX, Math.max(ATTITUDE_MIN, value))
}

const summarizeRepairedMemories = (storyOutline: StoryOutline, readNodeIds: string[]): string => {
  if (readNodeIds.length === 0) {
    return '尚未修复任何文化记忆片段。'
  }

  const repairedNodeTitles = readNodeIds.map((nodeId) => {
    const node = storyOutline.nodes.find((candidate) => candidate.id === nodeId)
    if (!node) {
      throw new Error(`Read runtime node '${nodeId}' is not present in the story outline.`)
    }

    return node.title
  })

  return `已修复的文化记忆片段：${repairedNodeTitles.join('、')}。`
}

const resolveCurrentNode = (storyOutline: StoryOutline, currentNodeId: string) => {
  const currentNode = storyOutline.nodes.find((node) => node.id === currentNodeId)
  if (!currentNode) {
    throw new Error(`Current runtime node '${currentNodeId}' is not present in the story outline.`)
  }

  return currentNode
}

const resolveNextNodeId = (storyOutline: StoryOutline, currentNodeId: string, nextNodeId: string | null): string => {
  if (nextNodeId === null) {
    return currentNodeId
  }

  const nextNodeExists = storyOutline.nodes.some((node) => node.id === nextNodeId)
  if (!nextNodeExists) {
    throw new Error(`Next story node '${nextNodeId}' is not present in the story outline.`)
  }

  return nextNodeId
}

export const createDefaultRuntimeState = (storyOutline: StoryOutline): RuntimeState => {
  const readNodeIds: string[] = []

  return runtimeStateSchema.parse({
    saveVersion: SAVE_VERSION,
    currentNodeId: storyOutline.entryNodeId,
    turnIndex: 0,
    attitudeScore: 0,
    historySummary: summarizeRepairedMemories(storyOutline, readNodeIds),
    readNodeIds,
    isCompleted: false,
    settings: {
      bgmEnabled: true
    }
  })
}

export const applyPlayerChoice = (input: ApplyPlayerChoiceInput): RuntimeState => {
  const currentNode = resolveCurrentNode(input.storyOutline, input.state.currentNodeId)
  const nextNodeId = resolveNextNodeId(input.storyOutline, currentNode.id, currentNode.nextNodeId)
  const attitudeDelta = input.choice === 'align' ? 1 : -1
  const readNodeIds = input.state.readNodeIds.includes(currentNode.id)
    ? input.state.readNodeIds
    : [...input.state.readNodeIds, currentNode.id]

  // 当当前节点没有下一节点（终节点）时，把运行时状态标记为已完成；
  // 渲染层据此展示升华式结尾而不是继续派发新一轮对话。
  const isCompleted = input.state.isCompleted || currentNode.nextNodeId === null

  return runtimeStateSchema.parse({
    ...input.state,
    currentNodeId: nextNodeId,
    turnIndex: input.state.turnIndex + 1,
    attitudeScore: clampAttitude(input.state.attitudeScore + attitudeDelta),
    historySummary: summarizeRepairedMemories(input.storyOutline, readNodeIds),
    readNodeIds,
    isCompleted
  })
}

export const resolveRuntimeStateAgainstStoryOutline = (
  state: RuntimeState,
  storyOutline: StoryOutline
): RuntimeState => {
  resolveCurrentNode(storyOutline, state.currentNodeId)

  return runtimeStateSchema.parse({
    ...state,
    historySummary: summarizeRepairedMemories(storyOutline, state.readNodeIds)
  })
}

export const serializeRuntimeState = (state: RuntimeState): string => {
  return `${JSON.stringify(runtimeStateSchema.parse(state), null, 2)}\n`
}

export const deserializeRuntimeState = (payload: string): RuntimeState => {
  return runtimeStateSchema.parse(JSON.parse(payload))
}