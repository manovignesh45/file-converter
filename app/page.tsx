'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import DragDropUploader from '../components/DragDropUploader'
import OptionsPanel from '../components/OptionsPanel'
import ProgressModal from '../components/ProgressModal'
import ResultsView from '../components/ResultsView'
import Header from '../components/Header'
import PdfEditor from '../components/pdf-editor/PdfEditor'
import ToolDirectory, { ToolId, tools } from '../components/ToolDirectory'
import { ImageFile, ConversionOptions, JobProgress } from '../types'

export default function Home() {
  const [images, setImages] = useState<ImageFile[]>([])
  const [options, setOptions] = useState<ConversionOptions>({
    operation: 'compress',
    compressionQuality: 80,
  })
  const [currentJob, setCurrentJob] = useState<JobProgress | null>(null)
  const [results, setResults] = useState<Array<string | {
    fileName: string
    originalSize?: number
    processedSize?: number
    compressionRatio?: number
    dimensions?: { width: number; height: number }
    format?: string
    pageCount?: number
  }>>([])
  const [isCleaningUp, setIsCleaningUp] = useState(false)
  const [editorFile, setEditorFile] = useState<File | null>(null)
  const [selectedTool, setSelectedTool] = useState<ToolId | null>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const isPdfTool = selectedTool?.startsWith('pdf-') ?? false
  const hasIncompatibleFiles = images.some(image =>
    isPdfTool ? image.file.type !== 'application/pdf' : !image.file.type.startsWith('image/')
  )

  const selectTool = (tool: ToolId) => {
    const operations: Record<ToolId, ConversionOptions['operation']> = {
      'image-compress': 'compress',
      'image-resize': 'resize',
      'image-convert': 'convert',
      'images-to-pdf': 'convert',
      'image-watermark': 'watermark',
      'pdf-edit': 'pdf-edit',
      'pdf-compress': 'pdf-compress',
      'pdf-unlock': 'pdf-remove-password',
    }
    setSelectedTool(tool)
    setOptions(previous => ({
      ...previous,
      operation: operations[tool],
      ...(tool === 'images-to-pdf' ? { outputFormat: 'pdf' as const } : {}),
      ...(tool === 'image-convert' ? { outputFormat: 'jpg' as const } : {}),
      ...(tool === 'image-watermark' ? {
        watermarkText: previous.watermarkText || 'Sample Watermark',
        watermarkPosition: previous.watermarkPosition || 'bottom-right',
        watermarkColor: previous.watermarkColor || '#ffffff',
      } : {}),
    }))
    requestAnimationFrame(() => workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  useEffect(() => {
    if (!editorFile) return
    const previousHtmlOverflow = document.documentElement.style.overflow
    const previousBodyOverflow = document.body.style.overflow
    window.scrollTo(0, 0)
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow
      document.body.style.overflow = previousBodyOverflow
    }
  }, [editorFile])

  const handleImagesChange = useCallback((newImages: ImageFile[]) => {
    setImages(newImages)
  }, [])

  const handleOptionsChange = useCallback((newOptions: ConversionOptions) => {
    setOptions(newOptions)
    const toolForOperation: Record<ConversionOptions['operation'], ToolId> = {
      compress: 'image-compress',
      resize: 'image-resize',
      convert: newOptions.outputFormat === 'pdf' ? 'images-to-pdf' : 'image-convert',
      pdf: 'images-to-pdf',
      watermark: 'image-watermark',
      'pdf-edit': 'pdf-edit',
      'pdf-compress': 'pdf-compress',
      'pdf-remove-password': 'pdf-unlock',
    }
    setSelectedTool(toolForOperation[newOptions.operation])
  }, [])

  // Check if processing can proceed
  const canProcess = useCallback(() => {
    if (images.length === 0 || hasIncompatibleFiles) return false
    
    // For PDF password removal, password is required
    if (options.operation === 'pdf-remove-password') {
      return !!(options.pdfPassword && options.pdfPassword.trim().length > 0)
    }

    if (options.operation === 'pdf-edit') {
      return images.length === 1 && images[0].file.type === 'application/pdf'
    }
    
    return true
  }, [images, hasIncompatibleFiles, options.operation, options.pdfPassword])

  const handleProcess = async () => {
    if (images.length === 0) return

    if (options.operation === 'pdf-edit') {
      setEditorFile(images[0].file)
      return
    }

    const jobId = Date.now().toString()
    setCurrentJob({
      id: jobId,
      status: 'processing',
      progress: 0,
      message: 'Starting processing...',
    })

    try {
      const formData = new FormData()
      images.forEach((img, index) => {
        formData.append('images', img.file)
        formData.append(`order_${index}`, img.order.toString())
      })
      formData.append('options', JSON.stringify(options))

      const response = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || 'Processing failed')
      }

      const result = await response.json()
      
      setCurrentJob({
        id: jobId,
        status: 'completed',
        progress: 100,
        message: 'Processing completed!',
        outputFiles: result.files,
      })

      setResults(result.files)
    } catch (error) {
      setCurrentJob({
        id: jobId,
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Processing failed. Please try again.',
      })
    }
  }

  const clearJob = () => {
    setCurrentJob(null)
  }

  const clearResults = async () => {
    setIsCleaningUp(true)
    try {
      // Call cleanup API to delete processed files
      const response = await fetch('/api/cleanup', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: results.map(file => typeof file === 'string' ? file : file.fileName),
        }),
      })
      if (response.ok) {
        const result = await response.json()
        console.log('Cleanup result:', result.message)
      } else {
        console.warn('Cleanup failed:', await response.text())
      }
    } catch (error) {
      console.error('Failed to cleanup processed files:', error)
      // Continue with UI cleanup even if file cleanup fails
    } finally {
      setIsCleaningUp(false)
    }
    // Clear UI state
    setResults([])
    setImages([])
    setOptions({
      operation: 'compress',
      compressionQuality: 80,
    })
    setSelectedTool(null)
  }

  return (
    <main className={editorFile ? 'pdf-editor-page' : 'min-h-screen pb-20'}>
      <Header />

      {editorFile ? (
        <div className="box-border h-full px-2 pb-4 pt-24 sm:px-4">
          <PdfEditor
            file={editorFile}
            initialPassword={options.pdfPassword}
            onCancel={() => setEditorFile(null)}
            onExported={(files) => {
              setResults(files)
              setEditorFile(null)
            }}
          />
        </div>
      ) : (
      <div className="container mx-auto max-w-7xl px-4 pb-12 pt-24 sm:px-6 lg:px-8">
        {results.length > 0 ? (
          <div className="animate-scale-in">
            <ResultsView 
              files={results} 
              onStartNew={clearResults}
              isCleaningUp={isCleaningUp}
            />
          </div>
        ) : (
          <>
            <ToolDirectory selectedTool={selectedTool} onSelect={selectTool} />
            {selectedTool && (
              <div ref={workspaceRef} className="tool-workspace scroll-mt-24">
                <div className="tool-workspace-heading">
                  <h2>{tools.find(tool => tool.id === selectedTool)?.title}</h2>
                  <p>Add your files, adjust the settings, and start processing.</p>
                </div>
                {hasIncompatibleFiles && (
                  <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
                    The files in your queue do not match this tool. Clear them and upload {isPdfTool ? 'PDFs' : 'images'} to continue.
                  </div>
                )}
                <div className="flex max-w-7xl flex-col gap-8 lg:flex-row">
                  <div className="order-1 h-full lg:w-2/3">
                    <DragDropUploader
                      images={images}
                      onImagesChange={handleImagesChange}
                      options={options}
                    />
                  </div>
                  <div className="order-2 lg:w-1/3">
                    <OptionsPanel
                      options={options}
                      onOptionsChange={handleOptionsChange}
                      onProcess={handleProcess}
                      canProcess={canProcess()}
                      images={images}
                      lockOperation
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      )}

      {currentJob && !editorFile && (
        <ProgressModal 
          job={currentJob}
          onClose={clearJob}
        />
      )}
    </main>
  )
}
