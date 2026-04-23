export interface ModelSmokeTestInput {
  profileId: string
  modelPath: string
  prompt?: string
}

export interface ModelSmokeTestResult {
  ok: boolean
  response: string | null
  errorMessage: string | null
  suggestedFix: string
}

export interface ModelSmokeTestDependencies {
  promptModel: (modelPath: string, prompt: string) => Promise<string>
}

const defaultPrompt = '请用一句中文自我介绍，并提到昆仑。'

const defaultDependencies: ModelSmokeTestDependencies = {
  promptModel: async (modelPath, prompt) => {
    const { getLlama, LlamaChatSession } = await import('node-llama-cpp')
    const llama = await getLlama({ gpu: false })
    const model = await llama.loadModel({ modelPath })
    const context = await model.createContext({ contextSize: { max: 2048 } })
    const session = new LlamaChatSession({ contextSequence: context.getSequence() })

    try {
      return await session.prompt(prompt, { maxTokens: 80 })
    } finally {
      await session.dispose?.()
      await context.dispose?.()
      await model.dispose?.()
      await llama.dispose?.()
    }
  }
}

export const runModelSmokeTest = async (
  input: ModelSmokeTestInput,
  dependencies: Partial<ModelSmokeTestDependencies> = {}
): Promise<ModelSmokeTestResult> => {
  const resolvedDependencies = {
    ...defaultDependencies,
    ...dependencies
  }

  try {
    const response = (await resolvedDependencies.promptModel(input.modelPath, input.prompt ?? defaultPrompt)).trim()
    if (response.length === 0) {
      return {
        ok: false,
        response: null,
        errorMessage: 'Model returned an empty response during smoke test.',
        suggestedFix: '重新下载当前模型文件并再次执行下载后的冒烟测试。'
      }
    }

    return {
      ok: true,
      response,
      errorMessage: null,
      suggestedFix: 'No fix needed.'
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      response: null,
      errorMessage,
      suggestedFix: '重新下载当前模型并重跑冒烟测试；若仍失败，则切换镜像或兼容模式。'
    }
  }
}