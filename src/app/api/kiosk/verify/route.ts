import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { otp_entered } = await request.json()

    if (!otp_entered || otp_entered.length !== 4) {
      return NextResponse.json({ success: false, message: 'Invalid OTP format' }, { status: 400 })
    }

    // Bypass check for local testing with dummy/empty Supabase URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    if (supabaseUrl.includes('dummy') || !supabaseUrl) {
      return NextResponse.json({
        success: true,
        message: 'Verified successfully (Mock Mode)',
        job_id: 'mock-job-id',
        files: [
          { file_id: '1', filename: 'CS301_Assignment.pdf', page_count: 3, copies: 1, color_mode: 'B&W', sides: 'Double' },
          { file_id: '2', filename: 'Reference_Material.pdf', page_count: 5, copies: 2, color_mode: 'Color', sides: 'Single' },
          { file_id: '3', filename: 'Receipt_Kiosk.png', page_count: 1, copies: 1, color_mode: 'B&W', sides: 'Single' }
        ]
      })
    }

    const supabase = await createClient()

    // Find the OTP session
    // We should look for an unused OTP that is not expired
    const { data: session, error: sessionError } = await supabase
      .from('otp_sessions')
      .select('*, print_jobs(*)')
      .eq('otp_code', otp_entered)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ success: false, message: 'Invalid or expired OTP' }, { status: 404 })
    }

    const printJobId = session.print_job_id
    
    // 1. Mark OTP as used
    const { error: updateOtpError } = await supabase
      .from('otp_sessions')
      .update({ used: true, used_at: new Date().toISOString() })
      .eq('id', session.id)

    if (updateOtpError) {
      console.error('Failed to update OTP:', updateOtpError)
      return NextResponse.json({ success: false, message: 'Server Error' }, { status: 500 })
    }

    // 2. Update print_job status to 'printing'
    const { error: updateJobError } = await supabase
      .from('print_jobs')
      .update({ status: 'printing' })
      .eq('id', printJobId)

    if (updateJobError) {
      console.error('Failed to update print job:', updateJobError)
      return NextResponse.json({ success: false, message: 'Server Error' }, { status: 500 })
    }

    // Return success to the kiosk display
    const jobData = session.print_jobs
    
    const actualJob = Array.isArray(jobData) ? jobData[0] : jobData;
    const filesArray = (actualJob && Array.isArray(actualJob.files)) ? actualJob.files.map((f: any) => ({
      file_id: f.file_id || '1',
      filename: f.filename || 'Document.pdf',
      page_count: f.bw_pages + f.color_pages || f.page_count || 1,
      copies: f.copies || 1,
      color_mode: f.color_mode || 'B&W',
      sides: f.sides || 'Single',
      storage_path: f.storage_path
    })) : []

    return NextResponse.json({
      success: true,
      message: 'Verified successfully',
      job_id: printJobId,
      files: filesArray,
      profile: {
        id: 'guest-' + otp_entered,
        full_name: 'Guest User',
        student_id: 'GUEST',
        department: 'Campus Print',
        wallet_balance: 0
      }
    })

  } catch (error: any) {
    console.error('Verify OTP error:', error)
    return NextResponse.json({ success: false, message: error.message || 'Internal Server Error', stack: error.stack }, { status: 500 })
  }
}
