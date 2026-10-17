'use client'

import type { PdfFieldDefinition } from '../../types/pdfFields'
import type { PdfDateFormat } from '../../lib/pdf/dateFormatting'
import { FIELD_DRAG_TYPE } from '../../lib/pdf/placement'

interface Props {
  fields: PdfFieldDefinition[]
  activeFieldId: string | null
  onSelectField: (id: string) => void
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

export default function QuickFillPanel({ fields, activeFieldId, onSelectField, onChangeField, onToday, scope, onScopeChange, selectedPages, onTogglePage, pageCount, onCreateSignature, onDeleteSignature, onRenameSignature, signatureUrls, savedSignatureIds }: Props) {
  return <aside className="pdf-fill-panel" aria-label="Quick Fill">
    <h2>Quick Fill</h2>
    <p className="mb-4">Enter a value once, then click Place or drag its row onto a page. Placed text stays linked until you edit that instance.</p>
    <div className="space-y-3">
      {fields.map(field => <div key={field.id} className={`pdf-field-card ${activeFieldId === field.id ? 'active' : ''}`}>
        <div className="flex items-center justify-between gap-2">{field.kind === 'signature' ? <input className="min-w-0 flex-1 text-sm font-semibold" aria-label="Signature name" defaultValue={field.label} onBlur={event => { if (event.target.value.trim() && event.target.value.trim() !== field.label) onRenameSignature(field.id, event.target.value.trim()) }} /> : <strong className="text-sm text-gray-800">{field.label}</strong>}<button className="pdf-style-toggle" onClick={() => onSelectField(field.id)} aria-pressed={activeFieldId === field.id}>Place</button><button className="pdf-style-toggle cursor-grab" draggable onDragStart={event => { event.dataTransfer.setData(FIELD_DRAG_TYPE, field.id); event.dataTransfer.effectAllowed = 'copy' }} title={`Drag ${field.label} onto a page`}>Drag</button></div>
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
