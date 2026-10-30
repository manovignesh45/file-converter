import { describe, expect, it } from 'vitest'
import { parsePageRanges, rangeLabel } from '../../lib/pdf/pageRanges'

describe('page ranges', () => {
  it('parses single pages, closed and open-ended ranges', () => {
    expect(parsePageRanges('1-3, 5, 8-', 10)).toEqual([
      { start: 1, end: 3 },
      { start: 5, end: 5 },
      { start: 8, end: 10 },
    ])
    expect(parsePageRanges('-2', 4)).toEqual([{ start: 1, end: 2 }])
  })

  it('rejects invalid or out-of-range input', () => {
    expect(() => parsePageRanges('', 3)).toThrow(/at least one/)
    expect(() => parsePageRanges('abc', 3)).toThrow(/not a valid/)
    expect(() => parsePageRanges('3-1', 3)).toThrow(/ends before/)
    expect(() => parsePageRanges('0', 3)).toThrow(/start at 1/)
    expect(() => parsePageRanges('2-4', 3)).toThrow(/out of range/)
  })

  it('labels ranges for file names', () => {
    expect(rangeLabel({ start: 2, end: 2 })).toBe('page2')
    expect(rangeLabel({ start: 1, end: 4 })).toBe('pages1-4')
  })
})
