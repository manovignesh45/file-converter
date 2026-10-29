import type { PdfFontFamily, PdfTextElement } from '../../types/pdfEditor'
import { layoutText } from './textLayout'

let metricsCanvas: HTMLCanvasElement | null = null

export function cssFontFamily(fontFamily: PdfFontFamily): string {
  return fontFamily === 'NotoSans' ? 'ConvertPro Noto Sans' : fontFamily === 'TimesRoman' ? 'Times New Roman' : fontFamily
}

function measurer(element: PdfTextElement) {
  metricsCanvas ??= document.createElement('canvas')
  const context = metricsCanvas.getContext('2d')
  if (!context) throw new Error('Text measurement is unavailable.')
  const family = cssFontFamily(element.fontFamily)
  return (text: string, size: number) => {
    context.font = `${element.italic ? 'italic ' : ''}${element.bold ? 'bold ' : ''}${size}px "${family}"`
    return context.measureText(text).width
  }
}

export function browserTextLayout(element: PdfTextElement) {
  return layoutText(element.text, {
    width: element.width, height: element.height, fontSize: element.fontSize,
    minFontSize: element.minFontSize ?? 8, singleLine: element.singleLine ?? false, autoFit: element.autoFit ?? false,
  }, measurer(element))
}

/** Width of `text` in PDF points at the element's font and size. */
export function browserTextWidth(element: PdfTextElement, text = element.text) {
  return measurer(element)(text, element.fontSize)
}
