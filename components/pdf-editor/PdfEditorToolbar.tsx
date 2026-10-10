'use client'

import {
  Circle,
  Highlighter,
  ImagePlus,
  MousePointer2,
  MoveDown,
  MoveUp,
  Pencil,
  Redo2,
  Slash,
  Square,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
  ArrowUpRight,
} from 'lucide-react'
import type { PdfEditorTool } from '../../types/pdfEditor'

const tools: Array<{ value: PdfEditorTool; label: string; icon: typeof MousePointer2 }> = [
  { value: 'select', label: 'Select', icon: MousePointer2 },
  { value: 'text', label: 'Text', icon: Type },
  { value: 'image', label: 'Image', icon: ImagePlus },
  { value: 'rectangle', label: 'Rectangle', icon: Square },
  { value: 'ellipse', label: 'Ellipse', icon: Circle },
  { value: 'line', label: 'Line', icon: Slash },
  { value: 'arrow', label: 'Arrow', icon: ArrowUpRight },
  { value: 'draw', label: 'Draw', icon: Pencil },
  { value: 'highlight', label: 'Highlight', icon: Highlighter },
]

interface PdfEditorToolbarProps {
  tool: PdfEditorTool
  onToolChange: (tool: PdfEditorTool) => void
  onImageRequest: () => void
  zoom: number
  onZoomChange: (zoom: number) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onDelete: () => void
  canDelete: boolean
  onReorder: (direction: 'forward' | 'backward') => void
}

export default function PdfEditorToolbar({
  tool,
  onToolChange,
  onImageRequest,
  zoom,
  onZoomChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onDelete,
  canDelete,
  onReorder,
}: PdfEditorToolbarProps) {
  return (
    <>
      <div className="pdf-editor-commandbar">
        <div className="flex items-center gap-1">
          <button className="pdf-icon-button" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)"><Undo2 /></button>
          <button className="pdf-icon-button" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)"><Redo2 /></button>
          <span className="mx-1 h-6 w-px bg-gray-200" />
          <button className="pdf-icon-button" onClick={() => onZoomChange(Math.max(0.5, zoom - 0.1))} title="Zoom out"><ZoomOut /></button>
          <span className="min-w-14 text-center text-sm font-semibold text-gray-700">{Math.round(zoom * 100)}%</span>
          <button className="pdf-icon-button" onClick={() => onZoomChange(Math.min(2.5, zoom + 0.1))} title="Zoom in"><ZoomIn /></button>
        </div>
        <div className="flex items-center gap-1">
          <button className="pdf-icon-button" onClick={() => onReorder('backward')} disabled={!canDelete} title="Send backward"><MoveDown /></button>
          <button className="pdf-icon-button" onClick={() => onReorder('forward')} disabled={!canDelete} title="Bring forward"><MoveUp /></button>
          <button className="pdf-icon-button text-red-600" onClick={onDelete} disabled={!canDelete} title="Delete selected"><Trash2 /></button>
        </div>
      </div>

      <div className="pdf-editor-toolrail" aria-label="PDF editing tools">
        {tools.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            className={`pdf-tool-button ${tool === value ? 'active' : ''}`}
            onClick={() => value === 'image' ? onImageRequest() : onToolChange(value)}
            aria-pressed={tool === value}
            title={label}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </>
  )
}

