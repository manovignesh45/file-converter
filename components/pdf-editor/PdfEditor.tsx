'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api'
import { ChevronLeft, ChevronRight, Download, FileText, Keyboard, ListChecks, LoaderCircle, Minus, PanelLeftClose, PanelLeftOpen, Plus, X } from 'lucide-react'
import PdfEditorToolbar, { editorTools } from './PdfEditorToolbar'
import KeyboardShortcutsDialog from './KeyboardShortcutsDialog'
import PdfEditorInspector from './PdfEditorInspector'
import PdfPageSurface from './PdfPageSurface'
import PdfThumbnailSidebar from './PdfThumbnailSidebar'
import QuickFillPanel from './QuickFillPanel'
import SignatureDialog from './SignatureDialog'
import { commitHistory, createHistory, redoHistory, undoHistory } from '../../lib/pdf/history'
import { cloneElementToPage, createDocumentPage, createEditorDocument, moveElementBy, sourcePageId, toLegacyExportPayload } from '../../lib/pdf/document'
import { hasSupportedImageSignature, MAX_IMAGE_BYTES } from '../../lib/pdf/validation'
import { applyPlacedElementEdit, createCommonFields, fieldDisplayValue, isTextualField, unlinkRemovedField, updateLinkedFieldImage, updateLinkedFieldText } from '../../lib/pdf/fields'
import { createFieldPlacements, fitFieldPlacementPoint } from '../../lib/pdf/placement'
import { clientToPdfPoint, fieldPlacementSize } from '../../lib/pdf/placement'
import { pdfToViewport } from '../../lib/pdf/coordinates'
import { anchoredScroll, clampZoom, fitZoom, MAX_ZOOM, MIN_ZOOM, stepZoom, wheelZoom, ZOOM_PRESETS, zoomShortcut, type ZoomAnchor, type ZoomFit } from '../../lib/pdf/zoom'
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
  PdfTextElement,
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
  const [showThumbnails, setShowThumbnails] = useState(true)
  const [showQuickFill, setShowQuickFill] = useState(true)
  const [quickFillWidth, setQuickFillWidth] = useState(288)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [placementFieldId, setPlacementFieldId] = useState<string | null>(null)
  const [focusFieldId, setFocusFieldId] = useState<string | null>(null)
  const [placementScope, setPlacementScope] = useState<'current' | 'selected' | 'all'>('current')
  const [selectedPages, setSelectedPages] = useState<number[]>([])
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false)
  const [signatureInitialUpload, setSignatureInitialUpload] = useState<File | null>(null)
  const [signatureRecords, setSignatureRecords] = useState<Record<string, SignatureRecord>>({})
  const [savedSignatureIds, setSavedSignatureIds] = useState<string[]>([])
  const [fitMode, setFitMode] = useState<ZoomFit | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [pageDraft, setPageDraft] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const replaceImageInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const assetUrlsRef = useRef<Record<string, string>>({})
  const clipboardRef = useRef<PdfEditorElement | null>(null)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const activePageRef = useRef(activePage)
  activePageRef.current = activePage
  const pendingAnchorRef = useRef<ZoomAnchor | null>(null)
  const initialFitRef = useRef(false)
  const cancelPageDraftRef = useRef(false)

  const document = history.present
  const elements = document.elements
  const pageInfo = document.pages
  const selectedElement = elements.find(element => element.id === selectedId) || null
  const selectedTextOverflow = selectedElement?.type === 'text' && browserTextLayout(selectedElement).overflow
  const dirty = history.past.length > 0
  const elementsByPage = useMemo(() => pages.map((_, index) => elements.filter(element => element.pageId ? element.pageId === sourcePageId(index) : element.pageIndex === index)), [elements, pages])

  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) setShowThumbnails(false)
    // Quick Fill would leave too little room for the page on smaller screens.
    if (window.matchMedia('(max-width: 1279px)').matches) setShowQuickFill(false)
  }, [])

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
          setHistory(current => ({ ...current, present: { ...current.present, pages: info } }))
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

  /** Builds a zoom anchor for a viewport point: the page under it and where it sits on that page. */
  const anchorAt = useCallback((clientX: number, clientY: number): ZoomAnchor | null => {
    const root = scrollRef.current
    if (!root) return null
    const rootRect = root.getBoundingClientRect()
    const hit = globalThis.document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('.pdf-page-shell')
    const shell = hit && root.contains(hit) ? hit : root.querySelector<HTMLElement>(`[data-page-index="${activePageRef.current}"]`)
    if (!shell) return null
    const rect = shell.getBoundingClientRect()
    return {
      pageIndex: Number(shell.dataset.pageIndex),
      fractionX: (clientX - rect.left) / rect.width,
      fractionY: (clientY - rect.top) / rect.height,
      viewportX: clientX - rootRect.left,
      viewportY: clientY - rootRect.top,
    }
  }, [])

  const centerAnchor = useCallback(() => {
    const rect = scrollRef.current?.getBoundingClientRect()
    return rect ? anchorAt(rect.left + rect.width / 2, rect.top + rect.height / 2) : null
  }, [anchorAt])

  const applyZoom = useCallback((next: number, anchor: ZoomAnchor | null = centerAnchor(), fit: ZoomFit | null = null) => {
    setFitMode(fit)
    const clamped = clampZoom(next)
    if (clamped === zoomRef.current) return
    pendingAnchorRef.current = anchor
    setZoom(clamped)
  }, [centerAnchor])

  const computeFit = useCallback((fit: ZoomFit) => {
    const root = scrollRef.current
    const page = pages[activePageRef.current] ?? pages[0]
    if (!root || !page) return null
    const style = getComputedStyle(root)
    return fitZoom(fit, page.getViewport({ scale: 1 }), { width: root.clientWidth, height: root.clientHeight }, { x: parseFloat(style.paddingLeft) || 0, y: parseFloat(style.paddingTop) || 0 })
  }, [pages])

  const fitTo = useCallback((fit: ZoomFit) => {
    const next = computeFit(fit)
    const root = scrollRef.current
    if (next === null || !root) return
    // Fitting shows the current page from its top edge.
    const anchor = { pageIndex: activePageRef.current, fractionX: 0.5, fractionY: 0, viewportX: root.clientWidth / 2, viewportY: parseFloat(getComputedStyle(root).paddingTop) || 0 }
    applyZoom(next, anchor, fit)
  }, [applyZoom, computeFit])

  // Open long or wide documents at a size that fits the screen, but never enlarge them.
  useEffect(() => {
    if (initialFitRef.current || !pages.length) return
    initialFitRef.current = true
    const fitted = computeFit('width')
    if (fitted !== null) setZoom(Math.min(1, fitted))
  }, [computeFit, pages.length])

  // Keep the anchored point under the pointer once the pages have their new size.
  useLayoutEffect(() => {
    const anchor = pendingAnchorRef.current
    pendingAnchorRef.current = null
    const root = scrollRef.current
    const shell = anchor && root?.querySelector<HTMLElement>(`[data-page-index="${anchor.pageIndex}"]`)
    if (!anchor || !root || !shell) return
    const rootRect = root.getBoundingClientRect()
    const rect = shell.getBoundingClientRect()
    const { left, top } = anchoredScroll({ left: rect.left - rootRect.left + root.scrollLeft, top: rect.top - rootRect.top + root.scrollTop, width: rect.width, height: rect.height }, anchor)
    root.scrollTo({ left, top, behavior: 'instant' as ScrollBehavior })
  }, [zoom])

  useEffect(() => {
    const root = scrollRef.current
    if (!root || !fitMode) return
    const observer = new ResizeObserver(() => {
      const next = computeFit(fitMode)
      if (next !== null && next !== zoomRef.current) applyZoom(next, centerAnchor(), fitMode)
    })
    observer.observe(root)
    return () => observer.disconnect()
  }, [applyZoom, centerAnchor, computeFit, fitMode])

  // Ctrl/Cmd+wheel, trackpad pinch, Safari gestures and two-finger touch zoom the
  // document instead of the browser. Rendering is costly, so changes are batched.
  useEffect(() => {
    const root = scrollRef.current
    if (!root || !pages.length) return
    let pending: number | null = null
    let pendingAnchor: ZoomAnchor | null = null
    let timer: number | undefined
    const schedule = (next: number, anchor: ZoomAnchor | null) => {
      pending = next
      pendingAnchor = anchor
      timer ??= window.setTimeout(() => {
        timer = undefined
        if (pending !== null) applyZoom(pending, pendingAnchor)
        pending = null
      }, 100)
    }
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      event.preventDefault()
      schedule(wheelZoom(pending ?? zoomRef.current, event.deltaY, event.deltaMode), anchorAt(event.clientX, event.clientY))
    }
    let gestureStart = 1
    const onGestureStart = (event: Event) => { event.preventDefault(); gestureStart = zoomRef.current }
    const onGestureChange = (event: Event) => {
      event.preventDefault()
      const gesture = event as Event & { scale: number; clientX: number; clientY: number }
      schedule(clampZoom(gestureStart * gesture.scale), anchorAt(gesture.clientX, gesture.clientY))
    }
    let pinch: { distance: number; zoom: number } | null = null
    const distance = (touches: TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY)
    const onTouchStart = (event: TouchEvent) => { if (event.touches.length === 2) pinch = { distance: distance(event.touches), zoom: zoomRef.current } }
    const onTouchMove = (event: TouchEvent) => {
      if (!pinch || event.touches.length !== 2) return
      event.preventDefault()
      const [first, second] = [event.touches[0], event.touches[1]]
      schedule(clampZoom(pinch.zoom * distance(event.touches) / Math.max(1, pinch.distance)), anchorAt((first.clientX + second.clientX) / 2, (first.clientY + second.clientY) / 2))
    }
    const onTouchEnd = (event: TouchEvent) => { if (event.touches.length < 2) pinch = null }
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('gesturestart', onGestureStart)
    window.addEventListener('gesturechange', onGestureChange)
    root.addEventListener('touchstart', onTouchStart, { passive: true, capture: true })
    root.addEventListener('touchmove', onTouchMove, { passive: false, capture: true })
    root.addEventListener('touchend', onTouchEnd, { capture: true })
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('gesturestart', onGestureStart)
      window.removeEventListener('gesturechange', onGestureChange)
      root.removeEventListener('touchstart', onTouchStart, { capture: true })
      root.removeEventListener('touchmove', onTouchMove, { capture: true })
      root.removeEventListener('touchend', onTouchEnd, { capture: true })
    }
  }, [anchorAt, applyZoom, pages.length])

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const closeEditor = () => {
    if (!dirty || window.confirm('Close the editor? Your changes have not been exported and will be lost.')) onCancel()
  }

  const commit = useCallback((next: PdfEditorElement[]) => {
    setHistory(current => commitHistory(current, { ...current.present, elements: next }))
  }, [])

  const addElements = useCallback((newElements: PdfEditorElement[], options: { keepTool?: boolean } = {}) => {
    setHistory(current => {
      const nextZ = current.present.elements.reduce((maximum, item) => Math.max(maximum, item.zIndex), -1) + 1
      const prepared = newElements.map((element, index) => ({ ...element, pageId: element.pageId ?? sourcePageId(element.pageIndex), zIndex: nextZ + index }))
      return commitHistory(current, { ...current.present, elements: [...current.present.elements, ...prepared] })
    })
    setSelectedId(newElements.at(-1)?.id || null)
    if (!options.keepTool) setTool('select')
  }, [])

  const addDrawing = useCallback((element: PdfDrawingElement) => addElements([element]), [addElements])
  const addHighlights = useCallback((items: PdfHighlightElement[]) => addElements(items), [addElements])
  // Stay in Edit text so several lines can be changed in a row.
  const replaceText = useCallback((element: PdfTextElement) => addElements([element], { keepTool: true }), [addElements])

  const fieldTargets = useCallback((sourcePage: PdfDocumentPage) => placementScope === 'all'
    ? pageInfo
    : placementScope === 'selected'
      ? pageInfo.filter(page => selectedPages.includes(page.sourcePageIndex))
      : [sourcePage], [pageInfo, placementScope, selectedPages])

  const locateDraggedField = useCallback((fieldId: string, clientX: number, clientY: number) => {
    const shell = globalThis.document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('.pdf-page-shell')
    const pageIndex = Number(shell?.dataset.pageIndex)
    if (!shell || !Number.isInteger(pageIndex)) return null
    const field = document.fields.find(item => item.id === fieldId)
    const sourcePage = pageInfo[pageIndex]
    const pdfPage = pages[pageIndex]
    if (!field || !sourcePage || !pdfPage) return null
    const viewport = pdfPage.getViewport({ scale: zoom })
    const rect = shell.getBoundingClientRect()
    const point = fitFieldPlacementPoint(field, sourcePage, fieldTargets(sourcePage), clientToPdfPoint(clientX, clientY, rect, viewport))
    if (!point) return null
    const size = fieldPlacementSize(field)
    const corners = [point, { x: point.x + size.width, y: point.y }, { x: point.x, y: point.y + size.height }, { x: point.x + size.width, y: point.y + size.height }].map(corner => pdfToViewport(corner, viewport))
    const minX = Math.min(...corners.map(corner => corner.x))
    const minY = Math.min(...corners.map(corner => corner.y))
    return { pageIndex, point, left: rect.left + minX * rect.width / viewport.width, top: rect.top + minY * rect.height / viewport.height, width: (Math.max(...corners.map(corner => corner.x)) - minX) * rect.width / viewport.width, height: (Math.max(...corners.map(corner => corner.y)) - minY) * rect.height / viewport.height, fontSize: 16 * zoom }
  }, [document.fields, fieldTargets, pageInfo, pages, zoom])

  const placeField = useCallback((fieldId: string, pageIndex: number, point: PdfPoint) => {
    const field = document.fields.find(item => item.id === fieldId)
    const sourcePage = pageInfo[pageIndex]
    if (!field || !sourcePage) return
    if (isTextualField(field) && !fieldDisplayValue(field).trim()) { setError(`Enter ${field.label.toLowerCase()} before placing it.`); return }
    if ((field.kind === 'signature' || field.kind === 'image') && !assets[field.assetId]) { setError('This image is unavailable. Add it again before placing.'); return }
    const targets = fieldTargets(sourcePage)
    if (!targets.length) { setError('Select at least one target page.'); return }
    const fittedPoint = fitFieldPlacementPoint(field, sourcePage, targets, point)
    if (!fittedPoint) { setError('This field is too large to fit on a selected page. Resize it after placing on a larger page.'); return }
    const result = createFieldPlacements(field, sourcePage, targets, fittedPoint, () => crypto.randomUUID())
    if (result.outOfBoundsPageIds.length) {
      setError(`The field would extend beyond ${result.outOfBoundsPageIds.length} page(s). Choose a position with more space.`)
      return
    }
    setError(null)
    addElements(result.elements)
    setPlacementFieldId(null)
  }, [addElements, assets, document.fields, fieldTargets, pageInfo])

  const changeField = useCallback((updated: PdfFieldDefinition) => {
    setHistory(current => commitHistory(current, {
      ...current.present,
      fields: current.present.fields.map(field => field.id === updated.id ? updated : field),
      elements: isTextualField(updated) ? updateLinkedFieldText(current.present.elements, updated) : updated.kind === 'image' ? updateLinkedFieldImage(current.present.elements, updated) : current.present.elements,
    }))
  }, [])

  const addTextField = () => {
    const id = crypto.randomUUID()
    setHistory(current => {
      const labels = new Set(current.present.fields.map(field => field.label.toLowerCase()))
      let count = 1
      while (labels.has(`text ${count}`)) count += 1
      return commitHistory(current, { ...current.present, fields: [...current.present.fields, { id, kind: 'custom', label: `Text ${count}`, value: '' }] })
    })
    setFocusFieldId(id)
    return id
  }

  const addCommonFields = () => {
    const existing = new Set(document.fields.map(field => field.label.toLowerCase()))
    const additions = createCommonFields(() => crypto.randomUUID()).filter(field => !existing.has(field.label.toLowerCase()))
    if (!additions.length) return
    setHistory(current => {
      return commitHistory(current, { ...current.present, fields: [...current.present.fields, ...additions] })
    })
    setFocusFieldId(additions[0].id)
  }

  const addMarkField = (kind: 'checkmark' | 'crossmark') => {
    const id = crypto.randomUUID()
    setHistory(current => commitHistory(current, { ...current.present, fields: [...current.present.fields, { id, kind, label: kind === 'checkmark' ? 'Checkmark' : 'Cross mark' }] }))
    setFocusFieldId(id)
  }

  const moveField = (id: string, direction: -1 | 1) => {
    setHistory(current => {
      const fields = [...current.present.fields]
      const index = fields.findIndex(field => field.id === id)
      const target = index + direction
      if (index < 0 || target < 0 || target >= fields.length) return current
      const moved = fields[index]
      fields[index] = fields[target]
      fields[target] = moved
      return commitHistory(current, { ...current.present, fields })
    })
  }

  const removeField = async (id: string) => {
    const field = document.fields.find(item => item.id === id)
    if (!field) return
    if (field.kind === 'signature' && savedSignatureIds.includes(id)) {
      if (!window.confirm('Remove this saved signature from this browser? Existing placements will stay on the PDF.')) return
      try {
        await deleteLocalSignature(id)
        setSavedSignatureIds(current => current.filter(item => item !== id))
      } catch { setError('The signature could not be removed from local storage.'); return }
    }
    setHistory(current => commitHistory(current, { ...current.present, fields: current.present.fields.filter(item => item.id !== id), elements: unlinkRemovedField(current.present.elements, id) }))
    if (placementFieldId === id) setPlacementFieldId(null)
  }

  const addOrReplaceFieldImage = async (chosen: File, fieldId?: string) => {
    const replacingField = fieldId ? document.fields.find(item => item.id === fieldId) : undefined
    if (fieldId && replacingField?.kind !== 'image') { setError('This image item is no longer available.'); return }
    if (chosen.size === 0 || chosen.size > MAX_IMAGE_BYTES) { setError('Images must be non-empty and no larger than 50 MB.'); return }
    const mimeType = hasSupportedImageSignature(new Uint8Array(await chosen.slice(0, 12).arrayBuffer()))
    if (!mimeType) { setError('Choose a valid PNG or JPEG image.'); return }
    let bitmap: ImageBitmap
    try { bitmap = await createImageBitmap(chosen) } catch { setError('The image could not be opened.'); return }
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40_000_000) { bitmap.close(); setError('The image dimensions are unsupported.'); return }
    const scale = Math.min(180 / bitmap.width, 120 / bitmap.height)
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    bitmap.close()
    const assetId = crypto.randomUUID()
    const url = URL.createObjectURL(chosen)
    setAssets(current => ({ ...current, [assetId]: chosen }))
    setAssetUrls(current => ({ ...current, [assetId]: url }))
    if (replacingField?.kind === 'image') {
      changeField({ ...replacingField, assetId, mimeType, width, height })
    } else {
      const id = crypto.randomUUID()
      const label = chosen.name.replace(/\.[^.]+$/, '').trim().slice(0, 100) || 'Image'
      setHistory(current => commitHistory(current, { ...current.present, fields: [...current.present.fields, { id, kind: 'image', label, assetId, mimeType, width, height }] }))
      setFocusFieldId(id)
    }
    setError(null)
  }

  const addSignature = async (record: SignatureRecord, saveLocally: boolean) => {
    if (saveLocally) await saveLocalSignature(record)
    const file = new File([record.blob], `${record.name}.${record.mimeType === 'image/png' ? 'png' : 'jpg'}`, { type: record.mimeType })
    const url = URL.createObjectURL(record.blob)
    setAssets(current => ({ ...current, [record.id]: file }))
    setAssetUrls(current => ({ ...current, [record.id]: url }))
    setSignatureRecords(current => ({ ...current, [record.id]: record }))
    if (saveLocally) setSavedSignatureIds(current => [...current, record.id])
    setHistory(current => commitHistory(current, { ...current.present, fields: [...current.present.fields, { id: record.id, kind: 'signature', label: record.name, assetId: record.id, mimeType: record.mimeType }] }))
    setTool('select')
    setShowQuickFill(true)
    setPlacementFieldId(record.id)
    setFocusFieldId(record.id)
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

  const renameField = async (id: string, name: string) => {
    const label = name.trim().slice(0, 100)
    const field = document.fields.find(item => item.id === id)
    if (!field || !label || label === field.label) return
    if (document.fields.some(item => item.id !== id && item.label.toLowerCase() === label.toLowerCase())) { setError('Use a different label so Quick Fill items are easy to identify.'); return }
    if (field.kind === 'signature') await renameSignature(id, label)
    else { changeField({ ...field, label }); setError(null) }
  }

  const addAt = useCallback((pageIndex: number, point: PdfPoint) => {
    if (placementFieldId) { placeField(placementFieldId, pageIndex, point); return }
    const common = { id: crypto.randomUUID(), pageIndex, zIndex: 0, x: point.x, y: point.y, rotation: 0, opacity: 1 }
    let element: PdfEditorElement | null = null
    if (tool === 'text') element = { ...common, type: 'text', width: 180, height: 60, text: 'New text', fontFamily: 'Helvetica', fontSize: 18, color: '#0f172a', bold: false, italic: false, underline: false }
    if (tool === 'rectangle' || tool === 'ellipse') element = { ...common, type: tool, width: 120, height: 80, strokeColor: '#4f46e5', fillColor: null, strokeWidth: 2 }
    if (tool === 'line' || tool === 'arrow') element = { ...common, type: tool, width: 120, height: 1, strokeColor: '#4f46e5', strokeWidth: 3 }
    if (element) addElements([element])
  }, [addElements, placementFieldId, placeField, tool])

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
      // Browser zoom would scale the whole editor UI; zoom the document instead.
      const zoomAction = zoomShortcut(event)
      if (zoomAction) {
        event.preventDefault()
        applyZoom(zoomAction === 'reset' ? 1 : stepZoom(zoomRef.current, zoomAction === 'in' ? 1 : -1))
        return
      }
      const target = event.target as HTMLElement
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
      if (event.isComposing || isTyping || showShortcuts) return
      const toolShortcut = !event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1
        ? editorTools.find(item => item.shortcut === event.key.toUpperCase())
        : undefined
      if (event.key === '?') {
        event.preventDefault()
        setShowShortcuts(true)
      } else if (toolShortcut && !event.shiftKey) {
        event.preventDefault()
        if (toolShortcut.value === 'image') imageInputRef.current?.click()
        else { setTool(toolShortcut.value); setPlacementFieldId(null) }
      } else if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y')) {
        event.preventDefault()
        setHistory(current => event.shiftKey || event.key.toLowerCase() === 'y' ? redoHistory(current) : undoHistory(current))
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
        setShowAdvanced(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activePage, addElements, applyZoom, deleteSelected, duplicateSelected, modifyElement, selectedElement, showShortcuts])

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

  const commitPageDraft = () => {
    const pageNumber = Number(pageDraft)
    if (!cancelPageDraftRef.current && pageDraft && Number.isInteger(pageNumber)) goToPage(pageNumber - 1)
    cancelPageDraftRef.current = false
    setPageDraft(null)
  }

  const closeShortcuts = useCallback(() => setShowShortcuts(false), [])

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
        <button className="pdf-icon-button" onClick={closeEditor} title="Close editor" aria-label="Close editor"><X /></button>
        <button className="pdf-icon-button" onClick={() => setShowThumbnails(value => !value)} aria-pressed={showThumbnails} aria-label={showThumbnails ? 'Hide page thumbnails' : 'Show page thumbnails'} title={showThumbnails ? 'Hide page thumbnails' : 'Show page thumbnails'}>{showThumbnails ? <PanelLeftClose /> : <PanelLeftOpen />}</button>
        <div className="pdf-editor-document"><input key={document.id} className="w-full truncate rounded border border-transparent bg-transparent px-1 text-base font-bold text-gray-900 hover:border-gray-200 focus:border-primary-500 focus:outline-none" aria-label="Document name" defaultValue={document.name} onBlur={event => { const name = event.target.value.trim(); if (name && name !== document.name) setHistory(current => commitHistory(current, { ...current.present, name })) }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} /><p className="pdf-editor-session-note px-1 text-xs text-gray-500">Session only · export sends the PDF to the server</p></div>
        <button className="pdf-icon-button pdf-shortcuts-button" onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts"><Keyboard /></button>
        <button className={`pdf-header-toggle ${showQuickFill ? 'active' : ''}`} aria-pressed={showQuickFill} aria-controls="pdf-quick-fill" onClick={() => { setShowQuickFill(value => !value); setPlacementFieldId(null) }} title="Quick Fill: reusable names, dates and signatures"><ListChecks /><span>Quick Fill</span></button>
        <button className="pdf-editor-export btn-primary" onClick={exportPdf} disabled={exporting}>
          {exporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          <span>{exporting ? 'Exporting…' : 'Export PDF'}</span>
        </button>
      </header>

      {error && <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <div className="pdf-editor-toolbar-wrap"><PdfEditorToolbar
        tool={tool} onToolChange={next => { setTool(next); setPlacementFieldId(null) }} onImageRequest={() => imageInputRef.current?.click()} onReplaceImage={() => replaceImageInputRef.current?.click()}
        onUndo={() => { setHistory(current => undoHistory(current)); setSelectedId(null) }}
        onRedo={() => { setHistory(current => redoHistory(current)); setSelectedId(null) }}
        canUndo={history.past.length > 0} canRedo={history.future.length > 0}
        onDelete={deleteSelected} onDuplicate={duplicateSelected}
        selectedElement={selectedElement} onElementChange={modifyElement} onAdvanced={() => setShowAdvanced(value => !value)} advancedOpen={showAdvanced}
        drawColor={drawColor} drawWidth={drawWidth} highlightColor={highlightColor}
        onDefaultsChange={values => { if (values.drawColor) setDrawColor(values.drawColor); if (values.drawWidth !== undefined) setDrawWidth(values.drawWidth); if (values.highlightColor) setHighlightColor(values.highlightColor) }}
      />
      {showAdvanced && <PdfEditorInspector element={selectedElement} onChange={modifyElement} onReorder={reorderSelected} onClose={() => setShowAdvanced(false)} />}
      </div>

      <input ref={imageInputRef} className="hidden" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" onChange={event => { void chooseImage(event.target.files?.[0]); event.target.value = '' }} />
      <input ref={replaceImageInputRef} className="hidden" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" onChange={event => { void chooseImage(event.target.files?.[0], true); event.target.value = '' }} />

      <div className="pdf-editor-body">
        {showThumbnails && <PdfThumbnailSidebar pages={pages} activePage={activePage} onSelect={goToPage} />}
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
              onReplaceText={replaceText}
              placingField={Boolean(placementFieldId)}
            />
          ))}
        </div>
        {showQuickFill && <QuickFillPanel
          fields={document.fields} activeFieldId={placementFieldId} focusFieldId={focusFieldId}
          width={quickFillWidth} onWidthChange={setQuickFillWidth} thumbnailsOpen={showThumbnails}
          onSelectField={id => { setTool('select'); setPlacementFieldId(current => current === id ? null : id); if (window.matchMedia('(max-width: 767px)').matches) setShowQuickFill(false) }}
          onClose={() => setShowQuickFill(false)}
          onDragFieldStart={() => { setTool('select'); setPlacementFieldId(null) }}
          onLocateField={locateDraggedField} onDropField={placeField} onChangeField={changeField}
          onCreateText={addTextField} onCreateCommon={addCommonFields} onCreateMark={addMarkField}
          onAddImage={addOrReplaceFieldImage} onRemoveField={removeField} onRenameField={renameField} onMoveField={moveField}
          scope={placementScope} onScopeChange={setPlacementScope} selectedPages={selectedPages}
          onTogglePage={index => setSelectedPages(current => current.includes(index) ? current.filter(item => item !== index) : [...current, index])}
          pageCount={pages.length} onCreateSignature={file => { setSignatureInitialUpload(file ?? null); setSignatureDialogOpen(true) }}
          signatureUrls={assetUrls} savedSignatureIds={savedSignatureIds}
        />}
      </div>
      <footer className="pdf-editor-status">
        <div className="pdf-status-group" role="group" aria-label="Page navigation">
          <button className="pdf-status-button" onClick={() => goToPage(activePage - 1)} disabled={activePage === 0} aria-label="Previous page" title="Previous page"><ChevronLeft /></button>
          <input className="pdf-page-input" inputMode="numeric" aria-label={`Page number, 1 to ${pages.length}`} value={pageDraft ?? String(activePage + 1)} onFocus={event => event.target.select()} onChange={event => setPageDraft(event.target.value.replace(/\D/g, ''))} onBlur={commitPageDraft} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); else if (event.key === 'Escape') { cancelPageDraftRef.current = true; event.currentTarget.blur() } }} />
          <span className="whitespace-nowrap">of {pages.length}</span>
          <button className="pdf-status-button" onClick={() => goToPage(activePage + 1)} disabled={activePage === pages.length - 1} aria-label="Next page" title="Next page"><ChevronRight /></button>
        </div>
        <span className={`pdf-status-message ${selectedTextOverflow ? 'text-amber-700' : ''}`} role="status">{selectedTextOverflow ? 'Selected text exceeds its box' : dirty ? 'Unsaved changes' : 'No changes yet'}</span>
        <div className="pdf-status-group" role="group" aria-label="Zoom">
          <button className="pdf-status-button" onClick={() => applyZoom(stepZoom(zoom, -1))} disabled={zoom <= MIN_ZOOM} aria-label="Zoom out" title="Zoom out (Ctrl −)"><Minus /></button>
          <select className="pdf-zoom-select" aria-label="Zoom level" value={fitMode ?? String(zoom)} onChange={event => { const value = event.target.value; if (value === 'width' || value === 'page') fitTo(value); else applyZoom(Number(value)) }}>
            <option value="width">{fitMode === 'width' ? `Fit width (${Math.round(zoom * 100)}%)` : 'Fit width'}</option>
            <option value="page">{fitMode === 'page' ? `Fit page (${Math.round(zoom * 100)}%)` : 'Fit page'}</option>
            {!fitMode && !ZOOM_PRESETS.includes(zoom) && <option value={String(zoom)}>{Math.round(zoom * 100)}%</option>}
            {ZOOM_PRESETS.map(preset => <option key={preset} value={String(preset)}>{preset * 100}%</option>)}
          </select>
          <button className="pdf-status-button" onClick={() => applyZoom(stepZoom(zoom, 1))} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in" title="Zoom in (Ctrl +)"><Plus /></button>
        </div>
      </footer>
      {showShortcuts && <KeyboardShortcutsDialog onClose={closeShortcuts} />}
      {signatureDialogOpen && <SignatureDialog initialUpload={signatureInitialUpload} onClose={() => { setSignatureDialogOpen(false); setSignatureInitialUpload(null) }} onSave={addSignature} />}
    </div>
  )
}
