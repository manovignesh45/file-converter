import { execFile } from 'child_process'
import { promisify } from 'util'
import { tmpdir } from 'os'
import path from 'path'
import fs from 'fs/promises'
import fontkit from '@pdf-lib/fontkit'
import {
  BlendMode,
  degrees,
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  rgb,
  StandardFonts,
} from 'pdf-lib'
import { v4 as uuidv4 } from 'uuid'
import type {
  PdfDrawingElement,
  PdfEditPayload,
  PdfEditorElement,
  PdfLineElement,
  PdfTextElement,
} from '../types/pdfEditor'
import { safeOutputBaseName } from '../lib/pdf/validation'
import { layoutText } from '../lib/pdf/textLayout'
import { symbolSegments } from '../lib/pdf/symbols'

const execFileAsync = promisify(execFile)

export interface PdfEditAsset {
  id: string
  mimeType: 'image/png' | 'image/jpeg'
  buffer: Buffer
}

export interface PdfEditResult {
  processedName: string
  originalSize: number
  processedSize: number
  pageCount: number
  outputPath: string
}

function hexToRgb(value: string) {
  const hex = value.slice(1)
  return rgb(
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  )
}

function fontNameFor(element: PdfTextElement): StandardFonts | 'NotoSans-Regular' | 'NotoSans-Bold' | 'NotoSans-Italic' | 'NotoSans-BoldItalic' {
  if (element.fontFamily === 'NotoSans') {
    if (element.bold && element.italic) return 'NotoSans-BoldItalic'
    if (element.bold) return 'NotoSans-Bold'
    if (element.italic) return 'NotoSans-Italic'
    return 'NotoSans-Regular'
  }
  if (element.fontFamily === 'TimesRoman') {
    if (element.bold && element.italic) return StandardFonts.TimesRomanBoldItalic
    if (element.bold) return StandardFonts.TimesRomanBold
    if (element.italic) return StandardFonts.TimesRomanItalic
    return StandardFonts.TimesRoman
  }
  if (element.fontFamily === 'Courier') {
    if (element.bold && element.italic) return StandardFonts.CourierBoldOblique
    if (element.bold) return StandardFonts.CourierBold
    if (element.italic) return StandardFonts.CourierOblique
    return StandardFonts.Courier
  }
  if (element.bold && element.italic) return StandardFonts.HelveticaBoldOblique
  if (element.bold) return StandardFonts.HelveticaBold
  if (element.italic) return StandardFonts.HelveticaOblique
  return StandardFonts.Helvetica
}

function drawText(page: PDFPage, element: PdfTextElement, font: PDFFont) {
  const layout = element.exportLayout ?? layoutText(element.text, {
    width: element.width, height: element.height, fontSize: element.fontSize,
    minFontSize: element.minFontSize ?? 8, singleLine: element.singleLine ?? false, autoFit: element.autoFit ?? false,
  }, (text, size) => font.widthOfTextAtSize(text, size))
  const lineHeight = layout.fontSize * 1.2
  layout.lines.forEach((line, index) => {
    if (!line) return
    const y = element.y + element.height - layout.fontSize - index * lineHeight
    const width = font.widthOfTextAtSize(line, layout.fontSize)
    const x = element.x + (element.textAlign === 'center' ? (element.width - width) / 2 : element.textAlign === 'right' ? element.width - width : 0)
    page.drawText(line, {
      x,
      y,
      size: layout.fontSize,
      font,
      color: hexToRgb(element.color),
      opacity: element.opacity,
      rotate: degrees(element.rotation),
    })
    if (element.underline && line) {
      const radians = element.rotation * Math.PI / 180
      page.drawLine({
        start: { x: x + 1.5 * Math.sin(radians), y: y - 1.5 * Math.cos(radians) },
        end: { x: x + width * Math.cos(radians) + 1.5 * Math.sin(radians), y: y + width * Math.sin(radians) - 1.5 * Math.cos(radians) },
        thickness: Math.max(0.5, layout.fontSize / 18),
        color: hexToRgb(element.color),
        opacity: element.opacity,
      })
    }
  })
}

function drawLineOrArrow(page: PDFPage, element: PdfLineElement) {
  const radians = (element.rotation * Math.PI) / 180
  const end = {
    x: element.x + Math.cos(radians) * element.width,
    y: element.y + Math.sin(radians) * element.width,
  }
  const color = hexToRgb(element.strokeColor)
  page.drawLine({
    start: { x: element.x, y: element.y },
    end,
    thickness: element.strokeWidth,
    color,
    opacity: element.opacity,
  })
  if (element.type === 'arrow') {
    const headLength = Math.max(8, element.strokeWidth * 4)
    const spread = Math.PI / 7
    for (const angle of [radians + Math.PI - spread, radians + Math.PI + spread]) {
      page.drawLine({
        start: end,
        end: {
          x: end.x + Math.cos(angle) * headLength,
          y: end.y + Math.sin(angle) * headLength,
        },
        thickness: element.strokeWidth,
        color,
        opacity: element.opacity,
      })
    }
  }
}

function drawFreehand(page: PDFPage, element: PdfDrawingElement) {
  for (let index = 1; index < element.points.length; index += 1) {
    page.drawLine({
      start: element.points[index - 1],
      end: element.points[index],
      thickness: element.strokeWidth,
      color: hexToRgb(element.color),
      opacity: element.opacity,
    })
  }
}

export class PdfEditService {
  private outputDir = path.join(process.cwd(), 'public', 'processed')

  private async loadDocument(input: Buffer, password?: string): Promise<{ document: PDFDocument; cleanup: () => Promise<void> }> {
    try {
      const document = await PDFDocument.load(input)
      return { document, cleanup: async () => undefined }
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : ''
      if (!message.includes('encrypt')) throw error
      if (!password) throw new Error('This PDF is password protected. Enter its password to edit it.')

      const temporaryDirectory = await fs.mkdtemp(path.join(tmpdir(), 'file-converter-pdf-'))
      const inputPath = path.join(temporaryDirectory, 'input.pdf')
      const outputPath = path.join(temporaryDirectory, 'unlocked.pdf')
      await fs.writeFile(inputPath, input, { mode: 0o600 })

      try {
        try {
          await execFileAsync('qpdf', [`--password=${password}`, '--decrypt', inputPath, outputPath])
        } catch (qpdfError: any) {
          if (qpdfError?.code !== 3) throw qpdfError
        }
        const decrypted = await fs.readFile(outputPath)
        const document = await PDFDocument.load(decrypted)
        return {
          document,
          cleanup: () => fs.rm(temporaryDirectory, { recursive: true, force: true }),
        }
      } catch (decryptError) {
        await fs.rm(temporaryDirectory, { recursive: true, force: true })
        const detail = [
          decryptError instanceof Error ? decryptError.message : '',
          typeof (decryptError as any)?.stderr === 'string' ? (decryptError as any).stderr : '',
        ].join(' ').toLowerCase()
        if (detail.includes('invalid password')) throw new Error('The PDF password is incorrect.')
        if (detail.includes('enoent')) throw new Error('Encrypted PDFs cannot be edited because qpdf is unavailable.')
        throw new Error('The encrypted PDF could not be opened. Check the password and file permissions.')
      }
    }
  }

  async exportPdf(
    input: Buffer,
    originalName: string,
    payload: PdfEditPayload,
    assets: PdfEditAsset[],
    password?: string,
  ): Promise<PdfEditResult> {
    await fs.mkdir(this.outputDir, { recursive: true })
    const loaded = await this.loadDocument(input, password)
    let outputPath: string | null = null

    try {
      const pdfDocument = loaded.document
      if (pdfDocument.getPageCount() !== payload.pages.length) {
        throw new Error('The PDF changed while it was being edited. Reload it and try again.')
      }
      const originalPageSizes = pdfDocument.getPages().map(page => page.getSize())

      const assetMap = new Map(assets.map(asset => [asset.id, asset]))
      const fontCache = new Map<string, PDFFont>()
      const imageCache = new Map<string, PDFImage>()
      pdfDocument.registerFontkit(fontkit)

      for (const element of [...payload.elements].sort((a, b) => a.pageIndex - b.pageIndex || a.zIndex - b.zIndex)) {
        const page = pdfDocument.getPage(element.pageIndex)
        await this.drawElement(pdfDocument, page, element, assetMap, fontCache, imageCache)
      }

      const bytes = await pdfDocument.save({ useObjectStreams: true })
      const verifyDocument = await PDFDocument.load(bytes)
      if (verifyDocument.getPageCount() !== payload.pages.length) {
        throw new Error('The exported PDF failed page-count verification.')
      }
      originalPageSizes.forEach((expected, index) => {
        const actual = verifyDocument.getPage(index).getSize()
        if (Math.abs(actual.width - expected.width) > 0.5 || Math.abs(actual.height - expected.height) > 0.5) {
          throw new Error(`The exported PDF failed page-size verification on page ${index + 1}.`)
        }
      })

      const processedName = `${safeOutputBaseName(originalName)}_edited_${uuidv4().slice(0, 8)}.pdf`
      outputPath = path.join(this.outputDir, processedName)
      await fs.writeFile(outputPath, bytes)

      return {
        processedName,
        originalSize: input.length,
        processedSize: bytes.length,
        pageCount: payload.pages.length,
        outputPath,
      }
    } catch (error) {
      if (outputPath) await fs.unlink(outputPath).catch(() => undefined)
      throw error
    } finally {
      await loaded.cleanup()
    }
  }

  private async drawElement(
    document: PDFDocument,
    page: PDFPage,
    element: PdfEditorElement,
    assets: Map<string, PdfEditAsset>,
    fonts: Map<string, PDFFont>,
    images: Map<string, PDFImage>,
  ) {
    switch (element.type) {
      case 'text': {
        const name = fontNameFor(element)
        let font = fonts.get(name)
        if (!font) {
          font = name.startsWith('NotoSans-')
            ? await document.embedFont(await fs.readFile(path.join(process.cwd(), 'public', 'fonts', `${name}.ttf`)), { subset: true })
            : await document.embedFont(name as StandardFonts)
          fonts.set(name, font)
        }
        try { drawText(page, element, font) } catch (error) {
          const message = error instanceof Error ? error.message : ''
          if (/encode|glyph|unicode/i.test(message)) throw new Error('The selected font cannot render one or more characters. Try Noto Sans or change the text.')
          throw error
        }
        return
      }
      case 'image': {
        const asset = assets.get(element.assetId)
        if (!asset) throw new Error('An image used in the editor is missing from the export.')
        let image = images.get(element.assetId)
        if (!image) {
          image = asset.mimeType === 'image/png'
            ? await document.embedPng(asset.buffer)
            : await document.embedJpg(asset.buffer)
          images.set(element.assetId, image)
        }
        page.drawImage(image, {
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height,
          rotate: degrees(element.rotation),
          opacity: element.opacity,
        })
        return
      }
      case 'rectangle':
        page.drawRectangle({
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height,
          rotate: degrees(element.rotation),
          borderColor: hexToRgb(element.strokeColor),
          borderWidth: element.strokeWidth,
          borderOpacity: element.opacity,
          color: element.fillColor ? hexToRgb(element.fillColor) : undefined,
          opacity: element.fillColor ? element.opacity : 0,
        })
        return
      case 'ellipse':
        page.drawEllipse({
          x: element.x + element.width / 2,
          y: element.y + element.height / 2,
          xScale: element.width / 2,
          yScale: element.height / 2,
          rotate: degrees(element.rotation),
          borderColor: hexToRgb(element.strokeColor),
          borderWidth: element.strokeWidth,
          borderOpacity: element.opacity,
          color: element.fillColor ? hexToRgb(element.fillColor) : undefined,
          opacity: element.fillColor ? element.opacity : 0,
        })
        return
      case 'line':
      case 'arrow':
        drawLineOrArrow(page, element)
        return
      case 'checkmark':
      case 'crossmark':
        symbolSegments(element).forEach(([start, end]) => page.drawLine({ start, end, thickness: element.strokeWidth, color: hexToRgb(element.strokeColor), opacity: element.opacity }))
        return
      case 'drawing':
        drawFreehand(page, element)
        return
      case 'highlight':
        page.drawRectangle({
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height,
          color: hexToRgb(element.color),
          opacity: element.opacity,
          blendMode: BlendMode.Multiply,
        })
    }
  }
}
