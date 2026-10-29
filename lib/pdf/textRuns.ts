import type { PdfEditorElement, PdfFontFamily, PdfTextElement } from '../../types/pdfEditor'

/** Structural subset of a PDF.js `TextItem`. */
export interface PdfTextItemLike {
  str: string
  transform: number[]
  width: number
  height: number
  fontName: string
  hasEOL?: boolean
}

/** Structural subset of a PDF.js `TextStyle`. */
export interface PdfTextStyleLike {
  fontFamily?: string
  ascent?: number
  descent?: number
  vertical?: boolean
}

/** Fields PDF.js exposes on loaded fonts through `page.commonObjs`. */
export interface PdfFontInfoLike {
  name?: string
  bold?: boolean
  italic?: boolean
  black?: boolean
  isMonospace?: boolean
  isSerifFont?: boolean
}

export interface PdfRect { x: number; y: number; width: number; height: number }

/** One line of original PDF text that can be replaced as a unit. */
export interface PdfTextRun {
  id: string
  text: string
  x: number
  baseline: number
  width: number
  fontSize: number
  bounds: PdfRect
  fontFamily: PdfFontFamily
  bold: boolean
  italic: boolean
}

interface PendingRun { text: string; x: number; baseline: number; width: number; fontSize: number; fontName: string }

// Characters the standard 14 PDF fonts can encode (WinAnsi); anything else needs Noto Sans.
const WIN_ANSI = /^[\t\n\r\x20-\x7e -ÿŒœŠšŸŽžƒˆ˜–—‘-‚“-„†-•…‰‹›€™]*$/

export function isWinAnsiText(text: string): boolean {
  return WIN_ANSI.test(text)
}

export function guessFont(info: PdfFontInfoLike | undefined, styleFamily: string | undefined, text: string): { fontFamily: PdfFontFamily; bold: boolean; italic: boolean } {
  // Embedded subsets are prefixed with six capitals, e.g. "ABCDEF+Arial-BoldMT".
  const name = (info?.name ?? '').replace(/^[A-Z]{6}\+/, '')
  const bold = Boolean(info?.bold || info?.black) || /bold|black|heavy|semibold|demi/i.test(name)
  const italic = Boolean(info?.italic) || /italic|oblique/i.test(name)
  if (!isWinAnsiText(text)) return { fontFamily: 'NotoSans', bold, italic }
  let fontFamily: PdfFontFamily = 'Helvetica'
  if (info?.isMonospace || /courier|mono|consol/i.test(name) || (!name && styleFamily === 'monospace')) fontFamily = 'Courier'
  else if (/sans|arial|helvetica|calibri|verdana|segoe|tahoma/i.test(name)) fontFamily = 'Helvetica'
  else if (/times|serif|georgia|garamond|roman|minion|cambria|palatino|baskerville|book/i.test(name) || info?.isSerifFont || (!name && styleFamily === 'serif')) fontFamily = 'TimesRoman'
  return { fontFamily, bold, italic }
}

/**
 * Groups PDF.js text items into editable lines. Only consecutive, horizontal items
 * in the same font, size and baseline are joined, so a bold word or a table
 * column stays its own run.
 */
export function buildTextRuns(
  items: PdfTextItemLike[],
  styles: Record<string, PdfTextStyleLike>,
  fontInfo: (fontName: string) => PdfFontInfoLike | undefined = () => undefined,
): PdfTextRun[] {
  const pending: PendingRun[] = []
  let current: PendingRun | null = null
  const flush = () => { if (current) pending.push(current); current = null }

  for (const item of items) {
    if (!item.str) { if (item.hasEOL) flush(); continue }
    const [a, b, c, d, e, f] = item.transform
    const fontSize = Math.hypot(c, d)
    const horizontal = a > 0 && d > 0 && Math.abs(b) <= 0.01 * a && Math.abs(c) <= 0.01 * d
    if (!(fontSize > 0) || !horizontal || styles[item.fontName]?.vertical) { flush(); continue }

    const gap = current ? e - (current.x + current.width) : 0
    const joins = current &&
      current.fontName === item.fontName &&
      Math.abs(current.fontSize - fontSize) <= 0.05 * fontSize &&
      Math.abs(current.baseline - f) <= 0.15 * fontSize &&
      gap >= -0.3 * fontSize && gap <= 0.8 * fontSize
    if (current && joins) {
      if (gap > 0.12 * fontSize && !/\s$/.test(current.text) && !/^\s/.test(item.str)) current.text += ' '
      current.text += item.str
      current.width = e + item.width - current.x
    } else {
      flush()
      current = { text: item.str, x: e, baseline: f, width: item.width, fontSize, fontName: item.fontName }
    }
    if (item.hasEOL) flush()
  }
  flush()

  return pending
    .filter(run => run.text.trim() && run.width > 0)
    .map((run, index) => {
      const style = styles[run.fontName] ?? {}
      const ascent = Math.min(1.05, Math.max(0.7, style.ascent || 0.8))
      const descent = Math.min(0, Math.max(-0.35, style.descent || -0.2))
      const pad = run.fontSize * 0.06
      const text = run.text.trimEnd()
      return {
        id: `run-${index}`,
        text,
        x: run.x,
        baseline: run.baseline,
        width: run.width,
        fontSize: run.fontSize,
        bounds: {
          x: run.x - pad,
          y: run.baseline + descent * run.fontSize - pad,
          width: run.width + pad * 2,
          height: (ascent - descent) * run.fontSize + pad * 2,
        },
        ...guessFont(fontInfo(run.fontName), style.fontFamily, text),
      }
    })
}

function toHex([r, g, b]: number[]): string {
  return `#${[r, g, b].map(value => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0')).join('')}`
}

/**
 * Estimates the background and ink colors of rendered text. `pixels` is RGBA data
 * for a region that contains `inner` (the text box) plus a margin; the margin ring
 * gives the background and the pixels that differ most from it give the ink.
 */
export function sampleTextColors(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  inner: { left: number; top: number; right: number; bottom: number },
): { textColor: string; backgroundColor: string } {
  const at = (x: number, y: number) => { const i = (y * width + x) * 4; return [pixels[i], pixels[i + 1], pixels[i + 2]] }
  const isInner = (x: number, y: number) => x >= inner.left && x < inner.right && y >= inner.top && y < inner.bottom

  const buckets = new Map<number, { count: number; sum: number[] }>()
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isInner(x, y)) continue
      const color = at(x, y)
      const key = ((color[0] >> 4) << 8) | ((color[1] >> 4) << 4) | (color[2] >> 4)
      const bucket = buckets.get(key) ?? { count: 0, sum: [0, 0, 0] }
      bucket.count += 1
      color.forEach((value, channel) => { bucket.sum[channel] += value })
      buckets.set(key, bucket)
    }
  }
  let dominant: { count: number; sum: number[] } | undefined
  buckets.forEach(bucket => { if (!dominant || bucket.count > dominant.count) dominant = bucket })
  const background = dominant ? dominant.sum.map(value => value / dominant!.count) : [255, 255, 255]

  const distance = (color: number[]) => Math.hypot(color[0] - background[0], color[1] - background[1], color[2] - background[2])
  let maximum = 0
  for (let y = Math.max(0, inner.top); y < Math.min(height, inner.bottom); y += 1) {
    for (let x = Math.max(0, inner.left); x < Math.min(width, inner.right); x += 1) maximum = Math.max(maximum, distance(at(x, y)))
  }
  let ink = [0, 0, 0]
  if (maximum >= 40) {
    // Antialiased edge pixels blend toward the background; keep the strongest strokes.
    const sum = [0, 0, 0]
    let count = 0
    for (let y = Math.max(0, inner.top); y < Math.min(height, inner.bottom); y += 1) {
      for (let x = Math.max(0, inner.left); x < Math.min(width, inner.right); x += 1) {
        const color = at(x, y)
        if (distance(color) < maximum * 0.75) continue
        color.forEach((value, channel) => { sum[channel] += value })
        count += 1
      }
    }
    ink = sum.map(value => value / count)
  }
  return { textColor: toHex(ink), backgroundColor: toHex(background) }
}

/** Creates a single-line text element whose baseline and start match the original run. */
export function createReplacementElement(
  run: PdfTextRun,
  options: { id: string; pageIndex: number; color: string; coverColor: string },
): PdfTextElement {
  const fontSize = Math.min(500, Math.max(4, Math.round(run.fontSize * 10) / 10))
  // Export places the first baseline at y + height - fontSize.
  const height = fontSize * 1.2
  return {
    id: options.id,
    type: 'text',
    pageIndex: options.pageIndex,
    zIndex: 0,
    x: run.x,
    y: run.baseline + fontSize - height,
    width: Math.max(1, run.width),
    height,
    rotation: 0,
    opacity: 1,
    text: run.text,
    fontFamily: run.fontFamily,
    fontSize,
    color: options.color,
    bold: run.bold,
    italic: run.italic,
    underline: false,
    singleLine: true,
    replaces: { ...run.bounds, text: run.text, coverColor: options.coverColor },
  }
}

/** Finds the element that already replaces a run, so a second click edits it instead of stacking covers. */
export function findReplacement(elements: PdfEditorElement[], run: PdfTextRun): PdfTextElement | undefined {
  const tolerance = Math.max(1, run.fontSize * 0.1)
  return elements.find((element): element is PdfTextElement => element.type === 'text' && Boolean(element.replaces) &&
    Math.abs(element.replaces!.x - run.bounds.x) <= tolerance &&
    Math.abs(element.replaces!.y - run.bounds.y) <= tolerance &&
    Math.abs(element.replaces!.width - run.bounds.width) <= tolerance)
}
