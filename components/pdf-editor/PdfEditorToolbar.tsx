'use client'

import { ArrowUpRight, Circle, Copy, Highlighter, ImagePlus, MousePointer2, Pencil, Redo2, Slash, Square, TextCursorInput, Trash2, Type, Undo2 } from 'lucide-react'
import type { PdfEditorElement, PdfEditorTool, PdfFontFamily } from '../../types/pdfEditor'

export const editorTools: Array<{ value: PdfEditorTool; label: string; shortcut: string; icon: typeof MousePointer2 }> = [
  { value: 'select', label: 'Select', shortcut: 'V', icon: MousePointer2 },
  { value: 'editText', label: 'Edit text', shortcut: 'E', icon: TextCursorInput },
  { value: 'text', label: 'Text', shortcut: 'T', icon: Type },
  { value: 'image', label: 'Image', shortcut: 'I', icon: ImagePlus },
  { value: 'rectangle', label: 'Rectangle', shortcut: 'R', icon: Square },
  { value: 'ellipse', label: 'Ellipse', shortcut: 'O', icon: Circle },
  { value: 'line', label: 'Line', shortcut: 'L', icon: Slash },
  { value: 'arrow', label: 'Arrow', shortcut: 'A', icon: ArrowUpRight },
  { value: 'draw', label: 'Draw', shortcut: 'D', icon: Pencil },
  { value: 'highlight', label: 'Highlight', shortcut: 'H', icon: Highlighter },
]

const toolHints: Partial<Record<PdfEditorTool, string>> = {
  select: 'Click an item to select it. Double-click text to edit it.',
  editText: 'Click any line of PDF text to change it. Press Enter to apply, Esc to cancel.',
  text: 'Click on the page to add a text box.',
  rectangle: 'Click on the page to add a rectangle.',
  ellipse: 'Click on the page to add an ellipse.',
  line: 'Click on the page to add a line.',
  arrow: 'Click on the page to add an arrow.',
  draw: 'Drag on the page to draw.',
  highlight: 'Select text, or drag across an area, to highlight it.',
}

interface Props {
  tool: PdfEditorTool
  onToolChange: (tool: PdfEditorTool) => void
  onImageRequest: () => void
  onReplaceImage: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onDelete: () => void
  onDuplicate: () => void
  selectedElement: PdfEditorElement | null
  onElementChange: (element: PdfEditorElement) => void
  onAdvanced: () => void
  advancedOpen: boolean
  drawColor: string
  drawWidth: number
  highlightColor: string
  onDefaultsChange: (values: { drawColor?: string; drawWidth?: number; highlightColor?: string }) => void
}

export default function PdfEditorToolbar({ tool, onToolChange, onImageRequest, onReplaceImage, onUndo, onRedo, canUndo, canRedo, onDelete, onDuplicate, selectedElement, onElementChange, onAdvanced, advancedOpen, drawColor, drawWidth, highlightColor, onDefaultsChange }: Props) {
  const update = (changes: Partial<PdfEditorElement>) => {
    if (selectedElement) onElementChange({ ...selectedElement, ...changes } as PdfEditorElement)
  }
  const color = selectedElement && ('color' in selectedElement ? selectedElement.color : 'strokeColor' in selectedElement ? selectedElement.strokeColor : null)
  const hint = !selectedElement && tool !== 'draw' ? toolHints[tool] : undefined
  return (
    <div className="pdf-editor-toolbar">
      <div className="pdf-editor-tools" role="toolbar" aria-label="PDF editing tools">
        {editorTools.map(({ value, label, shortcut, icon: Icon }) => (
          <button key={value} className={`pdf-tool-button ${tool === value ? 'active' : ''}`} onClick={() => value === 'image' ? onImageRequest() : onToolChange(value)} aria-pressed={tool === value} aria-keyshortcuts={shortcut} title={`${label} (${shortcut})`} aria-label={label}><Icon /><span className="pdf-tool-label">{label}</span></button>
        ))}
      </div>
      <div className="pdf-toolbar-divider" aria-hidden="true" />
      {/* Fixed height and horizontal scrolling keep the page from jumping as options change. */}
      <div className="pdf-editor-context" aria-label="Selected object formatting">
        {hint && <span className="pdf-toolbar-hint">{hint}</span>}
        {tool === 'draw' && !selectedElement && <><label className="pdf-toolbar-color">Draw color <input aria-label="Drawing color" type="color" value={drawColor} onChange={event => onDefaultsChange({ drawColor: event.target.value })} /></label><label className="pdf-toolbar-color">Width <input aria-label="Drawing width" className="pdf-toolbar-number" type="number" min="1" max="20" value={drawWidth} onChange={event => onDefaultsChange({ drawWidth: Number(event.target.value) })} /></label></>}
        {tool === 'highlight' && !selectedElement && <label className="pdf-toolbar-color">Color <input aria-label="Highlight color" type="color" value={highlightColor} onChange={event => onDefaultsChange({ highlightColor: event.target.value })} /></label>}
        {selectedElement?.type === 'text' && <>
          <select aria-label="Font family" value={selectedElement.fontFamily} onChange={event => update({ fontFamily: event.target.value as PdfFontFamily })}><option value="Helvetica">Helvetica</option><option value="TimesRoman">Times</option><option value="Courier">Courier</option><option value="NotoSans">Noto Sans</option></select>
          <input aria-label="Font size" className="w-16" type="number" min="4" max="500" value={selectedElement.fontSize} onChange={event => update({ fontSize: Number(event.target.value) })} />
          <button className={`pdf-style-toggle ${selectedElement.bold ? 'active' : ''}`} aria-pressed={selectedElement.bold} aria-label="Bold" title="Bold" onClick={() => update({ bold: !selectedElement.bold })}>B</button>
          <button className={`pdf-style-toggle italic ${selectedElement.italic ? 'active' : ''}`} aria-pressed={selectedElement.italic} aria-label="Italic" title="Italic" onClick={() => update({ italic: !selectedElement.italic })}>I</button>
          <button className={`pdf-style-toggle underline ${selectedElement.underline ? 'active' : ''}`} aria-pressed={selectedElement.underline} aria-label="Underline" title="Underline" onClick={() => update({ underline: !selectedElement.underline })}>U</button>
        </>}
        {color && <label className="pdf-toolbar-color">Color <input type="color" value={color} onChange={event => update('strokeColor' in selectedElement! ? { strokeColor: event.target.value } : { color: event.target.value })} /></label>}
        {selectedElement && 'strokeWidth' in selectedElement && <label className="pdf-toolbar-color">Stroke <input aria-label="Stroke width" className="pdf-toolbar-number" type="number" min="0" max="100" step="0.5" value={selectedElement.strokeWidth} onChange={event => update({ strokeWidth: Number(event.target.value) })} /></label>}
        {selectedElement && 'fillColor' in selectedElement && <label className="pdf-toolbar-color">Fill <input type="color" value={selectedElement.fillColor || '#ffffff'} onChange={event => update({ fillColor: event.target.value })} /></label>}
        {selectedElement?.type === 'image' && <button className="pdf-style-toggle" onClick={onReplaceImage}>Replace image</button>}
        {selectedElement && <>
          <button className="pdf-icon-button" onClick={onDuplicate} title="Duplicate (Ctrl+D)" aria-label="Duplicate selected"><Copy /></button>
          <button className="pdf-icon-button text-red-600" onClick={onDelete} title="Delete (Del)" aria-label="Delete selected"><Trash2 /></button>
        </>}
        {selectedElement && <button className={`pdf-style-toggle ${advancedOpen ? 'active' : ''}`} aria-expanded={advancedOpen} aria-controls="pdf-advanced-options" onClick={onAdvanced}>More options</button>}
      </div>
      <div className="pdf-editor-commandbar">
        <button className="pdf-icon-button" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo"><Undo2 /></button>
        <button className="pdf-icon-button" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo"><Redo2 /></button>
      </div>
    </div>
  )
}
