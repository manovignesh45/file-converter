import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import archiver from 'archiver'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'processed')

export async function POST(request: NextRequest) {
  try {
    const { files } = await request.json()

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'File names are required' }, { status: 400 })
    }

    const archive = archiver('zip', {
      zlib: { level: 9 }, // Sets the compression level.
    })

    // Create a pass-through stream to pipe the archive to the response
    const readableStream = new ReadableStream({
      start(controller) {
        archive.on('data', (chunk) => {
          controller.enqueue(chunk)
        })
        archive.on('end', () => {
          controller.close()
        })
        archive.on('error', (err) => {
          controller.error(err)
        })

        // Add files to the archive
        for (const fileName of files) {
          if (typeof fileName !== 'string' || path.basename(fileName) !== fileName || fileName.includes('..')) continue
          const filePath = path.join(UPLOAD_DIR, fileName)
          if (fs.existsSync(filePath)) {
            archive.file(filePath, { name: fileName })
          }
        }

        archive.finalize()
      },
    })

    const headers = new Headers()
    headers.append('Content-Type', 'application/zip')
    headers.append('Content-Disposition', 'attachment; filename="processed-files.zip"')

    return new NextResponse(readableStream, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error('Download all error:', error)
    return NextResponse.json(
      { error: 'Failed to create zip file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
