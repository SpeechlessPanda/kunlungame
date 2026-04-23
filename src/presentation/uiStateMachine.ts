/**
 * UI 壳层状态机 (Part 06)。
 *
 * 五种状态描述对话轮次的生命周期：
 *   - idle: 初始空态，尚未请求任何内容。
 *   - loading: 已触发请求，等待首个流片段。
 *   - streaming: 正在接收流式文本，选项未就绪。
 *   - awaiting-choice: 流结束，等待玩家从两个选项中做出选择。
 *   - error: 发生错误，需要提供重试入口。
 *
 * 本模块只定义状态迁移规则；实际的 AI 编排、存档与内容生成由
 * 其他层负责，UI 壳层只消费状态。
 */
export type UiTurnState =
  | 'idle'
  | 'loading'
  | 'streaming'
  | 'awaiting-choice'
  | 'error'

export type UiTurnEvent =
  | { type: 'request-start' }
  | { type: 'stream-chunk' }
  | { type: 'stream-end' }
  | { type: 'choices-ready' }
  | { type: 'choice-made' }
  | { type: 'error'; message: string }
  | { type: 'retry' }
  | { type: 'reset' }

export interface UiTurnSnapshot {
  state: UiTurnState
  errorMessage: string | null
  canRetry: boolean
  canChoose: boolean
}

const allowedEventsByState: Record<UiTurnState, UiTurnEvent['type'][]> = {
  idle: ['request-start', 'reset'],
  loading: ['stream-chunk', 'error', 'reset'],
  streaming: ['stream-chunk', 'stream-end', 'choices-ready', 'error', 'reset'],
  'awaiting-choice': ['choice-made', 'error', 'reset'],
  error: ['retry', 'reset']
}

export const createInitialSnapshot = (): UiTurnSnapshot => ({
  state: 'idle',
  errorMessage: null,
  canRetry: false,
  canChoose: false
})

export const reduceUiTurn = (
  snapshot: UiTurnSnapshot,
  event: UiTurnEvent
): UiTurnSnapshot => {
  const allowed = allowedEventsByState[snapshot.state]
  if (!allowed.includes(event.type)) {
    return snapshot
  }

  switch (event.type) {
    case 'request-start':
      return { state: 'loading', errorMessage: null, canRetry: false, canChoose: false }
    case 'stream-chunk':
      if (snapshot.state === 'loading') {
        return { state: 'streaming', errorMessage: null, canRetry: false, canChoose: false }
      }
      return snapshot
    case 'stream-end':
      return { state: 'streaming', errorMessage: null, canRetry: false, canChoose: false }
    case 'choices-ready':
      return { state: 'awaiting-choice', errorMessage: null, canRetry: false, canChoose: true }
    case 'choice-made':
      return { state: 'loading', errorMessage: null, canRetry: false, canChoose: false }
    case 'error':
      return { state: 'error', errorMessage: event.message, canRetry: true, canChoose: false }
    case 'retry':
      return { state: 'loading', errorMessage: null, canRetry: false, canChoose: false }
    case 'reset':
      return createInitialSnapshot()
    default:
      return snapshot
  }
}
