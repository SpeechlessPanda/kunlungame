import { describe, expect, it } from 'vitest'
import {
  createInitialSnapshot,
  reduceUiTurn
} from '../src/presentation/uiStateMachine.js'

describe('uiStateMachine', () => {
  it('starts in idle with no error and no choices', () => {
    const snapshot = createInitialSnapshot()
    expect(snapshot.state).toBe('idle')
    expect(snapshot.errorMessage).toBeNull()
    expect(snapshot.canChoose).toBe(false)
    expect(snapshot.canRetry).toBe(false)
  })

  it('transitions through a full successful turn', () => {
    let s = createInitialSnapshot()
    s = reduceUiTurn(s, { type: 'request-start' })
    expect(s.state).toBe('loading')

    s = reduceUiTurn(s, { type: 'stream-chunk' })
    expect(s.state).toBe('streaming')

    s = reduceUiTurn(s, { type: 'stream-end' })
    expect(s.state).toBe('streaming')

    s = reduceUiTurn(s, { type: 'choices-ready' })
    expect(s.state).toBe('awaiting-choice')
    expect(s.canChoose).toBe(true)

    s = reduceUiTurn(s, { type: 'choice-made' })
    expect(s.state).toBe('loading')
    expect(s.canChoose).toBe(false)
  })

  it('moves to error on explicit error event and supports retry', () => {
    let s = createInitialSnapshot()
    s = reduceUiTurn(s, { type: 'request-start' })
    s = reduceUiTurn(s, { type: 'error', message: 'model timeout' })

    expect(s.state).toBe('error')
    expect(s.errorMessage).toBe('model timeout')
    expect(s.canRetry).toBe(true)

    s = reduceUiTurn(s, { type: 'retry' })
    expect(s.state).toBe('loading')
    expect(s.errorMessage).toBeNull()
    expect(s.canRetry).toBe(false)
  })

  it('ignores events that are not allowed in the current state', () => {
    const start = createInitialSnapshot()
    const afterInvalid = reduceUiTurn(start, { type: 'stream-chunk' })
    expect(afterInvalid).toEqual(start)

    let s = reduceUiTurn(start, { type: 'request-start' })
    const afterInvalidChoice = reduceUiTurn(s, { type: 'choice-made' })
    expect(afterInvalidChoice).toEqual(s)
  })

  it('resets to idle from any state', () => {
    let s = createInitialSnapshot()
    s = reduceUiTurn(s, { type: 'request-start' })
    s = reduceUiTurn(s, { type: 'error', message: 'oops' })
    s = reduceUiTurn(s, { type: 'reset' })
    expect(s).toEqual(createInitialSnapshot())
  })
})
