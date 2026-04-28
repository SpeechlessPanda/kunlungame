/**
 * Desktop IPC 边界的运行时校验 schema。
 *
 * 设计目标：
 *  - 主进程 ↔ 渲染进程之间所有 IPC 返回值、事件载荷在抵达消费方前都先经过 Zod 校验，
 *    避免主进程的实现漂移（接口改字段、漏字段、误返回 null）以未捕获的形式扩散到 UI。
 *  - schema 是单一真相源；`desktop.ts` 里的 TS 类型由 `z.infer` 派生，确保编译时类型与
 *    运行时校验一致。
 *  - schema 只覆盖**结构契约**，业务级校验（例如态度值范围）由各自模块自己的 schema 处理
 *    （`runtimeStateSchema` 已经在 `src/runtime/runtimeState.ts`）。
 */
import { z } from 'zod'

const desktopShellActionSchema = z.enum([
  'launch-ready',
  'auto-download-required',
  'settings-download-required'
])

const dialogueOptionSchema = z.object({
  semantic: z.enum(['align', 'challenge']),
  label: z.string()
})

export const desktopStartupSnapshotSchema = z.object({
  appName: z.literal('Kunlungame'),
  shellReady: z.boolean(),
  modelSetup: z.object({
    selectedProfileId: z.string(),
    shellAction: desktopShellActionSchema
  })
})

export const desktopDialogueSmokeResultSchema = z.object({
  selectedProfileId: z.string(),
  currentNodeId: z.string(),
  fallbackUsed: z.boolean(),
  chunkCount: z.number().int().nonnegative(),
  combinedText: z.string(),
  combinedTextLength: z.number().int().nonnegative().optional(),
  options: z.array(dialogueOptionSchema),
  completed: z.boolean()
})

export const desktopSerializedRuntimeStateSchema = z.object({
  saveVersion: z.number().int(),
  currentNodeId: z.string(),
  turnIndex: z.number().int().nonnegative(),
  turnsInCurrentNode: z.number().int().nonnegative(),
  attitudeScore: z.number(),
  historySummary: z.string(),
  readNodeIds: z.array(z.string()),
  isCompleted: z.boolean(),
  settings: z.object({
    bgmEnabled: z.boolean(),
    preferredModelMode: z.enum(['default', 'compatibility', 'pro']),
    modelProvider: z.enum(['openai-compatible', 'local']).default('openai-compatible'),
    openAiCompatible: z.object({
      apiKey: z.string().default(''),
      baseUrl: z.string().default('https://api.openai.com/v1'),
      model: z.string().default('gpt-4o-mini'),
      fallbackModels: z.array(z.string().min(1)).default([])
    }).default({})
  })
})

export const desktopMainlineTurnRequestSchema = z.object({
  nodeId: z.string(),
  attitudeChoiceMode: z.enum(['align', 'challenge']),
  runtimeState: desktopSerializedRuntimeStateSchema,
  recentTurns: z.array(z.string())
})

const desktopMainlineTurnSuccessSchema = z.object({
  ok: z.literal(true),
  selectedProfileId: z.string(),
  modelPath: z.string(),
  currentNodeId: z.string(),
  fallbackUsed: z.boolean(),
  chunks: z.array(z.string()),
  combinedText: z.string(),
  options: z.array(dialogueOptionSchema),
  completed: z.boolean()
})

const desktopMainlineTurnFailureSchema = z.object({
  ok: z.literal(false),
  reason: z.enum([
    'node-missing',
    'model-missing',
    'model-load-failed',
    'orchestration-failed'
  ]),
  message: z.string(),
  modelPath: z.string().optional()
})

export const desktopMainlineTurnResultSchema = z.discriminatedUnion('ok', [
  desktopMainlineTurnSuccessSchema,
  desktopMainlineTurnFailureSchema
])

export const desktopMainlineTurnStreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('chunk'), text: z.string() }),
  z.object({ type: z.literal('reset') }),
  z.object({ type: z.literal('result'), result: desktopMainlineTurnResultSchema }),
  z.object({ type: z.literal('error'), message: z.string() })
])

export const desktopProfileAvailabilitySchema = z.object({
  profileId: z.string(),
  status: z.enum(['ready', 'partial', 'missing']),
  expectedFiles: z.array(z.string()),
  presentFiles: z.array(z.string()),
  missingFiles: z.array(z.string()),
  completionRatio: z.number().min(0).max(1),
  manifestDownloadedAt: z.string().nullable()
})

export const desktopProfileDownloadProgressEventSchema = z.object({
  profileId: z.string(),
  fileName: z.string().nullable(),
  phase: z.enum([
    'starting',
    'fetching-metadata',
    'downloading',
    'verifying',
    'file-done',
    'manifest-updated',
    'completed',
    'failed'
  ]),
  fileIndex: z.number().int().nonnegative(),
  totalFiles: z.number().int().nonnegative(),
  message: z.string(),
  bytesDownloaded: z.number().int().nonnegative().optional(),
  totalBytes: z.number().int().nonnegative().optional()
})

const desktopDownloadProfileSuccessSchema = z.object({
  ok: z.literal(true),
  profileId: z.string()
})

const desktopDownloadProfileFailureSchema = z.object({
  ok: z.literal(false),
  profileId: z.string(),
  reason: z.enum(['unknown-profile', 'download-failed', 'already-running']),
  message: z.string()
})

export const desktopDownloadProfileResultSchema = z.discriminatedUnion('ok', [
  desktopDownloadProfileSuccessSchema,
  desktopDownloadProfileFailureSchema
])

export const desktopRuntimeStateSnapshotSchema = z.object({
  state: desktopSerializedRuntimeStateSchema,
  recoveryAction: z.enum(['created-default', 'loaded-existing', 'reset-corrupted'])
})

export const desktopOpenAiCompatibleTestRequestSchema = z.object({
  apiKey: z.string(),
  baseUrl: z.string(),
  model: z.string()
})

const desktopOpenAiCompatibleTestSuccessSchema = z.object({
  ok: z.literal(true),
  model: z.string(),
  latencyMs: z.number().int().nonnegative()
})

const desktopOpenAiCompatibleTestFailureSchema = z.object({
  ok: z.literal(false),
  reason: z.enum([
    'missing-input',
    'invalid-base-url',
    'auth',
    'model-not-found',
    'http-error',
    'timeout',
    'network'
  ]),
  status: z.number().int().nonnegative().optional(),
  message: z.string()
})

export const desktopOpenAiCompatibleTestResultSchema = z.discriminatedUnion('ok', [
  desktopOpenAiCompatibleTestSuccessSchema,
  desktopOpenAiCompatibleTestFailureSchema
])
