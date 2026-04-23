/**
 * 对话文本缓存与可见文本计算 (Part 06)。
 *
 * AI 编排层会以若干文本片段的形式把完整回复推送给 UI 壳层。
 * 壳层需要：
 *   1. 保存所有片段的累积全文，便于重试或回看；
 *   2. 根据配置的“逐字出现节奏”计算当前可见文本；
 *   3. 支持跳过动画直接展示全文。
 *
 * 本模块是纯函数集合，不依赖任何 DOM、Vue 或计时器 API，
 * 方便做白盒单测。渲染层负责驱动 `step` 调用节奏。
 */
export interface DialogueStreamBuffer {
  fullText: string
  revealedLength: number
  completed: boolean
}

export interface RevealOptions {
  /** 一次 step 推进的字符数。必须是正整数。 */
  charsPerStep: number
}

export const createDialogueStreamBuffer = (): DialogueStreamBuffer => ({
  fullText: '',
  revealedLength: 0,
  completed: false
})

export const appendChunk = (
  buffer: DialogueStreamBuffer,
  chunk: string
): DialogueStreamBuffer => {
  if (buffer.completed) {
    return buffer
  }
  if (chunk.length === 0) {
    return buffer
  }
  return {
    fullText: buffer.fullText + chunk,
    revealedLength: buffer.revealedLength,
    completed: false
  }
}

export const markCompleted = (buffer: DialogueStreamBuffer): DialogueStreamBuffer => ({
  fullText: buffer.fullText,
  revealedLength: buffer.revealedLength,
  completed: true
})

export const step = (
  buffer: DialogueStreamBuffer,
  options: RevealOptions
): DialogueStreamBuffer => {
  if (!Number.isInteger(options.charsPerStep) || options.charsPerStep <= 0) {
    throw new Error('charsPerStep must be a positive integer.')
  }
  if (buffer.revealedLength >= buffer.fullText.length) {
    return buffer
  }
  const nextRevealed = Math.min(
    buffer.fullText.length,
    buffer.revealedLength + options.charsPerStep
  )
  return {
    fullText: buffer.fullText,
    revealedLength: nextRevealed,
    completed: buffer.completed
  }
}

export const skipToEnd = (buffer: DialogueStreamBuffer): DialogueStreamBuffer => ({
  fullText: buffer.fullText,
  revealedLength: buffer.fullText.length,
  completed: buffer.completed
})

export const getVisibleText = (buffer: DialogueStreamBuffer): string => {
  return buffer.fullText.slice(0, buffer.revealedLength)
}

export const isFullyRevealed = (buffer: DialogueStreamBuffer): boolean => {
  return (
    buffer.revealedLength >= buffer.fullText.length && buffer.fullText.length > 0
  )
}

export const resetBuffer = (): DialogueStreamBuffer => createDialogueStreamBuffer()
