export interface ModelProfile {
  id: string
  label: string
  repository: string
  quantization: 'Q4_K_M'
  files: string[]
  recommendedGpuVramGb: number
  contextWindow: number
}

/**
 * 默认模型：Qwen2.5-1.5B-Instruct Q4_K_M（~1.12 GB）。
 * 选择依据：
 * - 纯 CPU 笔记本（i5/i7 级）可以做到 40–80 tok/s，200 字回复 ~3–5 秒，接近"即时对话"。
 * - 同系列 Tokenizer / ChatML 模板与 3B 完全一致，切换时 prompt 不用改。
 * - 中文能力足以覆盖当前剧情（神话 + 早期文明 + 对话追问），配合 sanitizer 与
 *   fingerprint 负样本，风格一致性够用。
 *
 * 如果用户有 >= 6GB VRAM 的独显或不介意等 10–20 秒/轮，可以切到下面的
 * "quality" 档位。3B 仍然比 1.5B 在史实细节上稳一些。
 */
const defaultModelProfile: ModelProfile = {
  id: 'qwen2.5-1.5b-instruct-q4km',
  label: 'Instant Mode',
  repository: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
  quantization: 'Q4_K_M',
  files: ['qwen2.5-1.5b-instruct-q4_k_m.gguf'],
  recommendedGpuVramGb: 0,
  contextWindow: 32768
}

/**
 * 可选质量档：Qwen2.5-3B-Instruct Q4_K_M（~2 GB）。
 * GPU 加速（RTX 30 系及以上）~8 秒/轮；纯 CPU ~30–60 秒/轮，可接受但不"即时"。
 * 史实细节比 1.5B 更稳。
 */
const fallbackModelProfile: ModelProfile = {
  id: 'qwen2.5-3b-instruct-q4km',
  label: 'Quality Mode',
  repository: 'Qwen/Qwen2.5-3B-Instruct-GGUF',
  quantization: 'Q4_K_M',
  files: ['qwen2.5-3b-instruct-q4_k_m.gguf'],
  recommendedGpuVramGb: 4,
  contextWindow: 32768
}

/**
 * 可选 Pro 档：Qwen2.5-7B-Instruct Q4_K_M（分片，总 ~4.5 GB）。
 * 需要 >= 6GB VRAM GPU（Vulkan / CUDA）才能跑出 ~15–20 秒/轮的体验，纯 CPU
 * 需要 5+ 分钟/轮，不建议。开发机上可以用来采样高质量基准。
 */
const proModelProfile: ModelProfile = {
  id: 'qwen2.5-7b-instruct-q4km',
  label: 'Pro Mode',
  repository: 'Qwen/Qwen2.5-7B-Instruct-GGUF',
  quantization: 'Q4_K_M',
  files: [
    'qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf',
    'qwen2.5-7b-instruct-q4_k_m-00002-of-00002.gguf'
  ],
  recommendedGpuVramGb: 8,
  contextWindow: 32768
}

export const getDefaultModelProfile = (): ModelProfile => defaultModelProfile

export const getFallbackModelProfile = (): ModelProfile => fallbackModelProfile

export const getProModelProfile = (): ModelProfile => proModelProfile

/**
 * 默认被自动下载 / 装配的 profile 列表。7B Pro 档不在这里——它体积大、要求独显，
 * 需要玩家显式切换到 Pro Mode 或在脚本里带 `--include-pro` 时才会拉取。
 */
export const getAllModelProfiles = (): ModelProfile[] => [
  defaultModelProfile,
  fallbackModelProfile
]

/**
 * 可选档（目前只有 7B Pro）。需要通过命令行参数或 UI 显式触发下载。
 */
export const getOptionalModelProfiles = (): ModelProfile[] => [proModelProfile]
