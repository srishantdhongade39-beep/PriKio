import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Enforce RBAC
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 1. Get Active Kiosks
    const { data: kiosks, error: kiosksErr } = await supabase.from('kiosks').select('*')
    const activeKiosks = kiosks?.filter(k => k.is_online).length || 0

    // 2. Get Today's Jobs (from midnight)
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const { data: jobs, error: jobsErr } = await supabase
      .from('print_jobs')
      .select('kiosk_id, total_amount')
      .eq('payment_status', 'paid')
      .gte('created_at', startOfDay.toISOString())

    const totalPrints = jobs?.length || 0
    const totalEarnings = jobs?.reduce((sum, job) => sum + (Number(job.total_amount) || 0), 0) || 0

    // Revenue per kiosk
    const revenuePerKiosk: Record<string, number> = {}
    jobs?.forEach(job => {
      const kId = job.kiosk_id || 'Unknown'
      if (!revenuePerKiosk[kId]) revenuePerKiosk[kId] = 0
      revenuePerKiosk[kId] += Number(job.total_amount) || 0
    })

    // 3. Unread Notifications
    const { data: notifications, error: notifErr } = await supabase
      .from('notifications')
      .select('*')
      .eq('is_read', false)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      data: {
        activeKiosks,
        totalPrints,
        totalEarnings,
        revenuePerKiosk,
        kiosks: kiosks || [],
        notifications: notifications || []
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
