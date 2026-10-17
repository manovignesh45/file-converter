import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { PdfEditService, type PdfEditAsset } from '../../../../services/pdfEditService'
import {
  hasPdfSignature,
  hasSupportedImageSignature,
  MAX_IMAGE_BYTES,
  MAX_PDF_BYTES,
  parseEditPayload,
  validateAssetIds,
} from '../../../../lib/pdf/validation'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('pdf')
    const editsJson = formData.get('edits')
    const assetIdsJson = formData.get('assetIds')
    const password = formData.get('password')

    if (!(file instanceof File) || typeof editsJson !== 'string') {
      return NextResponse.json({ error: 'A PDF and edit data are required.' }, { status: 400 })
    }
    if (file.size === 0) {
      return NextResponse.json({ error: 'The selected PDF is empty.' }, { status: 400 })
    }
    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: 'The PDF exceeds the 50 MB limit.' }, { status: 413 })
    }

    const input = Buffer.from(await file.arrayBuffer())
    if (!hasPdfSignature(input)) {
      return NextResponse.json({ error: 'The selected file is not a valid PDF.' }, { status: 415 })
    }

    let payload
    try {
      payload = parseEditPayload(JSON.parse(editsJson))
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'The edit data is invalid.' },
        { status: 400 },
      )
    }

    let assetIds: unknown = []
    try {
      assetIds = typeof assetIdsJson === 'string' ? JSON.parse(assetIdsJson) : []
    } catch {
      return NextResponse.json({ error: 'The image asset list is invalid.' }, { status: 400 })
    }
    const assetFiles = formData.getAll('assets')
    let validatedAssetIds: string[]
    try { validatedAssetIds = validateAssetIds(assetIds, payload.elements) } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'The image asset list is invalid.' }, { status: 400 }) }
    if (validatedAssetIds.length !== assetFiles.length) return NextResponse.json({ error: 'The image assets do not match the edit data.' }, { status: 400 })
    if (assetFiles.length > 100 || assetFiles.reduce((total, asset) => total + (asset instanceof File ? asset.size : 0), 0) > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'This edit contains too many or too-large combined image assets.' }, { status: 413 })
    }

    const assets: PdfEditAsset[] = []
    for (let index = 0; index < assetFiles.length; index += 1) {
      const asset = assetFiles[index]
      if (!(asset instanceof File) || asset.size === 0 || asset.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: 'An added image is empty or exceeds the 50 MB limit.' }, { status: 413 })
      }
      const buffer = Buffer.from(await asset.arrayBuffer())
      const mimeType = hasSupportedImageSignature(buffer)
      if (!mimeType) {
        return NextResponse.json({ error: 'Added images must be valid PNG or JPEG files.' }, { status: 415 })
      }
      if (payload.elements.some(element => element.type === 'image' && element.assetId === validatedAssetIds[index] && element.mimeType !== mimeType)) {
        return NextResponse.json({ error: 'An image type does not match its referenced asset.' }, { status: 400 })
      }
      let metadata
      try {
        metadata = await sharp(buffer, { limitInputPixels: 40_000_000 }).metadata()
      } catch {
        return NextResponse.json({ error: 'An added image could not be decoded as PNG or JPEG.' }, { status: 415 })
      }
      if (!metadata.width || !metadata.height) {
        return NextResponse.json({ error: 'An added image could not be decoded.' }, { status: 415 })
      }
      assets.push({ id: validatedAssetIds[index], mimeType, buffer })
    }

    const result = await new PdfEditService().exportPdf(
      input,
      file.name,
      payload,
      assets,
      typeof password === 'string' && password ? password : undefined,
    )

    return NextResponse.json({
      success: true,
      files: [{
        fileName: result.processedName,
        originalSize: result.originalSize,
        processedSize: result.processedSize,
        pageCount: result.pageCount,
      }],
    })
  } catch (error) {
    console.error('PDF edit export failed:', error instanceof Error ? error.name : 'unknown error')
    const message = error instanceof Error ? error.message : 'The edited PDF could not be exported.'
    const status = /password|encrypted|invalid|corrupt|parse|xref|trailer|font|character/i.test(message) ? 422 : 500
    return NextResponse.json({ error: message, details: message }, { status })
  }
}
