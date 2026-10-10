import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> }
) {
  try {
    const { fileName } = await params
    if (path.basename(fileName) !== fileName || fileName.includes('..')) {
      return NextResponse.json({ error: 'Invalid file name' }, { status: 400 })
    }
    const filePath = path.join(process.cwd(), 'public', 'processed', fileName)

    // Check if file exists
    try {
      await fs.access(filePath)
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Read file
    const fileBuffer = await fs.readFile(filePath)

    // Determine content type
    const ext = path.extname(fileName).toLowerCase()
    const contentType = getContentType(ext)

    // Set headers for preview (not download)
    const headers = new Headers()
    headers.set('Content-Type', contentType)
    headers.set('Cache-Control', 'private, max-age=3600')
    headers.set('X-Content-Type-Options', 'nosniff')

    return new NextResponse(fileBuffer, { headers })

  } catch (error) {
    console.error('Preview error:', error)
    return NextResponse.json({ error: 'Preview failed' }, { status: 500 })
  }
}

function getContentType(ext: string): string {
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.pdf':
      return 'application/pdf'
    default:
      return 'application/octet-stream'
  }
}
