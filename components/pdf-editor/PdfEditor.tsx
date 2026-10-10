'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api'
import { ChevronLeft, ChevronRight, Download, FileText, LoaderCircle, X } from 'lucide-react'
import PdfEditorToolbar from './PdfEditorToolbar'
import PdfEditorInspector from './PdfEditorInspector'
import PdfPageSurface from './PdfPageSurface'
import { commitHistory, createHistory, redoHistory, undoHistory } from '../../lib/pdf/history'
import { hasSupportedImageSignature, MAX_IMAGE_BYTES } from '../../lib/pdf/validation'
import type {
  PdfAssetMap,
  PdfDrawingElement,
  PdfEditPayload,
  PdfEditorElement,
  PdfEditorTool,
  PdfHighlightElement,
  PdfPageInfo,
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
  const [pageInfo, setPageInfo] = useState<PdfPageInfo[]>([])
  const [history, setHistory] = useState(() => createHistory<PdfEditorElement[]>([]))
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
  const imageInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const assetUrlsRef = useRef<Record<string, string>>({})

  const elements = history.present
  const selectedElement = elements.find(element => element.id === selectedId) || null

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
        const info: PdfPageInfo[] = []
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          const page = await document.getPage(pageNumber)
          loadedPages.push(page)
          info.push({
            pageIndex: pageNumber - 1,
            width: page.view[2] - page.view[0],
            height: page.view[3] - page.view[1],
            rotation: page.rotate,
          })
        }
        if (!cancelled) {
          setPages(loadedPages)
          setPageInfo(info)
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
    setHistory(current => commitHistory(current, next))
  }, [])

  const addElements = useCallback((newElements: PdfEditorElement[]) => {
    setHistory(current => {
      const nextZ = current.present.reduce((maximum, item) => Math.max(maximum, item.zIndex), -1) + 1
      const prepared = newElements.map((element, index) => ({ ...element, zIndex: nextZ + index }))
      return commitHistory(current, [...current.present, ...prepared])
    })
    setSelectedId(newElements.at(-1)?.id || null)
    setTool('select')
  }, [])

  const addAt = useCallback((pageIndex: number, point: PdfPoint) => {
    const common = { id: crypto.randomUUID(), pageIndex, zIndex: 0, x: point.x, y: point.y, rotation: 0, opacity: 1 }
    let element: PdfEditorElement | null = null
    if (tool === 'text') element = { ...common, type: 'text', width: 180, height: 60, text: 'New text', fontFamily: 'Helvetica', fontSize: 18, color: '#0f172a', bold: false, italic: false, underline: false }
    if (tool === 'rectangle' || tool === 'ellipse') element = { ...common, type: tool, width: 120, height: 80, strokeColor: '#4f46e5', fillColor: null, strokeWidth: 2 }
    if (tool === 'line' || tool === 'arrow') element = { ...common, type: tool, width: 120, height: 1, strokeColor: '#4f46e5', strokeWidth: 3 }
    if (element) addElements([element])
  }, [addElements, tool])

  const modifyElement = useCallback((updated: PdfEditorElement) => {
    setHistory(current => commitHistory(current, current.present.map(element => element.id === updated.id ? updated : element)))
  }, [])

  const deleteSelected = useCallback(() => {
    if (!selectedId) return
    commit(elements.filter(element => element.id !== selectedId))
    setSelectedId(null)
  }, [commit, elements, selectedId])

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
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        setHistory(current => event.shiftKey ? redoHistory(current) : undoHistory(current))
        setSelectedId(null)
      } else if (!isTyping && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault()
        deleteSelected()
      } else if (!isTyping && event.key === 'Escape') {
        setTool('select')
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteSelected])

  const chooseImage = async (chosen: File | undefined) => {
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
      const payload: PdfEditPayload = { version: 1, pages: pageInfo, elements }
      const formData = new FormData()
      formData.append('pdf', file)
      formData.append('edits', JSON.stringify(payload))
      if (password) formData.append('password', password)
      const usedAssetIds = Array.from(new Set(elements.filter(element => element.type === 'image').map(element => element.assetId)))
      formData.append('assetIds', JSON.stringify(usedAssetIds))
      usedAssetIds.forEach(id => formData.append('assets', assets[id]))
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
        <div className="min-w-0 flex-1"><h1 className="truncate text-base font-bold text-gray-900">{file.name}</h1><p className="text-xs text-gray-500">{pages.length} page{pages.length === 1 ? '' : 's'} · original text is read-only</p></div>
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

      {error && <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <PdfEditorToolbar
        tool={tool} onToolChange={setTool} onImageRequest={() => imageInputRef.current?.click()}
        zoom={zoom} onZoomChange={setZoom}
        onUndo={() => { setHistory(current => undoHistory(current)); setSelectedId(null) }}
        onRedo={() => { setHistory(current => redoHistory(current)); setSelectedId(null) }}
        canUndo={history.past.length > 0} canRedo={history.future.length > 0}
        onDelete={deleteSelected} canDelete={Boolean(selectedElement)} onReorder={reorderSelected}
      />

      <input ref={imageInputRef} className="hidden" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" onChange={event => { void chooseImage(event.target.files?.[0]); event.target.value = '' }} />

      <div className="pdf-editor-body">
        <div ref={scrollRef} className="pdf-editor-pages">
          {pages.map((page, pageIndex) => (
            <PdfPageSurface
              key={pageIndex} page={page} pageIndex={pageIndex} active={activePage === pageIndex} zoom={zoom}
              elements={elements.filter(element => element.pageIndex === pageIndex)}
              selectedId={selectedId} tool={tool} assetUrls={assetUrls}
              drawColor={drawColor} drawWidth={drawWidth} highlightColor={highlightColor}
              onActivate={setActivePage} onSelect={setSelectedId} onAddAt={addAt}
              onAddDrawing={(element: PdfDrawingElement) => addElements([element])}
              onAddHighlights={(items: PdfHighlightElement[]) => addElements(items)}
              onModify={modifyElement}
            />
          ))}
        </div>
        <PdfEditorInspector
          element={selectedElement} onChange={modifyElement}
          drawColor={drawColor} drawWidth={drawWidth} highlightColor={highlightColor}
          onDefaultsChange={values => { if (values.drawColor) setDrawColor(values.drawColor); if (values.drawWidth) setDrawWidth(values.drawWidth); if (values.highlightColor) setHighlightColor(values.highlightColor) }}
        />
      </div>
    </div>
  )
}
