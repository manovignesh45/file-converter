import { describe, expect, it } from 'vitest'
import { cloneElementToPage, createDocumentPage, createEditorDocument, toLegacyExportPayload } from '../../lib/pdf/document'

describe('editor document export projection', () => {
  it('uses stable page identity to resolve the source page', () => {
    const document = createEditorDocument('doc', 'sample.pdf')
    document.pages = [createDocumentPage({ pageIndex: 0, width: 600, height: 800, rotation: 0 }, [10, 20, 610, 820])]
    document.elements = [{ id: 'text', pageId: document.pages[0].id, pageIndex: 99, zIndex: 0, x: 30, y: 40, width: 100, height: 30, rotation: 0, opacity: 1, type: 'text', text: 'Hello', fontFamily: 'Helvetica', fontSize: 12, color: '#000000', bold: false, italic: false, underline: false }]
    const payload = toLegacyExportPayload(document)
    expect(payload.elements[0].pageIndex).toBe(0)
    expect(payload.elements[0]).not.toHaveProperty('pageId')
    expect(document.elements[0].pageIndex).toBe(99)
  })

  it('moves drawing points when duplicating onto another page', () => {
    const drawing = { id: 'old', pageIndex: 0, zIndex: 1, x: 10, y: 20, width: 20, height: 20, rotation: 0, opacity: 1, type: 'drawing' as const, points: [{ x: 10, y: 20 }, { x: 30, y: 40 }], color: '#000000', strokeWidth: 2 }
    const cloned = cloneElementToPage(drawing, 'new', 2)
    expect(cloned).toMatchObject({ id: 'new', pageId: 'source-page-2', pageIndex: 2, x: 22, y: 8, points: [{ x: 22, y: 8 }, { x: 42, y: 28 }] })
    expect(drawing.points[0]).toEqual({ x: 10, y: 20 })
  })

  it('rejects a broken stable page reference instead of falling back to an index', () => {
    const document = createEditorDocument('doc', 'sample.pdf')
    document.pages = [createDocumentPage({ pageIndex: 0, width: 600, height: 800, rotation: 0 }, [0, 0, 600, 800])]
    document.elements = [{ id: 'bad', pageId: 'missing', pageIndex: 0, zIndex: 0, x: 0, y: 0, width: 1, height: 1, rotation: 0, opacity: 1, type: 'highlight', color: '#ffff00' }]
    expect(() => toLegacyExportPayload(document)).toThrow('missing page')
  })
})
