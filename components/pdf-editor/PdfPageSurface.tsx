'use client'

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  Canvas,
  Ellipse,
  FabricImage,
  Group,
  Line,
  Path,
  Point,
  Polyline,
  Rect,
  Textbox,
  Triangle,
  util,
} from 'fabric'
import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api'
import type { PageViewport } from 'pdfjs-dist/types/src/display/display_utils'
import { normalizeDegrees, pdfToViewport, viewportRotation, viewportScale, viewportToPdf } from '../../lib/pdf/coordinates'
import { clientToPdfPoint } from '../../lib/pdf/placement'
import { browserTextLayout } from '../../lib/pdf/browserTextLayout'
import type { PdfDrawingElement, PdfEditorElement, PdfEditorTool, PdfHighlightElement, PdfPoint, PdfTextElement } from '../../types/pdfEditor'

interface PdfPageSurfaceProps {
  page: PDFPageProxy
  pageIndex: number
  active: boolean
  zoom: number
  elements: PdfEditorElement[]
  selectedId: string | null
  tool: PdfEditorTool
  assetUrls: Record<string, string>
  drawColor: string
  drawWidth: number
  highlightColor: string
  onActivate: (pageIndex: number) => void
  onSelect: (id: string | null) => void
  onAddAt: (pageIndex: number, point: PdfPoint) => void
  onAddDrawing: (element: PdfDrawingElement) => void
  onAddHighlights: (elements: PdfHighlightElement[]) => void
  onModify: (element: PdfEditorElement) => void
  placingField?: boolean
}

function viewportBox(point: PdfPoint, width: number, height: number, viewport: PageViewport) {
  const corners = [point, { x: point.x + width, y: point.y }, { x: point.x, y: point.y + height }, { x: point.x + width, y: point.y + height }].map(corner => pdfToViewport(corner, viewport))
  const left = Math.min(...corners.map(corner => corner.x))
  const top = Math.min(...corners.map(corner => corner.y))
  return { left, top, width: Math.max(...corners.map(corner => corner.x)) - left, height: Math.max(...corners.map(corner => corner.y)) - top }
}

function objectOptions(element: PdfEditorElement, viewport: PageViewport) {
  const origin = pdfToViewport({ x: element.x, y: element.y }, viewport)
  return {
    left: origin.x,
    top: origin.y,
    originX: 'left' as const,
    originY: 'bottom' as const,
    angle: viewportRotation(viewport) + element.rotation,
    opacity: element.opacity,
    transparentCorners: false,
    cornerColor: '#4f46e5',
    borderColor: '#4f46e5',
    cornerStyle: 'circle' as const,
    cornerSize: 10,
    data: { id: element.id },
  }
}

function elementBounds(element: PdfDrawingElement) {
  const xs = element.points.map(point => point.x)
  const ys = element.points.map(point => point.y)
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(1, Math.max(...xs) - Math.min(...xs)),
    height: Math.max(1, Math.max(...ys) - Math.min(...ys)),
  }
}

export default function PdfPageSurface({
  page,
  pageIndex,
  active,
  zoom,
  elements,
  selectedId,
  tool,
  assetUrls,
  drawColor,
  drawWidth,
  highlightColor,
  onActivate,
  onSelect,
  onAddAt,
  onAddDrawing,
  onAddHighlights,
  onModify,
  placingField = false,
}: PdfPageSurfaceProps) {
  const backgroundRef = useRef<HTMLCanvasElement>(null)
  const shellRef = useRef<HTMLElement>(null)
  const [renderVisible, setRenderVisible] = useState(pageIndex === 0)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const fabricRef = useRef<Canvas | null>(null)
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId
  const drawingPointsRef = useRef<PdfPoint[] | null>(null)
  const temporaryDrawingRef = useRef<Polyline | null>(null)
  const highlightStartRef = useRef<{ x: number; y: number } | null>(null)
  const viewport = useMemo(() => page.getViewport({ scale: zoom }), [page, zoom])
  const selectedText = elements.find((element): element is PdfTextElement => element.id === selectedId && element.type === 'text')
  const selectedTextBox = selectedText ? viewportBox(selectedText, selectedText.width, selectedText.height, viewport) : null


  useEffect(() => {
    const shell = shellRef.current
    if (!shell || renderVisible) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) { setRenderVisible(true); observer.disconnect() }
    }, { rootMargin: '800px' })
    observer.observe(shell)
    return () => observer.disconnect()
  }, [renderVisible])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || !renderVisible) return
    const selected = selectedId ? canvas.getObjects().find(object => (object as { data?: { id?: string } }).data?.id === selectedId) : undefined
    if (selected && canvas.getActiveObject() !== selected) canvas.setActiveObject(selected)
    if (!selected && canvas.getActiveObject()) canvas.discardActiveObject()
    canvas.requestRenderAll()
  }, [renderVisible, selectedId])

  useEffect(() => {
    const canvas = backgroundRef.current
    if (!canvas || !renderVisible) return
    const outputScale = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.floor(viewport.width * outputScale)
    canvas.height = Math.floor(viewport.height * outputScale)
    canvas.style.width = `${viewport.width}px`
    canvas.style.height = `${viewport.height}px`
    const context = canvas.getContext('2d')
    if (!context) return
    const task = page.render({
      canvas,
      canvasContext: context,
      viewport,
      transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
    })
    void task.promise.catch(error => {
      // Zoom changes, unmounts, and React Strict Mode cancel pending renders.
      if (error?.name !== 'RenderingCancelledException') {
        console.error('PDF page rendering failed:', error)
      }
    })
    return () => task.cancel()
  }, [page, renderVisible, viewport])

  useEffect(() => {
    const container = textLayerRef.current
    if (!container || !renderVisible) return
    container.replaceChildren()
    let cancelled = false
    let textLayer: { render: () => Promise<unknown>; cancel: () => void } | null = null
    void (async () => {
      const pdfjs = await import('pdfjs-dist')
      const textContent = await page.getTextContent()
      if (cancelled) return
      textLayer = new pdfjs.TextLayer({ textContentSource: textContent, container, viewport })
      await textLayer.render()
    })().catch(error => {
      if (!cancelled) console.error('PDF text layer rendering failed:', error)
    })
    return () => {
      cancelled = true
      textLayer?.cancel()
    }
  }, [page, renderVisible, viewport])

  useEffect(() => {
    const element = overlayRef.current
    if (!element || !renderVisible) return
    const canvas = new Canvas(element, {
      width: viewport.width,
      height: viewport.height,
      // Object selection stays available; group transforms need a document-level
      // multi-selection command before they can be committed safely.
      selection: false,
      preserveObjectStacking: true,
    })
    fabricRef.current = canvas

    const scale = viewportScale(viewport)
    let disposed = false
    const addObjects = async () => {
      const notoFonts = elements.filter((item): item is PdfTextElement => item.type === 'text' && item.fontFamily === 'NotoSans')
      if (notoFonts.length) {
        await Promise.all(notoFonts.map(item => document.fonts.load(`${item.italic ? 'italic ' : ''}${item.bold ? 'bold ' : ''}16px "ConvertPro Noto Sans"`)))
        if (disposed) return
      }
      for (const editorElement of [...elements].sort((a, b) => a.zIndex - b.zIndex)) {
        const base = objectOptions(editorElement, viewport)
        let object: any
        switch (editorElement.type) {
          case 'text': {
            const layout = browserTextLayout(editorElement)
            object = new Textbox(layout.lines.join('\n'), {
              ...base,
              width: editorElement.width * scale,
              fontSize: layout.fontSize * scale,
              fontFamily: editorElement.fontFamily === 'TimesRoman' ? 'Times New Roman' : editorElement.fontFamily === 'NotoSans' ? 'ConvertPro Noto Sans' : editorElement.fontFamily,
              fontWeight: editorElement.bold ? 'bold' : 'normal',
              fontStyle: editorElement.italic ? 'italic' : 'normal',
              underline: editorElement.underline,
              textAlign: editorElement.textAlign ?? 'left',
              fill: editorElement.color,
              editable: false,
            })
            break
          }
          case 'image': {
            const url = assetUrls[editorElement.assetId]
            if (!url) continue
            object = await FabricImage.fromURL(url, {}, base)
            if (disposed) return
            object.set({
              scaleX: (editorElement.width * scale) / Math.max(1, object.width),
              scaleY: (editorElement.height * scale) / Math.max(1, object.height),
            })
            break
          }
          case 'rectangle':
          case 'highlight':
            object = new Rect({
              ...base,
              width: editorElement.width * scale,
              height: editorElement.height * scale,
              fill: editorElement.type === 'highlight' ? editorElement.color : editorElement.fillColor || 'transparent',
              stroke: editorElement.type === 'highlight' ? undefined : editorElement.strokeColor,
              strokeWidth: editorElement.type === 'highlight' ? 0 : editorElement.strokeWidth * scale,
              strokeUniform: true,
            })
            break
          case 'ellipse':
            object = new Ellipse({
              ...base,
              originY: 'center',
              rx: editorElement.width * scale / 2,
              ry: editorElement.height * scale / 2,
              top: base.top - editorElement.height * scale / 2,
              fill: editorElement.fillColor || 'transparent',
              stroke: editorElement.strokeColor,
              strokeWidth: editorElement.strokeWidth * scale,
              strokeUniform: true,
            })
            break
          case 'line':
            object = new Line([0, 0, editorElement.width * scale, 0], {
              ...base,
              originY: 'center',
              stroke: editorElement.strokeColor,
              strokeWidth: editorElement.strokeWidth * scale,
              strokeUniform: true,
            })
            break
          case 'checkmark':
          case 'crossmark': {
            const w = editorElement.width * scale
            const h = editorElement.height * scale
            const path = editorElement.type === 'checkmark'
              ? `M 0 ${h * 0.55} L ${w * 0.35} ${h} L ${w} 0`
              : `M 0 ${h} L ${w} 0 M 0 0 L ${w} ${h}`
            object = new Path(path, { ...base, fill: 'transparent', stroke: editorElement.strokeColor, strokeWidth: editorElement.strokeWidth * scale, strokeUniform: true })
            break
          }
          case 'arrow': {
            const length = editorElement.width * scale
            const line = new Line([0, 0, length, 0], { stroke: editorElement.strokeColor, strokeWidth: editorElement.strokeWidth * scale, strokeUniform: true })
            const head = new Triangle({ left: length, top: 0, width: 12 * scale, height: 14 * scale, fill: editorElement.strokeColor, angle: 90, originX: 'center', originY: 'center' })
            object = new Group([line, head], { ...base, originY: 'center' })
            break
          }
          case 'drawing': {
            const points = editorElement.points.map(point => pdfToViewport(point, viewport))
            object = new Polyline(points, {
              fill: 'transparent',
              stroke: editorElement.color,
              strokeWidth: editorElement.strokeWidth * scale,
              strokeUniform: true,
              opacity: editorElement.opacity,
              objectCaching: false,
              data: { id: editorElement.id },
              transparentCorners: false,
              cornerColor: '#4f46e5',
              borderColor: '#4f46e5',
              cornerStyle: 'circle',
            })
            break
          }
        }
        if (!object) continue
        object.set({ selectable: tool === 'select', evented: tool === 'select' })
        canvas.add(object)
        if (editorElement.id === selectedIdRef.current) canvas.setActiveObject(object)
      }
      canvas.requestRenderAll()
    }
    void addObjects()

    const selectionHandler = (event: any) => { if (!disposed) onSelect(event.selected?.[0]?.data?.id || null) }
    canvas.on('selection:created', selectionHandler)
    canvas.on('selection:updated', selectionHandler)
    canvas.on('selection:cleared', () => { if (!disposed) onSelect(null) })
    canvas.on('object:modified', (event: any) => {
      const object = event.target
      const id = object?.data?.id
      const original = elements.find(item => item.id === id)
      if (!original) return
      if (original.type === 'drawing') {
        const matrix = object.calcTransformMatrix()
        const pathOffset = object.pathOffset || new Point(0, 0)
        const points = object.points.map((point: { x: number; y: number }) => {
          const viewportPoint = util.transformPoint(new Point(point.x - pathOffset.x, point.y - pathOffset.y), matrix)
          return viewportToPdf(viewportPoint, viewport)
        })
        onModify({ ...original, ...elementBounds({ ...original, points }), points, rotation: 0 })
      } else {
        const width = Math.max(1, object.getScaledWidth() / scale)
        const height = Math.max(1, object.getScaledHeight() / scale)
        const pdfOrigin = viewportToPdf({ x: object.left || 0, y: object.top || 0 }, viewport)
        // Ellipses use a center Y origin in Fabric; the document anchor is lower left.
        if (original.type === 'ellipse') pdfOrigin.y -= height / 2
        const rotation = normalizeDegrees((object.angle || 0) - viewportRotation(viewport))
        const textChanges = original.type === 'text'
          ? { fontSize: Math.max(4, Math.min(500, original.fontSize * Math.abs(object.scaleY || 1))) }
          : {}
        onModify({ ...original, ...textChanges, x: pdfOrigin.x, y: pdfOrigin.y, width, height, rotation } as PdfEditorElement)
      }
    })

    canvas.on('mouse:down', (event: any) => {
      onActivate(pageIndex)
      if (placingField) {
        const rect = canvas.upperCanvasEl.getBoundingClientRect()
        onAddAt(pageIndex, clientToPdfPoint(event.e.clientX, event.e.clientY, rect, viewport))
        return
      }
      if (tool === 'select' || tool === 'highlight') return
      const scene = canvas.getScenePoint(event.e)
      if (tool === 'draw') {
        const first = viewportToPdf(scene, viewport)
        drawingPointsRef.current = [first]
        const temporary = new Polyline([scene], { fill: 'transparent', stroke: drawColor, strokeWidth: drawWidth * scale, selectable: false, evented: false })
        temporaryDrawingRef.current = temporary
        canvas.add(temporary)
        return
      }
      onAddAt(pageIndex, viewportToPdf(scene, viewport))
    })
    canvas.on('mouse:move', (event: any) => {
      if (!drawingPointsRef.current || !temporaryDrawingRef.current) return
      const scene = canvas.getScenePoint(event.e)
      drawingPointsRef.current.push(viewportToPdf(scene, viewport))
      temporaryDrawingRef.current.set({ points: drawingPointsRef.current.map(point => pdfToViewport(point, viewport)) })
      canvas.requestRenderAll()
    })
    canvas.on('mouse:up', () => {
      const points = drawingPointsRef.current
      if (!points || points.length < 2) return
      const bounds = elementBounds({ points } as PdfDrawingElement)
      onAddDrawing({
        id: crypto.randomUUID(), type: 'drawing', pageIndex, zIndex: 0,
        ...bounds, rotation: 0, opacity: 1, points, color: drawColor, strokeWidth: drawWidth,
      })
      drawingPointsRef.current = null
      temporaryDrawingRef.current = null
    })

    return () => {
      disposed = true
      fabricRef.current = null
      void canvas.dispose()
    }
  }, [assetUrls, drawColor, drawWidth, elements, onActivate, onAddAt, onAddDrawing, onModify, onSelect, pageIndex, placingField, renderVisible, tool, viewport])

  const finishHighlight = (pointerEvent: ReactPointerEvent<HTMLDivElement>) => {
    const container = textLayerRef.current
    if (!container || tool !== 'highlight') return
    const pageRect = container.getBoundingClientRect()
    const selection = window.getSelection()
    const rects: DOMRect[] = []
    if (selection && !selection.isCollapsed && selection.rangeCount) {
      rects.push(...Array.from(selection.getRangeAt(0).getClientRects()))
    } else if (highlightStartRef.current) {
      const start = highlightStartRef.current
      const end = { x: pointerEvent.clientX, y: pointerEvent.clientY }
      rects.push(new DOMRect(Math.min(start.x, end.x), Math.min(start.y, end.y), Math.abs(end.x - start.x), Math.abs(end.y - start.y)))
    }
    const highlights = rects
      .map(rect => {
        const left = Math.max(rect.left, pageRect.left) - pageRect.left
        const top = Math.max(rect.top, pageRect.top) - pageRect.top
        const right = Math.min(rect.right, pageRect.right) - pageRect.left
        const bottom = Math.min(rect.bottom, pageRect.bottom) - pageRect.top
        if (right - left < 2 || bottom - top < 2) return null
        const first = viewportToPdf({ x: left, y: top }, viewport)
        const second = viewportToPdf({ x: right, y: bottom }, viewport)
        return {
          id: crypto.randomUUID(), type: 'highlight' as const, pageIndex, zIndex: 0,
          x: Math.min(first.x, second.x), y: Math.min(first.y, second.y),
          width: Math.abs(second.x - first.x), height: Math.abs(second.y - first.y),
          rotation: 0, opacity: 0.35, color: highlightColor,
        }
      })
      .filter((item): item is PdfHighlightElement => Boolean(item))
    if (highlights.length) onAddHighlights(highlights)
    selection?.removeAllRanges()
    highlightStartRef.current = null
  }

  return (
    <section
      ref={shellRef}
      className={`pdf-page-shell ${active ? 'active' : ''} ${placingField ? 'is-placing' : ''}`}
      data-page-index={pageIndex}
      style={{ width: viewport.width, height: viewport.height }}
      onPointerDown={() => onActivate(pageIndex)}
      aria-label={`PDF page ${pageIndex + 1}`}
    >
      <canvas ref={backgroundRef} className="absolute inset-0" />
      <div
        ref={textLayerRef}
        className={`textLayer pdf-editor-text-layer ${tool === 'highlight' ? 'is-selecting' : ''}`}
        onPointerDown={event => { if (tool === 'highlight') highlightStartRef.current = { x: event.clientX, y: event.clientY } }}
        onPointerUp={finishHighlight}
      />
      <canvas ref={overlayRef} />
      {selectedText && selectedTextBox && <div className="pdf-inline-font-controls" style={{ left: Math.max(4, Math.min(selectedTextBox.left, viewport.width - 92)), top: selectedTextBox.top >= 44 ? selectedTextBox.top - 40 : Math.min(viewport.height - 36, selectedTextBox.top + selectedTextBox.height + 4) }} onPointerDown={event => event.stopPropagation()}>
        <button type="button" aria-label="Decrease selected text size" disabled={selectedText.fontSize <= 4} onClick={() => onModify({ ...selectedText, fontSize: Math.max(4, selectedText.fontSize - 1) })}>−</button>
        <span aria-label={`Font size ${selectedText.fontSize}`}>{selectedText.fontSize}</span>
        <button type="button" aria-label="Increase selected text size" disabled={selectedText.fontSize >= 500} onClick={() => onModify({ ...selectedText, fontSize: Math.min(500, selectedText.fontSize + 1) })}>+</button>
      </div>}
      <span className="pdf-page-number">{pageIndex + 1}</span>
    </section>
  )
}
