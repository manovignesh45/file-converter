import { hasSupportedImageSignature, MAX_IMAGE_BYTES } from './validation'

export interface SignatureRecord {
  id: string
  name: string
  blob: Blob
  mimeType: 'image/png' | 'image/jpeg'
  source: { kind: 'draw'; strokes: Array<Array<{ x: number; y: number }>> } | { kind: 'type'; text: string; font: 'serif' | 'script' } | { kind: 'upload' }
}

export async function validateSignatureBlob(blob: Blob): Promise<'image/png' | 'image/jpeg'> {
  if (!blob.size || blob.size > MAX_IMAGE_BYTES) throw new Error('Signature images must be non-empty and no larger than 50 MB.')
  const mimeType = hasSupportedImageSignature(new Uint8Array(await blob.slice(0, 12).arrayBuffer()))
  if (!mimeType) throw new Error('Choose a valid PNG or JPEG signature image.')
  return mimeType
}

export function hasVisiblePixels(rgba: Uint8ClampedArray): boolean {
  for (let index = 3; index < rgba.length; index += 4) if (rgba[index] > 0) return true
  return false
}
