import type { PdfEditorElement, PdfTextElement } from '../../types/pdfEditor'
import type { DateFieldDefinition, ImageFieldDefinition, PdfFieldDefinition, TextFieldDefinition } from '../../types/pdfFields'
import { formatDateOnly } from './dateFormatting'
export type { PdfFieldDefinition, TextFieldDefinition, DateFieldDefinition, ImageFieldDefinition, SignatureFieldDefinition, MarkFieldDefinition, PdfFieldKind } from '../../types/pdfFields'

export type LinkedTextElement = PdfTextElement

export function isTextualField(field: PdfFieldDefinition): field is TextFieldDefinition | DateFieldDefinition {
  return field.kind === 'date' || 'value' in field
}

export function createCommonFields(id: () => string): import('../../types/pdfFields').PdfFieldDefinition[] {
  return [
    { id: id(), kind: 'custom', label: 'Full name', value: '' },
    { id: id(), kind: 'custom', label: 'Address', value: '' },
    { id: id(), kind: 'custom', label: 'Place', value: '' },
    { id: id(), kind: 'custom', label: 'Date', value: '' },
    { id: id(), kind: 'custom', label: 'Initials', value: '' },
  ]
}

export function fieldDisplayValue(field: TextFieldDefinition | DateFieldDefinition): string {
  if (field.kind !== 'date') return field.value
  if (field.manualText !== undefined) return field.manualText
  return field.date ? formatDateOnly(field.date, field.format) : ''
}

/** Replaces only linked text content. Position, size and styling belong to each placement. */
export function updateLinkedFieldText(elements: PdfEditorElement[], field: TextFieldDefinition | DateFieldDefinition): PdfEditorElement[] {
  const value = fieldDisplayValue(field)
  return elements.map(element => {
    if (element.type !== 'text') return element
    const placed = element as LinkedTextElement
    return placed.fieldId === field.id && placed.fieldLink === 'linked'
      ? { ...placed, text: value }
      : element
  })
}

export function updateLinkedFieldImage(elements: PdfEditorElement[], field: ImageFieldDefinition): PdfEditorElement[] {
  return elements.map(element => element.type === 'image' && element.fieldId === field.id && element.fieldLink === 'linked'
    ? { ...element, assetId: field.assetId, mimeType: field.mimeType }
    : element)
}

export function unlinkRemovedField(elements: PdfEditorElement[], fieldId: string): PdfEditorElement[] {
  return elements.map(element => (element.type === 'text' || element.type === 'image') && element.fieldId === fieldId
    ? { ...element, fieldLink: 'independent' }
    : element)
}

export function detachFieldText(element: LinkedTextElement): LinkedTextElement {
  return { ...element, fieldLink: 'independent' }
}

export function applyPlacedElementEdit(original: PdfEditorElement, updated: PdfEditorElement): PdfEditorElement {
  if (original.type === 'text' && updated.type === 'text' && original.fieldLink === 'linked' && original.text !== updated.text) return detachFieldText(updated)
  if (original.type === 'image' && updated.type === 'image' && original.fieldLink === 'linked' && original.assetId !== updated.assetId) return { ...updated, fieldLink: 'independent' }
  return updated
}
