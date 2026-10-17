import type { PdfEditPayload, PdfEditorElement } from '../../types/pdfEditor'

export const MAX_PDF_BYTES = 50 * 1024 * 1024
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024
export const MAX_ELEMENTS = 5_000
export const MAX_DRAWING_POINTS = 25_000

export function hasPdfSignature(buffer: Uint8Array): boolean {
  if (buffer.byteLength < 5) return false
  return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46 && buffer[4] === 0x2d
}

export function hasSupportedImageSignature(buffer: Uint8Array): 'image/png' | 'image/jpeg' | null {
  if (
    buffer.byteLength >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) return 'image/png'

  if (buffer.byteLength >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }

  return null
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function validColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}

function validBase(element: any): boolean {
  return (
    element &&
    typeof element.id === 'string' && element.id.length <= 100 &&
    Number.isInteger(element.pageIndex) && element.pageIndex >= 0 &&
    Number.isInteger(element.zIndex) &&
    finiteNumber(element.x) && finiteNumber(element.y) &&
    finiteNumber(element.width) && element.width >= 0 && element.width <= 20_000 &&
    finiteNumber(element.height) && element.height >= 0 && element.height <= 20_000 &&
    finiteNumber(element.rotation) &&
    finiteNumber(element.opacity) && element.opacity >= 0 && element.opacity <= 1
  )
}

function validElement(element: any): element is PdfEditorElement {
  if (!validBase(element)) return false

  switch (element.type) {
    case 'text':
      return typeof element.text === 'string' && element.text.length <= 20_000 &&
        ['Helvetica', 'TimesRoman', 'Courier', 'NotoSans'].includes(element.fontFamily) &&
        finiteNumber(element.fontSize) && element.fontSize >= 4 && element.fontSize <= 500 &&
        validColor(element.color) &&
        typeof element.bold === 'boolean' && typeof element.italic === 'boolean' &&
        typeof element.underline === 'boolean' &&
        (element.fieldId === undefined || (typeof element.fieldId === 'string' && element.fieldId.length <= 100)) &&
        (element.fieldLink === undefined || ['linked', 'independent'].includes(element.fieldLink)) &&
        (element.textAlign === undefined || ['left', 'center', 'right'].includes(element.textAlign)) &&
        (element.singleLine === undefined || typeof element.singleLine === 'boolean') &&
        (element.autoFit === undefined || typeof element.autoFit === 'boolean') &&
        (element.minFontSize === undefined || (finiteNumber(element.minFontSize) && element.minFontSize >= 4 && element.minFontSize <= 500)) &&
        (element.exportLayout === undefined || (element.exportLayout &&
          Array.isArray(element.exportLayout.lines) && element.exportLayout.lines.length <= 1000 &&
          element.exportLayout.lines.every((line: unknown) => typeof line === 'string') &&
          element.exportLayout.lines.join('').length <= 20_000 &&
          finiteNumber(element.exportLayout.fontSize) && element.exportLayout.fontSize >= 4 && element.exportLayout.fontSize <= 500 &&
          element.exportLayout.lines.join(' ').replace(/\s+/g, ' ').trim() === element.text.replace(/\s+/g, ' ').trim()
        ))
    case 'image':
      return typeof element.assetId === 'string' && element.assetId.length <= 100 &&
        ['image/png', 'image/jpeg'].includes(element.mimeType) &&
        (element.signatureId === undefined || (typeof element.signatureId === 'string' && element.signatureId.length <= 100))
    case 'rectangle':
    case 'ellipse':
      return validColor(element.strokeColor) &&
        (element.fillColor === null || validColor(element.fillColor)) &&
        finiteNumber(element.strokeWidth) && element.strokeWidth >= 0 && element.strokeWidth <= 100
    case 'line':
    case 'arrow':
    case 'checkmark':
    case 'crossmark':
      return validColor(element.strokeColor) &&
        finiteNumber(element.strokeWidth) && element.strokeWidth > 0 && element.strokeWidth <= 100
    case 'drawing':
      return validColor(element.color) &&
        finiteNumber(element.strokeWidth) && element.strokeWidth > 0 && element.strokeWidth <= 100 &&
        Array.isArray(element.points) && element.points.length >= 2 && element.points.length <= MAX_DRAWING_POINTS &&
        element.points.every((point: any) => finiteNumber(point?.x) && finiteNumber(point?.y))
    case 'highlight':
      return validColor(element.color)
    default:
      return false
  }
}

export function parseEditPayload(input: unknown): PdfEditPayload {
  const payload = input as any
  if (!payload || payload.version !== 1 || !Array.isArray(payload.pages) || !Array.isArray(payload.elements)) {
    throw new Error('The PDF edit data is invalid or unsupported.')
  }
  if (payload.elements.length > MAX_ELEMENTS) {
    throw new Error(`This document contains too many added elements. The limit is ${MAX_ELEMENTS}.`)
  }
  const pagesValid = payload.pages.length > 0 && payload.pages.every((page: any, index: number) =>
    page?.pageIndex === index && finiteNumber(page.width) && page.width > 0 &&
    finiteNumber(page.height) && page.height > 0 && finiteNumber(page.rotation)
  )
  if (!pagesValid || !payload.elements.every(validElement)) {
    throw new Error('The PDF edit data contains invalid pages or elements.')
  }
  if (payload.elements.some((element: PdfEditorElement) => element.pageIndex >= payload.pages.length)) {
    throw new Error('An added element refers to a page that does not exist.')
  }
  if (new Set(payload.elements.map((element: PdfEditorElement) => element.id)).size !== payload.elements.length) {
    throw new Error('Added elements must have unique IDs.')
  }
  return payload
}

export function validateAssetIds(ids: unknown, elements: PdfEditorElement[]): string[] {
  if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string' && id.length > 0 && id.length <= 100)) throw new Error('The image asset list is invalid.')
  const assetIds = ids as string[]
  if (new Set(assetIds).size !== assetIds.length) throw new Error('Image asset IDs must be unique.')
  const referenced = new Set(elements.filter(element => element.type === 'image').map(element => element.assetId))
  if (assetIds.length !== referenced.size || assetIds.some(id => !referenced.has(id))) throw new Error('The image assets do not match the edit data.')
  return assetIds
}

export function safeOutputBaseName(fileName: string): string {
  const leafName = fileName.split(/[\\/]/).pop() || 'document.pdf'
  const withoutExtension = leafName.replace(/\.pdf$/i, '')
  const safe = withoutExtension.replace(/[^a-z0-9._-]+/gi, '_').replace(/^\.+/, '').slice(0, 100)
  return safe || 'document'
}
