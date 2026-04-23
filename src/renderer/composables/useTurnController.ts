import { computed, reactive, ref, type Ref } from 'vue'
import {
  appendChunk,
  createDialogueStreamBuffer,
  getVisibleText,
  markCompleted,
  skipToEnd,
  step,
  type DialogueStreamBuffer
} from '../../presentation/dialogueStreamBuffer.js'
import {
  createInitialSnapshot,
  reduceUiTurn,
  type UiTurnEvent,
  type UiTurnSnapshot
} from '../../presentation/uiStateMachine.js'

export interface ChoiceModel {
  id: 'align' | 'challenge'
  label: string
}

export interface TurnViewModel {
  snapshot: UiTurnSnapshot
  visibleText: string
  fullText: string
  choices: ChoiceModel[]
  isRevealing: boolean
}

export interface TurnController {
  view: Readonly<Ref<TurnViewModel>>
  dispatch(event: UiTurnEvent): void
  appendText(chunk: string): void
  endStream(): void
  setChoices(choices: ChoiceModel[]): void
  clearChoices(): void
  revealNext(charsPerStep?: number): void
  skipReveal(): void
  reset(): void
}

/**
 * 创建一个轮次控制器，集中管理 UI 壳层的“可见文本 + 状态机 + 选项”三件套。
 *
 * 这是 Part 06 要求的“对话面板逐步刷新 / 错误态 / 空态”的核心驱动，
 * 视觉层组件只通过 computed view 读数据，不直接改内部状态。
 */
export const createTurnController = (): TurnController => {
  const snapshot = ref<UiTurnSnapshot>(createInitialSnapshot())
  const buffer = ref<DialogueStreamBuffer>(createDialogueStreamBuffer())
  const choices = reactive<ChoiceModel[]>([])

  const view = computed<TurnViewModel>(() => ({
    snapshot: snapshot.value,
    visibleText: getVisibleText(buffer.value),
    fullText: buffer.value.fullText,
    choices: [...choices],
    isRevealing:
      buffer.value.fullText.length > 0 &&
      buffer.value.revealedLength < buffer.value.fullText.length
  }))

  const dispatch = (event: UiTurnEvent): void => {
    snapshot.value = reduceUiTurn(snapshot.value, event)
    if (event.type === 'reset' || event.type === 'choice-made' || event.type === 'retry') {
      buffer.value = createDialogueStreamBuffer()
      choices.splice(0, choices.length)
    }
  }

  const appendText = (chunk: string): void => {
    if (snapshot.value.state === 'loading') {
      dispatch({ type: 'stream-chunk' })
    } else if (snapshot.value.state !== 'streaming') {
      return
    }
    buffer.value = appendChunk(buffer.value, chunk)
  }

  const endStream = (): void => {
    buffer.value = markCompleted(buffer.value)
    dispatch({ type: 'stream-end' })
  }

  const setChoices = (next: ChoiceModel[]): void => {
    choices.splice(0, choices.length, ...next)
    dispatch({ type: 'choices-ready' })
  }

  const clearChoices = (): void => {
    choices.splice(0, choices.length)
  }

  const revealNext = (charsPerStep: number = 2): void => {
    if (buffer.value.fullText.length === 0) {
      return
    }
    buffer.value = step(buffer.value, { charsPerStep })
  }

  const skipReveal = (): void => {
    buffer.value = skipToEnd(buffer.value)
  }

  const reset = (): void => {
    dispatch({ type: 'reset' })
  }

  return {
    view: view as unknown as Readonly<Ref<TurnViewModel>>,
    dispatch,
    appendText,
    endStream,
    setChoices,
    clearChoices,
    revealNext,
    skipReveal,
    reset
  }
}
