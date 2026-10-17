import type { PdfEditorElement, PdfTextElement } from '../../types/pdfEditor'
import type { DateFieldDefinition, PdfFieldDefinition, TextFieldDefinition } from '../../types/pdfFields'
import { formatDateOnly } from './dateFormatting'
export type { PdfFieldDefinition, TextFieldDefinition, DateFieldDefinition, SignatureFieldDefinition, MarkFieldDefinition, PdfFieldKind } from '../../types/pdfFields'

export type LinkedTextElement = PdfTextElement

export function isTextualField(field: PdfFieldDefinition): field is TextFieldDefinition | DateFieldDefinition {
  return field.kind === 'date' || 'value' in field
}

export function createDefaultFields(id: () => string): import('../../types/pdfFields').PdfFieldDefinition[] {
  return [
    { id: id(), kind: 'name', label: 'Full name', value: '' },
    { id: id(), kind: 'address', label: 'Address', value: '' },
    { id: id(), kind: 'place', label: 'Place', value: '' },
    { id: id(), kind: 'date', label: 'Date', date: '', format: 'DD/MM/YYYY' },
    { id: id(), kind: 'custom', label: 'Custom text', value: '' },
    { id: id(), kind: 'initials', label: 'Initials', value: '' },
    { id: id(), kind: 'checkmark', label: 'Checkmark' },
    { id: id(), kind: 'crossmark', label: 'Cross mark' },
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

export function detachFieldText(element: LinkedTextElement): LinkedTextElement {
  return { ...element, fieldLink: 'independent' }
}

export function applyPlacedElementEdit(original: PdfEditorElement, updated: PdfEditorElement): PdfEditorElement {
  return original.type === 'text' && updated.type === 'text' && original.fieldLink === 'linked' && original.text !== updated.text
    ? detachFieldText(updated)
    : updated
}
