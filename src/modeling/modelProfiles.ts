export interface ModelProfile {
  id: string
  label: string
  repository: string
  quantization: 'Q4_K_M'
  files: string[]
  recommendedGpuVramGb: number
  contextWindow: number
}

const defaultModelProfile: ModelProfile = {
  id: 'qwen2.5-7b-instruct-q4km',
  label: 'Default Mode',
  repository: 'Qwen/Qwen2.5-7B-Instruct-GGUF',
  quantization: 'Q4_K_M',
  files: [
    'qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf',
    'qwen2.5-7b-instruct-q4_k_m-00002-of-00002.gguf'
  ],
  recommendedGpuVramGb: 8,
  contextWindow: 32768
}

const fallbackModelProfile: ModelProfile = {
  id: 'qwen2.5-3b-instruct-q4km',
  label: 'Compatibility Mode',
  repository: 'Qwen/Qwen2.5-3B-Instruct-GGUF',
  quantization: 'Q4_K_M',
  files: ['qwen2.5-3b-instruct-q4_k_m.gguf'],
  recommendedGpuVramGb: 6,
  contextWindow: 32768
}

export const getDefaultModelProfile = (): ModelProfile => defaultModelProfile

export const getFallbackModelProfile = (): ModelProfile => fallbackModelProfile

export const getAllModelProfiles = (): ModelProfile[] => [defaultModelProfile, fallbackModelProfile]
