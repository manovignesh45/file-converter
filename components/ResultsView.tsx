'use client'

import { useState } from 'react'

// Modern icon components
const Download = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)

const FileImage = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

const Archive = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
  </svg>
)

const RotateCcw = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)

const Share2 = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
  </svg>
)

const CheckCircle = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

interface ResultsViewProps {
  files: Array<string | {
    fileName: string
    originalSize?: number
    processedSize?: number
    compressionRatio?: number
    dimensions?: { width: number; height: number }
    format?: string
    pageCount?: number
  }>
  onStartNew: () => void
  isCleaningUp?: boolean
}

export default function ResultsView({ files, onStartNew, isCleaningUp = false }: ResultsViewProps) {
  type FileType = typeof files[0]
  
  // State to track image loading errors for each file
  const [imageErrors, setImageErrors] = useState<{[key: string]: boolean}>({})
  
  const handleImageError = (fileName: string) => {
    setImageErrors(prev => ({ ...prev, [fileName]: true }))
  }
  
  const handleImageLoad = (fileName: string) => {
    setImageErrors(prev => ({ ...prev, [fileName]: false }))
  }

  const getFileName = (file: FileType): string => {
    return typeof file === 'string' ? file : file.fileName
  }

  const getFileSize = (file: FileType): string => {
    if (typeof file === 'string') {
      return 'Calculating...'
    }
    if (file.processedSize) {
      return formatFileSize(file.processedSize)
    }
    return 'Calculating...'
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const calculateSummaryStats = () => {
    let totalOriginalSize = 0
    let totalProcessedSize = 0
    let filesWithSizeData = 0
    let totalSpaceSaved = 0

    files.forEach(file => {
      if (typeof file === 'object' && file.originalSize && file.processedSize) {
        totalOriginalSize += file.originalSize
        totalProcessedSize += file.processedSize
        totalSpaceSaved += (file.originalSize - file.processedSize)
        filesWithSizeData++
      }
    })

    const averageReduction = filesWithSizeData > 0 
      ? ((totalOriginalSize - totalProcessedSize) / totalOriginalSize * 100)
      : 0

    return {
      filesProcessed: files.length,
      averageReduction: averageReduction > 0 ? averageReduction.toFixed(1) + '%' : 'N/A',
      totalSize: totalProcessedSize > 0 ? formatFileSize(totalProcessedSize) : 'N/A',
      spaceSaved: totalSpaceSaved > 0 ? formatFileSize(totalSpaceSaved) : 'N/A',
      hasCompressionData: filesWithSizeData > 0
    }
  }

  const summaryStats = calculateSummaryStats()

  const handleDownload = (file: FileType) => {
    const fileName = getFileName(file)
    // Create download link
    const link = document.createElement('a')
    link.href = `/api/download/${fileName}`
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDownloadAll = async () => {
    try {
      const fileNames = files.map(getFileName)
      const response = await fetch('/api/download-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: fileNames })
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'processed-images.zip'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  const formatFileName = (file: FileType): string => {
    const fileName = getFileName(file)
    return fileName.replace(/_[a-f0-9]{8}\./i, '.')
  }

  const getFileExtension = (file: FileType): string => {
    const fileName = getFileName(file)
    return fileName.split('.').pop()?.toUpperCase() || 'UNKNOWN'
  }

  return (
    <div className="card border-0 shadow-xl ring-1 ring-black/5 bg-white/70 backdrop-blur-xl animate-fade-in">
      <div className="text-center mb-8 sm:mb-10 pt-4">
        <div className="bg-green-100 p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center shadow-inner animate-bounce-light">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-3">
          Processing Complete!
        </h2>
        <p className="text-lg text-gray-600 px-4 max-w-2xl mx-auto leading-relaxed">
          Your {files.length} image{files.length !== 1 ? 's' : ''} {files.length !== 1 ? 'have' : 'has'} been successfully processed and {files.length !== 1 ? 'are' : 'is'} ready for download.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8 sm:mb-10 max-w-4xl mx-auto">
        <div className="bg-white/60 p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm text-center">
          <div className="text-3xl font-bold text-gray-900 mb-1">{summaryStats.filesProcessed}</div>
          <div className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wide">Processed</div>
        </div>
        <div className="bg-white/60 p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm text-center">
          <div className={`text-3xl font-bold ${summaryStats.hasCompressionData ? 'text-green-600' : 'text-gray-400'}`}>
            {summaryStats.averageReduction}
          </div>
          <div className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wide">Reduced</div>
        </div>
        <div className="bg-white/60 p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm text-center">
          <div className={`text-3xl font-bold ${summaryStats.hasCompressionData ? 'text-primary-600' : 'text-gray-400'}`}>
            {summaryStats.totalSize}
          </div>
          <div className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wide">Final Size</div>
        </div>
        <div className="bg-white/60 p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm text-center">
          <div className={`text-3xl font-bold ${summaryStats.hasCompressionData ? 'text-purple-600' : 'text-gray-400'}`}>
            {summaryStats.spaceSaved}
          </div>
          <div className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wide">Saved</div>
        </div>
      </div>

      <div className="border-t border-gray-100 my-8"></div>

      {/* Results Grid */}
      <div className="space-y-6 mb-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileImage className="w-6 h-6 text-gray-400" />
            Processed Files
          </h3>
          <button
            onClick={handleDownloadAll}
            className="w-full sm:w-auto btn-primary bg-gray-900 hover:bg-black text-white shadow-lg shadow-gray-900/20"
          >
            <Archive className="w-5 h-5 mr-2" />
            Download All (ZIP)
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {files.map((file, index) => {
            const fileName = getFileName(file)
            const hasError = imageErrors[fileName] || false
            
            return (
              <div
                key={fileName}
                className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
              >
                {/* File Preview */}
                <div className="aspect-[4/3] bg-gray-50 relative overflow-hidden group-hover:bg-gray-100 transition-colors">
                  {!hasError && /\.(jpe?g|png|webp)$/i.test(fileName) ? (
                    <img
                      src={`/api/preview/${encodeURIComponent(fileName)}`}
                      alt={formatFileName(file)}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      onError={() => handleImageError(fileName)}
                      onLoad={() => handleImageLoad(fileName)}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                      {fileName.toLowerCase().endsWith('.pdf') ? (
                         <div className="transform transition-transform duration-300 group-hover:scale-110">
                           <FileImage className="w-16 h-16 text-red-500 mx-auto mb-3 drop-shadow-sm" />
                           <span className="block text-xs font-bold text-red-600 uppercase tracking-widest bg-red-50 px-2 py-1 rounded-full">PDF Document</span>
                         </div>
                      ) : fileName.toLowerCase().endsWith('.docx') ? (
                         <div className="transform transition-transform duration-300 group-hover:scale-110">
                           <FileImage className="w-16 h-16 text-blue-500 mx-auto mb-3 drop-shadow-sm" />
                           <span className="block text-xs font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded-full">Word Document</span>
                         </div>
                      ) : (
                        <div className="text-gray-300">
                          <FileImage className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <span className="text-xs">No Preview</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                    <button
                      onClick={() => handleDownload(file)}
                      className="w-full bg-white text-gray-900 font-medium py-2 rounded-lg text-sm shadow-sm hover:bg-gray-50 flex items-center justify-center"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Quick Download
                    </button>
                  </div>
                </div>

                {/* File Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-gray-900 truncate flex-1 mr-2" title={formatFileName(file)}>
                      {formatFileName(file)}
                    </h4>
                    <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded-md uppercase tracking-wider">
                      {getFileExtension(file)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <span>{getFileSize(file)}</span>
                    {typeof file === 'object' && file.compressionRatio && (
                      <span className="text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full text-xs">
                        -{Math.round((1 - (file.compressionRatio || 1)) * 100)}%
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleDownload(file)}
                    className="w-full btn-secondary py-2 text-sm justify-center border-gray-200 hover:border-primary-200 hover:text-primary-600"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-gray-50/50 -mx-6 -mb-6 p-6 sm:p-8 rounded-b-2xl border-t border-gray-100 mt-8">
        <div className="flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto">
          <button
            onClick={onStartNew}
            disabled={isCleaningUp}
            className={`flex-1 btn-primary py-3.5 flex items-center justify-center text-base font-semibold shadow-lg shadow-primary-500/20 ${
              isCleaningUp ? 'opacity-75 cursor-not-allowed' : ''
            }`}
          >
            <RotateCcw className={`w-5 h-5 mr-2 ${isCleaningUp ? 'animate-spin' : ''}`} />
            {isCleaningUp ? 'Cleaning up...' : 'Process More Files'}
          </button>
        </div>
      </div>
    </div>
  )
}
