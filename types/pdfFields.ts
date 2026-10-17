import type { PdfDateFormat } from '../lib/pdf/dateFormatting'

export type PdfFieldKind = 'name' | 'address' | 'place' | 'date' | 'custom' | 'initials' | 'image' | 'signature' | 'checkmark' | 'crossmark'

interface FieldBase { id: string; kind: PdfFieldKind; label: string }
export interface TextFieldDefinition extends FieldBase {
  kind: 'name' | 'address' | 'place' | 'custom' | 'initials'
  value: string
}
export interface DateFieldDefinition extends FieldBase {
  kind: 'date'
  date: string
  format: PdfDateFormat
  manualText?: string
}
export interface SignatureFieldDefinition extends FieldBase {
  kind: 'signature'
  assetId: string
  mimeType: 'image/png' | 'image/jpeg'
}
export interface ImageFieldDefinition extends FieldBase {
  kind: 'image'
  assetId: string
  mimeType: 'image/png' | 'image/jpeg'
  width: number
  height: number
}
export interface MarkFieldDefinition extends FieldBase {
  kind: 'checkmark' | 'crossmark'
}
export type PdfFieldDefinition = TextFieldDefinition | DateFieldDefinition | ImageFieldDefinition | SignatureFieldDefinition | MarkFieldDefinition
