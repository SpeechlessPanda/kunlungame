import { join } from 'node:path'
import { compileKnowledgeDirectory } from '../src/modeling/knowledgeCompilation.js'

const main = async (): Promise<void> => {
  const projectRoot = process.cwd()
  const inputDir = join(projectRoot, 'md', 'knowledge')
  const outputFile = join(projectRoot, 'src', 'content', 'generated', 'knowledgeEntries.json')
  const result = await compileKnowledgeDirectory({
    inputDir,
    outputFile
  })

  console.log(`Compiled ${result.entries.length} knowledge entries to ${outputFile}.`)
}

void main().catch((error: unknown) => {
  console.error('[knowledge-compile] failed', error)
  process.exitCode = 1
})