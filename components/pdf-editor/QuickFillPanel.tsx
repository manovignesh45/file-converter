'use client'

import { useEffect, useRef, useState, type DragEvent as ReactDragEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { PdfFieldDefinition } from '../../types/pdfFields'
import { fieldDisplayValue, isTextualField } from '../../lib/pdf/fields'
import type { PdfPoint } from '../../types/pdfEditor'

interface DragLocation { pageIndex: number; point: PdfPoint; left: number; top: number; width: number; height: number; fontSize: number }

interface Props {
  fields: PdfFieldDefinition[]
  activeFieldId: string | null
  focusFieldId: string | null
  width: number
  onWidthChange: (width: number) => void
  thumbnailsOpen: boolean
  onSelectField: (id: string) => void
  onDragFieldStart: () => void
  onLocateField: (id: string, clientX: number, clientY: number) => DragLocation | null
  onDropField: (id: string, pageIndex: number, point: PdfPoint) => void
  onChangeField: (field: PdfFieldDefinition) => void
  onCreateText: () => string
  onCreateCommon: () => void
  onCreateMark: (kind: 'checkmark' | 'crossmark') => void
  onAddImage: (file: File, replaceFieldId?: string) => Promise<void>
  onRemoveField: (id: string) => Promise<void>
  onRenameField: (id: string, name: string) => Promise<void>
  onMoveField: (id: string, direction: -1 | 1) => void
  scope: 'current' | 'selected' | 'all'
  onScopeChange: (scope: 'current' | 'selected' | 'all') => void
  selectedPages: number[]
  onTogglePage: (index: number) => void
  pageCount: number
  onCreateSignature: (file?: File) => void
  signatureUrls: Record<string, string>
  savedSignatureIds: string[]
}

export default function QuickFillPanel({ fields, activeFieldId, focusFieldId, width, onWidthChange, thumbnailsOpen, onSelectField, onDragFieldStart, onLocateField, onDropField, onChangeField, onCreateText, onCreateCommon, onCreateMark, onAddImage, onRemoveField, onRenameField, onMoveField, scope, onScopeChange, selectedPages, onTogglePage, pageCount, onCreateSignature, signatureUrls, savedSignatureIds }: Props) {
  const panelRef = useRef<HTMLElement>(null)
  const dragPreviewRef = useRef<HTMLDivElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const labelInputRef = useRef<HTMLInputElement>(null)
  const replaceImageFieldRef = useRef<string | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null)
  const [fileDropTarget, setFileDropTarget] = useState<'image' | 'signature' | null>(null)
  const resizeRef = useRef<{ pointerId: number; startX: number; startWidth: number; lastWidth: number; min: number; max: number } | null>(null)
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
  useEffect(() => {
    if (!focusFieldId) return
    setSearch('')
    setEditingLabelId(focusFieldId)
  }, [focusFieldId])
  useEffect(() => {
    if (!editingLabelId || !labelInputRef.current) return
    labelInputRef.current.focus()
    labelInputRef.current.select()
    labelInputRef.current.scrollIntoView({ block: 'nearest' })
  }, [editingLabelId])

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
      if ((gesture.field.kind === 'signature' || gesture.field.kind === 'image') && signatureUrls[gesture.field.assetId]) {
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

  const filteredFields = fields.filter(field => `${field.label} ${isTextualField(field) ? fieldDisplayValue(field) : ''}`.toLowerCase().includes(search.toLowerCase()))
  const chooseImage = (replaceFieldId?: string) => {
    replaceImageFieldRef.current = replaceFieldId
    imageInputRef.current?.click()
  }
  const enterFileTarget = (event: ReactDragEvent<HTMLButtonElement>, target: 'image' | 'signature') => {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setFileDropTarget(target)
  }
  const dropFile = (event: ReactDragEvent<HTMLButtonElement>, target: 'image' | 'signature') => {
    event.preventDefault()
    setFileDropTarget(null)
    const file = event.dataTransfer.files[0]
    if (!file) return
    if (target === 'image') void onAddImage(file)
    else onCreateSignature(file)
  }
  const leaveFileTarget = (event: ReactDragEvent<HTMLButtonElement>) => {
    if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setFileDropTarget(null)
  }
  const widthBounds = () => {
    const bodyWidth = panelRef.current?.parentElement?.getBoundingClientRect().width ?? window.innerWidth
    const mobile = window.matchMedia('(max-width: 767px)').matches
    const thumbnailWidth = mobile || !thumbnailsOpen ? 0 : panelRef.current?.parentElement?.querySelector('.pdf-thumbnail-sidebar')?.getBoundingClientRect().width ?? 0
    const max = Math.max(1, Math.floor(Math.min(928, mobile ? bodyWidth * 0.92 : bodyWidth - thumbnailWidth - 320)))
    return { min: Math.min(288, max), max }
  }
  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !panelRef.current) return
    event.preventDefault()
    const startWidth = panelRef.current.getBoundingClientRect().width
    resizeRef.current = { pointerId: event.pointerId, startX: event.clientX, startWidth, lastWidth: startWidth, ...widthBounds() }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const resize = resizeRef.current
    if (!resize || resize.pointerId !== event.pointerId || !panelRef.current) return
    const next = Math.round(Math.max(resize.min, Math.min(resize.max, resize.startWidth + resize.startX - event.clientX)))
    resize.lastWidth = next
    panelRef.current.style.width = `${next}px`
  }
  const endResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const resize = resizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    resizeRef.current = null
    onWidthChange(resize.lastWidth)
  }
  const resizeWithKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const delta = event.key === 'ArrowLeft' ? 32 : event.key === 'ArrowRight' ? -32 : 0
    if (!delta || !panelRef.current) return
    event.preventDefault()
    const { min, max } = widthBounds()
    onWidthChange(Math.round(Math.max(min, Math.min(max, panelRef.current.getBoundingClientRect().width + delta))))
  }

  return <aside ref={panelRef} id="pdf-quick-fill" className="pdf-fill-panel" data-thumbnails={thumbnailsOpen ? 'open' : 'closed'} style={{ width }} aria-label="Quick Fill">
    <div className="pdf-fill-resize-handle" role="separator" aria-label="Resize Quick Fill" aria-orientation="vertical" aria-valuemin={288} aria-valuemax={928} aria-valuenow={width} tabIndex={0} title="Drag to resize Quick Fill" onPointerDown={startResize} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize} onKeyDown={resizeWithKeyboard} onDoubleClick={() => onWidthChange(288)}><span aria-hidden="true">⋮</span></div>
    <h2>Quick Fill</h2>
    {activeFieldId && <p className="mb-3 rounded-lg bg-primary-50 px-3 py-2 text-xs text-primary-800" role="status">Click a page to place {fields.find(field => field.id === activeFieldId)?.label || 'this item'}. Press Escape to cancel.</p>}
    <p className="mb-3">Keep values here while editing this PDF. Click a card and then a page, or drag a card onto a page. Adjust the placed item there.</p>
    <div className="mb-3 space-y-2">
      <button type="button" className="btn-secondary w-full text-xs" onClick={onCreateText}>+ Text</button>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={`btn-secondary min-h-20 flex-col border-dashed text-xs ${fileDropTarget === 'image' ? 'border-primary-500 bg-primary-50' : ''}`} onClick={() => chooseImage()} onDragOver={event => enterFileTarget(event, 'image')} onDragLeave={leaveFileTarget} onDrop={event => dropFile(event, 'image')}><span>+ Image</span><span className="mt-1 font-normal text-gray-500">Click or drop PNG/JPG</span></button>
        <button type="button" className={`btn-secondary min-h-20 flex-col border-dashed text-xs ${fileDropTarget === 'signature' ? 'border-primary-500 bg-primary-50' : ''}`} onClick={() => onCreateSignature()} onDragOver={event => enterFileTarget(event, 'signature')} onDragLeave={leaveFileTarget} onDrop={event => dropFile(event, 'signature')}><span>+ Sign</span><span className="mt-1 font-normal text-gray-500">Click or drop PNG/JPG</span></button>
      </div>
    </div>
    <div className="mb-4 flex flex-wrap gap-2">
      <button type="button" className="text-xs font-semibold text-primary-700" onClick={onCreateCommon}>Add common labels</button>
      <button type="button" className="text-xs font-semibold text-primary-700" onClick={() => onCreateMark('checkmark')}>+ Checkmark</button>
      <button type="button" className="text-xs font-semibold text-primary-700" onClick={() => onCreateMark('crossmark')}>+ Cross</button>
    </div>
    <input ref={imageInputRef} type="file" accept="image/png,image/jpeg" className="hidden" aria-label="Choose Quick Fill image" onChange={event => { const file = event.currentTarget.files?.[0]; if (file) void onAddImage(file, replaceImageFieldRef.current); event.currentTarget.value = '' }} />
    {fields.length > 4 && <input className="mb-3" type="search" aria-label="Search Quick Fill items" placeholder="Search items" value={search} onChange={event => setSearch(event.target.value)} />}
    {!fields.length && <p className="rounded-lg border border-dashed border-gray-300 p-3 text-sm">Add a text value, image, or signature to get started.</p>}
    {fields.length > 0 && filteredFields.length === 0 && <p className="text-sm">No matching items.</p>}
    <div className="pdf-fill-grid">
      {filteredFields.map(field => <div key={field.id} className={`pdf-field-card ${activeFieldId === field.id ? 'active' : ''}`} role="button" tabIndex={0} aria-label={`Place ${field.label}`} aria-pressed={activeFieldId === field.id}
        onClick={event => { if (suppressClickRef.current) { event.preventDefault(); return }; if (!(event.target as HTMLElement).closest('input, textarea, select, button')) onSelectField(field.id) }}
        onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelectField(field.id) } }}
        onPointerDown={event => startPointer(event, field)} onPointerMove={movePointer} onPointerUp={endPointer} onPointerCancel={clearDragPreview}>
        <div className="flex items-center gap-1">
          {editingLabelId === field.id ? <input ref={labelInputRef} key={`${field.id}:${field.label}`} className="min-w-0 flex-1 text-sm font-semibold" aria-label={`${field.label} label`} defaultValue={field.label} maxLength={100} onBlur={event => { if (event.target.value.trim() && event.target.value.trim() !== field.label) void onRenameField(field.id, event.target.value); setEditingLabelId(null) }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.currentTarget.value = field.label; event.currentTarget.blur() } }} /> : <strong className="min-w-0 flex-1 truncate text-sm text-gray-800" title={field.label}>{field.label}</strong>}
          <button type="button" className="px-1 text-xs" aria-label={`Rename ${field.label}`} title="Rename item" onClick={() => setEditingLabelId(field.id)}>✎</button>
          <button type="button" className="px-1 text-xs" aria-label={`Move ${field.label} up`} title="Move up" disabled={fields[0]?.id === field.id} onClick={() => onMoveField(field.id, -1)}>↑</button>
          <button type="button" className="px-1 text-xs" aria-label={`Move ${field.label} down`} title="Move down" disabled={fields[fields.length - 1]?.id === field.id} onClick={() => onMoveField(field.id, 1)}>↓</button>
          <button type="button" className="px-1 text-xs text-red-700" aria-label={`Remove ${field.label}`} title="Remove item" onClick={() => { void onRemoveField(field.id) }}>×</button>
        </div>
        {isTextualField(field) ? <div className="mt-2"><textarea aria-label={`${field.label} value`} rows={fieldDisplayValue(field).length > 80 ? 3 : 1} value={fieldDisplayValue(field)} onChange={event => onChangeField(field.kind === 'date' ? { ...field, manualText: event.target.value } : { ...field, value: event.target.value })} /></div> : field.kind === 'signature' || field.kind === 'image' ? <div className="mt-2"><div role="img" aria-label={`${field.label} preview`} className="h-20 w-full bg-contain bg-center bg-no-repeat" style={{ backgroundImage: signatureUrls[field.assetId] ? `url(${signatureUrls[field.assetId]})` : undefined }} /><div className="mt-1 flex justify-between gap-2"><span className="text-xs">{field.kind === 'signature' && savedSignatureIds.includes(field.id) ? 'Saved in this browser' : 'This session only'}</span>{field.kind === 'image' && <button type="button" className="text-xs font-semibold text-primary-700" onClick={() => chooseImage(field.id)}>Replace image</button>}</div></div> : <p className="mt-2 text-xs">{field.kind === 'checkmark' ? '✓ Checkmark' : '✕ Cross mark'}</p>}
      </div>)}
    </div>
    <div className="mt-5 border-t border-gray-200 pt-4">
      <label className="pdf-property-field">Place on
        <select value={scope} onChange={event => onScopeChange(event.target.value as Props['scope'])}><option value="current">Clicked page</option><option value="selected">Selected pages</option><option value="all">All pages</option></select>
      </label>
      {scope === 'selected' && <div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto">{Array.from({ length: pageCount }, (_, index) => <label key={index} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={selectedPages.includes(index)} onChange={() => onTogglePage(index)} />{index + 1}</label>)}</div>}
    </div>
  </aside>
}
