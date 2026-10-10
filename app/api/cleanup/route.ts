import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

// GET endpoint to list current processed files
export async function GET(request: NextRequest) {
  try {
    const processedDir = process.env.PROCESSED_FILES_DIR || './public/processed'
    const absoluteProcessedDir = path.resolve(processedDir)

    try {
      await fs.access(absoluteProcessedDir)
    } catch {
      return NextResponse.json({ 
        files: [],
        count: 0,
        message: 'Processed files directory does not exist'
      })
    }

    const files = await fs.readdir(absoluteProcessedDir)
    const fileDetails: Array<{
      name: string
      size: number
      created: Date
      modified: Date
    }> = []

    for (const file of files) {
      const filePath = path.join(absoluteProcessedDir, file)
      try {
        const stats = await fs.stat(filePath)
        if (stats.isFile()) {
          fileDetails.push({
            name: file,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          })
        }
      } catch (error) {
        console.warn(`Failed to get stats for file ${file}:`, error)
      }
    }

    return NextResponse.json({
      files: fileDetails,
      count: fileDetails.length,
      message: `Found ${fileDetails.length} processed files`
    })

  } catch (error) {
    console.error('Error listing processed files:', error)
    return NextResponse.json(
      { 
        error: 'Failed to list processed files', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

// DELETE endpoint to clean up processed files
export async function DELETE(request: NextRequest) {
  try {
    // Get the processed files directory from environment variable
    const processedDir = process.env.PROCESSED_FILES_DIR || './public/processed'
    const absoluteProcessedDir = path.resolve(processedDir)

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const olderThanHours = searchParams.get('olderThan') // Optional: only delete files older than X hours
    let requestedFiles: string[] | null = null
    if (!olderThanHours) {
      try {
        const body = await request.json()
        requestedFiles = Array.isArray(body?.files)
          ? body.files.filter((file: unknown): file is string => typeof file === 'string' && path.basename(file) === file && !file.includes('..'))
          : null
      } catch {
        requestedFiles = null
      }
      if (!requestedFiles) {
        return NextResponse.json({ error: 'Specify processed file names or an olderThan retention window.' }, { status: 400 })
      }
    }

    // Check if directory exists
    try {
      await fs.access(absoluteProcessedDir)
    } catch {
      return NextResponse.json({ 
        success: true, 
        message: 'Processed files directory does not exist or is already empty',
        deletedFiles: 0 
      })
    }

    // Read all files in the directory
    const files = await fs.readdir(absoluteProcessedDir)
    let deletedCount = 0
    const errors: string[] = []
    const cutoffTime = olderThanHours ? new Date(Date.now() - parseInt(olderThanHours) * 60 * 60 * 1000) : null

    // Delete each file
    for (const file of files) {
      if (requestedFiles && !requestedFiles.includes(file)) continue
      const filePath = path.join(absoluteProcessedDir, file)
      
      try {
        // Check if it's a file (not a directory)
        const stats = await fs.stat(filePath)
        if (stats.isFile()) {
          // If cutoffTime is specified, only delete files older than that
          if (cutoffTime && stats.mtime > cutoffTime) {
            continue // Skip files that are too new
          }
          
          await fs.unlink(filePath)
          deletedCount++
          console.log(`Deleted processed file: ${file}`)
        }
      } catch (error) {
        const errorMsg = `Failed to delete file ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.warn(errorMsg)
        errors.push(errorMsg)
        // Continue with other files even if one fails
      }
    }

    const response = {
      success: true,
      message: `Successfully deleted ${deletedCount} processed files${cutoffTime ? ` older than ${olderThanHours} hours` : ''}`,
      deletedFiles: deletedCount,
      ...(errors.length > 0 && { errors })
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to clean up processed files', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
