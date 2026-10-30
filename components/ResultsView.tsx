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

const FileText = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
    compressionRatio?: number // percent saved, e.g. 35
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
      averageReduction: averageReduction > 0 ? averageReduction.toFixed(1) + '%' : null,
      totalSize: formatFileSize(files.reduce((total, file) => total + (typeof file === 'object' ? file.processedSize ?? 0 : 0), 0)),
      spaceSaved: totalSpaceSaved > 0 ? formatFileSize(totalSpaceSaved) : null,
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
        link.download = 'processed-files.zip'
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

  const getFileMeta = (file: FileType): string => {
    const parts = [getFileExtension(file), getFileSize(file)]
    if (typeof file === 'object' && file.pageCount) parts.push(`${file.pageCount} page${file.pageCount === 1 ? '' : 's'}`)
    if (typeof file === 'object' && file.dimensions) parts.push(`${file.dimensions.width}×${file.dimensions.height}`)
    return parts.join(' · ')
  }

  const isSingleFile = files.length === 1

  return (
    <div className="card border-0 shadow-xl ring-1 ring-black/5 bg-white/70 backdrop-blur-xl animate-fade-in">
      <div className="flex items-center gap-4 mb-6 sm:mb-8">
        <div className="bg-green-100 p-3 rounded-full flex-shrink-0">
          <CheckCircle className="w-7 h-7 text-green-600" />
        </div>
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Processing complete</h2>
          <p className="text-gray-600">
            {isSingleFile ? 'Your file is ready to download.' : `Your ${files.length} files are ready to download.`}
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* Summary and main actions; listed first so phones see the download button before the file list. */}
        <aside className="lg:order-2 lg:w-80 flex-shrink-0">
          <div className="lg:sticky lg:top-24 bg-white/80 rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
            <button
              onClick={isSingleFile ? () => handleDownload(files[0]) : handleDownloadAll}
              className="w-full btn-primary py-3.5 justify-center text-base font-semibold shadow-lg shadow-primary-500/20"
            >
              {isSingleFile ? <Download className="w-5 h-5 mr-2" /> : <Archive className="w-5 h-5 mr-2" />}
              {isSingleFile ? 'Download file' : `Download all ${files.length} (ZIP)`}
            </button>

            <dl className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-gray-50 rounded-xl p-3">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Files</dt>
                <dd className="text-xl font-bold text-gray-900">{summaryStats.filesProcessed}</dd>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total size</dt>
                <dd className="text-xl font-bold text-primary-600">{summaryStats.totalSize}</dd>
              </div>
              {summaryStats.averageReduction && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reduced</dt>
                  <dd className="text-xl font-bold text-green-600">{summaryStats.averageReduction}</dd>
                </div>
              )}
              {summaryStats.spaceSaved && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Saved</dt>
                  <dd className="text-xl font-bold text-purple-600">{summaryStats.spaceSaved}</dd>
                </div>
              )}
            </dl>

            <button
              onClick={onStartNew}
              disabled={isCleaningUp}
              className={`w-full btn-secondary py-3 justify-center ${isCleaningUp ? 'opacity-75 cursor-not-allowed' : ''}`}
            >
              <RotateCcw className={`w-5 h-5 mr-2 ${isCleaningUp ? 'animate-spin' : ''}`} />
              {isCleaningUp ? 'Cleaning up...' : 'Process more files'}
            </button>
          </div>
        </aside>

        {/* File list with a download button on every row */}
        <section className="lg:order-1 flex-1 min-w-0" aria-labelledby="processed-files-heading">
          <h3 id="processed-files-heading" className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
            Processed files
          </h3>
          <ul className="space-y-3">
            {files.map(file => {
              const fileName = getFileName(file)
              const showImage = !imageErrors[fileName] && /\.(jpe?g|png|webp)$/i.test(fileName)
              const isPdf = fileName.toLowerCase().endsWith('.pdf')
              const isWord = fileName.toLowerCase().endsWith('.docx')

              return (
                <li
                  key={fileName}
                  className="flex items-center gap-3 sm:gap-4 bg-white border border-gray-100 rounded-2xl p-3 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className={`w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 rounded-xl overflow-hidden flex items-center justify-center ${
                    isPdf ? 'bg-red-50' : isWord ? 'bg-blue-50' : 'bg-gray-50'
                  }`}>
                    {showImage ? (
                      <img
                        src={`/api/preview/${encodeURIComponent(fileName)}`}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={() => handleImageError(fileName)}
                        onLoad={() => handleImageLoad(fileName)}
                      />
                    ) : (
                      isPdf || isWord
                        ? <FileText className={`w-7 h-7 ${isPdf ? 'text-red-500' : 'text-blue-500'}`} />
                        : <FileImage className="w-7 h-7 text-gray-400" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate" title={formatFileName(file)}>
                      {formatFileName(file)}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {getFileMeta(file)}
                      {typeof file === 'object' && !!file.compressionRatio && file.compressionRatio > 0 && (
                        <span className="ml-2 text-green-600 font-medium">
                          -{Math.round(file.compressionRatio)}%
                        </span>
                      )}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDownload(file)}
                    className="flex-shrink-0 btn-secondary py-2 px-3 sm:px-4 text-sm justify-center border-gray-200 hover:border-primary-200 hover:text-primary-600"
                    aria-label={`Download ${formatFileName(file)}`}
                  >
                    <Download className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Download</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}
