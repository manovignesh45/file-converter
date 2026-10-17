import { describe, expect, it } from 'vitest'
import { pdfToViewport, viewportRotation, viewportScale, viewportToPdf } from '../../lib/pdf/coordinates'

describe('PDF coordinate mapping', () => {
  it.each([
    { name: '0 degree page', transform: [1.5, 0, 0, -1.5, 0, 1263] },
    { name: '90 degree page', transform: [0, 2, 2, 0, 0, 0] },
    { name: '180 degree page with offset crop box', transform: [-0.75, 0, 0, 0.75, 500, 20] },
    { name: '270 degree page', transform: [0, -1.25, -1.25, 0, 900, 700] },
  ])('round-trips points for $name', ({ transform }) => {
    const original = { x: 123.456, y: 78.9 }
    const viewport = { transform }
    const restored = viewportToPdf(pdfToViewport(original, viewport), viewport)
    expect(restored.x).toBeCloseTo(original.x, 8)
    expect(restored.y).toBeCloseTo(original.y, 8)
  })

  it('derives scale and rotation from the viewport matrix', () => {
    expect(viewportScale({ transform: [0, 2, 2, 0, 0, 0] })).toBe(2)
    expect(viewportRotation({ transform: [0, 2, 2, 0, 0, 0] })).toBe(90)
  })
})

