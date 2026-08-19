import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { kiosk_id, ink_level_percent, paper_level_percent, status } = body
    
    if (!kiosk_id) {
      return NextResponse.json({ error: 'kiosk_id is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // 1. Update the kiosk record
    const { error: updateError } = await supabase
      .from('kiosks')
      .update({
        ink_level_percent: ink_level_percent ?? 100,
        paper_level_percent: paper_level_percent ?? 100,
        last_ping: new Date().toISOString(),
        is_online: status === 'online'
      })
      .eq('id', kiosk_id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // 2. Check thresholds and create notifications
    const notifications = []
    if (ink_level_percent !== undefined && ink_level_percent < 10) {
      notifications.push({
        kiosk_id,
        type: 'low_ink',
        message: `Kiosk ${kiosk_id} is running low on ink (${ink_level_percent}%).`
      })
    }
    
    if (paper_level_percent !== undefined && paper_level_percent < 10) {
      notifications.push({
        kiosk_id,
        type: 'out_of_paper',
        message: `Kiosk ${kiosk_id} is almost out of paper (${paper_level_percent}%).`
      })
    }

    if (status === 'offline' || status === 'maintenance') {
      notifications.push({
        kiosk_id,
        type: 'offline',
        message: `Kiosk ${kiosk_id} reported status: ${status}.`
      })
    }

    if (notifications.length > 0) {
      await supabase.from('notifications').insert(notifications)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
