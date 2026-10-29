'use client'

import { ArrowUpRight, Circle, Copy, Highlighter, ImagePlus, MousePointer2, MoveDown, MoveUp, Pencil, Redo2, Slash, Square, TextCursorInput, Trash2, Type, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import type { PdfEditorElement, PdfEditorTool, PdfFontFamily } from '../../types/pdfEditor'

const tools: Array<{ value: PdfEditorTool; label: string; icon: typeof MousePointer2 }> = [
  { value: 'select', label: 'Select', icon: MousePointer2 },
  { value: 'editText', label: 'Edit text', icon: TextCursorInput },
  { value: 'text', label: 'Text', icon: Type },
  { value: 'image', label: 'Image', icon: ImagePlus },
  { value: 'rectangle', label: 'Rectangle', icon: Square },
  { value: 'ellipse', label: 'Ellipse', icon: Circle },
  { value: 'line', label: 'Line', icon: Slash },
  { value: 'arrow', label: 'Arrow', icon: ArrowUpRight },
  { value: 'draw', label: 'Draw', icon: Pencil },
  { value: 'highlight', label: 'Highlight', icon: Highlighter },
]

interface Props {
  tool: PdfEditorTool
  onToolChange: (tool: PdfEditorTool) => void
  onImageRequest: () => void
  onReplaceImage: () => void
  zoom: number
  onZoomChange: (zoom: number) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onDelete: () => void
  onDuplicate: () => void
  onReorder: (direction: 'forward' | 'backward') => void
  selectedElement: PdfEditorElement | null
  onElementChange: (element: PdfEditorElement) => void
  onAdvanced: () => void
  advancedOpen: boolean
  quickFillOpen: boolean
  onQuickFillToggle: () => void
  drawColor: string
  drawWidth: number
  highlightColor: string
  onDefaultsChange: (values: { drawColor?: string; drawWidth?: number; highlightColor?: string }) => void
}

export default function PdfEditorToolbar({ tool, onToolChange, onImageRequest, onReplaceImage, zoom, onZoomChange, onUndo, onRedo, canUndo, canRedo, onDelete, onDuplicate, onReorder, selectedElement, onElementChange, onAdvanced, advancedOpen, quickFillOpen, onQuickFillToggle, drawColor, drawWidth, highlightColor, onDefaultsChange }: Props) {
  const update = (changes: Partial<PdfEditorElement>) => {
    if (selectedElement) onElementChange({ ...selectedElement, ...changes } as PdfEditorElement)
  }
  const color = selectedElement && ('color' in selectedElement ? selectedElement.color : 'strokeColor' in selectedElement ? selectedElement.strokeColor : null)
  return (
    <div className="pdf-editor-toolbar">
      <div className="pdf-editor-tools" aria-label="PDF editing tools">
        {tools.map(({ value, label, icon: Icon }) => (
          <button key={value} className={`pdf-tool-button ${tool === value ? 'active' : ''}`} onClick={() => value === 'image' ? onImageRequest() : onToolChange(value)} aria-pressed={tool === value} title={label} aria-label={label}><Icon /><span>{label}</span></button>
        ))}
      </div>
      <div className="pdf-editor-context" aria-label="Selected object formatting">
        {tool === 'draw' && <><label className="pdf-toolbar-color">Draw color <input aria-label="Drawing color" type="color" value={drawColor} onChange={event => onDefaultsChange({ drawColor: event.target.value })} /></label><label className="pdf-toolbar-color">Width <input aria-label="Drawing width" className="pdf-toolbar-number" type="number" min="1" max="20" value={drawWidth} onChange={event => onDefaultsChange({ drawWidth: Number(event.target.value) })} /></label></>}
        {tool === 'editText' && !selectedElement && <span className="pdf-toolbar-hint">Click any line of PDF text to change it. Press Enter to apply, Esc to cancel.</span>}
        {tool === 'highlight' && <label className="pdf-toolbar-color">Highlight color <input aria-label="Highlight color" type="color" value={highlightColor} onChange={event => onDefaultsChange({ highlightColor: event.target.value })} /></label>}
        {selectedElement?.type === 'text' && <>
          <select aria-label="Font family" value={selectedElement.fontFamily} onChange={event => update({ fontFamily: event.target.value as PdfFontFamily })}><option value="Helvetica">Helvetica</option><option value="TimesRoman">Times</option><option value="Courier">Courier</option><option value="NotoSans">Noto Sans</option></select>
          <input aria-label="Font size" className="w-16" type="number" min="4" max="500" value={selectedElement.fontSize} onChange={event => update({ fontSize: Number(event.target.value) })} />
          <button className={`pdf-style-toggle ${selectedElement.bold ? 'active' : ''}`} aria-pressed={selectedElement.bold} onClick={() => update({ bold: !selectedElement.bold })}>B</button>
          <button className={`pdf-style-toggle italic ${selectedElement.italic ? 'active' : ''}`} aria-pressed={selectedElement.italic} onClick={() => update({ italic: !selectedElement.italic })}>I</button>
          <button className={`pdf-style-toggle underline ${selectedElement.underline ? 'active' : ''}`} aria-pressed={selectedElement.underline} onClick={() => update({ underline: !selectedElement.underline })}>U</button>
        </>}
        {color && <label className="pdf-toolbar-color">Color <input type="color" value={color} onChange={event => update('strokeColor' in selectedElement! ? { strokeColor: event.target.value } : { color: event.target.value })} /></label>}
        {selectedElement && 'strokeWidth' in selectedElement && <label className="pdf-toolbar-color">Stroke <input aria-label="Stroke width" className="pdf-toolbar-number" type="number" min="0" max="100" step="0.5" value={selectedElement.strokeWidth} onChange={event => update({ strokeWidth: Number(event.target.value) })} /></label>}
        {selectedElement && 'fillColor' in selectedElement && <label className="pdf-toolbar-color">Fill <input type="color" value={selectedElement.fillColor || '#ffffff'} onChange={event => update({ fillColor: event.target.value })} /></label>}
        {selectedElement?.type === 'image' && <button className="pdf-style-toggle" onClick={onReplaceImage}>Replace image</button>}
        {selectedElement && <>
          <label className="pdf-toolbar-opacity">Opacity <input type="range" min="0.05" max="1" step="0.05" value={selectedElement.opacity} onChange={event => update({ opacity: Number(event.target.value) })} /><span>{Math.round(selectedElement.opacity * 100)}%</span></label>
          <button className="pdf-icon-button" onClick={onDuplicate} title="Duplicate selected" aria-label="Duplicate selected"><Copy /></button>
          <button className="pdf-icon-button" onClick={() => onReorder('backward')} title="Send backward" aria-label="Send backward"><MoveDown /></button>
          <button className="pdf-icon-button" onClick={() => onReorder('forward')} title="Bring forward" aria-label="Bring forward"><MoveUp /></button>
          <button className="pdf-icon-button text-red-600" onClick={onDelete} title="Delete selected" aria-label="Delete selected"><Trash2 /></button>
        </>}
        <button className={`pdf-style-toggle ${advancedOpen ? 'active' : ''}`} aria-expanded={advancedOpen} aria-controls="pdf-advanced-options" onClick={onAdvanced}>More options</button>
      </div>
      <div className="pdf-editor-commandbar">
        <button className={`pdf-style-toggle ${quickFillOpen ? 'active' : ''}`} aria-expanded={quickFillOpen} aria-controls="pdf-quick-fill" onClick={onQuickFillToggle}>Quick Fill</button>
        <button className="pdf-icon-button" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo"><Undo2 /></button>
        <button className="pdf-icon-button" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo"><Redo2 /></button>
        <button className="pdf-icon-button" onClick={() => onZoomChange(Math.max(0.5, zoom - 0.1))} title="Zoom out" aria-label="Zoom out"><ZoomOut /></button>
        <span className="min-w-12 text-center text-sm">{Math.round(zoom * 100)}%</span>
        <button className="pdf-icon-button" onClick={() => onZoomChange(Math.min(2.5, zoom + 0.1))} title="Zoom in" aria-label="Zoom in"><ZoomIn /></button>
      </div>
    </div>
  )
}
