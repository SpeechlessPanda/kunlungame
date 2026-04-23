import { describe, expect, it } from 'vitest'
import {
  appendChunk,
  createDialogueStreamBuffer,
  getVisibleText,
  isFullyRevealed,
  markCompleted,
  skipToEnd,
  step
} from '../src/presentation/dialogueStreamBuffer.js'

describe('dialogueStreamBuffer', () => {
  it('starts empty and reveals nothing', () => {
    const buffer = createDialogueStreamBuffer()
    expect(buffer.fullText).toBe('')
    expect(getVisibleText(buffer)).toBe('')
    expect(isFullyRevealed(buffer)).toBe(false)
  })

  it('accumulates chunks without revealing them immediately', () => {
    let buffer = createDialogueStreamBuffer()
    buffer = appendChunk(buffer, '昆仑')
    buffer = appendChunk(buffer, '之上')
    expect(buffer.fullText).toBe('昆仑之上')
    expect(getVisibleText(buffer)).toBe('')
  })

  it('reveals characters progressively via step', () => {
    let buffer = createDialogueStreamBuffer()
    buffer = appendChunk(buffer, '云海翻涌')
    buffer = step(buffer, { charsPerStep: 2 })
    expect(getVisibleText(buffer)).toBe('云海')
    buffer = step(buffer, { charsPerStep: 2 })
    expect(getVisibleText(buffer)).toBe('云海翻涌')
    expect(isFullyRevealed(buffer)).toBe(true)
  })

  it('clamps step progress to available text length', () => {
    let buffer = createDialogueStreamBuffer()
    buffer = appendChunk(buffer, 'ABC')
    buffer = step(buffer, { charsPerStep: 100 })
    expect(getVisibleText(buffer)).toBe('ABC')
    const afterIdle = step(buffer, { charsPerStep: 1 })
    expect(afterIdle).toBe(buffer)
  })

  it('skipToEnd exposes the full text at once', () => {
    let buffer = createDialogueStreamBuffer()
    buffer = appendChunk(buffer, '长歌')
    buffer = skipToEnd(buffer)
    expect(getVisibleText(buffer)).toBe('长歌')
  })

  it('ignores chunks once the stream is marked completed', () => {
    let buffer = createDialogueStreamBuffer()
    buffer = appendChunk(buffer, '昆仑')
    buffer = markCompleted(buffer)
    buffer = appendChunk(buffer, '续写')
    expect(buffer.fullText).toBe('昆仑')
  })

  it('rejects invalid charsPerStep', () => {
    const buffer = appendChunk(createDialogueStreamBuffer(), 'A')
    expect(() => step(buffer, { charsPerStep: 0 })).toThrow()
    expect(() => step(buffer, { charsPerStep: -1 })).toThrow()
    expect(() => step(buffer, { charsPerStep: 1.5 })).toThrow()
  })
})
