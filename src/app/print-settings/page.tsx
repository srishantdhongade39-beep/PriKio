'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { CostResult } from '@/lib/calculate-cost'
import { usePrintStore } from '@/store/usePrintStore'
import dynamic from 'next/dynamic'
import PrintSettingsCard from '@/components/PrintSettingsCard'

const FilePreviewModal = dynamic(() => import('@/components/FilePreviewModal'), { ssr: false })

export default function PrintSettings() {
  const router = useRouter()
  const { profile } = useAuth()
  
  const { files, updatePageRange } = usePrintStore()
  
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [previewFileId, setPreviewFileId] = useState<string | null>(null)

  useEffect(() => {
    if (files.length === 0) {
      router.push('/upload')
    }
  }, [files.length, router])

  const handleConfirmPay = (settings: any) => {
    if (files.length === 0) return
    
    sessionStorage.setItem('printSettings', JSON.stringify(settings))
    router.push('/review')
  }

  if (files.length === 0) return null

  return (
    <div className="page-root">
      {/* Desktop left branding panel */}
      <div className="desktop-left-panel">
        <div className="dlp-step-pill">Step 2 of 3</div>
        <svg className="dlp-icon" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '40px', height: '40px' }}>
          <line x1="4" y1="21" x2="4" y2="14"></line>
          <line x1="4" y1="10" x2="4" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12" y2="3"></line>
          <line x1="20" y1="21" x2="20" y2="16"></line>
          <line x1="20" y1="12" x2="20" y2="3"></line>
          <line x1="1" y1="14" x2="7" y1="14"></line>
          <line x1="9" y1="8" x2="15" y2="8"></line>
          <line x1="17" y1="16" x2="23" y2="16"></line>
        </svg>
        <h2 className="dlp-heading">Configure Print Options</h2>
        <p className="dlp-sub">Choose color mode, layout, and number of copies for your documents.</p>

        <hr className="dlp-divider" />

      </div>

      <div className="desktop-right-panel" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', height: '100%', minHeight: 0 }}>
          <PrintSettingsCard
            files={files as any}
            onConfirm={handleConfirmPay}
            onPreviewClick={(id: string) => setPreviewFileId(id)}
            onBack={() => router.push('/upload')}
          />
          {error && <p style={{ color: 'var(--red)', fontSize: '12px', marginTop: '12px', textAlign: 'center' }}>{error}</p>}
          {submitting && <p style={{ color: 'var(--grey)', fontSize: '12px', marginTop: '12px', textAlign: 'center' }}>Processing...</p>}

          {previewFileId && (
            <FilePreviewModal
              file={files.find(f => f.id === previewFileId)!}
              onClose={() => setPreviewFileId(null)}
              onSave={(range: string) => {
                updatePageRange(previewFileId, range)
                setPreviewFileId(null)
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
