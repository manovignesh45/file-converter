'use client'

import { useState, useEffect, useCallback } from 'react'
import { ConversionOptions } from '../types'

// Modern icon components
const Settings = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const Zap = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)

const Resize = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
  </svg>
)

const FileImage = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

const Type = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
  </svg>
)

const FileMinus = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)

const Unlock = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
  </svg>
)

const Edit = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 13H9v-2.828l6.586-6.586z" />
  </svg>
)

interface OptionsPanelProps {
  options: ConversionOptions
  onOptionsChange: (options: ConversionOptions) => void
  onProcess: () => void
  canProcess: boolean
  images: Array<{ id: string; file: File; preview: string; order: number; estimatedSize?: number; originalSize: number; isPdf?: boolean }>
  lockOperation?: boolean
}

export default function OptionsPanel({ options, onOptionsChange, onProcess, canProcess, images, lockOperation = false }: OptionsPanelProps) {
  // Analyze uploaded file types
  const fileTypes = {
    hasImages: images.some(img => img.file.type.startsWith('image/')),
    hasPDFs: images.some(img => img.file.type === 'application/pdf' || img.isPdf),
    imageCount: images.filter(img => img.file.type.startsWith('image/')).length,
    pdfCount: images.filter(img => img.file.type === 'application/pdf' || img.isPdf).length,
  }

  // Generate contextual operations based on uploaded files
  const getAvailableOperations = useCallback(() => {
    const operations = []

    if (fileTypes.hasImages) {
      operations.push(
        { value: 'compress', label: 'Compress', desc: 'Reduce file size', icon: Zap },
        { value: 'resize', label: 'Resize', desc: 'Change dimensions', icon: Resize },
        { value: 'convert', label: 'Convert', desc: 'Change format', icon: FileImage },
        { value: 'watermark', label: 'Watermark', desc: 'Add watermark', icon: Type }
      )
    }

    if (fileTypes.hasPDFs) {
      operations.push(
        { value: 'pdf-edit', label: 'Edit PDF', desc: 'Add text, images and markup', icon: Edit },
        { value: 'pdf-compress', label: 'Compress PDF', desc: 'Reduce PDF size', icon: FileMinus },
        { value: 'pdf-remove-password', label: 'Unlock PDF', desc: 'Remove password', icon: Unlock }
      )
    }

    return operations
  }, [fileTypes.hasImages, fileTypes.hasPDFs])

  const availableOperations = getAvailableOperations()

  const updateOption = useCallback((key: keyof ConversionOptions, value: any) => {
    const updatedOptions = { ...options, [key]: value }
    
    // Set default values when operation changes
    if (key === 'operation') {
      if (value === 'convert' && !options.outputFormat) {
        updatedOptions.outputFormat = 'jpg'
      }
      if (value === 'watermark' && !options.watermarkPosition) {
        updatedOptions.watermarkPosition = 'bottom-right'
      }
      if (value === 'watermark' && !options.watermarkColor) {
        updatedOptions.watermarkColor = '#ffffff'
      }
      if (value === 'watermark' && !options.watermarkText) {
        updatedOptions.watermarkText = 'Sample Watermark'
      }
    }
    
    onOptionsChange(updatedOptions)
  }, [options, onOptionsChange])

  // Auto-select operation based on file types when files change
  useEffect(() => {
    if (lockOperation) return
    if (images.length > 0 && availableOperations.length > 0) {
      const currentOperationAvailable = availableOperations.some(op => op.value === options.operation)
      
      if (!options.operation || !currentOperationAvailable) {
        if (fileTypes.hasPDFs && !fileTypes.hasImages) {
          updateOption('operation', 'pdf-compress')
        } else {
          updateOption('operation', 'compress')
        }
      }
    }
  }, [images.length, fileTypes.hasImages, fileTypes.hasPDFs, options.operation, updateOption, availableOperations, lockOperation])

  return (
    <div className="card sticky top-6 h-fit backdrop-blur-xl bg-white/50 border-0 shadow-xl ring-1 ring-black/5">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary-500" />
          Settings
        </h2>
        <p className="text-sm text-gray-500">Configure processing options</p>
      </div>

      {images.length > 0 ? (
        <>
          {/* Operation Type */}
          {!lockOperation && <div className="mb-8">
            <label className="label-text">Operation</label>
            
            <div className="grid grid-cols-1 gap-2">
              {availableOperations.map((op) => {
                const IconComponent = op.icon || Settings
                const isSelected = options.operation === op.value

                return (
                  <button
                    key={op.value}
                    onClick={() => updateOption('operation', op.value)}
                    className={`flex items-center p-3 rounded-xl transition-all duration-200 text-left border relative overflow-hidden group ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50/50 shadow-md shadow-primary-500/10'
                        : 'border-transparent bg-white hover:bg-gray-50 hover:border-gray-200'
                    }`}
                  >
                    <div className={`p-2 rounded-lg mr-3 transition-colors ${
                      isSelected ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'
                    }`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`font-semibold text-sm ${
                        isSelected ? 'text-primary-900' : 'text-gray-900'
                      }`}>
                        {op.label}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {op.desc}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="absolute right-0 top-0 bottom-0 w-1 bg-primary-500" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>}

          {/* Dynamic Options based on Operation */}
          <div className="space-y-6">
            
            {/* COMPRESSION OPTIONS */}
            {options.operation === 'compress' && (
              <div className="bg-white/60 rounded-xl p-4 border border-gray-100 space-y-4">
                <div>
                  <label className="label-text flex justify-between">
                    <span>Compression Level</span>
                    <span className="text-primary-600 font-semibold">{options.compressionQuality || 80}%</span>
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={options.compressionQuality || 80}
                    onChange={(e) => updateOption('compressionQuality', parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-2 font-medium px-1">
                    <span>Max Compression</span>
                    <span>Best Quality</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                   <label className="label-text mb-3">Quick Presets</label>
                   <div className="grid grid-cols-2 gap-2">
                     {[
                       { size: 50, label: 'Govt. Sites' },
                       { size: 100, label: 'Standard' },
                       { size: 200, label: 'High Quality' },
                       { size: 500, label: 'Max' },
                     ].map((preset) => (
                       <button
                        key={preset.size}
                        onClick={() => {
                          onOptionsChange({
                            ...options,
                            targetSize: preset.size,
                            targetSizeUnit: 'KB',
                            compressionQuality: undefined
                          })
                        }}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                          options.targetSize === preset.size
                            ? 'bg-primary-600 text-white border-primary-600 shadow-lg shadow-primary-500/30'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                        }`}
                       >
                         {preset.size} KB
                         <span className="block opacity-75 text-[10px]">{preset.label}</span>
                       </button>
                     ))}
                   </div>
                </div>
              </div>
            )}

            {/* PDF COMPRESSION */}
            {options.operation === 'pdf-compress' && (
              <div className="bg-white/60 rounded-xl p-4 border border-gray-100 space-y-4">
                 <div>
                  <label className="label-text flex justify-between">
                    <span>Quality Level</span>
                    <span className="text-primary-600 font-semibold">{options.compressionQuality || 75}%</span>
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={options.compressionQuality || 75}
                    onChange={(e) => updateOption('compressionQuality', parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-500"
                  />
                </div>
                
                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="optimizeImages"
                    checked={options.optimizeImages || false}
                    onChange={(e) => updateOption('optimizeImages', e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500 border-gray-300"
                  />
                  <label htmlFor="optimizeImages" className="text-sm text-gray-700">
                    Optimize images inside PDF
                  </label>
                </div>
              </div>
            )}

            {/* RESIZE OPTIONS */}
            {options.operation === 'resize' && (
              <div className="bg-white/60 rounded-xl p-4 border border-gray-100 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-text">Width</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={options.resizeWidth || ''}
                        onChange={(e) => updateOption('resizeWidth', e.target.value ? parseInt(e.target.value) : undefined)}
                        className="input-field"
                        placeholder="Auto"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-medium">PX</span>
                    </div>
                  </div>
                  <div>
                    <label className="label-text">Height</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={options.resizeHeight || ''}
                        onChange={(e) => updateOption('resizeHeight', e.target.value ? parseInt(e.target.value) : undefined)}
                        className="input-field"
                        placeholder="Auto"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-medium">PX</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="maintainAspect"
                      checked={options.maintainAspectRatio !== false}
                      onChange={(e) => updateOption('maintainAspectRatio', e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 shadow-sm focus:border-primary-300 focus:ring focus:ring-primary-200 focus:ring-opacity-50"
                    />
                    <label htmlFor="maintainAspect" className="text-sm text-gray-700">Maintain aspect ratio</label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="cropToFit"
                      checked={options.cropToFit || false}
                      onChange={(e) => updateOption('cropToFit', e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 shadow-sm focus:border-primary-300 focus:ring focus:ring-primary-200 focus:ring-opacity-50"
                    />
                    <label htmlFor="cropToFit" className="text-sm text-gray-700">Crop to fit</label>
                  </div>
                </div>
              </div>
            )}

            {/* CONVERT OPTIONS */}
            {options.operation === 'convert' && (
               <div className="bg-white/60 rounded-xl p-4 border border-gray-100 space-y-4">
                 <div>
                   <label className="label-text">Output Format</label>
                   <select
                    value={options.outputFormat || 'jpg'}
                    onChange={(e) => updateOption('outputFormat', e.target.value)}
                    className="input-field"
                   >
                     <option value="jpg">JPEG (Photo)</option>
                     <option value="png">PNG (Transparent)</option>
                     <option value="webp">WebP (Modern)</option>
                     {fileTypes.hasImages && <option value="pdf">PDF Document</option>}
                   </select>
                 </div>
               </div>
            )}
            
            {/* PDF PASSWORD REMOVE */}
            {options.operation === 'pdf-remove-password' && (
              <div className="bg-white/60 rounded-xl p-4 border border-red-100 space-y-4">
                 <div>
                   <label className="label-text text-gray-800">File Password</label>
                   <input
                    type="password"
                    value={options.pdfPassword || ''}
                    onChange={(e) => updateOption('pdfPassword', e.target.value)}
                    className="input-field border-red-200 focus:border-red-500 focus:ring-red-500/20"
                    placeholder="Enter password to unlock"
                   />
                   <p className="text-xs text-red-500 mt-1.5 flex items-center">
                     <span className="w-1 h-1 bg-red-500 rounded-full mr-1.5"></span>
                     Required to process file
                   </p>
                 </div>
              </div>
            )}

            {/* PDF TO WORD */}
            {options.operation === 'pdf-to-word' && (
              <div className="bg-white/60 rounded-xl p-4 border border-gray-100 space-y-2 text-sm text-gray-600">
                <p>Text, headings, bold and italic styling are kept as editable Word text. Each PDF page starts a new page in the document.</p>
                <p className="text-xs text-gray-500">Scanned PDFs have no selectable text and cannot be converted.</p>
              </div>
            )}

            {/* PDF MERGE */}
            {options.operation === 'pdf-merge' && (
              <div className="bg-white/60 rounded-xl p-4 border border-gray-100 text-sm text-gray-600">
                {images.length < 2
                  ? 'Add at least two PDFs to merge.'
                  : `${images.length} PDFs will be combined in the order shown. Drag the files to change it.`}
              </div>
            )}

            {/* PDF SPLIT / ROTATE */}
            {(options.operation === 'pdf-split' || options.operation === 'pdf-rotate') && (
              <div className="bg-white/60 rounded-xl p-4 border border-gray-100 space-y-4">
                {options.operation === 'pdf-rotate' && (
                  <div>
                    <label className="label-text">Rotate clockwise</label>
                    <div className="grid grid-cols-3 gap-2">
                      {([90, 180, 270] as const).map(angle => (
                        <button
                          key={angle}
                          type="button"
                          onClick={() => updateOption('pdfRotation', angle)}
                          aria-pressed={(options.pdfRotation || 90) === angle}
                          className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
                            (options.pdfRotation || 90) === angle
                              ? 'bg-primary-600 text-white border-primary-600 shadow-lg shadow-primary-500/30'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {angle}°
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label htmlFor="pdfPageRanges" className="label-text">Pages</label>
                  <input
                    id="pdfPageRanges"
                    type="text"
                    value={options.pdfPageRanges || ''}
                    onChange={(e) => updateOption('pdfPageRanges', e.target.value)}
                    className="input-field"
                    placeholder={options.operation === 'pdf-split' ? 'Every page' : 'All pages'}
                  />
                  <p className="text-xs text-gray-500 mt-1.5">
                    {options.operation === 'pdf-split'
                      ? 'Leave empty to save each page separately, or enter ranges like 1-3, 4-6 to get one PDF per range.'
                      : 'Leave empty to rotate every page, or enter pages like 1, 3-5.'}
                  </p>
                </div>
              </div>
            )}

          </div>

          <div className="mt-8">
            <button
              onClick={onProcess}
              disabled={!canProcess}
              className={`w-full py-4 px-6 rounded-xl text-white font-bold text-lg shadow-xl transition-all duration-300 transform hover:-translate-y-1 ${
                canProcess
                  ? 'bg-gradient-to-r from-primary-600 to-indigo-600 hover:shadow-primary-500/30'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              {({
                'pdf-remove-password': 'Unlock PDF',
                'pdf-edit': 'Open Editor',
                'pdf-to-word': 'Convert to Word',
                'pdf-merge': 'Merge PDFs',
                'pdf-split': 'Split PDF',
                'pdf-rotate': 'Rotate PDF',
              } as Partial<Record<ConversionOptions['operation'], string>>)[options.operation] ?? 'Start Processing'}
            </button>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-gray-400 bg-white/50 rounded-xl border-dashed border-2 border-gray-100">
           <p>Upload files to configure options</p>
        </div>
      )}
    </div>
  )
}
