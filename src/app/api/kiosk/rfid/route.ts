import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { student_id } = await request.json()

    if (!student_id) {
      return NextResponse.json({ success: false, message: 'Missing student ID' }, { status: 400 })
    }

    const supabase = await createClient()

    // Find the user by student_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('student_id', student_id)
      .single()

    if (profileError || !profile) {
      if (student_id === 'S12345') {
        // MOCK FALLBACK FOR TESTING UI
        const { data: mockJobs } = await supabase
          .from('print_jobs')
          .select('*')
          .in('status', ['pending', 'processing', 'printing'])
          .order('created_at', { ascending: false })
          .limit(3)
          
        const mappedMockJobs = (mockJobs || []).map((job: any) => {
          let filesArr = job.files || [];
          if (typeof filesArr === 'string') {
            try { filesArr = JSON.parse(filesArr); } catch(e) { filesArr = []; }
          }
          const fileData = filesArr.length > 0 ? filesArr[0] : {};
          return {
            id: job.id,
            status: job.status,
            file_name: fileData.filename || job.file_name || 'Unknown Document',
            page_count: fileData.page_count || job.page_count || 1,
            color_mode: fileData.color_mode || job.color_mode || 'B&W',
            sides: fileData.sides || job.sides || 'Single'
          }
        })
        
        return NextResponse.json({
          success: true,
          profile: {
            id: 'mock-uuid',
            full_name: 'Aarav Patel (Mock)',
            student_id: 'S12345',
            department: 'B.Tech CS',
            wallet_balance: 450
          },
          jobs: mappedMockJobs
        })
      }
      return NextResponse.json({ success: false, message: 'Student not found or no active session' }, { status: 404 })
    }

    // Fetch active print jobs for this user
    const { data: jobs, error: jobsError } = await supabase
      .from('print_jobs')
      .select('*')
      .eq('user_id', profile.id)
      .in('status', ['pending', 'processing', 'printing'])
      .order('created_at', { ascending: true })

    if (jobsError) {
      console.error('Failed to fetch print jobs:', jobsError)
      return NextResponse.json({ success: false, message: 'Server Error' }, { status: 500 })
    }

    const mappedJobs = (jobs || []).map((job: any) => {
      let filesArr = job.files || [];
      if (typeof filesArr === 'string') {
        try { filesArr = JSON.parse(filesArr); } catch(e) { filesArr = []; }
      }
      const fileData = filesArr.length > 0 ? filesArr[0] : {};

      return {
        id: job.id,
        status: job.status,
        file_name: fileData.filename || job.file_name || 'Unknown Document',
        page_count: fileData.page_count || job.page_count || 1,
        color_mode: fileData.color_mode || job.color_mode || 'B&W',
        sides: fileData.sides || job.sides || 'Single'
      }
    })

    return NextResponse.json({
      success: true,
      profile: {
        id: profile.id,
        full_name: profile.full_name,
        student_id: profile.student_id,
        department: profile.department,
        wallet_balance: profile.wallet_balance
      },
      jobs: mappedJobs
    })

  } catch (error: any) {
    console.error('RFID API error:', error)
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 })
  }
}
