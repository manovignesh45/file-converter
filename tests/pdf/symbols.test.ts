import { describe, expect, it } from 'vitest'
import { symbolSegments } from '../../lib/pdf/symbols'

const base = { id: 'symbol', pageIndex: 0, zIndex: 0, x: 10, y: 20, width: 20, height: 20, rotation: 0, opacity: 1, strokeColor: '#000000', strokeWidth: 2 }

describe('vector marks', () => {
  it('keeps a checkmark within its PDF-space box', () => {
    expect(symbolSegments({ ...base, type: 'checkmark' })).toEqual([
      [{ x: 10, y: 29 }, { x: 17, y: 20 }],
      [{ x: 17, y: 20 }, { x: 30, y: 40 }],
    ])
  })

  it('models a cross as one object with two strokes', () => {
    expect(symbolSegments({ ...base, type: 'crossmark' })).toEqual([
      [{ x: 10, y: 20 }, { x: 30, y: 40 }],
      [{ x: 10, y: 40 }, { x: 30, y: 20 }],
    ])
  })
})
