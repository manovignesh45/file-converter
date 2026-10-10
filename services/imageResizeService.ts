import sharp, { type ResizeOptions as SharpResizeOptions } from 'sharp'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs/promises'

export interface ResizeOptions {
  width?: number
  height?: number
  maintainAspectRatio?: boolean
  cropToFit?: boolean
  outputFormat?: 'jpg' | 'png' | 'webp'
  removeMetadata?: boolean
}

export interface ProcessedImage {
  originalName: string
  processedName: string
  originalSize: number
  processedSize: number
  outputPath: string
  dimensions: {
    width: number
    height: number
  }
}

export class ImageResizeService {
  private outputDir: string

  constructor() {
    this.outputDir = path.join(process.cwd(), 'public', 'processed')
  }

  async ensureOutputDir(): Promise<void> {
    try {
      await fs.access(this.outputDir)
    } catch {
      await fs.mkdir(this.outputDir, { recursive: true })
    }
  }

  async resizeImage(
    inputBuffer: Buffer,
    originalName: string,
    options: ResizeOptions
  ): Promise<ProcessedImage> {
    await this.ensureOutputDir()

    // Extract original filename without extension
    const originalBaseName = path.parse(originalName).name
    const fileId = uuidv4().split('-')[0] // Use shorter ID
    const extension = options.outputFormat || 'jpg'
    const suffix = `_resized_${options.width || 'auto'}x${options.height || 'auto'}`
    const outputFileName = `${originalBaseName}${suffix}_${fileId}.${extension}`
    const outputPath = path.join(this.outputDir, outputFileName)

    let pipeline = sharp(inputBuffer)
    
    // Get original dimensions
    const metadata = await pipeline.metadata()
    const originalWidth = metadata.width || 0
    const originalHeight = metadata.height || 0

    // Remove metadata if requested
    if (options.removeMetadata) {
      pipeline = pipeline.withMetadata({})
    }

    // Apply resize
    if (options.width || options.height) {
      const resizeOptions: SharpResizeOptions = {
        width: options.width,
        height: options.height,
      }

      if (options.maintainAspectRatio !== false) {
        resizeOptions.fit = options.cropToFit ? 'cover' : 'inside'
        resizeOptions.withoutEnlargement = true
      } else {
        resizeOptions.fit = 'fill'
      }

      pipeline = pipeline.resize(resizeOptions)
    }

    // Apply format-specific compression
    if (extension === 'jpg') {
      pipeline = pipeline.jpeg({ quality: 90, progressive: true })
    } else if (extension === 'png') {
      pipeline = pipeline.png({ compressionLevel: 6, progressive: true })
    } else if (extension === 'webp') {
      pipeline = pipeline.webp({ quality: 90 })
    }

    const processedBuffer = await pipeline.toBuffer()
    const processedMetadata = await sharp(processedBuffer).metadata()

    await fs.writeFile(outputPath, processedBuffer)

    return {
      originalName,
      processedName: outputFileName,
      originalSize: inputBuffer.length,
      processedSize: processedBuffer.length,
      outputPath,
      dimensions: {
        width: processedMetadata.width || 0,
        height: processedMetadata.height || 0,
      },
    }
  }

  async estimateResizedSize(
    inputBuffer: Buffer,
    options: ResizeOptions
  ): Promise<{ estimatedSize: number; dimensions: { width: number; height: number } }> {
    const metadata = await sharp(inputBuffer).metadata()
    const originalWidth = metadata.width || 0
    const originalHeight = metadata.height || 0

    let newWidth = options.width || originalWidth
    let newHeight = options.height || originalHeight

    // Calculate dimensions with aspect ratio
    if (options.maintainAspectRatio !== false) {
      if (options.width && options.height) {
        const widthRatio = options.width / originalWidth
        const heightRatio = options.height / originalHeight
        const ratio = options.cropToFit 
          ? Math.max(widthRatio, heightRatio)
          : Math.min(widthRatio, heightRatio)
        
        newWidth = Math.round(originalWidth * ratio)
        newHeight = Math.round(originalHeight * ratio)
      } else if (options.width) {
        const ratio = options.width / originalWidth
        newWidth = options.width
        newHeight = Math.round(originalHeight * ratio)
      } else if (options.height) {
        const ratio = options.height / originalHeight
        newWidth = Math.round(originalWidth * ratio)
        newHeight = options.height
      }
    }

    // Estimate size based on pixel reduction
    const pixelRatio = (newWidth * newHeight) / (originalWidth * originalHeight)
    const estimatedSize = Math.round(inputBuffer.length * pixelRatio)

    return {
      estimatedSize,
      dimensions: { width: newWidth, height: newHeight },
    }
  }
}
