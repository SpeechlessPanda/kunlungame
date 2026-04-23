import { z } from 'zod'

export const backgroundModeSchema = z.enum(['fictional', 'photographic', 'composite'])
export const assetPlaceholderPolicySchema = z.enum(['empty-ok', 'static-placeholder'])

export const storyNodeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  era: z.string().min(1),
  theme: z.string().min(1),
  coreQuestion: z.string().min(1),
  summary: z.string().min(1),
  mustIncludeFacts: z.array(z.string().min(1)).min(1),
  retrievalKeywords: z.array(z.string().min(1)).min(1),
  recommendedFigures: z.array(z.string().min(1)).min(1),
  allowedKnowledgeTopics: z.array(z.string().min(1)).min(1),
  forbiddenFutureTopics: z.array(z.string().min(1)).default([]),
  backgroundMode: backgroundModeSchema,
  backgroundHint: z.string().min(1),
  toneHint: z.string().min(1),
  characterCueIds: z.array(z.string().min(1)).default([]),
  minTurns: z.number().int().min(1),
  nextNodeId: z.string().min(1).nullable()
})

export const knowledgeEntrySchema = z.object({
  id: z.string().min(1),
  topic: z.string().min(1),
  source: z.string().min(1),
  summary: z.string().min(1),
  extension: z.string().min(1),
  storyNodeIds: z.array(z.string().min(1)).min(1),
  keywords: z.array(z.string().min(1)).min(1)
})

export const storyOutlineSchema = z.object({
  entryNodeId: z.string().min(1),
  nodes: z.array(storyNodeSchema).min(1)
})

export const backgroundAssetSlotSchema = z.object({
  slotId: z.string().min(1),
  slotType: z.literal('background'),
  mode: backgroundModeSchema,
  assetPath: z.string().min(1).nullable(),
  placeholderPolicy: assetPlaceholderPolicySchema
})

export const characterAssetSlotSchema = z.object({
  slotId: z.string().min(1),
  slotType: z.literal('character'),
  assetPath: z.string().min(1).nullable(),
  placeholderPolicy: assetPlaceholderPolicySchema
})

export type BackgroundMode = z.infer<typeof backgroundModeSchema>
export type StoryNode = z.infer<typeof storyNodeSchema>
export type KnowledgeEntry = z.infer<typeof knowledgeEntrySchema>
export type StoryOutline = z.infer<typeof storyOutlineSchema>
export type BackgroundAssetSlot = z.infer<typeof backgroundAssetSlotSchema>
export type CharacterAssetSlot = z.infer<typeof characterAssetSlotSchema>

export const parseStoryOutline = (input: unknown): StoryOutline => {
  return storyOutlineSchema.parse(input)
}

export const parseKnowledgeEntries = (input: unknown): KnowledgeEntry[] => {
  return z.array(knowledgeEntrySchema).min(1).parse(input)
}

export const validateStoryNodeChain = (input: unknown): string[] => {
  const parsedOutline = storyOutlineSchema.safeParse(input)
  if (!parsedOutline.success) {
    return parsedOutline.error.issues.map((issue) => issue.message)
  }

  const outline = parsedOutline.data
  const issues: string[] = []
  const nodeMap = new Map<string, StoryNode>()

  for (const node of outline.nodes) {
    if (nodeMap.has(node.id)) {
      issues.push(`Story node '${node.id}' is duplicated.`)
      continue
    }

    nodeMap.set(node.id, node)
  }

  if (!nodeMap.has(outline.entryNodeId)) {
    issues.push(`Entry node '${outline.entryNodeId}' does not exist in the story outline.`)
    return issues
  }

  const visited = new Set<string>()
  let currentNodeId: string | null = outline.entryNodeId

  while (currentNodeId !== null) {
    if (visited.has(currentNodeId)) {
      issues.push(`Story outline contains a cycle at '${currentNodeId}'.`)
      break
    }

    visited.add(currentNodeId)
    const currentNode = nodeMap.get(currentNodeId)
    if (!currentNode) {
      issues.push(`Story node '${currentNodeId}' does not exist in the story outline.`)
      break
    }

    if (currentNode.nextNodeId !== null && !nodeMap.has(currentNode.nextNodeId)) {
      issues.push(
        `Story node '${currentNode.id}' points to missing nextNodeId '${currentNode.nextNodeId}'.`
      )
      break
    }

    currentNodeId = currentNode.nextNodeId
  }

  if (issues.length === 0 && visited.size !== outline.nodes.length) {
    issues.push('Story outline must remain a single mainline chain without disconnected nodes.')
  }

  return issues
}

export const createBackgroundAssetSlot = (
  storyNodeId: string,
  mode: BackgroundMode
): BackgroundAssetSlot => {
  return backgroundAssetSlotSchema.parse({
    slotId: `background.${storyNodeId}.scene`,
    slotType: 'background',
    mode,
    assetPath: null,
    placeholderPolicy: 'empty-ok'
  })
}

export const createCharacterAssetSlot = (characterId: string): CharacterAssetSlot => {
  return characterAssetSlotSchema.parse({
    slotId: `character.${characterId}.portrait`,
    slotType: 'character',
    assetPath: null,
    placeholderPolicy: 'static-placeholder'
  })
}

export const minimalStoryOutline: StoryOutline = {
  entryNodeId: 'kunlun-prologue',
  nodes: [
    {
      id: 'kunlun-prologue',
      title: '昆仑开篇',
      era: 'myth-origin',
      theme: '神话源流',
      coreQuestion: '我们为什么从昆仑进入这条文化主线？',
      summary: '玩家从昆仑的神话门槛进入主线，先建立世界观和文化方向。',
      mustIncludeFacts: ['昆仑是中国古代想象中的重要精神坐标'],
      retrievalKeywords: ['昆仑', '神话', '西王母'],
      recommendedFigures: ['西王母'],
      allowedKnowledgeTopics: ['myth-origin'],
      forbiddenFutureTopics: [],
      backgroundMode: 'fictional',
      backgroundHint: '云海、雪山与远古宫阙构成的神话边界。',
      toneHint: '庄严、清醒、带一点邀请感。',
      characterCueIds: ['guide.kunlun'],
      minTurns: 1,
      nextNodeId: null
    }
  ]
}

export const minimalKnowledgeEntries: KnowledgeEntry[] = [
  {
    id: 'kunlun-myth-overview',
    topic: '昆仑神话',
    source: '内容占位：待作者补充文献来源',
    summary: '概述昆仑在中国古代想象中的地位，以及它如何成为文化叙事入口。',
    extension: '可扩展到西王母、周穆王和山海经谱系。',
    storyNodeIds: ['kunlun-prologue'],
    keywords: ['昆仑', '西王母', '山海经']
  }
]