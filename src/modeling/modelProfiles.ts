export interface ModelProfile {
  id: string
  label: string
  repository: string
  quantization: 'Q4_K_M' | 'Q3_K_M'
  files: string[]
  recommendedGpuVramGb: number
  contextWindow: number
}

/**
 * 默认模型：Qwen2.5-3B-Instruct Q4_K_M（~2 GB）。
 * 选择依据：
 * - GPU 加速（RTX 30 系及以上）~8 秒/轮，流畅接近即时；纯 CPU 笔记本 30-60 秒/轮，
 *   虽不如 1.5B 即时但仍可玩，且指令遵循（禁用首词 / fingerprint / mustIncludeFacts）
 *   显著比 1.5B 稳，不会每一轮复述前一轮的开场句。
 * - 实测 1.5B 虽然 CPU 下也能 ~5 秒/轮，但对负样本清单的遵循明显不足，
 *   会频繁破防写出被禁词或重复前轮结构，质量不达标，因此把它从默认档移到可选档。
 * - 同系列 ChatML 模板，与 1.5B/7B 共享 prompt 模板。
 */
const defaultModelProfile: ModelProfile = {
  id: 'qwen2.5-3b-instruct-q4km',
  label: 'Quality Mode',
  repository: 'Qwen/Qwen2.5-3B-Instruct-GGUF',
  quantization: 'Q4_K_M',
  files: ['qwen2.5-3b-instruct-q4_k_m.gguf'],
  recommendedGpuVramGb: 4,
  contextWindow: 32768
}

/**
 * 兜底档：Qwen2.5-1.5B-Instruct Q4_K_M（~1.12 GB）。
 * 真·纯 CPU 老旧机器才切到这里（~3-5 秒/轮），但需要接受：
 * - 指令遵循较弱，偶尔会复述前轮的开场句或破掉被禁词；
 * - 叙事密度显著更低，mustIncludeFacts 覆盖不齐；
 * - 已启用最严格的 strictCoverage + repeatPenalty，但小模型上限就在这里。
 */
const fallbackModelProfile: ModelProfile = {
  id: 'qwen2.5-1.5b-instruct-q4km',
  label: 'Lite Mode',
  repository: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
  quantization: 'Q4_K_M',
  files: ['qwen2.5-1.5b-instruct-q4_k_m.gguf'],
  recommendedGpuVramGb: 0,
  contextWindow: 32768
}

/**
 * 可选 Pro 档：Qwen2.5-7B-Instruct Q3_K_M（单文件 ~3.81 GB）。
 *
 * 选择依据（替代旧的 Q4_K_M 分片版）：
 * - Q4_K_M (~4.5GB 分片) 在 RTX 4060 Laptop 8GB 上接近显存上限，会有部分层
 *   offload 到 CPU，token 生成速度被瓶颈拖到 ~15-20 秒/轮。
 * - Q3_K_M (~3.81GB 单文件) 可以让 7B 全量层落入 8GB 显存，token gen 实测
 *   提升 ~15-20%，prompt eval 也更稳；中文 ppl 退化 < 3%，叙事/选项节奏在
 *   galgame 场景内可接受。
 * - 单文件免去分片合并/校验链路，下载体验更稳，配合 byte-level resume
 *   失败重试更直观。
 * - 仍需手动切到 Pro Mode 触发下载（不进入 startup 自动列表），开发机上可
 *   用来采样高质量基准。
 */
const proModelProfile: ModelProfile = {
  id: 'qwen2.5-7b-instruct-q3km',
  label: 'Pro Mode',
  repository: 'Qwen/Qwen2.5-7B-Instruct-GGUF',
  quantization: 'Q3_K_M',
  files: ['qwen2.5-7b-instruct-q3_k_m.gguf'],
  recommendedGpuVramGb: 6,
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
 * 返回所有已知 profile（含 Pro 档）——供 UI 枚举选项 / 按 id 查找使用。
 * 与 `getAllModelProfiles` 区分：后者仅包含 startup 自动下载的两档。
 */
export const getAllKnownModelProfiles = (): ModelProfile[] => [
  defaultModelProfile,
  fallbackModelProfile,
  proModelProfile
]

export const findModelProfileById = (profileId: string): ModelProfile | null => {
  return getAllKnownModelProfiles().find((profile) => profile.id === profileId) ?? null
}

/**
 * 可选档（目前只有 7B Pro）。需要通过命令行参数或 UI 显式触发下载。
 */
export const getOptionalModelProfiles = (): ModelProfile[] => [proModelProfile]
