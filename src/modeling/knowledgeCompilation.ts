import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { knowledgeEntrySchema, type KnowledgeEntry } from '../shared/contracts/contentContracts.js'

export interface CompileKnowledgeDirectoryInput {
  inputDir: string
  outputFile: string
}

export interface CompileKnowledgeDirectoryResult {
  entries: KnowledgeEntry[]
}

export interface RetrieveKnowledgeEntriesInput {
  entries: KnowledgeEntry[]
  currentNodeId: string
  theme?: string
  keywords: string[]
  limit: number
}

export interface RetrieveKnowledgeEntriesResult {
  entries: KnowledgeEntry[]
  fallbackUsed: boolean
}

const normalizeMarkdown = (markdown: string): string => markdown.replace(/\r\n/g, '\n')

const parseScalarValue = (value: string): string | null => {
  const trimmedValue = value.trim()
  if (trimmedValue === 'null') {
    return null
  }

  return trimmedValue
}

const parseFrontMatter = (
  markdown: string,
  sourcePath: string
): { attributes: Record<string, unknown>; body: string } => {
  const normalizedMarkdown = normalizeMarkdown(markdown)
  if (!normalizedMarkdown.startsWith('---\n')) {
    throw new Error(`[${sourcePath}] Markdown must start with YAML front matter.`)
  }

  const closingMarkerIndex = normalizedMarkdown.indexOf('\n---\n', 4)
  if (closingMarkerIndex === -1) {
    throw new Error(`[${sourcePath}] Markdown front matter is missing a closing '---'.`)
  }

  const frontMatterBlock = normalizedMarkdown.slice(4, closingMarkerIndex)
  const body = normalizedMarkdown.slice(closingMarkerIndex + 5)
  const lines = frontMatterBlock.split('\n')
  const attributes: Record<string, unknown> = {}

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const currentLine = lines[lineIndex]?.trimEnd() ?? ''
    if (currentLine.trim() === '') {
      continue
    }

    const match = currentLine.match(/^([A-Za-z][A-Za-z0-9]*)\s*:\s*(.*)$/)
    if (!match) {
      throw new Error(`[${sourcePath}] Invalid front matter line: '${currentLine}'.`)
    }

    const [, key, rawValue] = match
    if (rawValue.trim() !== '') {
      attributes[key] = parseScalarValue(rawValue)
      continue
    }

    const listValues: string[] = []
    let listIndex = lineIndex + 1
    while (listIndex < lines.length) {
      const listLine = lines[listIndex] ?? ''
      const listMatch = listLine.match(/^\s*-\s+(.+)$/)
      if (!listMatch) {
        break
      }

      listValues.push(listMatch[1].trim())
      listIndex += 1
    }

    attributes[key] = listValues
    lineIndex = listIndex - 1
  }

  return {
    attributes,
    body
  }
}

const parseMarkdownSections = (body: string, sourcePath: string): Record<string, string> => {
  const sections = normalizeMarkdown(body).split(/^##\s+/m)
  const sectionMap: Record<string, string> = {}

  for (const section of sections) {
    const trimmedSection = section.trim()
    if (trimmedSection === '') {
      continue
    }

    const firstLineBreakIndex = trimmedSection.indexOf('\n')
    if (firstLineBreakIndex === -1) {
      throw new Error(`[${sourcePath}] Section '${trimmedSection}' must include body content.`)
    }

    const title = trimmedSection.slice(0, firstLineBreakIndex).trim()
    const content = trimmedSection.slice(firstLineBreakIndex + 1).trim()
    sectionMap[title] = content
  }

  return sectionMap
}

export const parseKnowledgeMarkdown = (markdown: string, sourcePath: string): KnowledgeEntry => {
  const { attributes, body } = parseFrontMatter(markdown, sourcePath)
  const sections = parseMarkdownSections(body, sourcePath)

  const summary = sections['Summary']
  const extension = sections['Extension']

  if (!summary || !extension) {
    throw new Error(`[${sourcePath}] Knowledge Markdown requires both '## Summary' and '## Extension' sections.`)
  }

  return knowledgeEntrySchema.parse({
    id: attributes['id'],
    topic: attributes['topic'],
    source: attributes['source'],
    storyNodeIds: attributes['storyNodeIds'],
    keywords: attributes['keywords'],
    summary,
    extension
  })
}

const collectMarkdownFiles = async (directoryPath: string): Promise<string[]> => {
  const directoryEntries = await readdir(directoryPath, {
    withFileTypes: true
  })
  const markdownFiles: string[] = []

  for (const entry of directoryEntries) {
    const fullPath = join(directoryPath, entry.name)
    if (entry.isDirectory()) {
      markdownFiles.push(...(await collectMarkdownFiles(fullPath)))
      continue
    }

    if (extname(entry.name).toLowerCase() === '.md') {
      markdownFiles.push(fullPath)
    }
  }

  return markdownFiles.sort((left, right) => left.localeCompare(right))
}

export const compileKnowledgeDirectory = async (
  input: CompileKnowledgeDirectoryInput
): Promise<CompileKnowledgeDirectoryResult> => {
  const markdownFiles = await collectMarkdownFiles(input.inputDir)
  const entries = await Promise.all(
    markdownFiles.map(async (filePath) => {
      const markdown = await readFile(filePath, 'utf8')
      return parseKnowledgeMarkdown(markdown, filePath)
    })
  )

  if (entries.length === 0) {
    throw new Error(`Knowledge compilation produced no entries from '${input.inputDir}'.`)
  }

  await mkdir(dirname(input.outputFile), {
    recursive: true
  })
  await writeFile(input.outputFile, `${JSON.stringify(entries, null, 2)}\n`, 'utf8')

  return {
    entries
  }
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
  const rankedEntries = input.entries
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
    entries: input.entries.slice(0, input.limit),
    fallbackUsed: true
  }
}