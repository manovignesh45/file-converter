'use client'

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import type { PdfFieldDefinition } from '../../types/pdfFields'
import type { PdfDateFormat } from '../../lib/pdf/dateFormatting'
import { fieldDisplayValue, isTextualField } from '../../lib/pdf/fields'
import type { PdfPoint } from '../../types/pdfEditor'

interface DragLocation { pageIndex: number; point: PdfPoint; left: number; top: number; width: number; height: number; fontSize: number }

interface Props {
  fields: PdfFieldDefinition[]
  activeFieldId: string | null
  onSelectField: (id: string) => void
  onDragFieldStart: () => void
  onLocateField: (id: string, clientX: number, clientY: number) => DragLocation | null
  onDropField: (id: string, pageIndex: number, point: PdfPoint) => void
  onChangeField: (field: PdfFieldDefinition) => void
  onToday: (id: string) => void
  scope: 'current' | 'selected' | 'all'
  onScopeChange: (scope: 'current' | 'selected' | 'all') => void
  selectedPages: number[]
  onTogglePage: (index: number) => void
  pageCount: number
  onCreateSignature: () => void
  onDeleteSignature: (id: string) => void
  onRenameSignature: (id: string, name: string) => void
  signatureUrls: Record<string, string>
  savedSignatureIds: string[]
}

export default function QuickFillPanel({ fields, activeFieldId, onSelectField, onDragFieldStart, onLocateField, onDropField, onChangeField, onToday, scope, onScopeChange, selectedPages, onTogglePage, pageCount, onCreateSignature, onDeleteSignature, onRenameSignature, signatureUrls, savedSignatureIds }: Props) {
  const dragPreviewRef = useRef<HTMLDivElement | null>(null)
  const dragGestureRef = useRef<{ field: PdfFieldDefinition; pointerId: number; startX: number; startY: number; started: boolean } | null>(null)
  const suppressClickRef = useRef(false)
  const clearDragPreview = () => {
    dragPreviewRef.current?.remove()
    dragPreviewRef.current = null
    dragGestureRef.current = null
  }
  useEffect(() => () => {
    dragPreviewRef.current?.remove()
  }, [])

  const startPointer = (event: ReactPointerEvent<HTMLDivElement>, field: PdfFieldDefinition) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('input, textarea, select, button')) return
    dragGestureRef.current = { field, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, started: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const movePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = dragGestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    if (!gesture.started && Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) < 5) return
    if (!gesture.started) {
      gesture.started = true
      onDragFieldStart()
      const preview = document.createElement('div')
      preview.className = 'pdf-field-drag-preview'
      if (gesture.field.kind === 'signature' && signatureUrls[gesture.field.assetId]) {
        const image = document.createElement('img')
        image.src = signatureUrls[gesture.field.assetId]
        image.alt = gesture.field.label
        preview.appendChild(image)
      } else {
        const value = document.createElement('span')
        value.textContent = gesture.field.kind === 'checkmark' ? '✓' : gesture.field.kind === 'crossmark' ? '✕' : isTextualField(gesture.field) ? fieldDisplayValue(gesture.field) || gesture.field.label : gesture.field.label
        preview.appendChild(value)
      }
      for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
        const handle = document.createElement('i')
        handle.className = `pdf-field-preview-handle ${corner}`
        preview.appendChild(handle)
      }
      document.body.appendChild(preview)
      dragPreviewRef.current = preview
    }
    event.preventDefault()
    const preview = dragPreviewRef.current
    if (!preview) return
    const location = onLocateField(gesture.field.id, event.clientX, event.clientY)
    preview.classList.toggle('is-on-page', Boolean(location))
    preview.style.transform = `translate3d(${location ? location.left : event.clientX + 12}px, ${location ? location.top : event.clientY + 12}px, 0)`
    preview.style.width = location ? `${location.width}px` : ''
    preview.style.height = location ? `${location.height}px` : ''
    preview.style.fontSize = location ? `${location.fontSize}px` : ''
  }

  const endPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = dragGestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    if (gesture.started) {
      event.preventDefault()
      const location = onLocateField(gesture.field.id, event.clientX, event.clientY)
      if (location) onDropField(gesture.field.id, location.pageIndex, location.point)
      suppressClickRef.current = true
      window.setTimeout(() => { suppressClickRef.current = false }, 0)
    }
    clearDragPreview()
  }

  return <aside id="pdf-quick-fill" className="pdf-fill-panel" aria-label="Quick Fill">
    <h2>Quick Fill</h2>
    {activeFieldId && <p className="mb-3 rounded-lg bg-primary-50 px-3 py-2 text-xs text-primary-800" role="status">Click a page to place {fields.find(field => field.id === activeFieldId)?.label || 'this item'}. Press Escape to cancel.</p>}
    <p className="mb-4">Click a card, then click a page, or drag it onto a page. The placed item stays selected for resizing and moving. Use the controls above selected text to change its size.</p>
    <div className="space-y-3">
      {fields.map(field => <div key={field.id} className={`pdf-field-card ${activeFieldId === field.id ? 'active' : ''}`} role="button" tabIndex={0} aria-label={`Place ${field.label}`} aria-pressed={activeFieldId === field.id}
        onClick={event => { if (suppressClickRef.current) { event.preventDefault(); return }; if (!(event.target as HTMLElement).closest('input, textarea, select, button')) onSelectField(field.id) }}
        onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelectField(field.id) } }}
        onPointerDown={event => startPointer(event, field)} onPointerMove={movePointer} onPointerUp={endPointer} onPointerCancel={clearDragPreview}>
        <div className="flex items-center justify-between gap-2">{field.kind === 'signature' ? <input className="min-w-0 flex-1 text-sm font-semibold" aria-label="Signature name" defaultValue={field.label} onBlur={event => { if (event.target.value.trim() && event.target.value.trim() !== field.label) onRenameSignature(field.id, event.target.value.trim()) }} /> : <strong className="text-sm text-gray-800">{field.label}</strong>}</div>
        {field.kind === 'date' ? <div className="mt-2 space-y-2">
          <input aria-label="Date" type="date" value={field.date} onChange={event => onChangeField({ ...field, date: event.target.value })} />
          <select aria-label="Date format" value={field.format} onChange={event => onChangeField({ ...field, format: event.target.value as PdfDateFormat })}><option>DD/MM/YYYY</option><option>DD-MM-YYYY</option><option>YYYY-MM-DD</option><option>DD MMM YYYY</option></select>
          <input aria-label="Manual date text" placeholder="Manual display text (optional)" value={field.manualText ?? ''} onChange={event => onChangeField({ ...field, manualText: event.target.value || undefined })} />
          <button className="text-xs font-semibold text-primary-700" onClick={() => onToday(field.id)}>Use today</button>
        </div> : 'value' in field ? <textarea className="mt-2" aria-label={field.label} rows={field.kind === 'address' ? 2 : 1} value={field.value} onChange={event => onChangeField({ ...field, value: event.target.value })} /> : field.kind === 'signature' ? <div className="mt-2"><div role="img" aria-label={`${field.label} preview`} className="h-14 w-full bg-contain bg-center bg-no-repeat" style={{ backgroundImage: signatureUrls[field.assetId] ? `url(${signatureUrls[field.assetId]})` : undefined }} /><div className="mt-1 flex justify-between gap-2"><span className="text-xs">{savedSignatureIds.includes(field.id) ? 'Saved in this browser' : 'This session only'}</span><button className="text-xs text-red-700" onClick={() => onDeleteSignature(field.id)}>Remove</button></div></div> : <p className="mt-2 text-xs">Vector mark</p>}
      </div>)}
    </div>
    <button className="btn-secondary mt-4 w-full" onClick={onCreateSignature}>Create signature</button>
    <div className="mt-5 border-t border-gray-200 pt-4">
      <label className="pdf-property-field">Place on
        <select value={scope} onChange={event => onScopeChange(event.target.value as Props['scope'])}><option value="current">Clicked page</option><option value="selected">Selected pages</option><option value="all">All pages</option></select>
      </label>
      {scope === 'selected' && <div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto">{Array.from({ length: pageCount }, (_, index) => <label key={index} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={selectedPages.includes(index)} onChange={() => onTogglePage(index)} />{index + 1}</label>)}</div>}
    </div>
  </aside>
}
