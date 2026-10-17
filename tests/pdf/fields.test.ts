import { describe, expect, it } from 'vitest'
import { formatDateOnly, parseDateOnly } from '../../lib/pdf/dateFormatting'
import { applyPlacedElementEdit, detachFieldText, fieldDisplayValue, unlinkRemovedField, updateLinkedFieldImage, updateLinkedFieldText, type LinkedTextElement } from '../../lib/pdf/fields'
import type { PdfImageElement } from '../../types/pdfEditor'

const placed = (id: string, fieldLink: 'linked' | 'independent'): LinkedTextElement => ({
  id, pageIndex: 0, pageId: 'source-page-0', zIndex: 0, x: 10, y: 20, width: 100, height: 30,
  rotation: 0, opacity: 1, type: 'text', text: 'Old', fontFamily: 'Helvetica', fontSize: 12,
  color: '#000000', bold: false, italic: false, underline: false, fieldId: 'name', fieldLink,
})

describe('quick fill fields', () => {
  it('formats date-only values without timezone conversion', () => {
    expect(parseDateOnly('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 })
    expect(parseDateOnly('2025-02-29')).toBeNull()
    expect(formatDateOnly('2024-02-29', 'DD MMM YYYY')).toBe('29 Feb 2024')
    expect(formatDateOnly('2024-02-29', 'DD/MM/YYYY')).toBe('29/02/2024')
    expect(formatDateOnly('2024-02-29', 'DD-MM-YYYY')).toBe('29-02-2024')
    expect(formatDateOnly('2024-02-29', 'YYYY-MM-DD')).toBe('2024-02-29')
  })

  it('uses manual date text when provided', () => {
    expect(fieldDisplayValue({ id: 'date', kind: 'date', label: 'Date', date: '2024-02-29', format: 'DD/MM/YYYY', manualText: 'Today' })).toBe('Today')
  })

  it('updates linked placements without changing detached text or geometry', () => {
    const linked = placed('linked', 'linked')
    const detached = detachFieldText(placed('detached', 'linked'))
    const result = updateLinkedFieldText([linked, detached], { id: 'name', kind: 'name', label: 'Full name', value: 'Alex' })
    expect(result[0]).toMatchObject({ text: 'Alex', x: 10, y: 20, fontSize: 12 })
    expect(result[1]).toMatchObject({ text: 'Old', fieldLink: 'independent' })
  })

  it('detaches only when an instance text changes', () => {
    const original = placed('one', 'linked')
    expect(applyPlacedElementEdit(original, { ...original, fontSize: 14 })).toMatchObject({ fieldLink: 'linked', fontSize: 14 })
    expect(applyPlacedElementEdit(original, { ...original, text: 'Custom' })).toMatchObject({ fieldLink: 'independent', text: 'Custom' })
  })

  it('updates linked image placements while preserving their individual size and position', () => {
    const image: PdfImageElement = { id: 'image-1', pageId: 'source-page-0', pageIndex: 0, zIndex: 0, x: 12, y: 24, width: 75, height: 40, rotation: 0, opacity: 1, type: 'image', assetId: 'old', mimeType: 'image/png', fieldId: 'photo', fieldLink: 'linked' }
    const replaced = updateLinkedFieldImage([image], { id: 'photo', kind: 'image', label: 'Photo', assetId: 'new', mimeType: 'image/jpeg', width: 180, height: 120 })[0]
    expect(replaced).toMatchObject({ assetId: 'new', mimeType: 'image/jpeg', x: 12, y: 24, width: 75, height: 40 })
    expect(applyPlacedElementEdit(image, { ...image, assetId: 'manual' })).toMatchObject({ assetId: 'manual', fieldLink: 'independent' })
  })

  it('keeps placed content when its Quick Fill source is removed', () => {
    const text = placed('text', 'linked')
    const image: PdfImageElement = { id: 'image', pageId: 'source-page-0', pageIndex: 0, zIndex: 0, x: 12, y: 24, width: 75, height: 40, rotation: 0, opacity: 1, type: 'image', assetId: 'photo-asset', mimeType: 'image/png', fieldId: 'name', fieldLink: 'linked' }
    expect(unlinkRemovedField([text, image], 'name')).toMatchObject([{ text: 'Old', fieldLink: 'independent' }, { assetId: 'photo-asset', fieldLink: 'independent' }])
  })
})
