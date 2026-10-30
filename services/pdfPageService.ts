import { degrees, PDFDocument } from 'pdf-lib'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs/promises'
import { PageRange, parsePageRanges, rangeLabel } from '../lib/pdf/pageRanges'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'processed')

export interface PdfPageResult {
  processedName: string
  originalSize: number
  processedSize: number
  pageCount: number
}

async function loadPdf(buffer: Buffer, name: string): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(buffer)
  } catch (error) {
    if (error instanceof Error && /encrypt/i.test(error.message)) {
      throw new Error(`${name} is password protected. Unlock it first with the Unlock PDF tool.`)
    }
    throw new Error(`${name} appears to be corrupted or is not a valid PDF.`)
  }
}

async function savePdf(document: PDFDocument, baseName: string, suffix: string, originalSize: number): Promise<PdfPageResult> {
  const bytes = await document.save()
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
  const processedName = `${baseName}_${suffix}_${uuidv4().split('-')[0]}.pdf`
  await fs.writeFile(path.join(UPLOAD_DIR, processedName), bytes)
  return { processedName, originalSize, processedSize: bytes.length, pageCount: document.getPageCount() }
}

export class PdfPageService {
  async merge(files: Array<{ buffer: Buffer; name: string }>): Promise<PdfPageResult> {
    if (files.length < 2) throw new Error('Choose at least two PDFs to merge.')

    const merged = await PDFDocument.create()
    for (const file of files) {
      const source = await loadPdf(file.buffer, file.name)
      const pages = await merged.copyPages(source, source.getPageIndices())
      pages.forEach(page => merged.addPage(page))
    }

    const originalSize = files.reduce((total, file) => total + file.buffer.length, 0)
    return savePdf(merged, path.parse(files[0].name).name, 'merged', originalSize)
  }

  /** Splits into one PDF per range, or one per page when no ranges are given. */
  async split(buffer: Buffer, originalName: string, ranges?: string): Promise<PdfPageResult[]> {
    const source = await loadPdf(buffer, originalName)
    const pageCount = source.getPageCount()
    const selected: PageRange[] = ranges?.trim()
      ? parsePageRanges(ranges, pageCount)
      : source.getPageIndices().map(index => ({ start: index + 1, end: index + 1 }))

    const baseName = path.parse(originalName).name
    const results: PdfPageResult[] = []
    for (const range of selected) {
      const part = await PDFDocument.create()
      const indices = Array.from({ length: range.end - range.start + 1 }, (_, offset) => range.start - 1 + offset)
      const pages = await part.copyPages(source, indices)
      pages.forEach(page => part.addPage(page))
      results.push(await savePdf(part, baseName, rangeLabel(range), buffer.length))
    }
    return results
  }

  /** Rotates the chosen pages (all pages when no ranges are given) clockwise by the angle. */
  async rotate(buffer: Buffer, originalName: string, angle: number, ranges?: string): Promise<PdfPageResult> {
    if (![90, 180, 270].includes(angle)) throw new Error('Rotation must be 90, 180 or 270 degrees.')

    const document = await loadPdf(buffer, originalName)
    const pageCount = document.getPageCount()
    const selected = ranges?.trim() ? parsePageRanges(ranges, pageCount) : [{ start: 1, end: pageCount }]

    document.getPages().forEach((page, index) => {
      const pageNumber = index + 1
      if (!selected.some(range => pageNumber >= range.start && pageNumber <= range.end)) return
      page.setRotation(degrees((page.getRotation().angle + angle) % 360))
    })

    return savePdf(document, path.parse(originalName).name, 'rotated', buffer.length)
  }
}
