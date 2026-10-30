import { NextRequest, NextResponse } from 'next/server'
import { ImageCompressionService } from '../../../services/imageCompressionService'
import { ImageResizeService } from '../../../services/imageResizeService'
import { ImageToPdfService } from '../../../services/imageToPdfService'
import { FormatConversionService } from '../../../services/formatConversionService'
import { PdfCompressionService } from '../../../services/pdfCompressionService'
import { PdfPasswordService } from '../../../services/pdfPasswordService'
import { PdfToWordService } from '../../../services/pdfToWordService'
import { PdfPageService } from '../../../services/pdfPageService'
import { hasPdfSignature, MAX_PDF_BYTES } from '../../../lib/pdf/validation'

export async function POST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData()
    const files = formData.getAll('images') as File[]
    const optionsStr = formData.get('options') as string
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 })
    }

    for (const file of files) {
      if (!(file instanceof File) || file.size === 0) {
        return NextResponse.json({ error: 'Uploaded files must not be empty.' }, { status: 400 })
      }
      if (file.size > MAX_PDF_BYTES) {
        return NextResponse.json({ error: `${file.name} exceeds the 50 MB limit.` }, { status: 413 })
      }
      if (file.type === 'application/pdf') {
        const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer())
        if (!hasPdfSignature(signature)) {
          return NextResponse.json({ error: `${file.name} is not a valid PDF.` }, { status: 415 })
        }
      }
    }

    const options = JSON.parse(optionsStr)

    // Process files based on operation
    const results = await processFiles(files, options)

    return NextResponse.json({
      success: true,
      files: results.files,
      message: 'Processing completed successfully',
    })

  } catch (error) {
    console.error('Processing error:', error)
    return NextResponse.json(
      { error: 'Processing failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function processFiles(files: File[], options: any) {
  const outputFiles: any[] = []

  switch (options.operation) {
    case 'compress':
      const compressionService = new ImageCompressionService()
      
      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const result = await compressionService.compressImage(buffer, file.name, {
          quality: options.compressionQuality,
          targetSize: options.targetSize,
          targetSizeUnit: options.targetSizeUnit,
          removeMetadata: options.removeMetadata,
          outputFormat: options.outputFormat,
        })
        outputFiles.push({
          fileName: result.processedName,
          originalSize: result.originalSize,
          processedSize: result.processedSize,
          compressionRatio: result.compressionRatio,
        })
      }
      break

    case 'resize':
      const resizeService = new ImageResizeService()
      
      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const result = await resizeService.resizeImage(buffer, file.name, {
          width: options.resizeWidth,
          height: options.resizeHeight,
          maintainAspectRatio: options.maintainAspectRatio,
          cropToFit: options.cropToFit,
          outputFormat: options.outputFormat,
          removeMetadata: options.removeMetadata,
        })
        outputFiles.push({
          fileName: result.processedName,
          originalSize: result.originalSize,
          processedSize: result.processedSize,
          dimensions: result.dimensions,
        })
      }
      break

    case 'convert':
      if (options.outputFormat === 'pdf') {
        // Convert images to PDF
        const pdfService = new ImageToPdfService()
        
        const imageBuffers = await Promise.all(
          files.map(async (file, index) => ({
            buffer: Buffer.from(await file.arrayBuffer()),
            name: file.name,
            order: index,
          }))
        )

        const pdfResult = await pdfService.convertImagesToPdf(imageBuffers, {
          pageSize: options.pdfPageSize || 'A4',
          orientation: 'portrait',
          quality: options.compressionQuality || 90,
          imagesPerPage: options.pdfImagesPerPage || 1,
        })
        
        outputFiles.push({
          fileName: pdfResult.pdfName,
          originalSize: imageBuffers.reduce((sum, img) => sum + img.buffer.length, 0),
          processedSize: pdfResult.fileSize,
          format: 'PDF',
          pageCount: pdfResult.pageCount,
        })
      } else {
        // Regular format conversion
        const conversionService = new FormatConversionService()
        
        for (const file of files) {
          const buffer = Buffer.from(await file.arrayBuffer())
          const result = await conversionService.convertFormat(buffer, file.name, {
            outputFormat: options.outputFormat,
            quality: options.compressionQuality,
            removeMetadata: options.removeMetadata,
          })
          outputFiles.push({
            fileName: result.processedName,
            originalSize: result.originalSize,
            processedSize: result.processedSize,
            format: result.format,
          })
        }
      }
      break

    case 'pdf':
      const pdfService = new ImageToPdfService()
      
      const imageBuffers = await Promise.all(
        files.map(async (file, index) => ({
          buffer: Buffer.from(await file.arrayBuffer()),
          name: file.name,
          order: index,
        }))
      )

      const pdfResult = await pdfService.convertImagesToPdf(imageBuffers, {
        pageSize: options.pageSize || 'A4',
        orientation: options.orientation || 'portrait',
        quality: options.compressionQuality || 90,
        imagesPerPage: options.pdfImagesPerPage || 1,
      })
      outputFiles.push({
        fileName: pdfResult.pdfName,
        originalSize: imageBuffers.reduce((total, img) => total + img.buffer.length, 0),
        processedSize: pdfResult.fileSize,
        pageCount: pdfResult.pageCount,
      })
      break

    case 'watermark':
      const watermarkService = new FormatConversionService()
      
      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const result = await watermarkService.addWatermark(
          buffer,
          file.name,
          {
            text: options.watermarkText || 'Sample Watermark',
            position: options.watermarkPosition,
            color: options.watermarkColor,
          },
          {
            outputFormat: options.outputFormat || 'jpg',
            quality: options.compressionQuality,
            removeMetadata: options.removeMetadata,
          }
        )
        outputFiles.push({
          fileName: result.processedName,
          originalSize: result.originalSize,
          processedSize: result.processedSize,
          format: result.format,
        })
      }
      break

    case 'pdf-compress':
      const pdfCompressionService = new PdfCompressionService()
      
      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const result = await pdfCompressionService.compressPdf(buffer, file.name, {
          quality: options.compressionQuality,
          targetSize: options.targetSize,
          targetSizeUnit: options.targetSizeUnit,
          removeMetadata: options.removeMetadata,
          optimizeImages: options.optimizeImages,
        })
        outputFiles.push({
          fileName: result.processedName,
          originalSize: result.originalSize,
          processedSize: result.processedSize,
          compressionRatio: result.compressionRatio,
          pageCount: result.pageCount,
        })
      }
      break

    case 'pdf-remove-password':
      const pdfPasswordService = new PdfPasswordService()

      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const result = await pdfPasswordService.removePassword(buffer, file.name, {
          password: options.pdfPassword,
        })
        outputFiles.push({
          fileName: result.processedName,
          originalSize: result.originalSize,
          processedSize: result.processedSize,
          pageCount: result.pageCount,
        })
      }
      break

    case 'pdf-to-word':
      const pdfToWordService = new PdfToWordService()

      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const result = await pdfToWordService.convertToWord(buffer, file.name, {
          password: options.pdfPassword,
        })
        outputFiles.push({
          fileName: result.processedName,
          originalSize: result.originalSize,
          processedSize: result.processedSize,
          format: 'DOCX',
          pageCount: result.pageCount,
        })
      }
      break

    case 'pdf-merge':
      const mergeResult = await new PdfPageService().merge(
        await Promise.all(files.map(async file => ({ buffer: Buffer.from(await file.arrayBuffer()), name: file.name })))
      )
      outputFiles.push({
        fileName: mergeResult.processedName,
        originalSize: mergeResult.originalSize,
        processedSize: mergeResult.processedSize,
        pageCount: mergeResult.pageCount,
      })
      break

    case 'pdf-split':
      const splitService = new PdfPageService()

      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const parts = await splitService.split(buffer, file.name, options.pdfPageRanges)
        for (const part of parts) {
          outputFiles.push({
            fileName: part.processedName,
            processedSize: part.processedSize,
            pageCount: part.pageCount,
          })
        }
      }
      break

    case 'pdf-rotate':
      const rotateService = new PdfPageService()

      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const result = await rotateService.rotate(buffer, file.name, Number(options.pdfRotation) || 90, options.pdfPageRanges)
        outputFiles.push({
          fileName: result.processedName,
          originalSize: result.originalSize,
          processedSize: result.processedSize,
          pageCount: result.pageCount,
        })
      }
      break

    default:
      throw new Error(`Unsupported operation: ${options.operation}`)
  }

  return { files: outputFiles }
}
