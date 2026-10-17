import type { PdfTextElement } from '../../types/pdfEditor'
import { layoutText } from './textLayout'

let metricsCanvas: HTMLCanvasElement | null = null

export function browserTextLayout(element: PdfTextElement) {
  metricsCanvas ??= document.createElement('canvas')
  const context = metricsCanvas.getContext('2d')
  if (!context) throw new Error('Text measurement is unavailable.')
  const family = element.fontFamily === 'NotoSans' ? 'ConvertPro Noto Sans' : element.fontFamily === 'TimesRoman' ? 'Times New Roman' : element.fontFamily
  return layoutText(element.text, {
    width: element.width, height: element.height, fontSize: element.fontSize,
    minFontSize: element.minFontSize ?? 8, singleLine: element.singleLine ?? false, autoFit: element.autoFit ?? false,
  }, (text, size) => {
    context.font = `${element.italic ? 'italic ' : ''}${element.bold ? 'bold ' : ''}${size}px "${family}"`
    return context.measureText(text).width
  })
}
