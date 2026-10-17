import { describe, expect, it } from 'vitest'
import { commitHistory, createHistory, redoHistory, undoHistory } from '../../lib/pdf/history'

describe('editor history', () => {
  it('supports undo, redo, and clears the redo branch after a new change', () => {
    let history = createHistory(['first'])
    history = commitHistory(history, ['first', 'second'])
    history = commitHistory(history, ['first', 'second', 'third'])
    history = undoHistory(history)
    expect(history.present).toEqual(['first', 'second'])
    history = redoHistory(history)
    expect(history.present).toEqual(['first', 'second', 'third'])
    history = undoHistory(history)
    history = commitHistory(history, ['replacement'])
    expect(history.future).toEqual([])
    expect(history.present).toEqual(['replacement'])
  })
})

