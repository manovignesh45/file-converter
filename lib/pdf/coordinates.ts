import type { PdfPoint } from '../../types/pdfEditor'

export interface PdfViewportLike {
  transform: [number, number, number, number, number, number] | number[]
}

export function applyTransform(point: PdfPoint, transform: number[]): PdfPoint {
  const [a, b, c, d, e, f] = transform
  return {
    x: a * point.x + c * point.y + e,
    y: b * point.x + d * point.y + f,
  }
}

export function invertTransform(transform: number[]): number[] {
  const [a, b, c, d, e, f] = transform
  const determinant = a * d - b * c

  if (Math.abs(determinant) < Number.EPSILON) {
    throw new Error('PDF page transform is not invertible')
  }

  return [
    d / determinant,
    -b / determinant,
    -c / determinant,
    a / determinant,
    (c * f - d * e) / determinant,
    (b * e - a * f) / determinant,
  ]
}

export function pdfToViewport(point: PdfPoint, viewport: PdfViewportLike): PdfPoint {
  return applyTransform(point, viewport.transform)
}

export function viewportToPdf(point: PdfPoint, viewport: PdfViewportLike): PdfPoint {
  return applyTransform(point, invertTransform(viewport.transform))
}

export function viewportScale(viewport: PdfViewportLike): number {
  const [a, b] = viewport.transform
  return Math.sqrt(a * a + b * b)
}

export function viewportRotation(viewport: PdfViewportLike): number {
  const [a, b] = viewport.transform
  return normalizeDegrees((Math.atan2(b, a) * 180) / Math.PI)
}

export function normalizeDegrees(value: number): number {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}

export function clampToPage(point: PdfPoint, width: number, height: number): PdfPoint {
  return {
    x: Math.min(width, Math.max(0, point.x)),
    y: Math.min(height, Math.max(0, point.y)),
  }
}

