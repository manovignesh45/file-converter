import type { PdfPoint, PdfSymbolElement } from '../../types/pdfEditor'

export function symbolSegments(element: PdfSymbolElement): Array<[PdfPoint, PdfPoint]> {
  const { x, y, width: w, height: h } = element
  if (element.type === 'checkmark') {
    const a = { x, y: y + h * 0.45 }
    const b = { x: x + w * 0.35, y }
    const c = { x: x + w, y: y + h }
    return [[a, b], [b, c]]
  }
  return [
    [{ x, y }, { x: x + w, y: y + h }],
    [{ x, y: y + h }, { x: x + w, y }],
  ]
}
