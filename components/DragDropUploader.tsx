'use client'

import { useCallback, useState, useEffect } from 'react'
import { useDropzone, type Accept } from 'react-dropzone'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import PreviewCard from './PreviewCard'
import { ImageFile, ConversionOptions } from '../types'

// Modern icon components
const Upload = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
)

const ImageIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

const PdfIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)

const Move = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)

const Trash = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

interface DragDropUploaderProps {
  images: ImageFile[]
  onImagesChange: (images: ImageFile[]) => void
  options: ConversionOptions
}

interface SortableItemProps {
  id: string
  image: ImageFile
  onRemove: (id: string) => void
  options: ConversionOptions
}

function SortableItem({ id, image, onRemove, options }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="relative group">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-200">
        <PreviewCard 
          image={image} 
          onRemove={onRemove}
          options={options}
        />
        <div 
          {...listeners}
          className="absolute top-2 right-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-move p-1.5 bg-white/90 backdrop-blur rounded-full shadow-sm hover:bg-gray-100"
        >
          <Move className="w-4 h-4 text-gray-500" />
        </div>
      </div>
    </div>
  )
}

export default function DragDropUploader({ images, onImagesChange, options }: DragDropUploaderProps) {
  const [estimatedSizes, setEstimatedSizes] = useState<{ [key: string]: number }>({})
  const [uploadError, setUploadError] = useState<string | null>(null)
  const isPdfOperation = options.operation.startsWith('pdf-')
  const acceptedTypes: Accept = isPdfOperation
    ? { 'application/pdf': ['.pdf'] }
    : { 'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif', '.bmp'] }
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const calculateEstimatedSize = useCallback((file: File, options: ConversionOptions): number => {
    const originalSize = file.size
    const isPdf = file.type === 'application/pdf'

    switch (options.operation) {
      case 'compress':
        if (options.targetSize && options.targetSizeUnit) {
          const targetBytes = options.targetSizeUnit === 'KB' 
            ? options.targetSize * 1024 
            : options.targetSize * 1024 * 1024
          return Math.min(targetBytes, originalSize)
        }
        if (options.compressionQuality) {
          return Math.round(originalSize * (options.compressionQuality / 100))
        }
        return originalSize * 0.8

      case 'pdf-compress':
        if (options.targetSize && options.targetSizeUnit) {
          const targetBytes = options.targetSizeUnit === 'KB' 
            ? options.targetSize * 1024 
            : options.targetSize * 1024 * 1024
          return Math.min(targetBytes, originalSize)
        }
        if (options.compressionQuality) {
          // PDF compression is less aggressive than image compression
          const ratio = Math.max(options.compressionQuality / 100, 0.5)
          return Math.round(originalSize * ratio)
        }
        return Math.round(originalSize * 0.75) // Default 25% reduction

      case 'resize':
        // Only applies to images
        if (isPdf) return originalSize
        // Estimate based on dimension reduction
        if (options.resizeWidth || options.resizeHeight) {
          return Math.round(originalSize * 0.6) // Rough estimate
        }
        return originalSize

      case 'convert':
        // Only applies to images
        if (isPdf) return originalSize
        // Different formats have different compression ratios
        if (options.outputFormat === 'webp') {
          return Math.round(originalSize * 0.7)
        }
        if (options.outputFormat === 'jpg') {
          return Math.round(originalSize * 0.8)
        }
        return originalSize

      default:
        return originalSize
    }
  }, [])

  useEffect(() => {
    const newEstimatedSizes: { [key: string]: number } = {}
    images.forEach(img => {
      newEstimatedSizes[img.id] = calculateEstimatedSize(img.file, options)
    })
    setEstimatedSizes(newEstimatedSizes)
    
    // Update images with estimated sizes
    const updatedImages = images.map(img => ({
      ...img,
      estimatedSize: newEstimatedSizes[img.id]
    }))
    
    if (JSON.stringify(updatedImages) !== JSON.stringify(images)) {
      onImagesChange(updatedImages)
    }
  }, [images, options, calculateEstimatedSize, onImagesChange])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUploadError(null)
    const newImages: ImageFile[] = acceptedFiles.map((file, index) => {
      const isPdf = file.type === 'application/pdf'
      return {
        id: `${Date.now()}-${index}`,
        file,
        preview: isPdf ? '' : URL.createObjectURL(file), // No preview for PDFs
        originalSize: file.size,
        estimatedSize: calculateEstimatedSize(file, options),
        order: images.length + index,
        isPdf,
      }
    })

    onImagesChange([...images, ...newImages])
  }, [images, onImagesChange, options, calculateEstimatedSize])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: (rejections) => {
      const tooLarge = rejections.some(rejection => rejection.errors.some(error => error.code === 'file-too-large'))
      setUploadError(tooLarge ? 'Files must be 50 MB or smaller.' : `Choose ${isPdfOperation ? 'a PDF' : 'a supported image'} file.`)
    },
    accept: acceptedTypes,
    multiple: options.operation !== 'pdf-edit',
    maxSize: 50 * 1024 * 1024,
  })

  const removeImage = useCallback((id: string) => {
    const updatedImages = images.filter(img => img.id !== id)
    onImagesChange(updatedImages)
  }, [images, onImagesChange])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = images.findIndex(img => img.id === active.id)
      const newIndex = images.findIndex(img => img.id === over.id)
      
      const reorderedImages = arrayMove(images, oldIndex, newIndex)
      
      // Update order property
      const updatedImages = reorderedImages.map((img, index) => ({
        ...img,
        order: index
      }))
      
      onImagesChange(updatedImages)
    }
  }, [images, onImagesChange])

  return (
    <div className="h-full flex flex-col">
      <div className="card h-full flex flex-col border-0 bg-white/50 backdrop-blur-xl shadow-xl ring-1 ring-black/5">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              {isPdfOperation ? <PdfIcon className="w-6 h-6 text-red-500"/> : <ImageIcon className="w-6 h-6 text-primary-500"/>}
              {isPdfOperation ? 'Upload PDFs' : 'Upload Images'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {isPdfOperation
                ? options.operation === 'pdf-edit' ? 'Choose one PDF to edit' : 'Process your PDF documents'
                : 'Process your images locally and securely'
              }
            </p>
          </div>
          {images.length > 0 && (
             <button
              onClick={() => onImagesChange([])}
              className="text-red-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <Trash className="w-4 h-4" />
              Clear All
            </button>
          )}
        </div>

        {uploadError && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {uploadError}
          </div>
        )}

        <div
          {...getRootProps()}
          className={`upload-zone flex-1 flex flex-col items-center justify-center min-h-[300px] ${
            isDragActive ? 'active border-primary-500 bg-primary-50/50' : 'border-gray-200'
          } ${images.length > 0 ? 'min-h-[160px] mb-8' : ''}`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center max-w-sm mx-auto p-4">
            <div className={`p-4 rounded-2xl mb-4 transition-all duration-300 ${
              isDragActive ? 'bg-primary-100 scale-110' : 'bg-primary-50 group-hover:bg-primary-100'
            }`}>
              {isDragActive ? (
                <Upload className="w-10 h-10 text-primary-600 animate-bounce" />
              ) : (
                <Upload className="w-10 h-10 text-primary-500" />
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">
              {isDragActive 
                ? 'Drop files now'
                : 'Click or Drag files here'
              }
            </h3>
            <p className="text-sm text-gray-500 text-center leading-relaxed">
              {isPdfOperation ? 'Supports PDF documents.' : 'Supports JPG, PNG, WebP, GIF, and BMP images.'}
              <br/>Max file size: 50MB
            </p>
          </div>
        </div>

        {images.length > 0 && (
          <div className="mt-auto animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Files Queue ({images.length})
              </h3>
            </div>
            
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={images.map(img => img.id)} strategy={verticalListSortingStrategy}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {images.map((image) => (
                    <SortableItem
                      key={image.id}
                      id={image.id}
                      image={image}
                      onRemove={removeImage}
                      options={options}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            
            <div className="mt-6 p-4 bg-gray-50/80 rounded-xl border border-gray-100">
              <div className="grid grid-cols-3 gap-4 text-center divide-x divide-gray-200">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Original Size</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {(images.reduce((sum, img) => sum + img.originalSize, 0) / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Estimated Size</p>
                  <p className="text-sm font-semibold text-primary-600">
                    {(images.reduce((sum, img) => sum + (img.estimatedSize || img.originalSize), 0) / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Savings</p>
                  <p className="text-sm font-semibold text-green-600">
                    {Math.round((1 - images.reduce((sum, img) => sum + (img.estimatedSize || img.originalSize), 0) / images.reduce((sum, img) => sum + img.originalSize, 0)) * 100)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
