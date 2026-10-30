'use client'

import { useState } from 'react'
import {
  ArrowDownRight, Combine, FileImage, FileLock2, FilePenLine, FilePlus2,
  FileText, FileType2, ImageDown, RotateCw, Scan, Scissors, Stamp,
} from 'lucide-react'

export type ToolId = 'image-compress' | 'image-resize' | 'image-convert' | 'images-to-pdf' |
  'image-watermark' | 'pdf-edit' | 'pdf-compress' | 'pdf-unlock' | 'pdf-to-word' | 'pdf-merge' |
  'pdf-split' | 'pdf-rotate'

export const tools = [
  { id: 'image-compress', category: 'Images', title: 'Compress image', description: 'Make images smaller while keeping the detail you need.', icon: ImageDown, tone: 'blue' },
  { id: 'image-resize', category: 'Images', title: 'Resize image', description: 'Set new dimensions or crop an image to fit.', icon: Scan, tone: 'violet' },
  { id: 'image-convert', category: 'Images', title: 'Convert image', description: 'Change images between JPG, PNG, and WebP.', icon: FileImage, tone: 'teal' },
  { id: 'images-to-pdf', category: 'Images', title: 'Images to PDF', description: 'Put one or more images into a single PDF.', icon: FilePlus2, tone: 'orange' },
  { id: 'image-watermark', category: 'Images', title: 'Watermark image', description: 'Add your text to images in the position you choose.', icon: Stamp, tone: 'pink' },
  { id: 'pdf-to-word', category: 'PDFs', title: 'PDF to Word', description: 'Turn a PDF into an editable Word document.', icon: FileType2, tone: 'blue' },
  { id: 'pdf-merge', category: 'PDFs', title: 'Merge PDF', description: 'Combine several PDFs into one, in the order you choose.', icon: Combine, tone: 'teal' },
  { id: 'pdf-split', category: 'PDFs', title: 'Split PDF', description: 'Save every page, or chosen page ranges, as separate PDFs.', icon: Scissors, tone: 'pink' },
  { id: 'pdf-rotate', category: 'PDFs', title: 'Rotate PDF', description: 'Turn all pages, or only some, the right way up.', icon: RotateCw, tone: 'green' },
  { id: 'pdf-edit', category: 'PDFs', title: 'Edit PDF', description: 'Add text, images, shapes, and markup to a PDF.', icon: FilePenLine, tone: 'violet' },
  { id: 'pdf-compress', category: 'PDFs', title: 'Compress PDF', description: 'Reduce the size of a PDF document.', icon: FileText, tone: 'green' },
  { id: 'pdf-unlock', category: 'PDFs', title: 'Unlock PDF', description: 'Remove a PDF password when you know it.', icon: FileLock2, tone: 'orange' },
] as const

type Category = 'All tools' | 'Images' | 'PDFs'

export default function ToolDirectory({ selectedTool, onSelect }: {
  selectedTool: ToolId | null
  onSelect: (tool: ToolId) => void
}) {
  const [category, setCategory] = useState<Category>('All tools')
  const visibleTools = tools.filter(tool => category === 'All tools' || tool.category === category)

  return (
    <section className="tool-directory" aria-labelledby="tools-heading">
      <div className="tool-intro">
        <h1 id="tools-heading">What would you like to do?</h1>
        <p>Choose a tool to work with your images or PDFs.</p>
      </div>

      <div className="tool-filters" role="group" aria-label="Filter tools">
        {(['All tools', 'Images', 'PDFs'] as const).map(item => (
          <button
            key={item}
            type="button"
            className={`tool-filter ${category === item ? 'is-active' : ''}`}
            aria-pressed={category === item}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="tool-grid">
        {visibleTools.map(tool => {
          const Icon = tool.icon
          return (
            <button
              key={tool.id}
              type="button"
              className={`tool-card ${selectedTool === tool.id ? 'is-selected' : ''}`}
              onClick={() => onSelect(tool.id)}
              aria-pressed={selectedTool === tool.id}
              aria-label={`Choose ${tool.title}`}
            >
              <span className={`tool-card-icon tone-${tool.tone}`} aria-hidden="true"><Icon size={30} strokeWidth={1.8} /></span>
              <span className="tool-card-title">{tool.title}</span>
              <span className="tool-card-description">{tool.description}</span>
              <ArrowDownRight className="tool-card-arrow" size={20} aria-hidden="true" />
            </button>
          )
        })}
      </div>
    </section>
  )
}
