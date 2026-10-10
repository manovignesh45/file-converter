export interface ImageFile {
  id: string
  file: File
  preview: string
  order: number
  estimatedSize?: number
  originalSize: number
  isPdf?: boolean // New field to identify PDF files
}

export interface ConversionOptions {
  operation: 'compress' | 'resize' | 'convert' | 'pdf' | 'watermark' | 'pdf-compress' | 'pdf-remove-password' | 'pdf-edit'
  compressionQuality?: number
  targetSize?: number
  targetSizeUnit?: 'KB' | 'MB'
  resizeWidth?: number
  resizeHeight?: number
  maintainAspectRatio?: boolean
  cropToFit?: boolean
  outputFormat?: 'jpg' | 'png' | 'webp' | 'pdf'
  removeMetadata?: boolean
  watermarkText?: string
  watermarkPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
  watermarkColor?: string // New field for watermark color
  optimizeImages?: boolean // New field for PDF compression
  pdfLayout?: 'fit' | 'original' | 'fill' // New field for PDF layout
  pdfPageSize?: 'A4' | 'Letter' | 'Legal' | 'A3' // New field for PDF page size
  pdfImagesPerPage?: 1 | 2 // New field: number of images per page (1 = one per page, 2 = side-by-side)
  pdfPassword?: string
}

export interface JobProgress {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress: number
  message: string
  outputFiles?: Array<string | {
    fileName: string
    originalSize?: number
    processedSize?: number
    compressionRatio?: number
    pageCount?: number
  }>
}
