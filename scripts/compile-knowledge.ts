import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  compileKnowledgeSources,
  parseKnowledgeMarkdown
} from '../src/modeling/knowledgeCompilation.js'
import { mainlineStoryOutline } from '../src/content/source/mainlineOutline.js'
import { readdir } from 'node:fs/promises'

const collectSupplementaryEntryFiles = async (dir: string): Promise<string[]> => {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
      .map((entry) => join(dir, entry.name))
      .sort((left, right) => left.localeCompare(right))
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'ENOENT'
    ) {
      return []
    }
    throw error
  }
}

const main = async (): Promise<void> => {
  const projectRoot = process.cwd()
  const knowledgeSourceFile = join(projectRoot, 'docs', 'knowledge-base', 'cultural-knowledge.md')
  const outputDir = join(projectRoot, 'src', 'content', 'generated')
  const result = await compileKnowledgeSources({
    knowledgeSourceFile,
    sourceReferencePath: 'docs/knowledge-base/cultural-knowledge.md',
    storyOutline: mainlineStoryOutline,
    outputDir
  })

  // 把 md/knowledge/*.md 里的节点专属补充条目合并进 knowledgeEntries.json，
  // 让 RAG 在 cultural-knowledge.md 主源之外，还能拉到每个节点至少一篇高密度叙事素材。
  const supplementaryDir = join(projectRoot, 'md', 'knowledge')
  const supplementaryFiles = await collectSupplementaryEntryFiles(supplementaryDir)
  const supplementaryEntries = await Promise.all(
    supplementaryFiles.map(async (filePath) => {
      const markdown = await readFile(filePath, 'utf8')
      const relativePath = filePath
        .slice(projectRoot.length + 1)
        .split(/[/\\]/)
        .join('/')
      const entry = parseKnowledgeMarkdown(markdown, relativePath)
      return { ...entry, source: relativePath }
    })
  )

  // 同 id 优先用补充条目（让作者侧的 md/knowledge 写得更具体的版本生效）。
  const mergedById = new Map<string, (typeof result.entries)[number]>()
  for (const entry of result.entries) mergedById.set(entry.id, entry)
  for (const entry of supplementaryEntries) mergedById.set(entry.id, entry)
  const mergedEntries = Array.from(mergedById.values()).sort((left, right) =>
    left.id.localeCompare(right.id)
  )

  await writeFile(
    join(outputDir, 'knowledgeEntries.json'),
    `${JSON.stringify(mergedEntries, null, 2)}\n`,
    'utf8'
  )

  console.log(
    `Compiled ${result.entries.length} primary + ${supplementaryEntries.length} supplementary knowledge entries `
      + `(${mergedEntries.length} unique) and story outline to ${outputDir}.`
  )
}

void main().catch((error: unknown) => {
  console.error('[knowledge-compile] failed', error)
  process.exitCode = 1
})
