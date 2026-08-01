import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { jobId, storagePath, fileName, fileId } = await request.json()

    if (!jobId || !storagePath || !fileName) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const extension = fileName.split('.').pop()?.toLowerCase()
    if (!extension || extension === 'pdf') {
      return NextResponse.json({ error: 'File is already PDF or has no extension' }, { status: 400 })
    }

    const supabase = await createClient()

    // 1. Download the raw file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(storagePath)

    if (downloadError || !fileData) {
      console.error('Storage download error:', downloadError)
      return NextResponse.json({ error: 'Failed to download original file from storage' }, { status: 500 })
    }

    // 2. Call ConvertAPI
    const convertApiKey = process.env.NODE_ENV === 'production' 
      ? process.env.CONVERT_API_SECRET 
      : (process.env.CONVERT_API_SANDBOX_SECRET || process.env.CONVERT_API_SECRET)
        
    if (!convertApiKey) {
      return NextResponse.json({ error: 'ConvertAPI secret is not configured' }, { status: 500 })
    }

    const uploadFormData = new FormData()
    uploadFormData.append('File', fileData, fileName)

    const convertRes = await fetch(`https://v2.convertapi.com/convert/${extension}/to/pdf?Secret=${convertApiKey}`, {
      method: 'POST',
      body: uploadFormData
    })

    if (!convertRes.ok) {
      const errText = await convertRes.text()
      console.error('ConvertAPI Error in async convert:', errText)
      return NextResponse.json({ error: 'ConvertAPI conversion failed' }, { status: 502 })
    }

    const result = await convertRes.json()
    const base64Data = result.Files[0].FileData
    const nodeBuf = Buffer.from(base64Data, 'base64')
    const pdfArrayBuffer = nodeBuf.buffer.slice(nodeBuf.byteOffset, nodeBuf.byteOffset + nodeBuf.byteLength)

    // 3. Determine new converted PDF filename and storage path
    const baseName = fileName.substring(0, fileName.lastIndexOf('.')) || fileName
    const convertedFileName = `${baseName}.pdf`
    const safeConvertedName = convertedFileName.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const convertedStoragePath = `${jobId}/${safeConvertedName}`

    // 4. Upload converted PDF to Supabase Storage
    const uploadBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' })
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(convertedStoragePath, uploadBlob, {
        upsert: true,
        contentType: 'application/pdf'
      })

    if (uploadError) {
      console.error('Failed to save converted PDF to storage:', uploadError)
      return NextResponse.json({ error: 'Failed to save converted PDF' }, { status: 500 })
    }

    // 5. Extract exact page count from converted PDF
    let pageCount = 1
    const text = Buffer.from(pdfArrayBuffer).toString('latin1')
    const matches = text.match(/\/Type\s*\/Page\b/g)
    if (matches && matches.length > 0) {
      pageCount = matches.length
    }

    // 6. Generate signed URL for the converted PDF
    const { data: signedUrlData } = await supabase.storage
      .from('documents')
      .createSignedUrl(convertedStoragePath, 3600)

    // 7. Update the print_jobs record in PostgreSQL
    const { data: currentJob } = await supabase
      .from('print_jobs')
      .select('files')
      .eq('id', jobId)
      .single()

    if (currentJob && Array.isArray(currentJob.files)) {
      const updatedFiles = currentJob.files.map((f: any) => {
        if (f.storage_path === storagePath || f.filename === fileName || (fileId && f.file_id === fileId)) {
          return {
            ...f,
            filename: convertedFileName,
            storage_path: convertedStoragePath,
            page_count: pageCount
          }
        }
        return f
      })

      const totalPages = updatedFiles.reduce((sum: number, f: any) => sum + (f.page_count || 1), 0)

      await supabase
        .from('print_jobs')
        .update({
          files: updatedFiles,
          estimated_seconds: 10 * totalPages
        })
        .eq('id', jobId)
    }

    return NextResponse.json({
      success: true,
      convertedUrl: signedUrlData?.signedUrl || '',
      convertedFileName,
      storagePath: convertedStoragePath,
      pageCount
    })

  } catch (error: any) {
    console.error('Async convert route error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
