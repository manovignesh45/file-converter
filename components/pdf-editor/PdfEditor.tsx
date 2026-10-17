'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api'
import { ChevronLeft, ChevronRight, Download, FileText, LoaderCircle, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Redo2, Undo2, X, ZoomIn, ZoomOut } from 'lucide-react'
import PdfEditorToolbar from './PdfEditorToolbar'
import PdfEditorInspector from './PdfEditorInspector'
import PdfPageSurface from './PdfPageSurface'
import PdfThumbnailSidebar from './PdfThumbnailSidebar'
import QuickFillPanel from './QuickFillPanel'
import SignatureDialog from './SignatureDialog'
import { commitHistory, createHistory, redoHistory, undoHistory } from '../../lib/pdf/history'
import { cloneElementToPage, createDocumentPage, createEditorDocument, moveElementBy, sourcePageId, toLegacyExportPayload } from '../../lib/pdf/document'
import { hasSupportedImageSignature, MAX_IMAGE_BYTES } from '../../lib/pdf/validation'
import { applyPlacedElementEdit, createDefaultFields, fieldDisplayValue, isTextualField, updateLinkedFieldText } from '../../lib/pdf/fields'
import { localTodayDateOnly } from '../../lib/pdf/dateFormatting'
import { createFieldPlacements } from '../../lib/pdf/placement'
import type { PdfFieldDefinition } from '../../types/pdfFields'
import { deleteLocalSignature, listLocalSignatures, saveLocalSignature } from '../../lib/pdf/signatureRepository'
import type { SignatureRecord } from '../../lib/pdf/signatures'
import { browserTextLayout } from '../../lib/pdf/browserTextLayout'
import type {
  PdfAssetMap,
  PdfDrawingElement,
  PdfEditorDocument,
  PdfEditorElement,
  PdfEditorTool,
  PdfHighlightElement,
  PdfDocumentPage,
  PdfPoint,
} from '../../types/pdfEditor'

interface PdfEditorProps {
  file: File
  initialPassword?: string
  onCancel: () => void
  onExported: (files: Array<{ fileName: string; originalSize?: number; processedSize?: number; pageCount?: number }>) => void
}

export default function PdfEditor({ file, initialPassword = '', onCancel, onExported }: PdfEditorProps) {
  const [pages, setPages] = useState<PDFPageProxy[]>([])
  const [history, setHistory] = useState(() => createHistory<PdfEditorDocument>(createEditorDocument(crypto.randomUUID(), file.name)))
  const [assets, setAssets] = useState<PdfAssetMap>({})
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tool, setTool] = useState<PdfEditorTool>('select')
  const [zoom, setZoom] = useState(1)
  const [activePage, setActivePage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState(initialPassword)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [passwordUpdater, setPasswordUpdater] = useState<((password: string) => void) | null>(null)
  const [drawColor, setDrawColor] = useState('#1e293b')
  const [drawWidth, setDrawWidth] = useState(3)
  const [highlightColor, setHighlightColor] = useState('#fde047')
  const [mode, setMode] = useState<'edit' | 'fill'>('edit')
  const [showThumbnails, setShowThumbnails] = useState(true)
  const [showInspector, setShowInspector] = useState(false)
  const [placementFieldId, setPlacementFieldId] = useState<string | null>(null)
  const [placementScope, setPlacementScope] = useState<'current' | 'selected' | 'all'>('current')
  const [selectedPages, setSelectedPages] = useState<number[]>([])
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false)
  const [signatureRecords, setSignatureRecords] = useState<Record<string, SignatureRecord>>({})
  const [savedSignatureIds, setSavedSignatureIds] = useState<string[]>([])
  const imageInputRef = useRef<HTMLInputElement>(null)
  const replaceImageInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const assetUrlsRef = useRef<Record<string, string>>({})
  const clipboardRef = useRef<PdfEditorElement | null>(null)

  const document = history.present
  const elements = document.elements
  const pageInfo = document.pages
  const selectedElement = elements.find(element => element.id === selectedId) || null
  const selectedTextOverflow = selectedElement?.type === 'text' && browserTextLayout(selectedElement).overflow
  const elementsByPage = useMemo(() => pages.map((_, index) => elements.filter(element => element.pageId ? element.pageId === sourcePageId(index) : element.pageIndex === index)), [elements, pages])

  useEffect(() => {
    let cancelled = false
    let task: any
    void (async () => {
      try {
        setLoading(true)
        setError(null)
        const pdfjs = await import('pdfjs-dist')
        // Keep the worker out of Webpack's module wrapper. PDF.js requires its API
        // module and worker to be the exact same version, and a stable same-origin
        // URL also avoids stale development chunks after a dependency update.
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs'
        const data = new Uint8Array(await file.arrayBuffer())
        if (cancelled) return
        task = pdfjs.getDocument({ data, password: initialPassword || undefined })
        task.onPassword = (updatePassword: (value: string) => void) => {
          if (cancelled) return
          setNeedsPassword(true)
          setPasswordUpdater(() => updatePassword)
          setLoading(false)
        }
        const document = await task.promise
        const loadedPages: PDFPageProxy[] = []
        const info: PdfDocumentPage[] = []
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          const page = await document.getPage(pageNumber)
          loadedPages.push(page)
          info.push(createDocumentPage({
            pageIndex: pageNumber - 1,
            width: page.view[2] - page.view[0],
            height: page.view[3] - page.view[1],
            rotation: page.rotate,
          }, [page.view[0], page.view[1], page.view[2], page.view[3]]))
        }
        if (!cancelled) {
          setPages(loadedPages)
          setHistory(current => ({ ...current, present: { ...current.present, pages: info, fields: current.present.fields.some(field => field.kind !== 'signature') ? current.present.fields : [...createDefaultFields(() => crypto.randomUUID()), ...current.present.fields] } }))
          setNeedsPassword(false)
          setLoading(false)
        }
      } catch (loadError) {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : 'Unknown PDF loading error.'
          console.error('PDF editor failed to load the document:', loadError)
          setError(
            /password/i.test(message)
              ? 'The PDF password is incorrect.'
              : `The PDF could not be loaded in this browser. ${message}`,
          )
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
      task?.destroy()
    }
  }, [file, initialPassword])

  useEffect(() => { assetUrlsRef.current = assetUrls }, [assetUrls])
  useEffect(() => () => {
    Object.values(assetUrlsRef.current).forEach(url => URL.revokeObjectURL(url))
  }, [])

  useEffect(() => {
    let cancelled = false
    void listLocalSignatures().then(records => {
      if (cancelled) return
      const files: PdfAssetMap = {}
      const urls: Record<string, string> = {}
      for (const record of records) {
        files[record.id] = new File([record.blob], `${record.name}.${record.mimeType === 'image/png' ? 'png' : 'jpg'}`, { type: record.mimeType })
        urls[record.id] = URL.createObjectURL(record.blob)
      }
      setAssets(current => ({ ...current, ...files }))
      setAssetUrls(current => ({ ...current, ...urls }))
      setSignatureRecords(current => ({ ...current, ...Object.fromEntries(records.map(record => [record.id, record])) }))
      setSavedSignatureIds(records.map(record => record.id))
      setHistory(current => ({ ...current, present: { ...current.present, fields: [...current.present.fields, ...records.filter(record => !current.present.fields.some(field => field.id === record.id)).map(record => ({ id: record.id, kind: 'signature' as const, label: record.name, assetId: record.id, mimeType: record.mimeType }))] } }))
    }).catch(() => { if (!cancelled) setError('Saved signatures are unavailable in this browser. Session signatures still work.') })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const root = scrollRef.current
    if (!root || !pages.length) return
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      const pageIndex = Number((visible?.target as HTMLElement | undefined)?.dataset.pageIndex)
      if (Number.isInteger(pageIndex)) setActivePage(pageIndex)
    }, { root, threshold: [0.2, 0.5, 0.75] })
    root.querySelectorAll('[data-page-index]').forEach(element => observer.observe(element))
    return () => observer.disconnect()
  }, [pages.length, zoom])

  const commit = useCallback((next: PdfEditorElement[]) => {
    setHistory(current => commitHistory(current, { ...current.present, elements: next }))
  }, [])

  const addElements = useCallback((newElements: PdfEditorElement[]) => {
    setHistory(current => {
      const nextZ = current.present.elements.reduce((maximum, item) => Math.max(maximum, item.zIndex), -1) + 1
      const prepared = newElements.map((element, index) => ({ ...element, pageId: element.pageId ?? sourcePageId(element.pageIndex), zIndex: nextZ + index }))
      return commitHistory(current, { ...current.present, elements: [...current.present.elements, ...prepared] })
    })
    setSelectedId(newElements.at(-1)?.id || null)
    setTool('select')
  }, [])

  const addDrawing = useCallback((element: PdfDrawingElement) => addElements([element]), [addElements])
  const addHighlights = useCallback((items: PdfHighlightElement[]) => addElements(items), [addElements])

  const placeField = useCallback((fieldId: string, pageIndex: number, point: PdfPoint) => {
    const field = document.fields.find(item => item.id === fieldId)
    const sourcePage = pageInfo[pageIndex]
    if (!field || !sourcePage) return
    if (isTextualField(field) && !fieldDisplayValue(field).trim()) { setError(`Enter ${field.label.toLowerCase()} before placing it.`); return }
    if (field.kind === 'signature' && !assets[field.assetId]) { setError('This signature image is unavailable. Recreate it before placing.'); return }
    const targets = placementScope === 'all' ? pageInfo : placementScope === 'selected' ? pageInfo.filter(page => selectedPages.includes(page.sourcePageIndex)) : [sourcePage]
    if (!targets.length) { setError('Select at least one target page.'); return }
    const result = createFieldPlacements(field, sourcePage, targets, point, () => crypto.randomUUID())
    if (result.outOfBoundsPageIds.length) {
      setError(`The field would extend beyond ${result.outOfBoundsPageIds.length} page(s). Choose a position with more space.`)
      return
    }
    setError(null)
    addElements(result.elements)
    setPlacementFieldId(fieldId)
  }, [addElements, assets, document.fields, pageInfo, placementScope, selectedPages])

  const changeField = useCallback((updated: PdfFieldDefinition) => {
    setHistory(current => commitHistory(current, {
      ...current.present,
      fields: current.present.fields.map(field => field.id === updated.id ? updated : field),
      elements: isTextualField(updated) ? updateLinkedFieldText(current.present.elements, updated) : current.present.elements,
    }))
  }, [])

  const addSignature = async (record: SignatureRecord, saveLocally: boolean) => {
    if (saveLocally) await saveLocalSignature(record)
    const file = new File([record.blob], `${record.name}.${record.mimeType === 'image/png' ? 'png' : 'jpg'}`, { type: record.mimeType })
    const url = URL.createObjectURL(record.blob)
    setAssets(current => ({ ...current, [record.id]: file }))
    setAssetUrls(current => ({ ...current, [record.id]: url }))
    setSignatureRecords(current => ({ ...current, [record.id]: record }))
    if (saveLocally) setSavedSignatureIds(current => [...current, record.id])
    setHistory(current => commitHistory(current, { ...current.present, fields: [...current.present.fields, { id: record.id, kind: 'signature', label: record.name, assetId: record.id, mimeType: record.mimeType }] }))
    setPlacementFieldId(record.id)
  }

  const removeSignature = async (id: string) => {
    if (!window.confirm('Remove this signature from the library? Existing placements will stay on the document.')) return
    try {
      if (savedSignatureIds.includes(id)) await deleteLocalSignature(id)
      setSavedSignatureIds(current => current.filter(item => item !== id))
      setHistory(current => commitHistory(current, { ...current.present, fields: current.present.fields.filter(field => field.id !== id) }))
      if (placementFieldId === id) setPlacementFieldId(null)
    } catch { setError('The signature could not be removed from local storage.') }
  }

  const renameSignature = async (id: string, name: string) => {
    const record = signatureRecords[id]
    if (!record) return
    try {
      if (savedSignatureIds.includes(id)) await saveLocalSignature({ ...record, name })
      setSignatureRecords(current => ({ ...current, [id]: { ...record, name } }))
      setHistory(current => commitHistory(current, { ...current.present, fields: current.present.fields.map(field => field.id === id ? { ...field, label: name } : field) }))
    } catch { setError('The signature name could not be saved locally.') }
  }

  const addAt = useCallback((pageIndex: number, point: PdfPoint) => {
    if (mode === 'fill' && placementFieldId) { placeField(placementFieldId, pageIndex, point); return }
    const common = { id: crypto.randomUUID(), pageIndex, zIndex: 0, x: point.x, y: point.y, rotation: 0, opacity: 1 }
    let element: PdfEditorElement | null = null
    if (tool === 'text') element = { ...common, type: 'text', width: 180, height: 60, text: 'New text', fontFamily: 'Helvetica', fontSize: 18, color: '#0f172a', bold: false, italic: false, underline: false }
    if (tool === 'rectangle' || tool === 'ellipse') element = { ...common, type: tool, width: 120, height: 80, strokeColor: '#4f46e5', fillColor: null, strokeWidth: 2 }
    if (tool === 'line' || tool === 'arrow') element = { ...common, type: tool, width: 120, height: 1, strokeColor: '#4f46e5', strokeWidth: 3 }
    if (element) addElements([element])
  }, [addElements, mode, placementFieldId, placeField, tool])

  const modifyElement = useCallback((updated: PdfEditorElement) => {
    setHistory(current => commitHistory(current, { ...current.present, elements: current.present.elements.map(element => {
      if (element.id !== updated.id) return element
      return applyPlacedElementEdit(element, updated)
    }) }))
  }, [])

  const deleteSelected = useCallback(() => {
    if (!selectedId) return
    commit(elements.filter(element => element.id !== selectedId))
    setSelectedId(null)
  }, [commit, elements, selectedId])

  const duplicateSelected = useCallback(() => {
    if (!selectedElement) return
    addElements([cloneElementToPage(selectedElement, crypto.randomUUID(), selectedElement.pageIndex)])
  }, [addElements, selectedElement])

  const reorderSelected = useCallback((direction: 'forward' | 'backward') => {
    if (!selectedId) return
    const pageElements = elements.filter(element => element.pageIndex === selectedElement?.pageIndex).sort((a, b) => a.zIndex - b.zIndex)
    const index = pageElements.findIndex(element => element.id === selectedId)
    const swapIndex = direction === 'forward' ? index + 1 : index - 1
    if (index < 0 || swapIndex < 0 || swapIndex >= pageElements.length) return
    const other = pageElements[swapIndex]
    commit(elements.map(element => element.id === selectedId ? { ...element, zIndex: other.zIndex } : element.id === other.id ? { ...element, zIndex: selectedElement!.zIndex } : element))
  }, [commit, elements, selectedElement, selectedId])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
      if (event.isComposing || isTyping) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        setHistory(current => event.shiftKey ? redoHistory(current) : undoHistory(current))
        setSelectedId(null)
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && selectedElement) {
        if (window.getSelection()?.toString()) return
        event.preventDefault()
        clipboardRef.current = { ...selectedElement }
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v' && clipboardRef.current) {
        event.preventDefault()
        const source = clipboardRef.current
        addElements([cloneElementToPage(source, crypto.randomUUID(), activePage)])
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && selectedElement) {
        event.preventDefault()
        duplicateSelected()
      } else if (!isTyping && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault()
        deleteSelected()
      } else if (selectedElement && !event.ctrlKey && !event.metaKey && !event.altKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault()
        const distance = event.shiftKey ? 10 : 1
        modifyElement(moveElementBy(selectedElement, event.key === 'ArrowRight' ? distance : event.key === 'ArrowLeft' ? -distance : 0, event.key === 'ArrowUp' ? distance : event.key === 'ArrowDown' ? -distance : 0))
      } else if (!isTyping && event.key === 'Escape') {
        setTool('select')
        setSelectedId(null)
        setPlacementFieldId(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activePage, addElements, deleteSelected, duplicateSelected, modifyElement, selectedElement])

  const chooseImage = async (chosen: File | undefined, replace = false) => {
    if (!chosen) return
    if (chosen.size === 0 || chosen.size > MAX_IMAGE_BYTES) {
      setError('Images must be non-empty and no larger than 50 MB.')
      return
    }
    const signature = hasSupportedImageSignature(new Uint8Array(await chosen.slice(0, 12).arrayBuffer()))
    if (!signature) {
      setError('Choose a valid PNG or JPEG image.')
      return
    }
    const assetId = crypto.randomUUID()
    const url = URL.createObjectURL(chosen)
    let imageWidth = 180
    let imageHeight = 120
    try {
      const bitmap = await createImageBitmap(chosen)
      const ratio = bitmap.width / bitmap.height
      if (ratio >= 1) imageHeight = imageWidth / ratio
      else imageWidth = imageHeight * ratio
      bitmap.close()
    } catch {
      // The server performs authoritative decoding; use a safe preview size here.
    }
    setAssets(current => ({ ...current, [assetId]: chosen }))
    setAssetUrls(current => ({ ...current, [assetId]: url }))
    if (replace && selectedElement?.type === 'image') {
      modifyElement({ ...selectedElement, assetId, mimeType: signature })
      return
    }
    const info = pageInfo[activePage]
    addElements([{
      id: crypto.randomUUID(), type: 'image', pageIndex: activePage, zIndex: 0,
      x: Math.max(20, info.width / 2 - imageWidth / 2), y: Math.max(20, info.height / 2 - imageHeight / 2),
      width: imageWidth, height: imageHeight, rotation: 0, opacity: 1, assetId, mimeType: signature,
    }])
  }

  const goToPage = (pageIndex: number) => {
    const next = Math.min(pages.length - 1, Math.max(0, pageIndex))
    scrollRef.current?.querySelector(`[data-page-index="${next}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActivePage(next)
  }

  const exportPdf = async () => {
    setExporting(true)
    setError(null)
    try {
      await window.document.fonts.load('16px "ConvertPro Noto Sans"')
      const payload = toLegacyExportPayload(document)
      payload.elements = payload.elements.map(element => element.type === 'text'
        ? { ...element, exportLayout: browserTextLayout(element) }
        : element)
      const formData = new FormData()
      formData.append('pdf', file, document.name)
      formData.append('edits', JSON.stringify(payload))
      if (password) formData.append('password', password)
      const usedAssetIds = Array.from(new Set(elements.filter(element => element.type === 'image').map(element => element.assetId)))
      formData.append('assetIds', JSON.stringify(usedAssetIds))
      usedAssetIds.forEach(id => {
        const asset = assets[id]
        if (!asset) throw new Error('An image or signature used in the document is missing. Restore it before export.')
        formData.append('assets', asset)
      })
      const response = await fetch('/api/pdf/edit', { method: 'POST', body: formData })
      const result = await response.json()
      if (!response.ok) throw new Error(result.details || result.error || 'The edited PDF could not be exported.')
      onExported(result.files)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'The edited PDF could not be exported.')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><LoaderCircle className="h-8 w-8 animate-spin text-primary-600" /><span className="ml-3 font-medium text-gray-700">Opening PDF…</span></div>
  }

  if (needsPassword) {
    return (
      <div className="mx-auto max-w-md card">
        <FileText className="mb-4 h-10 w-10 text-primary-600" />
        <h2 className="text-xl font-bold">This PDF is password protected</h2>
        <p className="mt-2 text-sm text-gray-500">Enter the document password to view and edit it. The original remains unchanged; the exported copy will be unlocked.</p>
        <input className="input-field mt-5" type="password" value={password} onChange={event => setPassword(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && password) { setLoading(true); passwordUpdater?.(password) } }} autoFocus />
        <div className="mt-5 flex gap-3"><button className="btn-secondary" onClick={onCancel}>Cancel</button><button className="btn-primary" disabled={!password} onClick={() => { setLoading(true); passwordUpdater?.(password) }}>Open PDF</button></div>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    )
  }

  if (error && !pages.length) {
    return <div className="mx-auto max-w-lg card"><h2 className="text-xl font-bold">PDF could not be opened</h2><p className="mt-2 text-gray-600">{error}</p><button className="btn-secondary mt-5" onClick={onCancel}>Choose another file</button></div>
  }

  return (
    <div className="pdf-editor-frame">
      <header className="pdf-editor-header">
        <button className="pdf-icon-button" onClick={onCancel} title="Close editor"><X /></button>
        <div className="min-w-0 flex-1"><input key={document.id} className="w-full truncate rounded border border-transparent bg-transparent text-base font-bold text-gray-900 hover:border-gray-200 focus:border-primary-500 focus:outline-none" aria-label="Document name" defaultValue={document.name} onBlur={event => { const name = event.target.value.trim(); if (name && name !== document.name) setHistory(current => commitHistory(current, { ...current.present, name })) }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} /><p className="text-xs text-gray-500">Session only · export sends the PDF to the server</p></div>
        <div className="flex items-center gap-1">
          <button className="pdf-icon-button" onClick={() => goToPage(activePage - 1)} disabled={activePage === 0}><ChevronLeft /></button>
          <span className="min-w-20 text-center text-sm font-semibold">{activePage + 1} / {pages.length}</span>
          <button className="pdf-icon-button" onClick={() => goToPage(activePage + 1)} disabled={activePage === pages.length - 1}><ChevronRight /></button>
        </div>
        <button className="btn-primary px-4" onClick={exportPdf} disabled={exporting}>
          {exporting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {exporting ? 'Exporting…' : 'Export PDF'}
        </button>
      </header>

      <nav className="pdf-editor-modes" aria-label="Editor mode">
        <button className={mode === 'edit' ? 'active' : ''} aria-current={mode === 'edit' ? 'page' : undefined} onClick={() => setMode('edit')}>Edit PDF</button>
        <button className={mode === 'fill' ? 'active' : ''} aria-current={mode === 'fill' ? 'page' : undefined} onClick={() => { setMode('fill'); setTool('select') }}>Fill &amp; Sign</button>
        <span className="ml-auto text-xs text-gray-500">Original PDF text is read-only</span>
      </nav>

      {error && <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      {mode === 'edit' && <PdfEditorToolbar
        tool={tool} onToolChange={setTool} onImageRequest={() => imageInputRef.current?.click()} onReplaceImage={() => replaceImageInputRef.current?.click()}
        zoom={zoom} onZoomChange={setZoom}
        onUndo={() => { setHistory(current => undoHistory(current)); setSelectedId(null) }}
        onRedo={() => { setHistory(current => redoHistory(current)); setSelectedId(null) }}
        canUndo={history.past.length > 0} canRedo={history.future.length > 0}
        onDelete={deleteSelected} onDuplicate={duplicateSelected} onReorder={reorderSelected}
        selectedElement={selectedElement} onElementChange={modifyElement} onAdvanced={() => setShowInspector(true)}
      />}
      {mode === 'fill' && <div className="pdf-fill-toolbar"><span>{placementFieldId ? `Click a page to place ${document.fields.find(field => field.id === placementFieldId)?.label || 'field'}. Escape cancels.` : 'Choose a field to place'}</span><div className="flex items-center gap-1"><button className="pdf-icon-button" title="Undo" aria-label="Undo" disabled={!history.past.length} onClick={() => { setHistory(current => undoHistory(current)); setSelectedId(null) }}><Undo2 /></button><button className="pdf-icon-button" title="Redo" aria-label="Redo" disabled={!history.future.length} onClick={() => { setHistory(current => redoHistory(current)); setSelectedId(null) }}><Redo2 /></button><button className="pdf-icon-button" title="Zoom out" aria-label="Zoom out" onClick={() => setZoom(value => Math.max(0.5, value - 0.1))}><ZoomOut /></button><span className="text-sm">{Math.round(zoom * 100)}%</span><button className="pdf-icon-button" title="Zoom in" aria-label="Zoom in" onClick={() => setZoom(value => Math.min(2.5, value + 0.1))}><ZoomIn /></button>{placementFieldId && <button className="pdf-style-toggle" onClick={() => setPlacementFieldId(null)}>Cancel placement</button>}</div></div>}

      <input ref={imageInputRef} className="hidden" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" onChange={event => { void chooseImage(event.target.files?.[0]); event.target.value = '' }} />
      <input ref={replaceImageInputRef} className="hidden" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" onChange={event => { void chooseImage(event.target.files?.[0], true); event.target.value = '' }} />

      <div className="pdf-editor-body">
        {showThumbnails && <PdfThumbnailSidebar pages={pages} activePage={activePage} onSelect={goToPage} />}
        <button className="pdf-sidebar-toggle" onClick={() => setShowThumbnails(value => !value)} aria-label={showThumbnails ? 'Hide page thumbnails' : 'Show page thumbnails'} title={showThumbnails ? 'Hide page thumbnails' : 'Show page thumbnails'}>{showThumbnails ? <PanelLeftClose /> : <PanelLeftOpen />}</button>
        <div ref={scrollRef} className="pdf-editor-pages">
          {pages.map((page, pageIndex) => (
            <PdfPageSurface
              key={pageIndex} page={page} pageIndex={pageIndex} active={activePage === pageIndex} zoom={zoom}
              elements={elementsByPage[pageIndex]}
              selectedId={selectedId} tool={tool} assetUrls={assetUrls}
              drawColor={drawColor} drawWidth={drawWidth} highlightColor={highlightColor}
              onActivate={setActivePage} onSelect={setSelectedId} onAddAt={addAt}
              onAddDrawing={addDrawing}
              onAddHighlights={addHighlights}
              onModify={modifyElement}
              placingField={mode === 'fill' && Boolean(placementFieldId)}
              onDropField={placeField}
            />
          ))}
        </div>
        {mode === 'fill' && !showInspector && <QuickFillPanel fields={document.fields} activeFieldId={placementFieldId} onSelectField={id => setPlacementFieldId(current => current === id ? null : id)} onChangeField={changeField} onToday={id => { const field = document.fields.find(item => item.id === id); if (field?.kind === 'date') changeField({ ...field, date: localTodayDateOnly(), manualText: undefined }) }} scope={placementScope} onScopeChange={setPlacementScope} selectedPages={selectedPages} onTogglePage={index => setSelectedPages(current => current.includes(index) ? current.filter(item => item !== index) : [...current, index])} pageCount={pages.length} onCreateSignature={() => setSignatureDialogOpen(true)} onDeleteSignature={id => { void removeSignature(id) }} onRenameSignature={(id, name) => { void renameSignature(id, name) }} signatureUrls={assetUrls} savedSignatureIds={savedSignatureIds} />}
        {showInspector && <PdfEditorInspector
          element={selectedElement} onChange={modifyElement}
          drawColor={drawColor} drawWidth={drawWidth} highlightColor={highlightColor}
          onDefaultsChange={values => { if (values.drawColor) setDrawColor(values.drawColor); if (values.drawWidth) setDrawWidth(values.drawWidth); if (values.highlightColor) setHighlightColor(values.highlightColor) }}
        />}
        <button className="pdf-inspector-toggle" onClick={() => setShowInspector(value => !value)} aria-label={showInspector ? 'Hide properties' : mode === 'fill' ? 'Show selected properties' : 'Show properties'} title={showInspector ? 'Hide properties' : 'Show properties'}>{showInspector ? <PanelRightClose /> : <PanelRightOpen />}</button>
      </div>
      <footer className="pdf-editor-status"><span>Page {activePage + 1} of {pages.length}</span><span>Zoom {Math.round(zoom * 100)}%</span><span>{selectedTextOverflow ? 'Selected text exceeds its box' : 'Unsaved session'}</span></footer>
      {signatureDialogOpen && <SignatureDialog onClose={() => setSignatureDialogOpen(false)} onSave={addSignature} />}
    </div>
  )
}
