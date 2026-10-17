import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import { stat } from 'fs/promises'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'processed')

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> }
) {
  const { fileName } = await params

  if (!fileName) {
    return NextResponse.json({ error: 'File name is required' }, { status: 400 })
  }

  try {
    if (path.basename(fileName) !== fileName || fileName.includes('..')) {
      return NextResponse.json({ error: 'Invalid file name' }, { status: 400 })
    }
    const filePath = path.join(UPLOAD_DIR, fileName)

    // Check if file exists
    try {
      await stat(filePath)
    } catch (error) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const fileBuffer = await fs.readFile(filePath)

    const headers = new Headers()
    headers.append('Content-Disposition', `attachment; filename="${fileName}"`) 
    headers.append('Content-Type', path.extname(fileName).toLowerCase() === '.pdf' ? 'application/pdf' : 'application/octet-stream')
    headers.append('X-Content-Type-Options', 'nosniff')

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json(
      { error: 'Failed to download file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
