import type { PdfDocumentPage, PdfEditorElement, PdfPoint } from '../../types/pdfEditor'
import type { PdfFieldDefinition } from '../../types/pdfFields'
import { fieldDisplayValue, isTextualField } from './fields'
import { viewportToPdf, type PdfViewportLike } from './coordinates'

export interface PlacementResult { elements: PdfEditorElement[]; outOfBoundsPageIds: string[] }

export function fieldPlacementSize(field: PdfFieldDefinition): { width: number; height: number } {
  if (field.kind === 'signature') return { width: 180, height: 65 }
  if (field.kind === 'image') return { width: field.width, height: field.height }
  if (field.kind === 'checkmark' || field.kind === 'crossmark') return { width: 22, height: 22 }
  return { width: field.kind === 'initials' ? 80 : 180, height: field.kind === 'address' ? 80 : 35 }
}

/** Keeps a dragged field inside every destination page while preserving its shared offset. */
export function fitFieldPlacementPoint(field: PdfFieldDefinition, sourcePage: PdfDocumentPage, targetPages: PdfDocumentPage[], point: PdfPoint): PdfPoint | null {
  if (!targetPages.length) return null
  const size = fieldPlacementSize(field)
  const maxX = Math.min(...targetPages.map(page => page.bounds[2] - page.bounds[0] - size.width))
  const maxY = Math.min(...targetPages.map(page => page.bounds[3] - page.bounds[1] - size.height))
  if (maxX < 0 || maxY < 0) return null
  return {
    x: sourcePage.bounds[0] + Math.max(0, Math.min(point.x - sourcePage.bounds[0], maxX)),
    y: sourcePage.bounds[1] + Math.max(0, Math.min(point.y - sourcePage.bounds[1], maxY)),
  }
}

export function clientToPdfPoint(clientX: number, clientY: number, rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>, viewport: PdfViewportLike & { width: number; height: number }): PdfPoint {
  return viewportToPdf({
    x: (clientX - rect.left) * viewport.width / rect.width,
    y: (clientY - rect.top) * viewport.height / rect.height,
  }, viewport)
}

function placedAt(field: PdfFieldDefinition, page: PdfDocumentPage, point: PdfPoint, id: () => string): PdfEditorElement[] {
  const base = { pageId: page.id, pageIndex: page.sourcePageIndex, zIndex: 0, x: point.x, y: point.y, rotation: 0, opacity: 1 }
  const size = fieldPlacementSize(field)
  if (field.kind === 'signature') return [{ ...base, id: id(), type: 'image', ...size, assetId: field.assetId, mimeType: field.mimeType, signatureId: field.id }]
  if (field.kind === 'image') return [{ ...base, id: id(), type: 'image', ...size, assetId: field.assetId, mimeType: field.mimeType, fieldId: field.id, fieldLink: 'linked' }]
  if (field.kind === 'checkmark' || field.kind === 'crossmark') return [{ ...base, id: id(), type: field.kind, ...size, strokeColor: '#0f172a', strokeWidth: 2.5, fieldId: field.id }]
  if (!isTextualField(field)) return []
  return [{
    ...base, id: id(), type: 'text', ...size, text: fieldDisplayValue(field),
    fontFamily: 'NotoSans', fontSize: 16, color: '#0f172a', bold: false, italic: false, underline: false,
    fieldId: field.id, fieldLink: 'linked', textAlign: 'left', singleLine: field.kind !== 'address', autoFit: false, minFontSize: 8,
  }]
}

/** Uses the same offset from each visible page's left and bottom edges. */
export function createFieldPlacements(field: PdfFieldDefinition, sourcePage: PdfDocumentPage, targetPages: PdfDocumentPage[], point: PdfPoint, id: () => string): PlacementResult {
  const offset = { x: point.x - sourcePage.bounds[0], y: point.y - sourcePage.bounds[1] }
  const elements: PdfEditorElement[] = []
  const outOfBoundsPageIds: string[] = []
  for (const page of targetPages) {
    const target = { x: page.bounds[0] + offset.x, y: page.bounds[1] + offset.y }
    const placed = placedAt(field, page, target, id)
    if (placed.some(element => element.x < page.bounds[0] || element.y < page.bounds[1] || element.x + element.width > page.bounds[2] || element.y + element.height > page.bounds[3])) {
      outOfBoundsPageIds.push(page.id)
    }
    elements.push(...placed)
  }
  return { elements, outOfBoundsPageIds }
}
