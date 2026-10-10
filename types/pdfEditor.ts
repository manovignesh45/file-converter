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

export type PdfFontFamily = 'Helvetica' | 'TimesRoman' | 'Courier'

export interface PdfPoint {
  x: number
  y: number
}

interface PdfElementBase {
  id: string
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
}

export interface PdfImageElement extends PdfElementBase {
  type: 'image'
  assetId: string
  mimeType: 'image/png' | 'image/jpeg'
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

export type PdfEditorElement =
  | PdfTextElement
  | PdfImageElement
  | PdfShapeElement
  | PdfLineElement
  | PdfDrawingElement
  | PdfHighlightElement

export interface PdfPageInfo {
  pageIndex: number
  width: number
  height: number
  rotation: number
}

export interface PdfEditPayload {
  version: 1
  pages: PdfPageInfo[]
  elements: PdfEditorElement[]
}

export type PdfAssetMap = Record<string, File>

