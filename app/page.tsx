'use client'

import { useState, useCallback } from 'react'
import DragDropUploader from '../components/DragDropUploader'
import OptionsPanel from '../components/OptionsPanel'
import ProgressModal from '../components/ProgressModal'
import ResultsView from '../components/ResultsView'
import Header from '../components/Header'
import PdfEditor from '../components/pdf-editor/PdfEditor'
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

  const handleImagesChange = useCallback((newImages: ImageFile[]) => {
    setImages(newImages)
  }, [])

  const handleOptionsChange = useCallback((newOptions: ConversionOptions) => {
    setOptions(newOptions)
  }, [])

  // Check if processing can proceed
  const canProcess = useCallback(() => {
    if (images.length === 0) return false
    
    // For PDF password removal, password is required
    if (options.operation === 'pdf-remove-password') {
      return !!(options.pdfPassword && options.pdfPassword.trim().length > 0)
    }

    if (options.operation === 'pdf-edit') {
      return images.length === 1 && images[0].file.type === 'application/pdf'
    }
    
    return true
  }, [images, options.operation, options.pdfPassword])

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
  }

  return (
    <main className="min-h-screen pb-20">
      <Header />

      {editorFile ? (
        <div className="px-2 pb-4 pt-24 sm:px-4">
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
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 max-w-7xl animate-fade-in">
        <div className="text-center mb-12 sm:mb-16">
          <span className="inline-block py-1 px-3 rounded-full bg-primary-100 text-primary-700 text-sm font-semibold mb-4 animate-slide-up">
            #1 Free Online Converter
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-gray-900 mb-6 animate-slide-up animate-delay-100">
            Convert Files <br className="hidden sm:block" />
            <span className="text-gradient">With Superpowers</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto animate-slide-up animate-delay-200 leading-relaxed px-4">
            Compress, resize, and transform your images and PDFs securely. 
            All processing happens locally or on secure servers.
          </p>
        </div>

        {results.length > 0 ? (
          <div className="animate-scale-in">
            <ResultsView 
              files={results} 
              onStartNew={clearResults}
              isCleaningUp={isCleaningUp}
            />
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto animate-slide-up animate-delay-300">
            <div className="lg:w-2/3 order-1 h-full">
              <DragDropUploader 
                images={images}
                onImagesChange={handleImagesChange}
                options={options}
              />
            </div>
            
            <div className="lg:w-1/3 order-2">
              <div className="sticky top-6">
                <OptionsPanel 
                  options={options}
                  onOptionsChange={handleOptionsChange}
                  onProcess={handleProcess}
                  canProcess={canProcess()}
                  images={images}
                />
              </div>
            </div>
          </div>
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
