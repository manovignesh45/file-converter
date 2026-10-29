import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { buildTextRuns, createReplacementElement, findReplacement, guessFont, isWinAnsiText, sampleTextColors, type PdfFontInfoLike, type PdfTextItemLike } from '../../lib/pdf/textRuns'

const item = (str: string, x: number, y: number, size: number, width: number, fontName = 'f1', hasEOL = false): PdfTextItemLike =>
  ({ str, transform: [size, 0, 0, size, x, y], width, height: size, fontName, hasEOL })

const styles = { f1: { fontFamily: 'sans-serif', ascent: 0.75, descent: -0.25 }, f2: { fontFamily: 'serif', ascent: 0.7, descent: -0.2 } }

describe('text runs', () => {
  it('joins consecutive items on one baseline and inserts a missing word space', () => {
    const runs = buildTextRuns([item('Hello', 50, 700, 12, 28), item('world', 81, 700, 12, 30), item('', 0, 0, 0, 0, 'f1', true), item('Next line', 50, 680, 12, 50)], styles)
    expect(runs.map(run => run.text)).toEqual(['Hello world', 'Next line'])
    expect(runs[0]).toMatchObject({ x: 50, baseline: 700, width: 61, fontSize: 12 })
    expect(runs[0].bounds.y).toBeCloseTo(700 - 0.25 * 12 - 0.72)
    expect(runs[0].bounds.height).toBeCloseTo(12 + 1.44)
  })

  it('keeps a different font, a distant column and rotated text out of the run', () => {
    const rotated: PdfTextItemLike = { str: 'Side', transform: [0, 12, -12, 0, 300, 300], width: 20, height: 12, fontName: 'f1' }
    const runs = buildTextRuns([item('Name', 50, 700, 12, 30), item('Bold', 82, 700, 12, 26, 'f2'), item('Column', 300, 700, 12, 40), rotated], styles)
    expect(runs.map(run => run.text)).toEqual(['Name', 'Bold', 'Column'])
  })

  it('reads lines and fonts from a real PDF through PDF.js', async () => {
    const source = await PDFDocument.create()
    const page = source.addPage([400, 300])
    page.drawText('Invoice total', { x: 50, y: 200, size: 14, font: await source.embedFont(StandardFonts.HelveticaBold) })
    page.drawText('Due in thirty days', { x: 50, y: 150, size: 11, font: await source.embedFont(StandardFonts.TimesRomanItalic) })
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const pdf = await pdfjs.getDocument({ data: await source.save(), verbosity: 0 }).promise
    const pdfPage = await pdf.getPage(1)
    const content = await pdfPage.getTextContent()
    await pdfPage.getOperatorList()
    const runs = buildTextRuns(content.items.filter(entry => 'str' in entry) as PdfTextItemLike[], content.styles, name => pdfPage.commonObjs.get(name) as PdfFontInfoLike)
    expect(runs).toHaveLength(2)
    expect(runs[0]).toMatchObject({ text: 'Invoice total', x: 50, baseline: 200, fontSize: 14, fontFamily: 'Helvetica', bold: true, italic: false })
    expect(runs[1]).toMatchObject({ text: 'Due in thirty days', fontFamily: 'TimesRoman', bold: false, italic: true })
    await pdf.destroy()
  })

  it('maps embedded font names to the closest export font', () => {
    expect(guessFont({ name: 'ABCDEF+Arial-BoldMT' }, 'sans-serif', 'x')).toEqual({ fontFamily: 'Helvetica', bold: true, italic: false })
    expect(guessFont({ name: 'TimesNewRomanPS-ItalicMT' }, 'serif', 'x')).toEqual({ fontFamily: 'TimesRoman', bold: false, italic: true })
    expect(guessFont({ name: 'CourierNewPSMT' }, undefined, 'x').fontFamily).toBe('Courier')
    expect(guessFont({ name: 'NotoSerif-Regular' }, 'serif', 'x').fontFamily).toBe('TimesRoman')
    expect(guessFont(undefined, 'serif', 'x').fontFamily).toBe('TimesRoman')
    expect(guessFont({ name: 'Arial' }, 'sans-serif', 'Привет').fontFamily).toBe('NotoSans')
    expect(isWinAnsiText('Café – “quoted” €5')).toBe(true)
    expect(isWinAnsiText('日本')).toBe(false)
  })

  it('samples the background from the margin and the ink from the strongest strokes', () => {
    const width = 10
    const height = 6
    const pixels = new Uint8ClampedArray(width * height * 4)
    for (let index = 0; index < width * height; index += 1) pixels.set([250, 248, 240, 255], index * 4)
    // Stroke pixels plus one antialiased pixel inside the text box.
    for (const x of [3, 4, 5]) pixels.set([20, 40, 160, 255], (3 * width + x) * 4)
    pixels.set([140, 150, 200, 255], (2 * width + 4) * 4)
    expect(sampleTextColors(pixels, width, height, { left: 2, top: 1, right: 8, bottom: 5 })).toEqual({ textColor: '#1428a0', backgroundColor: '#faf8f0' })
  })

  it('falls back to black ink when the box has no visible text', () => {
    const pixels = new Uint8ClampedArray(4 * 4 * 4).fill(255)
    expect(sampleTextColors(pixels, 4, 4, { left: 1, top: 1, right: 3, bottom: 3 })).toEqual({ textColor: '#000000', backgroundColor: '#ffffff' })
  })

  it('creates a replacement whose exported baseline matches the original and finds it again', () => {
    const [run] = buildTextRuns([item('Total: $40', 72, 500, 10, 48)], styles)
    const element = createReplacementElement(run, { id: 'edit', pageIndex: 0, color: '#111111', coverColor: '#ffffff' })
    expect(element.y + element.height - element.fontSize).toBeCloseTo(500)
    expect(element).toMatchObject({ x: 72, text: 'Total: $40', singleLine: true, replaces: { text: 'Total: $40', coverColor: '#ffffff', ...run.bounds } })
    expect(findReplacement([element], run)?.id).toBe('edit')
    expect(findReplacement([{ ...element, replaces: undefined }], run)).toBeUndefined()
  })
})
