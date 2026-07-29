'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import PaymentSuccess from '@/components/PaymentSuccess'

import { usePrintStore } from '@/store/usePrintStore'

export default function Payment() {
  const router = useRouter()
  const [printJob, setPrintJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  const { globalJobId } = usePrintStore()

  useEffect(() => {
    const printJobId = sessionStorage.getItem('printJobId')
    if (!printJobId) {
      router.push('/upload')
      return
    }

    const fetchJob = async () => {
      try {
        const cached = sessionStorage.getItem('printJobData')
        if (cached) {
          setPrintJob(JSON.parse(cached))
          setLoading(false)
          return
        }

        const res = await fetch(`/api/print-jobs/${printJobId}`)
        const result = await res.json()
        if (res.ok) {
          setPrintJob(result.data)
        } else {
          setError(result.error)
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchJob()
  }, [router])

  const handleSimulateWebhookAndRedirect = async () => {
    // Simulate webhook by directly updating Supabase status so the Status screen knows it's paid
    const realJobId = globalJobId || printJob?.id
    if (!realJobId) {
      router.push('/')
      return
    }
    
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        await fetch(`${supabaseUrl}/rest/v1/print_jobs?id=eq.${realJobId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({ status: 'verified', payment_status: 'paid' })
        });
      }
    } catch (e) {
      console.error("Simulation failed", e)
    }
    
    router.push(`/status?id=${realJobId}`)
  }

  if (loading) return null

  if (error || !printJob) {
    return <div style={{ padding: '20px', color: 'red' }}>{error || 'Failed to load print job.'}</div>
  }
  
  return (
    <PaymentSuccess 
      amount={((printJob.total_amount_paise || 0) / 100).toFixed(2)}
      paymentId={printJob.id}
      redirectSeconds={3}
      onRedirect={handleSimulateWebhookAndRedirect}
    />
  )
}
