'use client'

import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { hasVisiblePixels, validateSignatureBlob, type SignatureRecord } from '../../lib/pdf/signatures'

interface Props { onClose: () => void; onSave: (record: SignatureRecord, saveLocally: boolean) => Promise<void> }

function pngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not create the signature image.')), 'image/png'))
}

export default function SignatureDialog({ onClose, onSave }: Props) {
  const [method, setMethod] = useState<'draw' | 'type' | 'upload'>('draw')
  const [name, setName] = useState('My signature')
  const [text, setText] = useState('')
  const [font, setFont] = useState<'serif' | 'script'>('script')
  const [upload, setUpload] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [saveLocally, setSaveLocally] = useState(false)
  const [hasStroke, setHasStroke] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const strokesRef = useRef<Array<Array<{ x: number; y: number }>>>([])
  const strokeLengthRef = useRef(0)

  useEffect(() => {
    if (!upload) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(upload)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [upload])

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: (event.clientX - rect.left) * event.currentTarget.width / rect.width, y: (event.clientY - rect.top) * event.currentTarget.height / rect.height }
  }
  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    canvas.setPointerCapture(event.pointerId)
    const pos = point(event)
    context.strokeStyle = '#111827'
    context.lineWidth = 3
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.beginPath()
    context.moveTo(pos.x, pos.y)
    context.lineTo(pos.x + 0.1, pos.y + 0.1)
    context.stroke()
    drawingRef.current = true
    strokesRef.current.push([pos])
    setHasStroke(true)
  }
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    const pos = point(event)
    const stroke = strokesRef.current.at(-1)
    const previous = stroke?.at(-1)
    if (previous) strokeLengthRef.current += Math.hypot(pos.x - previous.x, pos.y - previous.y)
    stroke?.push(pos)
    context.lineTo(pos.x, pos.y)
    context.stroke()
  }
  const save = async () => {
    if (!name.trim()) { setError('Give the signature a name.'); return }
    setBusy(true)
    setError(null)
    try {
      let blob: Blob
      let source: SignatureRecord['source']
      if (method === 'draw') {
        if (!hasStroke || strokeLengthRef.current < 8 || !canvasRef.current) throw new Error('Draw a signature before saving it.')
        blob = await pngBlob(canvasRef.current)
        source = { kind: 'draw', strokes: strokesRef.current.map(stroke => stroke.map(point => ({ ...point }))) }
      } else if (method === 'type') {
        if (!text.trim()) throw new Error('Type a signature before saving it.')
        const family = font === 'script' ? 'ConvertPro Signature Display' : 'ConvertPro Signature Serif'
        await document.fonts.load(`italic 72px "${family}"`)
        const canvas = document.createElement('canvas')
        canvas.width = 700
        canvas.height = 180
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Signature canvas is unavailable.')
        context.fillStyle = '#111827'
        context.font = `italic 72px "${family}"`
        context.textBaseline = 'middle'
        context.fillText(text.trim(), 24, 90, 650)
        blob = await pngBlob(canvas)
        source = { kind: 'type', text: text.trim(), font }
      } else {
        if (!upload) throw new Error('Choose a signature image.')
        blob = upload
        source = { kind: 'upload' }
      }
      const mimeType = await validateSignatureBlob(blob)
      if (method === 'upload') {
        const bitmap = await createImageBitmap(blob)
        if (bitmap.width * bitmap.height > 40_000_000) { bitmap.close(); throw new Error('Signature image dimensions are too large.') }
        if (mimeType === 'image/png') {
          const sample = document.createElement('canvas')
          sample.width = Math.min(128, bitmap.width)
          sample.height = Math.min(128, bitmap.height)
          const context = sample.getContext('2d')
          context?.drawImage(bitmap, 0, 0, sample.width, sample.height)
          const pixels = context?.getImageData(0, 0, sample.width, sample.height).data
          if (pixels && !hasVisiblePixels(pixels)) { bitmap.close(); throw new Error('The uploaded signature image is fully transparent.') }
        }
        bitmap.close()
      }
      await onSave({ id: crypto.randomUUID(), name: name.trim(), blob, mimeType, source }, saveLocally)
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the signature.')
    } finally { setBusy(false) }
  }

  return <div className="pdf-signature-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><div className="pdf-signature-dialog" role="dialog" aria-modal="true" aria-label="Create signature">
    <h2 className="text-lg font-bold">Create a visual signature</h2>
    <p className="mt-1 text-xs text-gray-600">This creates an image placed on the PDF; it is not certificate-based signing.</p>
    <div className="mt-4 flex gap-2">{(['draw', 'type', 'upload'] as const).map(value => <button key={value} className={`pdf-style-toggle capitalize ${method === value ? 'active' : ''}`} onClick={() => setMethod(value)}>{value}</button>)}</div>
    {method === 'draw' && <div className="mt-3"><canvas ref={canvasRef} width={700} height={180} className="w-full rounded-lg border border-gray-300 bg-white" style={{ touchAction: 'none' }} onPointerDown={start} onPointerMove={move} onPointerUp={() => { drawingRef.current = false }} onPointerCancel={() => { drawingRef.current = false }} aria-label="Draw signature" /><button className="mt-2 text-sm text-primary-700" onClick={() => { canvasRef.current?.getContext('2d')?.clearRect(0, 0, 700, 180); strokesRef.current = []; strokeLengthRef.current = 0; setHasStroke(false) }}>Clear drawing</button></div>}
    {method === 'type' && <div className="mt-3 space-y-2"><input className="input-field" aria-label="Signature text" value={text} onChange={event => setText(event.target.value)} placeholder="Type your name" /><select className="input-field" aria-label="Signature style" value={font} onChange={event => setFont(event.target.value as 'serif' | 'script')}><option value="script">Display italic</option><option value="serif">Serif italic</option></select><div className="min-h-20 rounded-lg border border-gray-200 p-3 text-3xl italic" style={{ fontFamily: font === 'script' ? 'ConvertPro Signature Display' : 'ConvertPro Signature Serif' }}>{text || 'Preview'}</div></div>}
    {method === 'upload' && <div className="mt-3"><input type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" aria-label="Upload signature image" onChange={event => setUpload(event.target.files?.[0] || null)} />{previewUrl && <div role="img" aria-label="Signature preview" className="mt-3 h-32 w-full bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${previewUrl})` }} />}</div>}
    <label className="pdf-property-field mt-4">Signature name<input value={name} onChange={event => setName(event.target.value)} maxLength={100} /></label>
    <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={saveLocally} onChange={event => setSaveLocally(event.target.checked)} />Save to this browser for reuse</label>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    <div className="mt-5 flex justify-end gap-2"><button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="btn-primary" onClick={() => { void save() }} disabled={busy}>{busy ? 'Saving…' : 'Add signature'}</button></div>
  </div></div>
}
