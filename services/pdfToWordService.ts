import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, SectionType, TextRun } from 'docx'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs/promises'
import { bodyFontSize, buildParagraphs, fontStyleFromName, TextFragment } from '../lib/pdf/pdfToWord'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'processed')
const POINTS_TO_TWIPS = 20

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  // Running the worker in-process avoids resolving pdf.worker.mjs by path on the server.
  const globals = globalThis as typeof globalThis & { pdfjsWorker?: unknown }
  if (!globals.pdfjsWorker) globals.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
  return pdfjs
}

interface ExtractedPage {
  width: number
  height: number
  fragments: TextFragment[]
}

export class PdfToWordService {
  async extractPages(buffer: Buffer, password?: string): Promise<ExtractedPage[]> {
    const pdfjs = await loadPdfjs()
    const task = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      password: password || undefined,
      disableFontFace: true,
      useSystemFonts: false,
      isEvalSupported: false,
    })

    let pdf
    try {
      pdf = await task.promise
    } catch (error) {
      if (error instanceof Error && error.name === 'PasswordException') {
        throw new Error('This PDF is password protected. Unlock it first with the Unlock PDF tool.')
      }
      throw new Error('The PDF file appears to be corrupted or is not a valid PDF.')
    }

    try {
      const pages: ExtractedPage[] = []
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber)
        const viewport = page.getViewport({ scale: 1 })
        // The operator list loads fonts into commonObjs, which gives real font names for bold/italic detection.
        await page.getOperatorList()
        const content = await page.getTextContent()
        const fontStyles = new Map<string, { bold: boolean; italic: boolean }>()

        const fragments: TextFragment[] = []
        for (const item of content.items) {
          if (!('str' in item) || !item.str) continue
          let style = fontStyles.get(item.fontName)
          if (!style) {
            let name: string | undefined
            try {
              name = (page.commonObjs.get(item.fontName) as { name?: string } | undefined)?.name
            } catch {
              name = content.styles[item.fontName]?.fontFamily
            }
            style = fontStyleFromName(name)
            fontStyles.set(item.fontName, style)
          }

          // Convert the item's origin into the unrotated viewport so rotated pages read top to bottom.
          const [x, yFromTop] = viewport.convertToViewportPoint(item.transform[4], item.transform[5])
          const fontSize = Math.hypot(item.transform[2], item.transform[3]) || item.height
          fragments.push({
            text: item.str,
            x,
            y: viewport.height - yFromTop,
            width: item.width,
            fontSize,
            ...style,
          })
        }

        pages.push({ width: viewport.width, height: viewport.height, fragments })
        page.cleanup()
      }
      return pages
    } finally {
      await pdf.destroy()
    }
  }

  async convertToWord(buffer: Buffer, originalName: string, options: { password?: string } = {}): Promise<{
    processedName: string
    originalSize: number
    processedSize: number
    pageCount: number
  }> {
    const pages = await this.extractPages(buffer, options.password)
    if (pages.every(page => page.fragments.every(fragment => !fragment.text.trim()))) {
      throw new Error('No selectable text was found. This PDF looks like a scanned image, which cannot be converted to editable text.')
    }

    const bodySize = bodyFontSize(pages.flatMap(page => page.fragments))
    const sections = pages.map((page, index) => {
      const paragraphs = buildParagraphs(page.fragments, page.width, bodySize)
      const lefts = page.fragments.filter(fragment => fragment.text.trim()).map(fragment => fragment.x)
      const margin = Math.max(36, Math.min(72, lefts.length ? Math.min(...lefts) : 72))

      return {
        properties: {
          type: index === 0 ? undefined : SectionType.NEXT_PAGE,
          page: {
            size: { width: Math.round(page.width * POINTS_TO_TWIPS), height: Math.round(page.height * POINTS_TO_TWIPS) },
            margin: { top: 1440, bottom: 1440, left: Math.round(margin * POINTS_TO_TWIPS), right: Math.round(margin * POINTS_TO_TWIPS) },
          },
        },
        children: paragraphs.length > 0
          ? paragraphs.map(paragraph => new Paragraph({
              heading: paragraph.heading === 1 ? HeadingLevel.HEADING_1 : paragraph.heading === 2 ? HeadingLevel.HEADING_2 : undefined,
              alignment: paragraph.alignment === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
              indent: paragraph.indent > 0 ? { left: Math.round(paragraph.indent * POINTS_TO_TWIPS) } : undefined,
              spacing: {
                before: Math.round(Math.min(paragraph.spaceBefore, 36) * POINTS_TO_TWIPS),
                after: 0,
              },
              children: paragraph.runs.map(run => new TextRun({
                text: run.text,
                bold: run.bold,
                italics: run.italic,
                // Word sizes are half-points; keep headings' explicit size so the result matches the PDF.
                size: Math.round(run.fontSize * 2),
                color: '000000',
                font: 'Calibri',
              })),
            }))
          : [new Paragraph({})],
      }
    })

    const document = new Document({
      creator: 'File Converter',
      title: path.parse(originalName).name,
      sections,
    })
    const docxBuffer = await Packer.toBuffer(document)

    await fs.mkdir(UPLOAD_DIR, { recursive: true })
    const processedName = `${path.parse(originalName).name}_${uuidv4().split('-')[0]}.docx`
    await fs.writeFile(path.join(UPLOAD_DIR, processedName), docxBuffer)

    return {
      processedName,
      originalSize: buffer.length,
      processedSize: docxBuffer.length,
      pageCount: pages.length,
    }
  }
}
