'use client'

import type { PdfEditorElement } from '../../types/pdfEditor'
import { browserTextLayout } from '../../lib/pdf/browserTextLayout'

interface Props {
  element: PdfEditorElement | null
  onChange: (element: PdfEditorElement) => void
  onClose: () => void
}

export default function PdfEditorInspector({ element, onChange, onClose }: Props) {
  const update = (changes: Partial<PdfEditorElement>) => {
    if (element) onChange({ ...element, ...changes } as PdfEditorElement)
  }
  const overflow = element?.type === 'text' ? browserTextLayout(element).overflow : false

  return <div id="pdf-advanced-options" className="pdf-editor-advanced" role="dialog" aria-label="More editing options">
    <div className="mb-4 flex items-center justify-between gap-2"><h2 className="font-semibold text-gray-900">More options</h2><button className="text-sm font-medium text-primary-700" onClick={onClose}>Close</button></div>
    {!element ? <p className="text-sm leading-6 text-gray-500">Select an added item to edit its content and size. Original PDF text is read-only.</p> : <div className="space-y-4">
      {element.type === 'text' && <>
        {element.fieldId && <div className="rounded-lg bg-primary-50 p-2 text-xs text-primary-800">{element.fieldLink === 'linked' ? 'Linked to Quick Fill value' : 'Independent value'}{element.fieldLink === 'linked' && <button className="ml-2 font-bold underline" onClick={() => update({ fieldLink: 'independent' })}>Detach</button>}</div>}
        <label className="pdf-property-field">Text<textarea value={element.text} onChange={event => update({ text: event.target.value })} rows={3} /></label>
        <label className="pdf-property-field">Alignment<select value={element.textAlign ?? 'left'} onChange={event => update({ textAlign: event.target.value as 'left' | 'center' | 'right' })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
        <label className="pdf-property-label"><input type="checkbox" checked={element.singleLine ?? false} onChange={event => update({ singleLine: event.target.checked })} />Single line</label>
        <label className="pdf-property-label"><input type="checkbox" checked={element.autoFit ?? false} onChange={event => update({ autoFit: event.target.checked })} />Auto-fit text</label>
        {element.autoFit && <label className="pdf-property-field">Minimum font size<input type="number" min="4" max={element.fontSize} value={element.minFontSize ?? 8} onChange={event => update({ minFontSize: Number(event.target.value) })} /></label>}
        {overflow && <p role="status" className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Text exceeds its box. Widen the box or shorten the text; export keeps the full content.</p>}
      </>}
      {(element.type === 'rectangle' || element.type === 'ellipse') && <label className="pdf-property-label"><input type="checkbox" checked={element.fillColor !== null} onChange={event => update({ fillColor: event.target.checked ? '#ffffff' : null })} />Use fill</label>}
      <div className="grid grid-cols-2 gap-2"><label className="pdf-property-field">Width<input type="number" min="1" value={Math.round(element.width)} onChange={event => update({ width: Math.max(1, Number(event.target.value)) })} /></label><label className="pdf-property-field">Height<input type="number" min="1" value={Math.round(element.height)} onChange={event => update({ height: Math.max(1, Number(event.target.value)) })} /></label></div>
      {element.type !== 'drawing' && element.type !== 'highlight' && <label className="pdf-property-field">Rotation<input type="number" min="-360" max="360" value={Math.round(element.rotation)} onChange={event => update({ rotation: Number(event.target.value) })} /></label>}
    </div>}
  </div>
}
