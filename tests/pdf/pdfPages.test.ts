import fs from 'fs/promises'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { PdfPageService } from '../../services/pdfPageService'

const outputs: string[] = []

afterEach(async () => {
  await Promise.all(outputs.splice(0).map(output => fs.unlink(output).catch(() => undefined)))
})

async function pdfWithPages(...sizes: Array<[number, number]>): Promise<Buffer> {
  const document = await PDFDocument.create()
  sizes.forEach(size => document.addPage(size))
  return Buffer.from(await document.save())
}

async function openResult(name: string): Promise<PDFDocument> {
  const output = path.join(process.cwd(), 'public', 'processed', name)
  outputs.push(output)
  return PDFDocument.load(await fs.readFile(output))
}

describe('PDF page tools', () => {
  const service = new PdfPageService()

  it('merges PDFs in the given order', async () => {
    const result = await service.merge([
      { buffer: await pdfWithPages([100, 100], [200, 200]), name: 'a.pdf' },
      { buffer: await pdfWithPages([300, 300]), name: 'b.pdf' },
    ])
    const merged = await openResult(result.processedName)
    expect(merged.getPages().map(page => page.getWidth())).toEqual([100, 200, 300])
    await expect(service.merge([{ buffer: await pdfWithPages([100, 100]), name: 'a.pdf' }])).rejects.toThrow(/at least two/)
  })

  it('splits every page, or by ranges', async () => {
    const input = await pdfWithPages([100, 100], [200, 200], [300, 300])

    const perPage = await service.split(input, 'doc.pdf')
    expect(perPage).toHaveLength(3)
    for (const part of perPage) await openResult(part.processedName)
    expect(perPage[1].processedName).toMatch(/^doc_page2_/)

    const ranged = await service.split(input, 'doc.pdf', '1-2, 3')
    const first = await openResult(ranged[0].processedName)
    await openResult(ranged[1].processedName)
    expect(first.getPages().map(page => page.getWidth())).toEqual([100, 200])
  })

  it('rotates only the selected pages, adding to their existing rotation', async () => {
    const result = await service.rotate(await pdfWithPages([100, 100], [200, 200]), 'doc.pdf', 270, '2')
    const rotated = await openResult(result.processedName)
    expect(rotated.getPages().map(page => page.getRotation().angle)).toEqual([0, 270])
    await expect(service.rotate(await pdfWithPages([100, 100]), 'doc.pdf', 45)).rejects.toThrow(/90, 180 or 270/)
  })
})
