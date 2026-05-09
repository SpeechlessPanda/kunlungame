import { z } from 'zod'

const dialogueOptionSchema = z.object({
  semantic: z.enum(['align', 'challenge']),
  label: z.string()
})

export const desktopStartupSnapshotSchema = z.object({
  appName: z.literal('Kunlungame'),
  shellReady: z.boolean()
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
    openAiCompatible: z.object({
      apiKey: z.string().default(''),
      baseUrl: z.string().default('https://ai-api.vaa.la/v1'),
      model: z.string().default('kimi-for-coding'),
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
  currentNodeId: z.string(),
  chunks: z.array(z.string()),
  combinedText: z.string(),
  options: z.array(dialogueOptionSchema),
  completed: z.boolean()
})

const desktopMainlineTurnFailureSchema = z.object({
  ok: z.literal(false),
  reason: z.enum([
    'node-missing',
    'api-missing',
    'orchestration-failed'
  ]),
  message: z.string()
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
