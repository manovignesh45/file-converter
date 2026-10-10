import fs from 'fs/promises'
import { afterEach, describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { PdfEditService } from '../../services/pdfEditService'
import type { PdfEditPayload } from '../../types/pdfEditor'

const outputs: string[] = []

afterEach(async () => {
  await Promise.all(outputs.splice(0).map(output => fs.unlink(output).catch(() => undefined)))
})

describe('PDF edit export', () => {
  it('reopens an edited mixed-size PDF without changing its pages', async () => {
    const source = await PDFDocument.create()
    source.addPage([300, 500])
    source.addPage([792, 612])
    const input = Buffer.from(await source.save())
    const payload: PdfEditPayload = {
      version: 1,
      pages: [
        { pageIndex: 0, width: 300, height: 500, rotation: 0 },
        { pageIndex: 1, width: 792, height: 612, rotation: 0 },
      ],
      elements: [
        { id: 'text', type: 'text', pageIndex: 0, zIndex: 0, x: 35, y: 390, width: 180, height: 50, rotation: 0, opacity: 1, text: 'Verified export text', fontFamily: 'Helvetica', fontSize: 18, color: '#112233', bold: true, italic: false, underline: true },
        { id: 'shape', type: 'rectangle', pageIndex: 1, zIndex: 0, x: 100, y: 100, width: 140, height: 75, rotation: 12, opacity: 0.7, strokeColor: '#4f46e5', fillColor: '#c7d2fe', strokeWidth: 2 },
        { id: 'drawing', type: 'drawing', pageIndex: 1, zIndex: 1, x: 50, y: 300, width: 100, height: 50, rotation: 0, opacity: 1, points: [{ x: 50, y: 300 }, { x: 90, y: 350 }, { x: 150, y: 320 }], color: '#ef4444', strokeWidth: 4 },
        { id: 'ellipse', type: 'ellipse', pageIndex: 0, zIndex: 2, x: 30, y: 250, width: 90, height: 55, rotation: 0, opacity: 0.6, strokeColor: '#112233', fillColor: '#abcdef', strokeWidth: 2 },
        { id: 'line', type: 'line', pageIndex: 0, zIndex: 3, x: 40, y: 200, width: 100, height: 1, rotation: 20, opacity: 1, strokeColor: '#445566', strokeWidth: 2 },
        { id: 'arrow', type: 'arrow', pageIndex: 1, zIndex: 2, x: 300, y: 250, width: 120, height: 1, rotation: 35, opacity: 1, strokeColor: '#778899', strokeWidth: 3 },
        { id: 'highlight', type: 'highlight', pageIndex: 1, zIndex: 3, x: 100, y: 500, width: 180, height: 22, rotation: 0, opacity: 0.3, color: '#fde047' },
        { id: 'image', type: 'image', pageIndex: 1, zIndex: 4, x: 500, y: 350, width: 80, height: 80, rotation: 10, opacity: 1, assetId: 'pixel', mimeType: 'image/png' },
      ],
    }

    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
    const result = await new PdfEditService().exportPdf(input, 'mixed sizes.pdf', payload, [{ id: 'pixel', mimeType: 'image/png', buffer: png }])
    outputs.push(result.outputPath)
    const exported = await PDFDocument.load(await fs.readFile(result.outputPath))

    expect(exported.getPageCount()).toBe(2)
    expect(exported.getPage(0).getSize()).toEqual({ width: 300, height: 500 })
    expect(exported.getPage(1).getSize()).toEqual({ width: 792, height: 612 })
    expect(result.processedName).toMatch(/^mixed_sizes_edited_[a-f0-9]{8}\.pdf$/)
    expect(result.processedSize).toBeGreaterThan(0)
  })
})
