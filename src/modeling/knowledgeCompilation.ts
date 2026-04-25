import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import {
  knowledgeEntrySchema,
  parseStoryOutline,
  type KnowledgeEntry,
  type StoryOutline
} from '../shared/contracts/contentContracts.js'

export interface CompileKnowledgeDirectoryInput {
  inputDir: string
  outputFile: string
}

export interface CompileKnowledgeDirectoryResult {
  entries: KnowledgeEntry[]
}

export interface CompileKnowledgeSourcesInput {
  knowledgeSourceFile: string
  sourceReferencePath?: string
  storyOutline: StoryOutline
  outputDir: string
}

export interface CompileKnowledgeSourcesResult {
  storyOutline: StoryOutline
  entries: KnowledgeEntry[]
}

export {
  retrieveKnowledgeEntries,
  type RetrieveKnowledgeEntriesInput,
  type RetrieveKnowledgeEntriesResult
} from './knowledgeRetrieval.js'

const normalizeMarkdown = (markdown: string): string => markdown.replace(/\r\n/g, '\n')

const CULTURAL_SECTION_CONFIG: Record<
  string,
  {
    topic: string
    storyNodeIds: string[]
    includeInEntries: boolean
  }
> = {
  一: {
    topic: 'myth-origin',
    storyNodeIds: ['kunlun-threshold', 'creation-myths'],
    includeInEntries: true
  },
  二: {
    topic: 'civilization-origin',
    storyNodeIds: ['civilization-roots'],
    includeInEntries: true
  },
  三: {
    topic: 'order-and-thought',
    storyNodeIds: ['order-and-thought'],
    includeInEntries: true
  },
  四: {
    topic: 'order-and-thought',
    storyNodeIds: ['order-and-thought'],
    includeInEntries: true
  },
  五: {
    topic: 'order-and-thought',
    storyNodeIds: ['order-and-thought'],
    includeInEntries: true
  },
  六: {
    topic: 'empire-and-openness',
    storyNodeIds: ['empire-and-openness'],
    includeInEntries: true
  },
  七: {
    topic: 'fusion-and-refinement',
    storyNodeIds: ['fusion-and-refinement'],
    includeInEntries: true
  },
  八: {
    topic: 'rupture-and-guardianship',
    storyNodeIds: ['rupture-and-guardianship'],
    includeInEntries: true
  },
  九: {
    topic: 'contemporary-return',
    storyNodeIds: ['contemporary-return'],
    includeInEntries: true
  },
  十: {
    topic: 'dialogue-samples',
    storyNodeIds: [],
    includeInEntries: false
  }
}

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

const cleanHeadingLabel = (heading: string): string => {
  return heading.replace(/^\d+(?:\.\d+)?\s*/, '').trim()
}

const collectKeywords = (sectionTitle: string, subsectionTitle: string): string[] => {
  const keywords = [cleanHeadingLabel(sectionTitle), cleanHeadingLabel(subsectionTitle)]
  return Array.from(new Set(keywords.filter((keyword) => keyword !== '')))
}

const buildEntrySummary = (content: string): { summary: string; extension: string } => {
  const normalizedContent = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')

  if (normalizedContent.length === 0) {
    return {
      summary: '待补充知识摘要。',
      extension: '待补充知识延伸。'
    }
  }

  const summary = normalizedContent[0]?.replace(/^[-*]\s*/, '') ?? '待补充知识摘要。'
  const extensionLines = normalizedContent.slice(1)

  return {
    summary,
    extension:
      extensionLines.length > 0
        ? extensionLines.join('\n')
        : `${summary}（编译自原始文化知识库章节）`
  }
}

const parseCulturalKnowledgeMarkdown = (
  markdown: string,
  sourcePath: string
): KnowledgeEntry[] => {
  const lines = normalizeMarkdown(markdown).split('\n')
  const entries: KnowledgeEntry[] = []
  let currentTopLevelTitle: string | null = null
  let currentSubsectionTitle: string | null = null
  let currentSubsectionLines: string[] = []

  const pushCurrentSubsection = (): void => {
    if (!currentTopLevelTitle || !currentSubsectionTitle) {
      return
    }

    const topLevelMatch = currentTopLevelTitle.match(/^([一二三四五六七八九十]+)、(.+)$/)
    if (!topLevelMatch) {
      currentSubsectionTitle = null
      currentSubsectionLines = []
      return
    }

    const [, sectionIndex] = topLevelMatch
    const sectionConfig = CULTURAL_SECTION_CONFIG[sectionIndex]
    if (!sectionConfig || !sectionConfig.includeInEntries) {
      currentSubsectionTitle = null
      currentSubsectionLines = []
      return
    }

    const subsectionContent = currentSubsectionLines.join('\n').trim()
    const { summary, extension } = buildEntrySummary(subsectionContent)
    const entryId = `${sectionConfig.topic}-${String(entries.length + 1).padStart(2, '0')}`

    entries.push(
      knowledgeEntrySchema.parse({
        id: entryId,
        topic: sectionConfig.topic,
        source: `${sourcePath}#${cleanHeadingLabel(currentSubsectionTitle)}`,
        summary,
        extension,
        storyNodeIds: sectionConfig.storyNodeIds,
        keywords: collectKeywords(currentTopLevelTitle, currentSubsectionTitle)
      })
    )

    currentSubsectionTitle = null
    currentSubsectionLines = []
  }

  for (const line of lines) {
    if (line.startsWith('## ')) {
      pushCurrentSubsection()
      currentTopLevelTitle = line.slice(3).trim()
      currentSubsectionTitle = null
      currentSubsectionLines = []
      continue
    }

    if (line.startsWith('### ')) {
      pushCurrentSubsection()
      currentSubsectionTitle = line.slice(4).trim()
      currentSubsectionLines = []
      continue
    }

    if (currentSubsectionTitle) {
      currentSubsectionLines.push(line)
    }
  }

  pushCurrentSubsection()

  if (entries.length === 0) {
    throw new Error(`[${sourcePath}] Cultural knowledge compilation produced no structured entries.`)
  }

  return entries
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

export const compileKnowledgeSources = async (
  input: CompileKnowledgeSourcesInput
): Promise<CompileKnowledgeSourcesResult> => {
  const markdown = await readFile(input.knowledgeSourceFile, 'utf8')
  const storyOutline = parseStoryOutline(input.storyOutline)
  const entries = parseCulturalKnowledgeMarkdown(
    markdown,
    input.sourceReferencePath ?? input.knowledgeSourceFile
  )

  await mkdir(input.outputDir, {
    recursive: true
  })
  await writeFile(join(input.outputDir, 'storyOutline.json'), `${JSON.stringify(storyOutline, null, 2)}\n`, 'utf8')
  await writeFile(
    join(input.outputDir, 'knowledgeEntries.json'),
    `${JSON.stringify(entries, null, 2)}\n`,
    'utf8'
  )

  return {
    storyOutline,
    entries
  }
}
