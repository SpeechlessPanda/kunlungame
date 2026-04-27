import type { KnowledgeEntry, StoryNode } from '../shared/contracts/contentContracts.js'
import type { StoryPrompt } from './storyPromptBuilder.js'
import { formatKnowledgeEntriesForPrompt } from './ragKnowledgeCards.js'

export interface ReplyQualityAssessment {
  needsRepair: boolean
  reasons: string[]
  anchorHits: number
  paragraphCount: number
  textLength: number
}

const normalize = (value: string): string => value.replace(/\s+/g, '').toLocaleLowerCase()

const collectCoverageAnchors = (node: StoryNode): string[] => {
  const anchors = new Set<string>()
  for (const keyword of node.retrievalKeywords) anchors.add(keyword)
  for (const figure of node.recommendedFigures) anchors.add(figure)
  for (const fact of node.mustIncludeFacts) {
    const quoted = fact.match(/[《"][^》"]+[》"]|[A-Za-z0-9-]{2,}/g) ?? []
    for (const item of quoted) anchors.add(item.replace(/[《》"]/g, ''))
  }
  return [...anchors].filter((anchor) => anchor.trim().length >= 2)
}

const countParagraphs = (text: string): number => {
  const explicit = text.split(/\n+/).filter((part) => part.trim().length > 0).length
  if (explicit > 1) return explicit
  return text.split(/[。！？?!]/u).filter((part) => part.trim().length >= 12).length
}

export const assessReplyQuality = (input: { text: string; currentNode: StoryNode }): ReplyQualityAssessment => {
  const normalizedText = normalize(input.text)
  const anchors = collectCoverageAnchors(input.currentNode)
  const anchorHits = anchors.filter((anchor) => normalizedText.includes(normalize(anchor))).length
  const paragraphCount = countParagraphs(input.text)
  const textLength = input.text.replace(/\s+/g, '').length
  const reasons: string[] = []

  if (textLength < 160) reasons.push(`too-short:${textLength}`)
  if (paragraphCount < 3) reasons.push(`too-few-paragraphs:${paragraphCount}`)
  if (anchors.length > 0 && anchorHits < Math.min(3, anchors.length)) reasons.push(`low-anchor-coverage:${anchorHits}`)

  return {
    needsRepair: reasons.length > 0,
    reasons,
    anchorHits,
    paragraphCount,
    textLength
  }
}

export const buildCoverageRepairPrompt = (input: {
  currentNode: StoryNode
  retrievedEntries: KnowledgeEntry[]
  previousText: string
  forbiddenTerms: string[]
  reasons: string[]
}): StoryPrompt => {
  const ragCards = formatKnowledgeEntriesForPrompt(input.retrievedEntries).join('\n\n')
  return {
    system: [
      '你仍然扮演「昆仑」这个文化陪伴者小妹妹。',
      '上一版回答没有达到质量门槛；现在只重写正文，不输出选项、编号、标题或解释。',
      '必须保持当前节点，不得跳到后续节点。',
      '必须输出 3-4 个自然段，总长 180-260 字。',
      '前两段必须讲清当前节点事实，最后一句才允许追问玩家。',
      '语气可以活泼，但知识段也必须像她本人在说话，不能变成百科条目。'
    ].join('\n'),
    user: [
      `当前节点：${input.currentNode.title}`,
      `核心问题：${input.currentNode.coreQuestion}`,
      `必须包含的事实：${input.currentNode.mustIncludeFacts.join('；')}`,
      `可用 RAG 知识卡：\n${ragCards || '（无额外知识卡，使用必须包含的事实即可。）'}`,
      `禁止提前涉及：${input.forbiddenTerms.join('、') || '无'}`,
      `上一版问题：${input.reasons.join('、')}`,
      `上一版正文（不要照抄）：${input.previousText}`,
      '现在重写一版合格正文：'
    ].join('\n\n')
  }
}
