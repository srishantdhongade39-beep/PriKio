import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { otp_entered } = await request.json()

    if (!otp_entered || otp_entered.length !== 4) {
      return NextResponse.json({ success: false, message: 'Invalid OTP format' }, { status: 400 })
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
    let fileName = "Document"
    let pageCount = 1
    
    // Extract file info if available
    if (jobData && jobData.files && jobData.files.length > 0) {
      fileName = jobData.files[0].filename || "Document"
      pageCount = jobData.files.length
    }

    return NextResponse.json({
      success: true,
      message: 'Verified successfully',
      job_id: printJobId,
      file_name: fileName,
      page_count: pageCount,
      color_mode: jobData.files?.[0]?.color_mode || 'B&W',
      sides: jobData.files?.[0]?.sides || 'Single',
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
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 })
  }
}
