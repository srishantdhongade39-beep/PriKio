import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const SUPABASE_URL = 'https://cmhckkpdifpnmewyyqrh.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_I3NVyNL1LT6mn4aM5dsARA_GQu526D2'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function testUpload() {
  console.log('Testing upload...')
  const jobId = crypto.randomUUID()
  const storagePath = `${jobId}/test.txt`
  
  const buffer = Buffer.from('test file content')

  console.log('1. Testing storage...')
  const storageRes = await supabase.storage
    .from('documents')
    .upload(storagePath, buffer, { 
      upsert: true,
      contentType: 'text/plain'
    })
  console.log('Storage:', storageRes.error ? `Error: ${storageRes.error.message}` : 'Success')

  console.log('2. Testing print_jobs insert...')
  const filesJson = [{
    file_id: crypto.randomUUID(),
    filename: 'test.txt',
    storage_path: storagePath,
    pages_selected: 'All',
    copies: 1,
    color_mode: 'B&W',
    paper_size: 'A4',
    sides: 'Single',
    subtotal_paise: 200
  }]

  const jobRes = await supabase
    .from('print_jobs')
    .insert({
      id: jobId,
      session_id: crypto.randomUUID(),
      status: 'pending',
      files: filesJson,
      total_amount_paise: 200,
      estimated_seconds: 10
    })
  console.log('Job Insert:', jobRes.error ? `Error: ${JSON.stringify(jobRes.error)}` : 'Success')

  console.log('3. Testing otp_sessions insert...')
  const otpRes = await supabase
    .from('otp_sessions')
    .insert({
      print_job_id: jobId,
      otp_code: '1234',
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    })
  console.log('OTP Insert:', otpRes.error ? `Error: ${JSON.stringify(otpRes.error)}` : 'Success')
}

testUpload()
