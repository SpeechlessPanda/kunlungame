import type { KnowledgeEntry } from '../shared/contracts/contentContracts.js'

const stripMarkdownMarkup = (text: string): string => {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\s+$/gm, '')
    .trim()
}

const splitFactLines = (extension: string): string[] => {
  const cleaned = stripMarkdownMarkup(extension)
  return cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 5)
}

export const cleanKnowledgeTextForPrompt = (text: string): string => stripMarkdownMarkup(text)

export const formatKnowledgeEntriesForPrompt = (entries: KnowledgeEntry[]): string[] => {
  return entries.map((entry, index) => {
    const summary = cleanKnowledgeTextForPrompt(entry.summary)
    const facts = splitFactLines(entry.extension)
    const factBlock = facts.length > 0
      ? facts.map((fact, factIndex) => `${factIndex + 1}. ${fact}`).join('\n')
      : `1. ${summary}`

    return [
      `RAG-K${index + 1} · ${summary}`,
      `来源：${entry.source}`,
      `主题：${entry.topic}`,
      '事实要点：',
      factBlock,
      '讲述方式：用昆仑子的口吻重新组织；可以改变顺序与表达，但不得照抄条目、不得输出列表或 Markdown。'
    ].join('\n')
  })
}