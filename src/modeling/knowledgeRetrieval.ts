import type { KnowledgeEntry } from '../shared/contracts/contentContracts.js'

export interface RetrieveKnowledgeEntriesInput {
  entries: KnowledgeEntry[]
  currentNodeId: string
  allowedTopics?: string[]
  theme?: string
  keywords: string[]
  limit: number
  /**
   * 可选轮换偏移量：传入同一节点的不同轮次（比如 turnsInCurrentNode），
   * 让 ranked 条目以 round-robin 的方式轮换，避免 AI 在同一节点連续几轮看到一模一样的 3 条知识。
   * 默认 0（向后兼容：与原有行为完全一致）。
   */
  turnSalt?: number
}

export interface RetrieveKnowledgeEntriesResult {
  entries: KnowledgeEntry[]
  fallbackUsed: boolean
}

const countKeywordMatches = (entryKeywords: string[], queryKeywords: string[]): number => {
  const queryKeywordSet = new Set(queryKeywords.filter((keyword) => keyword.trim() !== ''))
  let matches = 0

  for (const keyword of entryKeywords) {
    if (queryKeywordSet.has(keyword)) {
      matches += 1
    }
  }

  return matches
}

export const retrieveKnowledgeEntries = (
  input: RetrieveKnowledgeEntriesInput
): RetrieveKnowledgeEntriesResult => {
  const allowedTopics = input.allowedTopics?.filter((topic) => topic.trim() !== '') ?? []
  const eligibleEntries = input.entries.filter((entry) => {
    const directNodeMatch = entry.storyNodeIds.includes(input.currentNodeId)
    const topicAllowed = allowedTopics.length === 0 || allowedTopics.includes(entry.topic)

    return directNodeMatch && topicAllowed
  })

  const rankedEntries = eligibleEntries
    .map((entry) => {
      const directNodeMatch = entry.storyNodeIds.includes(input.currentNodeId) ? 1 : 0
      const keywordMatches = countKeywordMatches(entry.keywords, input.keywords)
      const themeMatch = input.theme && entry.topic.includes(input.theme) ? 1 : 0
      const score = directNodeMatch * 100 + keywordMatches * 10 + themeMatch

      return {
        entry,
        directNodeMatch,
        keywordMatches,
        themeMatch,
        score
      }
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => {
      if (right.directNodeMatch !== left.directNodeMatch) {
        return right.directNodeMatch - left.directNodeMatch
      }

      if (right.keywordMatches !== left.keywordMatches) {
        return right.keywordMatches - left.keywordMatches
      }

      if (right.themeMatch !== left.themeMatch) {
        return right.themeMatch - left.themeMatch
      }

      return left.entry.id.localeCompare(right.entry.id)
    })
    .map((candidate) => candidate.entry)

  if (rankedEntries.length > 0) {
    const salt = Math.max(0, Math.floor(input.turnSalt ?? 0))
    const offset = rankedEntries.length === 0 ? 0 : salt % rankedEntries.length
    const rotated = offset === 0
      ? rankedEntries
      : [...rankedEntries.slice(offset), ...rankedEntries.slice(0, offset)]
    return {
      entries: rotated.slice(0, input.limit),
      fallbackUsed: false
    }
  }

  return {
    entries: eligibleEntries.slice(0, input.limit),
    fallbackUsed: true
  }
}
