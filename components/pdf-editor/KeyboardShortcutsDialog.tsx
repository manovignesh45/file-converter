'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { editorTools } from './PdfEditorToolbar'

const isMac = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform)
const mod = isMac ? '⌘' : 'Ctrl'

const groups: Array<{ title: string; items: Array<[string, string[]]> }> = [
  { title: 'Tools', items: editorTools.map(tool => [tool.label, [tool.shortcut]]) },
  {
    title: 'View',
    items: [
      ['Zoom in', [mod, '+']],
      ['Zoom out', [mod, '−']],
      ['Actual size (100%)', [mod, '0']],
      ['Zoom at the pointer', [mod, 'scroll']],
    ],
  },
  {
    title: 'Editing',
    items: [
      ['Undo', [mod, 'Z']],
      ['Redo', [mod, 'Shift', 'Z']],
      ['Copy / paste item', [mod, 'C / V']],
      ['Duplicate item', [mod, 'D']],
      ['Delete item', ['Delete']],
      ['Nudge item', ['Arrow keys']],
      ['Nudge 10 points', ['Shift', 'Arrow keys']],
      ['Deselect / select tool', ['Esc']],
      ['Show this list', ['?']],
    ],
  },
]

export default function KeyboardShortcutsDialog({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose() }
    }
    // Capture so Escape closes the dialog without also clearing the editor's selection.
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [onClose])

  return (
    <div className="pdf-signature-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className="pdf-shortcuts-dialog" role="dialog" aria-modal="true" aria-labelledby="pdf-shortcuts-title">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="pdf-shortcuts-title" className="text-lg font-bold text-gray-900">Keyboard shortcuts</h2>
          <button ref={closeRef} className="pdf-icon-button" onClick={onClose} aria-label="Close keyboard shortcuts"><X /></button>
        </div>
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {groups.map(group => (
            <section key={group.title} className={group.title === 'Editing' ? 'sm:col-span-2' : undefined}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{group.title}</h3>
              <dl className={group.title === 'Editing' ? 'grid gap-x-8 sm:grid-cols-2' : undefined}>
                {group.items.map(([label, keys]) => (
                  <div key={label} className="flex items-center justify-between gap-3 border-b border-gray-100 py-1.5 text-sm">
                    <dt className="text-gray-700">{label}</dt>
                    <dd className="flex flex-none gap-1">{keys.map(key => <kbd key={key} className="pdf-kbd">{key}</kbd>)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
