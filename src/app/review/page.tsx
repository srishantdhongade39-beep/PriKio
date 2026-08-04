'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { usePrintStore, useHydratedPrintStore } from '@/store/usePrintStore'
import OrderReview from '@/components/OrderReview'

export default function ReviewPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const hasHydrated = useHydratedPrintStore()
  const { files, globalJobId, printSettings } = usePrintStore()
  
  const [settings, setSettings] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!hasHydrated) return

    if (files.length === 0) {
      router.push('/upload')
      return
    }

    const storedSettings = sessionStorage.getItem('printSettings')
    if (storedSettings) {
      try {
        setSettings(JSON.parse(storedSettings))
        return
      } catch (e) {
        console.error("Failed to parse sessionStorage printSettings", e)
      }
    }

    if (printSettings) {
      setSettings(printSettings)
    } else {
      router.push('/print-settings')
    }
  }, [hasHydrated, files.length, printSettings, router])

  const handleProceed = async () => {
    if (files.length === 0 || !settings) return
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/print-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: globalJobId,
          files: files.map(f => ({
            id: f.id,
            fileName: f.fileName,
            storage_path: `${globalJobId}/${f.fileName}`,
            fileUrl: f.url,
            fileSizeMb: parseFloat(f.fileSizeMb),
            pageCount: f.pageCount,
            pageRange: f.pagesToPrint || 'All',
            colorMode: f.colorMode || settings.colorMode || 'bw',
            layout: f.layout || settings.layout || 'duplex',
            orientation: f.orientation || settings.orientation || 'portrait',
            copies: f.copies || settings.copies || 1,
          })),
          colorMode: settings.colorMode,
          sides: settings.layout,
          orientation: settings.orientation,
          copies: settings.copies,
          sheetCount: settings.sheetCount,
          total_amount: settings.totalCost
        })
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error)

      sessionStorage.setItem('printJobId', result.data.id)
      sessionStorage.setItem('printJobData', JSON.stringify(result.data))
      usePrintStore.getState().setJobData(result.data.id, result.data.otp || '')
      router.push('/payment')
      
    } catch (err: any) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  if (!hasHydrated || files.length === 0 || !settings) {
    return (
      <div className="page-root" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--grey)', fontSize: '14px', fontWeight: 500 }}>Loading order review...</div>
      </div>
    )
  }

  return (
    <div className="page-root">
      <div className="desktop-left-panel">
        <div className="dlp-step-pill">Step 3 of 4</div>
        <svg className="dlp-icon" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '40px', height: '40px' }}>
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
          <path d="M9 14h6"></path>
          <path d="M9 18h6"></path>
          <path d="M9 10h.01"></path>
        </svg>
        <h2 className="dlp-heading">Review Your Order</h2>
        <p className="dlp-sub">Check your print settings and select your kiosk before payment.</p>

        <hr className="dlp-divider" />

      </div>

      <div className="desktop-right-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', height: '100%' }}>
          {submitting ? (
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '440px', margin: 'auto' }}>
              <div className="skeleton" style={{ height: '120px', width: '100%', borderRadius: '14px' }}></div>
              <div className="skeleton" style={{ height: '60px', width: '100%', borderRadius: '12px' }}></div>
              <div className="skeleton" style={{ height: '60px', width: '100%', borderRadius: '12px' }}></div>
              <div className="skeleton" style={{ height: '80px', width: '100%', borderRadius: '12px', marginTop: '20px' }}></div>
              <p style={{ color: 'var(--grey)', fontSize: '13px', textAlign: 'center', marginTop: '16px', fontWeight: 600 }}>Securely encrypting and submitting your order...</p>
            </div>
          ) : (
            <>
              <OrderReview
                files={files as any}
                copies={settings.copies}
                colorMode={settings.colorMode}
                layout={settings.layout}
                orientation={settings.orientation}
                printCost={settings.totalCost - 2}
                serviceFee={2}
                onEdit={() => router.push('/print-settings')}
                onProceed={handleProceed}
              />
              {error && <p style={{ color: 'var(--red)', fontSize: '12px', marginTop: '12px', textAlign: 'center' }}>{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
