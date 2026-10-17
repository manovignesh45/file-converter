import type { PdfDocumentPage, PdfEditorElement, PdfPoint } from '../../types/pdfEditor'
import type { PdfFieldDefinition } from '../../types/pdfFields'
import { fieldDisplayValue, isTextualField } from './fields'
import { viewportToPdf, type PdfViewportLike } from './coordinates'

export interface PlacementResult { elements: PdfEditorElement[]; outOfBoundsPageIds: string[] }
export const FIELD_DRAG_TYPE = 'application/x-convertpro-field'

export function clientToPdfPoint(clientX: number, clientY: number, rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>, viewport: PdfViewportLike & { width: number; height: number }): PdfPoint {
  return viewportToPdf({
    x: (clientX - rect.left) * viewport.width / rect.width,
    y: (clientY - rect.top) * viewport.height / rect.height,
  }, viewport)
}

function placedAt(field: PdfFieldDefinition, page: PdfDocumentPage, point: PdfPoint, id: () => string): PdfEditorElement[] {
  const base = { pageId: page.id, pageIndex: page.sourcePageIndex, zIndex: 0, x: point.x, y: point.y, rotation: 0, opacity: 1 }
  if (field.kind === 'signature') return [{ ...base, id: id(), type: 'image', width: 180, height: 65, assetId: field.assetId, mimeType: field.mimeType, signatureId: field.id }]
  if (field.kind === 'checkmark' || field.kind === 'crossmark') return [{ ...base, id: id(), type: field.kind, width: 22, height: 22, strokeColor: '#0f172a', strokeWidth: 2.5, fieldId: field.id }]
  if (!isTextualField(field)) return []
  return [{
    ...base, id: id(), type: 'text', width: field.kind === 'initials' ? 80 : 180,
    height: field.kind === 'address' ? 80 : 35, text: fieldDisplayValue(field),
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
