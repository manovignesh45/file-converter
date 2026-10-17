'use client'

import type { PdfEditorElement, PdfFontFamily } from '../../types/pdfEditor'
import { browserTextLayout } from '../../lib/pdf/browserTextLayout'

interface PdfEditorInspectorProps {
  element: PdfEditorElement | null
  onChange: (element: PdfEditorElement) => void
  drawColor: string
  drawWidth: number
  highlightColor: string
  onDefaultsChange: (values: { drawColor?: string; drawWidth?: number; highlightColor?: string }) => void
}

export default function PdfEditorInspector({
  element,
  onChange,
  drawColor,
  drawWidth,
  highlightColor,
  onDefaultsChange,
}: PdfEditorInspectorProps) {
  if (!element) {
    return (
      <aside className="pdf-editor-inspector">
        <h2>Properties</h2>
        <p className="text-sm leading-6 text-gray-500">Select an added element to change its appearance.</p>
        <div className="mt-6 space-y-4 border-t border-gray-200 pt-5">
          <label className="pdf-property-label">Drawing color<input type="color" value={drawColor} onChange={event => onDefaultsChange({ drawColor: event.target.value })} /></label>
          <label className="pdf-property-label">Drawing width<input type="range" min="1" max="20" value={drawWidth} onChange={event => onDefaultsChange({ drawWidth: Number(event.target.value) })} /></label>
          <label className="pdf-property-label">Highlight color<input type="color" value={highlightColor} onChange={event => onDefaultsChange({ highlightColor: event.target.value })} /></label>
        </div>
        <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm leading-5 text-amber-900 ring-1 ring-amber-200">
          Original PDF text cannot be changed reliably. Use Add text to place new text. Scanned text also requires OCR and is not directly editable.
        </div>
      </aside>
    )
  }

  const update = (changes: Partial<PdfEditorElement>) => onChange({ ...element, ...changes } as PdfEditorElement)
  const overflow = element.type === 'text' ? browserTextLayout(element).overflow : false

  return (
    <aside className="pdf-editor-inspector">
      <h2>Properties</h2>
      <p className="mb-5 text-sm capitalize text-gray-500">{element.type}</p>

      <div className="space-y-4">
        {element.type === 'text' && (
          <>
            {element.fieldId && <div className="rounded-lg bg-primary-50 p-2 text-xs text-primary-800">{element.fieldLink === 'linked' ? 'Linked to Quick Fill value' : 'Independent value'}{element.fieldLink === 'linked' && <button className="ml-2 font-bold underline" onClick={() => update({ fieldLink: 'independent' })}>Detach</button>}</div>}
            <label className="pdf-property-field">Text<textarea value={element.text} onChange={event => update({ text: event.target.value })} rows={4} /></label>
            <label className="pdf-property-field">Font
              <select value={element.fontFamily} onChange={event => update({ fontFamily: event.target.value as PdfFontFamily })}>
                <option value="Helvetica">Helvetica</option><option value="TimesRoman">Times</option><option value="Courier">Courier</option><option value="NotoSans">Noto Sans</option>
              </select>
            </label>
            <label className="pdf-property-field">Font size<input type="number" min="4" max="500" value={element.fontSize} onChange={event => update({ fontSize: Number(event.target.value) })} /></label>
            <label className="pdf-property-label">Color<input type="color" value={element.color} onChange={event => update({ color: event.target.value })} /></label>
            <div className="grid grid-cols-3 gap-2">
              <button className={`pdf-style-toggle ${element.bold ? 'active' : ''}`} onClick={() => update({ bold: !element.bold })}>Bold</button>
              <button className={`pdf-style-toggle italic ${element.italic ? 'active' : ''}`} onClick={() => update({ italic: !element.italic })}>Italic</button>
              <button className={`pdf-style-toggle underline ${element.underline ? 'active' : ''}`} onClick={() => update({ underline: !element.underline })}>Underline</button>
            </div>
            <label className="pdf-property-field">Alignment<select value={element.textAlign ?? 'left'} onChange={event => update({ textAlign: event.target.value as 'left' | 'center' | 'right' })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
            <label className="pdf-property-label"><input type="checkbox" checked={element.singleLine ?? false} onChange={event => update({ singleLine: event.target.checked })} />Single line</label>
            <label className="pdf-property-label"><input type="checkbox" checked={element.autoFit ?? false} onChange={event => update({ autoFit: event.target.checked })} />Auto-fit text</label>
            {element.autoFit && <label className="pdf-property-field">Minimum font size<input type="number" min="4" max={element.fontSize} value={element.minFontSize ?? 8} onChange={event => update({ minFontSize: Number(event.target.value) })} /></label>}
            {overflow && <p role="status" className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Text exceeds its box at the current minimum size. Widen the box or shorten the text; export keeps the full content.</p>}
          </>
        )}

        {(element.type === 'rectangle' || element.type === 'ellipse') && (
          <>
            <label className="pdf-property-label">Stroke<input type="color" value={element.strokeColor} onChange={event => update({ strokeColor: event.target.value })} /></label>
            <label className="pdf-property-label">Fill<input type="color" value={element.fillColor || '#ffffff'} onChange={event => update({ fillColor: event.target.value })} /></label>
            <label className="pdf-property-label"><input type="checkbox" checked={element.fillColor !== null} onChange={event => update({ fillColor: event.target.checked ? '#ffffff' : null })} />Use fill</label>
            <label className="pdf-property-field">Stroke width<input type="number" min="0" max="100" value={element.strokeWidth} onChange={event => update({ strokeWidth: Number(event.target.value) })} /></label>
          </>
        )}

        {(element.type === 'line' || element.type === 'arrow' || element.type === 'checkmark' || element.type === 'crossmark') && (
          <>
            <label className="pdf-property-label">Stroke<input type="color" value={element.strokeColor} onChange={event => update({ strokeColor: event.target.value })} /></label>
            <label className="pdf-property-field">Stroke width<input type="number" min="1" max="100" value={element.strokeWidth} onChange={event => update({ strokeWidth: Number(event.target.value) })} /></label>
          </>
        )}

        {element.type === 'drawing' && (
          <>
            <label className="pdf-property-label">Color<input type="color" value={element.color} onChange={event => update({ color: event.target.value })} /></label>
            <label className="pdf-property-field">Stroke width<input type="number" min="1" max="100" value={element.strokeWidth} onChange={event => update({ strokeWidth: Number(event.target.value) })} /></label>
          </>
        )}

        {element.type === 'highlight' && <label className="pdf-property-label">Color<input type="color" value={element.color} onChange={event => update({ color: event.target.value })} /></label>}

        <label className="pdf-property-field">Opacity
          <input type="range" min="0.05" max="1" step="0.05" value={element.opacity} onChange={event => update({ opacity: Number(event.target.value) })} />
          <span className="text-xs text-gray-500">{Math.round(element.opacity * 100)}%</span>
        </label>
        <div className="grid grid-cols-2 gap-2"><label className="pdf-property-field">Width<input type="number" min="1" value={Math.round(element.width)} onChange={event => update({ width: Math.max(1, Number(event.target.value)) })} /></label><label className="pdf-property-field">Height<input type="number" min="1" value={Math.round(element.height)} onChange={event => update({ height: Math.max(1, Number(event.target.value)) })} /></label></div>
        {element.type !== 'drawing' && element.type !== 'highlight' && <label className="pdf-property-field">Rotation<input type="number" min="-360" max="360" value={Math.round(element.rotation)} onChange={event => update({ rotation: Number(event.target.value) })} /></label>}
      </div>
    </aside>
  )
}
