import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'


export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    let file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const supabase = await createClient()
    const jobId = crypto.randomUUID()
    
    let buffer = await file.arrayBuffer()

    // Convert non-PDF files to PDF using ConvertAPI
    if (file.type !== 'application/pdf') {
      const convertApiKey = process.env.NODE_ENV === 'production' 
        ? process.env.CONVERT_API_SECRET 
        : (process.env.CONVERT_API_SANDBOX_SECRET || process.env.CONVERT_API_SECRET);
        
      if (!convertApiKey) {
        return NextResponse.json({ error: 'ConvertAPI secret is not configured' }, { status: 500 });
      }

      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!extension) {
        return NextResponse.json({ error: 'Cannot determine file extension for conversion' }, { status: 400 });
      }

      try {
        const uploadFormData = new FormData();
        uploadFormData.append('File', file, file.name);

        const response = await fetch(`https://v2.convertapi.com/convert/${extension}/to/pdf?Secret=${convertApiKey}`, {
          method: 'POST',
          body: uploadFormData
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error('ConvertAPI Error:', errText);
          throw new Error('Conversion failed');
        }

        const result = await response.json();
        const base64Data = result.Files[0].FileData;
        buffer = Buffer.from(base64Data, 'base64');
        
        // Update file name and type so the rest of the flow treats it as a PDF
        const newFileName = file.name.substring(0, file.name.lastIndexOf('.')) + '.pdf';
        file = new File([buffer], newFileName, { type: 'application/pdf' });
      } catch (err) {
        console.error('Conversion exception:', err);
        return NextResponse.json({ error: 'Failed to convert file to PDF' }, { status: 500 });
      }
    }

    const storagePath = `${jobId}/${file.name}`

    // Start storage upload promise
    const storagePromise = supabase.storage
      .from('documents')
      .upload(storagePath, buffer, { 
        upsert: true,
        contentType: file.type
      })

    // Determine total pages via simple PDF text matching (CPU bound, fast)
    let pageCount = 1
    if (file.type === 'application/pdf') {
      const text = Buffer.from(buffer).toString('latin1')
      const matches = text.match(/\/Type\s*\/Page\b/g)
      if (matches && matches.length > 0) {
        pageCount = matches.length
      }
    }

    // Start job record promise
    const filesJson = [{
      file_id: crypto.randomUUID(),
      filename: file.name,
      storage_path: storagePath,
      pages_selected: 'All',
      copies: 1,
      color_mode: 'B&W',
      paper_size: 'A4',
      sides: 'Single',
      subtotal_paise: 200
    }]

    const jobPromise = supabase
      .from('print_jobs')
      .insert({
        id: jobId,
        session_id: crypto.randomUUID(), // temporary session ID
        status: 'pending',
        files: filesJson,
        total_amount_paise: 200,
        estimated_seconds: 10 * pageCount
      })

    // Start OTP generation promise
    const otp = Math.floor(1000 + Math.random() * 9000).toString()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 mins validity
    const otpPromise = supabase
      .from('otp_sessions')
      .insert({
        print_job_id: jobId,
        otp_code: otp,
        expires_at: expiresAt
      })

    // Wait for all three network operations concurrently
    const [storageRes, jobRes, otpRes] = await Promise.all([
      storagePromise,
      jobPromise,
      otpPromise
    ])

    if (storageRes.error) {
      console.error('Storage error:', storageRes.error)
      return NextResponse.json({ error: 'Failed to upload file to storage' }, { status: 500 })
    }
    if (jobRes.error) {
      console.error('Job insert error:', jobRes.error)
      return NextResponse.json({ error: 'Failed to create job record' }, { status: 500 })
    }
    if (otpRes.error) {
      console.error('OTP insert error:', otpRes.error)
      return NextResponse.json({ error: 'Failed to generate OTP' }, { status: 500 })
    }

    return NextResponse.json({
      job_id: jobId,
      otp: otp,
      expires_in: 900,
      page_count: pageCount
    })

  } catch (error: any) {
    console.error('Upload handler error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
