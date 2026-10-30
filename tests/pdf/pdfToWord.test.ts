import fs from 'fs/promises'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { buildParagraphs, fontStyleFromName, TextFragment } from '../../lib/pdf/pdfToWord'
import { PdfToWordService } from '../../services/pdfToWordService'

const outputs: string[] = []

afterEach(async () => {
  await Promise.all(outputs.splice(0).map(output => fs.unlink(output).catch(() => undefined)))
})

function fragment(text: string, x: number, y: number, overrides: Partial<TextFragment> = {}): TextFragment {
  return { text, x, y, width: text.length * 6, fontSize: 12, bold: false, italic: false, ...overrides }
}

describe('PDF to Word layout', () => {
  it('joins wrapped lines into one paragraph and splits on large gaps', () => {
    const paragraphs = buildParagraphs([
      fragment('The quick brown fox jumps over the lazy dog and keeps', 72, 700, { width: 450 }),
      fragment('running.', 72, 686, { width: 50 }),
      fragment('A second paragraph.', 72, 640, { width: 120 }),
    ], 612)

    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[0].runs.map(run => run.text).join('')).toBe('The quick brown fox jumps over the lazy dog and keeps running.')
    expect(paragraphs[1].runs[0].text).toBe('A second paragraph.')
  })

  it('orders fragments on a line left to right and keeps styled runs', () => {
    const [paragraph] = buildParagraphs([
      fragment('world', 110, 700, { width: 30, bold: true }),
      fragment('Hello', 72, 700, { width: 30 }),
    ], 612)

    expect(paragraph.runs).toEqual([
      { text: 'Hello', fontSize: 12, bold: false, italic: false },
      { text: ' world', fontSize: 12, bold: true, italic: false },
    ])
  })

  it('marks large text as headings and rejoins hyphenated words', () => {
    const paragraphs = buildParagraphs([
      fragment('Report title', 72, 740, { fontSize: 24, width: 150 }),
      fragment('This sentence is long enough to fill the line and ends with a hyph-', 72, 700, { width: 460 }),
      fragment('enated word.', 72, 686, { width: 70 }),
    ], 612, 12)

    expect(paragraphs[0].heading).toBe(1)
    expect(paragraphs[1].heading).toBeUndefined()
    expect(paragraphs[1].runs[0].text).toContain('hyphenated word.')
  })

  it('reads bold and italic from embedded font names', () => {
    expect(fontStyleFromName('ABCDEF+Arial-BoldItalicMT')).toEqual({ bold: true, italic: true })
    expect(fontStyleFromName('Helvetica')).toEqual({ bold: false, italic: false })
  })
})

describe('PDF to Word service', () => {
  it('creates a .docx containing the PDF text', async () => {
    const source = await PDFDocument.create()
    const regular = await source.embedFont(StandardFonts.Helvetica)
    const bold = await source.embedFont(StandardFonts.HelveticaBold)
    const page = source.addPage([612, 792])
    page.drawText('Quarterly Summary', { x: 72, y: 720, size: 24, font: bold })
    page.drawText('Revenue grew in every region.', { x: 72, y: 680, size: 12, font: regular })
    source.addPage([612, 792]).drawText('Second page text', { x: 72, y: 720, size: 12, font: regular })

    const result = await new PdfToWordService().convertToWord(Buffer.from(await source.save()), 'summary.pdf')
    const output = path.join(process.cwd(), 'public', 'processed', result.processedName)
    outputs.push(output)

    expect(result.processedName).toMatch(/^summary_[a-f0-9]{8}\.docx$/)
    expect(result.pageCount).toBe(2)
    const docx = await fs.readFile(output)
    expect(docx.subarray(0, 2).toString()).toBe('PK')

    const service = new PdfToWordService()
    const pages = await service.extractPages(Buffer.from(await source.save()))
    expect(pages[0].fragments.find(item => item.text === 'Quarterly Summary')?.bold).toBe(true)
  })

  it('explains that scanned PDFs without text cannot be converted', async () => {
    const source = await PDFDocument.create()
    source.addPage([300, 300])
    await expect(new PdfToWordService().convertToWord(Buffer.from(await source.save()), 'scan.pdf')).rejects.toThrow(/No selectable text/)
  })
})
