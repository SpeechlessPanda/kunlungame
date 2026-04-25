import { join } from 'node:path'
import { compileKnowledgeSources } from '../src/modeling/knowledgeCompilation.js'
import { mainlineStoryOutline } from '../src/content/source/mainlineOutline.js'

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

  console.log(
    `Compiled ${result.entries.length} knowledge entries and story outline to ${outputDir}.`
  )
}

void main().catch((error: unknown) => {
  console.error('[knowledge-compile] failed', error)
  process.exitCode = 1
})