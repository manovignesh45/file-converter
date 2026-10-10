import type { PdfDocumentPage, PdfEditPayload, PdfEditorDocument, PdfEditorElement, PdfPageInfo } from '../../types/pdfEditor'

export function sourcePageId(sourcePageIndex: number): string {
  return `source-page-${sourcePageIndex}`
}

export function createEditorDocument(id: string, name: string): PdfEditorDocument {
  return { id, name, pages: [], elements: [] }
}

export function createDocumentPage(info: PdfPageInfo, bounds: [number, number, number, number]): PdfDocumentPage {
  return { ...info, id: sourcePageId(info.pageIndex), sourcePageIndex: info.pageIndex, bounds }
}

export function pageForElement(document: PdfEditorDocument, element: PdfEditorElement): PdfDocumentPage | undefined {
  return element.pageId
    ? document.pages.find(page => page.id === element.pageId)
    : document.pages.find(page => page.sourcePageIndex === element.pageIndex)
}

export function moveElementBy(element: PdfEditorElement, dx: number, dy: number): PdfEditorElement {
  if (element.type === 'drawing') {
    return { ...element, x: element.x + dx, y: element.y + dy, points: element.points.map(point => ({ x: point.x + dx, y: point.y + dy })) }
  }
  return { ...element, x: element.x + dx, y: element.y + dy }
}

export function cloneElementToPage(element: PdfEditorElement, id: string, pageIndex: number, dx = 12, dy = -12): PdfEditorElement {
  return { ...moveElementBy(element, dx, dy), id, pageIndex, pageId: sourcePageId(pageIndex) }
}

export function toLegacyExportPayload(document: PdfEditorDocument): PdfEditPayload {
  return {
    version: 1,
    pages: document.pages.map(({ pageIndex, width, height, rotation }) => ({ pageIndex, width, height, rotation })),
    elements: document.elements.map(element => {
      const page = pageForElement(document, element)
      if (!page) throw new Error(`Element ${element.id} refers to a missing page.`)
      const { pageId: _pageId, ...exportElement } = element
      return { ...exportElement, pageIndex: page.sourcePageIndex } as PdfEditorElement
    }),
  }
}
