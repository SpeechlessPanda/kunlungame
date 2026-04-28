import { describe, expect, it, vi } from 'vitest'
import {
  IpcContractError,
  wrapDesktopBridgeWithValidation
} from '../src/renderer/lib/desktopBridgeClient.js'
import type {
  DesktopBridge,
  DesktopDownloadProfileResult,
  DesktopMainlineTurnStreamEvent,
  DesktopMainlineTurnResult,
  DesktopProfileAvailability,
  DesktopRuntimeStateSnapshot,
  DesktopStartupSnapshot
} from '../src/shared/types/desktop.js'

const buildValidStartupSnapshot = (): DesktopStartupSnapshot => ({
  appName: 'Kunlungame',
  shellReady: true,
  modelSetup: {
    selectedProfileId: 'qwen2_5-3b-q4_k_m',
    shellAction: 'launch-ready'
  }
})

const buildValidProfileAvailability = (): DesktopProfileAvailability => ({
  profileId: 'qwen2_5-3b-q4_k_m',
  status: 'ready',
  expectedFiles: ['weights.gguf'],
  presentFiles: ['weights.gguf'],
  missingFiles: [],
  completionRatio: 1,
  manifestDownloadedAt: '2026-04-25T00:00:00.000Z'
})

const buildValidRuntimeStateSnapshot = (): DesktopRuntimeStateSnapshot => ({
  state: {
    saveVersion: 1,
    currentNodeId: 'kunlun-threshold',
    turnIndex: 0,
    turnsInCurrentNode: 0,
    attitudeScore: 0,
    historySummary: '',
    readNodeIds: [],
    isCompleted: false,
    settings: {
      bgmEnabled: true,
      preferredModelMode: 'default',
      modelProvider: 'openai-compatible',
      openAiCompatible: {
        apiKey: '',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini'
      }
    }
  },
  recoveryAction: 'loaded-existing'
})

const buildValidTurnResultSuccess = (): DesktopMainlineTurnResult => ({
  ok: true,
  selectedProfileId: 'qwen2_5-3b-q4_k_m',
  modelPath: '/tmp/model.gguf',
  currentNodeId: 'kunlun-threshold',
  fallbackUsed: false,
  chunks: ['你好'],
  combinedText: '你好',
  options: [
    { semantic: 'align', label: '同意' },
    { semantic: 'challenge', label: '质疑' }
  ],
  completed: false
})

const buildValidDownloadResult = (): DesktopDownloadProfileResult => ({
  ok: true,
  profileId: 'qwen2_5-3b-q4_k_m'
})

const buildRawBridge = (overrides: Partial<DesktopBridge> = {}): DesktopBridge => ({
  ping: vi.fn().mockResolvedValue('pong'),
  quitApp: vi.fn().mockResolvedValue(undefined),
  getStartupSnapshot: vi.fn().mockResolvedValue(buildValidStartupSnapshot()),
  runDialogueSmoke: vi.fn().mockResolvedValue({
    selectedProfileId: 'p',
    currentNodeId: 'n',
    fallbackUsed: false,
    chunkCount: 0,
    combinedText: '',
    options: [],
    completed: false
  }),
  runMainlineTurn: vi.fn().mockResolvedValue(buildValidTurnResultSuccess()),
  loadRuntimeState: vi.fn().mockResolvedValue(buildValidRuntimeStateSnapshot()),
  saveRuntimeState: vi.fn().mockResolvedValue(undefined),
  getProfileAvailability: vi.fn().mockResolvedValue(buildValidProfileAvailability()),
  downloadProfile: vi.fn().mockResolvedValue(buildValidDownloadResult()),
  onProfileDownloadProgress: vi.fn().mockReturnValue(() => {}),
  ...overrides
})

describe('wrapDesktopBridgeWithValidation', () => {
  describe('正常路径', () => {
    it('合法 startup snapshot 透传', async () => {
      const bridge = wrapDesktopBridgeWithValidation(buildRawBridge())
      const result = await bridge.getStartupSnapshot()
      expect(result.appName).toBe('Kunlungame')
      expect(result.modelSetup.shellAction).toBe('launch-ready')
    })

    it('合法 turn 成功结果透传', async () => {
      const bridge = wrapDesktopBridgeWithValidation(buildRawBridge())
      const result = await bridge.runMainlineTurn({
        nodeId: 'kunlun-threshold',
        attitudeChoiceMode: 'align',
        runtimeState: buildValidRuntimeStateSnapshot().state,
        recentTurns: []
      })
      expect(result.ok).toBe(true)
    })

    it('合法 turn 失败结果透传，含 reason 与 message', async () => {
      const failure: DesktopMainlineTurnResult = {
        ok: false,
        reason: 'model-missing',
        message: '模型文件不存在'
      }
      const bridge = wrapDesktopBridgeWithValidation(
        buildRawBridge({ runMainlineTurn: vi.fn().mockResolvedValue(failure) })
      )
      const result = await bridge.runMainlineTurn({
        nodeId: 'kunlun-threshold',
        attitudeChoiceMode: 'align',
        runtimeState: buildValidRuntimeStateSnapshot().state,
        recentTurns: []
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe('model-missing')
      }
    })

    it('合法 streamMainlineTurn 事件逐个透传', async () => {
      const bridge = wrapDesktopBridgeWithValidation(
        buildRawBridge({
          streamMainlineTurn: vi.fn(async (_request, onEvent) => {
            onEvent({ type: 'chunk', text: '第一句。' })
            onEvent({ type: 'reset' })
            onEvent({ type: 'result', result: buildValidTurnResultSuccess() })
          })
        })
      )

      const events: DesktopMainlineTurnStreamEvent[] = []
      await bridge.streamMainlineTurn!({
        nodeId: 'kunlun-threshold',
        attitudeChoiceMode: 'align',
        runtimeState: buildValidRuntimeStateSnapshot().state,
        recentTurns: []
      }, (event) => events.push(event))

      expect(events.map((event) => event.type)).toEqual(['chunk', 'reset', 'result'])
    })

    it('saveRuntimeState 不做返回值校验，不抛错', async () => {
      const bridge = wrapDesktopBridgeWithValidation(buildRawBridge())
      await expect(
        bridge.saveRuntimeState(buildValidRuntimeStateSnapshot().state)
      ).resolves.toBeUndefined()
    })

    it('loadRuntimeState accepts OpenAI-compatible provider settings', async () => {
      const bridge = wrapDesktopBridgeWithValidation(buildRawBridge({
        loadRuntimeState: vi.fn().mockResolvedValue({
          ...buildValidRuntimeStateSnapshot(),
          state: {
            ...buildValidRuntimeStateSnapshot().state,
            settings: {
              bgmEnabled: true,
              preferredModelMode: 'default',
              modelProvider: 'openai-compatible',
              openAiCompatible: {
                apiKey: 'sk-test',
                baseUrl: 'https://api.example.test/v1',
                model: 'gpt-4.1-mini'
              }
            }
          }
        })
      }))

      const snapshot = await bridge.loadRuntimeState()

      expect(snapshot.state.settings.modelProvider).toBe('openai-compatible')
      expect(snapshot.state.settings.openAiCompatible.model).toBe('gpt-4.1-mini')
    })
  })

  describe('防御主进程实现漂移', () => {
    it('startup snapshot 缺字段 → 抛 IpcContractError', async () => {
      const bridge = wrapDesktopBridgeWithValidation(
        buildRawBridge({
          getStartupSnapshot: vi.fn().mockResolvedValue({
            appName: 'Kunlungame',
            shellReady: true
            // modelSetup 缺失
          } as unknown as DesktopStartupSnapshot)
        })
      )
      await expect(bridge.getStartupSnapshot()).rejects.toBeInstanceOf(IpcContractError)
    })

    it('profile availability completionRatio 越界 → 抛 IpcContractError', async () => {
      const bridge = wrapDesktopBridgeWithValidation(
        buildRawBridge({
          getProfileAvailability: vi.fn().mockResolvedValue({
            ...buildValidProfileAvailability(),
            completionRatio: 1.5
          })
        })
      )
      await expect(bridge.getProfileAvailability('x')).rejects.toBeInstanceOf(IpcContractError)
    })

    it('runMainlineTurn 返回未知 reason → 抛 IpcContractError', async () => {
      const bridge = wrapDesktopBridgeWithValidation(
        buildRawBridge({
          runMainlineTurn: vi.fn().mockResolvedValue({
            ok: false,
            reason: 'unknown-reason',
            message: 'x'
          } as unknown as DesktopMainlineTurnResult)
        })
      )
      await expect(
        bridge.runMainlineTurn({
          nodeId: 'kunlun-threshold',
          attitudeChoiceMode: 'align',
          runtimeState: buildValidRuntimeStateSnapshot().state,
          recentTurns: []
        })
      ).rejects.toBeInstanceOf(IpcContractError)
    })

    it('streamMainlineTurn 畸形事件 → 抛 IpcContractError', async () => {
      const bridge = wrapDesktopBridgeWithValidation(
        buildRawBridge({
          streamMainlineTurn: vi.fn(async (_request, onEvent) => {
            onEvent({ type: 'chunk', text: 42 } as never)
          }) as never
        })
      )

      await expect(
        bridge.streamMainlineTurn!({
          nodeId: 'kunlun-threshold',
          attitudeChoiceMode: 'align',
          runtimeState: buildValidRuntimeStateSnapshot().state,
          recentTurns: []
        }, () => { })
      ).rejects.toBeInstanceOf(IpcContractError)
    })

    it('streamMainlineTurn 缺失 → 抛 IpcContractError', async () => {
      const bridge = wrapDesktopBridgeWithValidation(buildRawBridge({ streamMainlineTurn: undefined }))
      await expect(bridge.streamMainlineTurn!({
        nodeId: 'kunlun-threshold',
        attitudeChoiceMode: 'align',
        runtimeState: buildValidRuntimeStateSnapshot().state,
        recentTurns: []
      }, () => { })).rejects.toBeInstanceOf(IpcContractError)
    })

    it('loadRuntimeState recoveryAction 非法值 → 抛 IpcContractError', async () => {
      const bridge = wrapDesktopBridgeWithValidation(
        buildRawBridge({
          loadRuntimeState: vi.fn().mockResolvedValue({
            ...buildValidRuntimeStateSnapshot(),
            recoveryAction: 'bogus' as never
          })
        })
      )
      await expect(bridge.loadRuntimeState()).rejects.toBeInstanceOf(IpcContractError)
    })

    it('downloadProfile reason 非法 → 抛 IpcContractError', async () => {
      const bridge = wrapDesktopBridgeWithValidation(
        buildRawBridge({
          downloadProfile: vi.fn().mockResolvedValue({
            ok: false,
            profileId: 'x',
            reason: 'never-happens',
            message: 'm'
          } as unknown as DesktopDownloadProfileResult)
        })
      )
      await expect(bridge.downloadProfile('x')).rejects.toBeInstanceOf(IpcContractError)
    })

    it('ping 返回非 string → 抛 IpcContractError', async () => {
      const bridge = wrapDesktopBridgeWithValidation(
        buildRawBridge({ ping: vi.fn().mockResolvedValue(42 as unknown as string) })
      )
      await expect(bridge.ping()).rejects.toBeInstanceOf(IpcContractError)
    })
  })

  describe('progress 事件畸形容错', () => {
    it('畸形 progress 事件被丢弃，不污染 handler', () => {
      let captured: unknown = null
      const rawProgressHandlers: Array<(e: unknown) => void> = []
      const raw = buildRawBridge({
        onProfileDownloadProgress: vi.fn().mockImplementation((handler) => {
          rawProgressHandlers.push(handler)
          return () => {}
        })
      })
      const bridge = wrapDesktopBridgeWithValidation(raw)
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      try {
        bridge.onProfileDownloadProgress((event) => {
          captured = event
        })
        // 注入畸形事件
        rawProgressHandlers[0]!({ profileId: 1, phase: 'downloading' })
        expect(captured).toBeNull()
        expect(warnSpy).toHaveBeenCalled()
        // 注入合法事件
        rawProgressHandlers[0]!({
          profileId: 'p',
          fileName: null,
          phase: 'downloading',
          fileIndex: 0,
          totalFiles: 1,
          message: 'ok'
        })
        expect(captured).not.toBeNull()
      } finally {
        warnSpy.mockRestore()
      }
    })
  })

  describe('IpcContractError 元数据', () => {
    it('携带 channel 与 cause', async () => {
      const bridge = wrapDesktopBridgeWithValidation(
        buildRawBridge({
          getStartupSnapshot: vi.fn().mockResolvedValue({} as DesktopStartupSnapshot)
        })
      )
      try {
        await bridge.getStartupSnapshot()
        expect.unreachable('应当抛错')
      } catch (error) {
        expect(error).toBeInstanceOf(IpcContractError)
        if (error instanceof IpcContractError) {
          expect(error.channel).toBe('desktop:get-startup-snapshot')
          expect(error.cause).toBeDefined()
        }
      }
    })
  })
})
