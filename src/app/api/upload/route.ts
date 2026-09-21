import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Helper for controlled concurrency
async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  const exec = async () => {
    while (i < items.length) {
      const index = i++;
      results[index] = await fn(items[index]);
    }
  };
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => exec());
  await Promise.all(workers);
  return results;
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || ''
    const supabase = await createClient()

    // ─────────────────────────────────────────────────────────────
    // FAST PATH: Direct Upload Session Initialization (JSON payload)
    // Supports PDF, Images, and async-convertible files (PPTX, DOCX)
    // ─────────────────────────────────────────────────────────────
    if (contentType.includes('application/json')) {
      const body = await request.json()
      const clientFiles: Array<{
        fileName: string
        fileType?: string
        pageCount?: number
      }> = body.files || []

      if (!clientFiles || clientFiles.length === 0) {
        return NextResponse.json({ error: 'No files specified' }, { status: 400 })
      }

      const jobId = crypto.randomUUID()
      const otp = Math.floor(1000 + Math.random() * 9000).toString()
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

      // Generate signed upload URLs for each file so browser can upload directly
      const processedFiles = await Promise.all(
        clientFiles.map(async (file) => {
          let fileName = file.fileName
          const fileType = file.fileType || 'application/octet-stream'
          const safeFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_')
          const storagePath = `${jobId}/${safeFileName}`

          const ext = fileName.split('.').pop()?.toLowerCase() || ''
          const needsConversion = !['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(ext)

          // Generate signed upload URL
          const { data: uploadData } = await supabase.storage
            .from('documents')
            .createSignedUploadUrl(storagePath)

          let signedUploadUrl = uploadData?.signedUrl || ''
          let token = uploadData?.token || ''

          // Generate download/preview signed URL
          const { data: signedUrlData } = await supabase.storage
            .from('documents')
            .createSignedUrl(storagePath, 3600)

          return {
            file_id: crypto.randomUUID(),
            filename: fileName,
            storage_path: storagePath,
            pages_selected: 'All',
            copies: 1,
            color_mode: 'B&W',
            paper_size: 'A4',
            sides: 'Single',
            subtotal_paise: 200,
            page_count: file.pageCount || 1,
            url: signedUrlData?.signedUrl || '',
            signedUploadUrl,
            uploadToken: token,
            needsConversion
          }
        })
      )

      const totalPages = processedFiles.reduce((sum, f) => sum + f.page_count, 0)
      
      const dbFiles = processedFiles.map(f => {
        const { page_count, url, signedUploadUrl, uploadToken, needsConversion, ...rest } = f
        return rest
      })

      // Create initial print_job record
      const jobRes = await supabase
        .from('print_jobs')
        .insert({
          id: jobId,
          session_id: crypto.randomUUID(),
          status: 'pending',
          files: dbFiles,
          total_amount_paise: dbFiles.length * 200,
          estimated_seconds: 10 * totalPages
        })

      if (jobRes.error) {
        console.error('Job insert error:', jobRes.error)
        return NextResponse.json({ error: 'Failed to create job record: ' + jobRes.error.message }, { status: 500 })
      }

      // Create OTP session
      const otpRes = await supabase
        .from('otp_sessions')
        .insert({
          print_job_id: jobId,
          otp_code: otp,
          expires_at: expiresAt
        })

      if (otpRes.error) {
        console.error('OTP insert error:', otpRes.error)
        return NextResponse.json({ error: 'Failed to create OTP session: ' + otpRes.error.message }, { status: 500 })
      }

      return NextResponse.json({
        job_id: jobId,
        otp: otp,
        expires_in: 900,
        files: processedFiles
      })
    }

    // ─────────────────────────────────────────────────────────────
    // FALLBACK PATH: Multipart FormData (for legacy clients)
    // ─────────────────────────────────────────────────────────────
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const jobId = crypto.randomUUID()
    
    const processedFiles = await mapConcurrent(files, 3, async (file) => {
      let buffer: ArrayBuffer | Buffer = await file.arrayBuffer()
      let fileName = file.name
      let fileType = file.type
      const extension = fileName.split('.').pop()?.toLowerCase()
  
      if (fileType !== 'application/pdf' && extension !== 'pdf') {
        const convertApiKey = process.env.NODE_ENV === 'production' 
          ? process.env.CONVERT_API_SECRET 
          : (process.env.CONVERT_API_SANDBOX_SECRET || process.env.CONVERT_API_SECRET);
          
        if (!convertApiKey) {
          throw new Error('ConvertAPI secret is not configured');
        }
  
        if (!extension) {
          throw new Error('Cannot determine file extension for conversion');
        }
  
        const uploadFormData = new FormData();
        uploadFormData.append('File', file, fileName);
  
        let response = await fetch(`https://v2.convertapi.com/convert/${extension}/to/pdf?Secret=${convertApiKey}`, {
          method: 'POST',
          body: uploadFormData
        });

        if (!response.ok) {
          console.warn(`Primary ConvertAPI failed with status ${response.status}. Falling back to sandbox...`);
          const sandboxKey = process.env.CONVERT_API_SANDBOX_SECRET;
          if (sandboxKey) {
            response = await fetch(`https://v2.convertapi.com/convert/${extension}/to/pdf?Secret=${sandboxKey}`, {
              method: 'POST',
              body: uploadFormData
            });
          }
        }
  
        if (!response.ok) {
          const errText = await response.text();
          console.error('ConvertAPI Error:', errText);
          throw new Error('Conversion failed');
        }
  
        const result = await response.json();
        const base64Data = result.Files[0].FileData;
        
        const nodeBuf = Buffer.from(base64Data, 'base64');
        buffer = nodeBuf.buffer.slice(nodeBuf.byteOffset, nodeBuf.byteOffset + nodeBuf.byteLength);
        
        fileName = fileName.substring(0, fileName.lastIndexOf('.')) + '.pdf';
        fileType = 'application/pdf';
      }
  
      const safeFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_')
      const storagePath = `${jobId}/${safeFileName}`
      const uploadBlob = new Blob([buffer], { type: fileType });
  
      const storageRes = await supabase.storage
        .from('documents')
        .upload(storagePath, uploadBlob, { 
          upsert: true,
          contentType: fileType
        })
  
      if (storageRes.error) {
        throw new Error('Failed to upload file to storage: ' + storageRes.error.message)
      }
  
      let pageCount = 1
      if (fileType === 'application/pdf') {
        const text = Buffer.from(buffer).toString('latin1')
        const matches = text.match(/\/Type\s*\/Page\b/g)
        if (matches && matches.length > 0) {
          pageCount = matches.length
        }
      }
      
      const { data: signedUrlData } = await supabase.storage.from('documents').createSignedUrl(storagePath, 3600);

      return {
        file_id: crypto.randomUUID(),
        filename: fileName,
        storage_path: storagePath,
        pages_selected: 'All',
        copies: 1,
        color_mode: 'B&W',
        paper_size: 'A4',
        sides: 'Single',
        subtotal_paise: 200,
        page_count: pageCount,
        url: signedUrlData?.signedUrl || ''
      }
    })

    const totalPages = processedFiles.reduce((sum, f) => sum + f.page_count, 0)
    
    const dbFiles = processedFiles.map(f => {
      const { page_count, url, ...rest } = f;
      return rest;
    })

    const jobRes = await supabase
      .from('print_jobs')
      .insert({
        id: jobId,
        session_id: crypto.randomUUID(),
        status: 'pending',
        files: dbFiles,
        total_amount_paise: dbFiles.length * 200,
        estimated_seconds: 10 * totalPages
      })

    if (jobRes.error) {
      console.error('Job insert error:', jobRes.error)
      return NextResponse.json({ error: 'Failed to create job record: ' + jobRes.error.message }, { status: 500 })
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString() 

    const otpRes = await supabase
      .from('otp_sessions')
      .insert({
        print_job_id: jobId,
        otp_code: otp,
        expires_at: expiresAt
      })

    if (otpRes.error) {
      console.error('OTP insert error:', otpRes.error)
      return NextResponse.json({ error: 'Failed to create OTP session: ' + otpRes.error.message }, { status: 500 })
    }

    return NextResponse.json({
      job_id: jobId,
      otp: otp,
      expires_in: 900,
      files: processedFiles
    })

  } catch (error: any) {
    console.error('Upload handler error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
