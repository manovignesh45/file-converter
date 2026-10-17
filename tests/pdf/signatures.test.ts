import { describe, expect, it } from 'vitest'
import { hasVisiblePixels, validateSignatureBlob } from '../../lib/pdf/signatures'

describe('signature images', () => {
  it('rejects empty or unsupported bytes', async () => {
    await expect(validateSignatureBlob(new Blob([]))).rejects.toThrow('non-empty')
    await expect(validateSignatureBlob(new Blob(['not an image'], { type: 'image/png' }))).rejects.toThrow('valid PNG or JPEG')
  })

  it('uses file bytes rather than claimed MIME type', async () => {
    const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
    await expect(validateSignatureBlob(new Blob([pngHeader], { type: 'image/jpeg' }))).resolves.toBe('image/png')
  })

  it('detects fully transparent image samples', () => {
    expect(hasVisiblePixels(new Uint8ClampedArray([10, 20, 30, 0]))).toBe(false)
    expect(hasVisiblePixels(new Uint8ClampedArray([10, 20, 30, 0, 10, 20, 30, 1]))).toBe(true)
  })
})
