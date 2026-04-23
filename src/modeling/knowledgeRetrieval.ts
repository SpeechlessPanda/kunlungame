import type { KnowledgeEntry } from '../shared/contracts/contentContracts.js'

export interface RetrieveKnowledgeEntriesInput {
  entries: KnowledgeEntry[]
  currentNodeId: string
  allowedTopics?: string[]
  theme?: string
  keywords: string[]
  limit: number
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
    return {
      entries: rankedEntries.slice(0, input.limit),
      fallbackUsed: false
    }
  }

  return {
    entries: eligibleEntries.slice(0, input.limit),
    fallbackUsed: true
  }
}
