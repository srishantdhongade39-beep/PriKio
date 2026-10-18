import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const supabase = await createClient()
    const { data: job, error } = await supabase
      .from('print_jobs')
      .select('status')
      .eq('id', id)
      .single()

    if (error || !job) {
      return NextResponse.json({ error: error?.message || 'Print job not found' }, { status: 404 })
    }

    return NextResponse.json({
      data: {
        id,
        status: job.status
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const { status } = await request.json()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('print_jobs')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update print job status:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
