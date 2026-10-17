import { describe, expect, it } from 'vitest'
import { layoutText } from '../../lib/pdf/textLayout'

const measure = (text: string, size: number) => text.length * size * 0.5

describe('text fitting', () => {
  it('fits a single line down to a readable minimum', () => {
    const result = layoutText('1234567890', { width: 50, height: 24, fontSize: 20, minFontSize: 8, singleLine: true, autoFit: true }, measure)
    expect(result.fontSize).toBe(10)
    expect(result.overflow).toBe(false)
  })

  it('reports overflow at the minimum instead of clipping text', () => {
    const result = layoutText('1234567890', { width: 20, height: 24, fontSize: 20, minFontSize: 8, singleLine: true, autoFit: true }, measure)
    expect(result.fontSize).toBe(8)
    expect(result.overflow).toBe(true)
  })

  it('wraps multiline text and respects box height', () => {
    const result = layoutText('one two three', { width: 30, height: 10, fontSize: 10, minFontSize: 8, singleLine: false, autoFit: false }, measure)
    expect(result.lines.length).toBeGreaterThan(1)
    expect(result.overflow).toBe(true)
  })
})
