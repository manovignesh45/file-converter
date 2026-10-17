import type { PdfFieldDefinition } from './pdfFields'

export type PdfEditorTool =
  | 'select'
  | 'text'
  | 'image'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'draw'
  | 'highlight'

export type PdfFontFamily = 'Helvetica' | 'TimesRoman' | 'Courier' | 'NotoSans'

export interface PdfPoint {
  x: number
  y: number
}

interface PdfElementBase {
  id: string
  /** Stable editor page identity; pageIndex remains the legacy export coordinate. */
  pageId?: string
  pageIndex: number
  zIndex: number
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
}

export interface PdfTextElement extends PdfElementBase {
  type: 'text'
  text: string
  fontFamily: PdfFontFamily
  fontSize: number
  color: string
  bold: boolean
  italic: boolean
  underline: boolean
  fieldId?: string
  fieldLink?: 'linked' | 'independent'
  textAlign?: 'left' | 'center' | 'right'
  singleLine?: boolean
  autoFit?: boolean
  minFontSize?: number
  exportLayout?: { lines: string[]; fontSize: number }
}

export interface PdfImageElement extends PdfElementBase {
  type: 'image'
  assetId: string
  mimeType: 'image/png' | 'image/jpeg'
  signatureId?: string
  fieldId?: string
  fieldLink?: 'linked' | 'independent'
}

export interface PdfShapeElement extends PdfElementBase {
  type: 'rectangle' | 'ellipse'
  strokeColor: string
  fillColor: string | null
  strokeWidth: number
}

export interface PdfLineElement extends PdfElementBase {
  type: 'line' | 'arrow'
  strokeColor: string
  strokeWidth: number
}

export interface PdfDrawingElement extends PdfElementBase {
  type: 'drawing'
  points: PdfPoint[]
  color: string
  strokeWidth: number
}

export interface PdfHighlightElement extends PdfElementBase {
  type: 'highlight'
  color: string
}

export interface PdfSymbolElement extends PdfElementBase {
  type: 'checkmark' | 'crossmark'
  strokeColor: string
  strokeWidth: number
  fieldId?: string
}

export type PdfEditorElement =
  | PdfTextElement
  | PdfImageElement
  | PdfShapeElement
  | PdfLineElement
  | PdfDrawingElement
  | PdfHighlightElement
  | PdfSymbolElement

export interface PdfPageInfo {
  pageIndex: number
  width: number
  height: number
  rotation: number
}

export interface PdfDocumentPage extends PdfPageInfo {
  id: string
  sourcePageIndex: number
  bounds: [number, number, number, number]
}

export interface PdfEditorDocument {
  id: string
  name: string
  pages: PdfDocumentPage[]
  elements: PdfEditorElement[]
  fields: PdfFieldDefinition[]
}

export interface PdfEditPayload {
  version: 1
  pages: PdfPageInfo[]
  elements: PdfEditorElement[]
}

export type PdfAssetMap = Record<string, File>

