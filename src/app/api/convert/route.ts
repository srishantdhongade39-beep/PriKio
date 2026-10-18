import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function convertWithILovePdf(fileUrl: string, fileName: string, extension: string): Promise<ArrayBuffer | null> {
  const publicKey = process.env.ILOVEPDF_PUBLIC_KEY
  if (!publicKey) return null

  try {
    // 1. Authenticate with ILovePDF
    const authRes = await fetch('https://api.ilovepdf.com/v1/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_key: publicKey })
    })
    if (!authRes.ok) throw new Error(`ILovePDF Auth failed with status ${authRes.status}`)
    const { token } = await authRes.json()

    // 2. Start officepdf task
    const startRes = await fetch('https://api.ilovepdf.com/v1/start/officepdf', {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!startRes.ok) throw new Error(`ILovePDF Start task failed: ${startRes.status}`)
    const { server, task } = await startRes.json()

    // 3. Upload file (fetch blob first to avoid cloud_file remote fetching issues)
    const fileRes = await fetch(fileUrl)
    if (!fileRes.ok) throw new Error(`Failed to fetch original file: ${fileRes.status}`)
    const fileBlob = await fileRes.blob()

    const uploadForm = new FormData()
    uploadForm.append('task', task)
    uploadForm.append('file', fileBlob, fileName)

    const uploadRes = await fetch(`https://${server}/v1/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: uploadForm
    })
    if (!uploadRes.ok) throw new Error(`ILovePDF Upload failed: ${uploadRes.status}`)
    const { server_filename } = await uploadRes.json()

    // 4. Process task
    const processRes = await fetch(`https://${server}/v1/process`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        task,
        tool: 'officepdf',
        files: [{ server_filename, filename: fileName }]
      })
    })
    if (!processRes.ok) throw new Error(`ILovePDF Process failed: ${processRes.status}`)

    // 5. Download converted PDF
    const downloadRes = await fetch(`https://${server}/v1/download/${task}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!downloadRes.ok) throw new Error(`ILovePDF Download failed: ${downloadRes.status}`)

    const buffer = await downloadRes.arrayBuffer()
    return buffer
  } catch (err) {
    console.warn('ILovePDF conversion attempt error:', err)
    return null
  }
}

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

    // 1. Generate a signed URL for the original file in Supabase Storage
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(storagePath, 3600)

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Storage signed URL error:', signedUrlError)
      return NextResponse.json({ error: 'Failed to get signed URL for original file' }, { status: 500 })
    }

    const fileUrl = signedUrlData.signedUrl
    let pdfArrayBuffer: ArrayBuffer | null = null

    // 2a. Try ILovePDF API first if configured
    pdfArrayBuffer = await convertWithILovePdf(fileUrl, fileName, extension)

    // 2b. If ILovePDF not configured or failed, try ConvertAPI fallback
    if (!pdfArrayBuffer) {
      const convertApiKey = process.env.NODE_ENV === 'production' 
        ? process.env.CONVERT_API_SECRET 
        : (process.env.CONVERT_API_SANDBOX_SECRET || process.env.CONVERT_API_SECRET)
          
      if (convertApiKey) {
        const formData = new FormData()
        formData.append('File', fileUrl)

        let convertRes = await fetch(`https://v2.convertapi.com/convert/${extension}/to/pdf?Secret=${convertApiKey}`, {
          method: 'POST',
          body: formData
        })

        if (!convertRes.ok && convertRes.status === 503) {
          console.warn('ConvertAPI rate limit (503) reached. Retrying after delay...')
          await new Promise(resolve => setTimeout(resolve, 2000))
          convertRes = await fetch(`https://v2.convertapi.com/convert/${extension}/to/pdf?Secret=${convertApiKey}`, {
            method: 'POST',
            body: formData
          })
        }

        if (convertRes.ok) {
          const result = await convertRes.json()
          const base64Data = result.Files[0].FileData
          const nodeBuf = Buffer.from(base64Data, 'base64')
          pdfArrayBuffer = nodeBuf.buffer.slice(nodeBuf.byteOffset, nodeBuf.byteOffset + nodeBuf.byteLength)
        }
      }
    }

    if (!pdfArrayBuffer) {
      return NextResponse.json({ 
        error: 'Document conversion service is currently unavailable. Please save your document as a PDF on your device and upload the PDF directly.' 
      }, { status: 502 })
    }

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
    const { data: convertedSignedUrlData } = await supabase.storage
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
      convertedUrl: convertedSignedUrlData?.signedUrl || '',
      convertedFileName,
      storagePath: convertedStoragePath,
      pageCount
    })

  } catch (error: any) {
    console.error('Async convert route error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
