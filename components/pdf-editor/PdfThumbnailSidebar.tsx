'use client'

import { useEffect, useRef, useState } from 'react'
import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api'

function Thumbnail({ page, pageIndex, active, onSelect }: { page: PDFPageProxy; pageIndex: number; active: boolean; onSelect: (pageIndex: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [visible, setVisible] = useState(pageIndex === 0)
  useEffect(() => {
    const button = buttonRef.current
    if (!button || visible) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) { setVisible(true); observer.disconnect() }
    }, { rootMargin: '200px' })
    observer.observe(button)
    return () => observer.disconnect()
  }, [visible])
  useEffect(() => {
    if (!visible || !canvasRef.current) return
    const viewport = page.getViewport({ scale: Math.min(0.23, 150 / page.getViewport({ scale: 1 }).width) })
    const canvas = canvasRef.current
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const context = canvas.getContext('2d')
    if (!context) return
    const task = page.render({ canvas, canvasContext: context, viewport })
    void task.promise.catch(error => {
      if (error?.name !== 'RenderingCancelledException') console.error('PDF thumbnail rendering failed:', error)
    })
    return () => task.cancel()
  }, [page, visible])
  return <button ref={buttonRef} className={`pdf-thumbnail ${active ? 'active' : ''}`} onClick={() => onSelect(pageIndex)} aria-label={`Go to page ${pageIndex + 1}`} aria-current={active ? 'page' : undefined}><canvas ref={canvasRef} aria-hidden="true" /><span>Page {pageIndex + 1}</span></button>
}

export default function PdfThumbnailSidebar({ pages, activePage, onSelect }: { pages: PDFPageProxy[]; activePage: number; onSelect: (pageIndex: number) => void }) {
  return <aside className="pdf-thumbnail-sidebar" aria-label="Page thumbnails">{pages.map((page, index) => <Thumbnail key={index} page={page} pageIndex={index} active={activePage === index} onSelect={onSelect} />)}</aside>
}
