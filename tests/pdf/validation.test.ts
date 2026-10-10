import { describe, expect, it } from 'vitest'
import { hasPdfSignature, hasSupportedImageSignature, parseEditPayload, safeOutputBaseName } from '../../lib/pdf/validation'

describe('PDF editor validation', () => {
  it('checks file signatures instead of trusting extensions', () => {
    expect(hasPdfSignature(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(true)
    expect(hasPdfSignature(new TextEncoder().encode('not-a-pdf'))).toBe(false)
    expect(hasSupportedImageSignature(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(hasSupportedImageSignature(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png')
  })

  it('rejects elements that target a missing page', () => {
    expect(() => parseEditPayload({
      version: 1,
      pages: [{ pageIndex: 0, width: 612, height: 792, rotation: 0 }],
      elements: [{ id: 'x', pageIndex: 2, zIndex: 0, x: 1, y: 1, width: 10, height: 10, rotation: 0, opacity: 1, type: 'highlight', color: '#ffff00' }],
    })).toThrow(/page that does not exist/i)
  })

  it('normalizes unsafe output names', () => {
    expect(safeOutputBaseName('../../Quarter 1/report.pdf')).toBe('report')
  })
})
