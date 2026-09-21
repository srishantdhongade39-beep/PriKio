'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { usePrintStore, useHydratedPrintStore } from '@/store/usePrintStore'
import dynamic from 'next/dynamic'
import PrintSettingsCard from '@/components/PrintSettingsCard'

const FilePreviewModal = dynamic(() => import('@/components/FilePreviewModal'), { ssr: false })

export default function PrintSettings() {
  const router = useRouter()
  const { profile } = useAuth()
  
  const hasHydrated = useHydratedPrintStore()
  const { files, updatePageRange } = usePrintStore()
  
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [previewFileId, setPreviewFileId] = useState<string | null>(null)

  useEffect(() => {
    // Only evaluate navigation guard after store hydration from localStorage completes
    if (!hasHydrated) return

    if (files.length === 0) {
      router.push('/upload')
    }
  }, [hasHydrated, files.length, router])

  const handleConfirmPay = async (settings: any) => {
    if (files.length === 0) return
    
    // If any file is still converting in the background, wait gracefully
    const hasConverting = files.some(f => f.isConverting)
    if (hasConverting) {
      setSubmitting(true)
      const start = Date.now()
      // Wait up to 30 seconds for conversion to finish
      while (Date.now() - start < 30000) {
        await new Promise(r => setTimeout(r, 500))
        const currentFiles = usePrintStore.getState().files
        if (!currentFiles.some(f => f.isConverting)) break
      }
      setSubmitting(false)
    }

    const finalFiles = usePrintStore.getState().files;
    
    // Check if any file failed conversion
    if (finalFiles.some(f => f.conversionError)) {
      setError("One or more files failed to process. Please go back and remove them.");
      return;
    }
    
    // Check if it's STILL converting after timeout
    if (finalFiles.some(f => f.isConverting)) {
      setError("File conversion is taking too long. Please try again or upload a PDF instead.");
      return;
    }

    // Strictly ensure no non-PDF/image files make it to print
    const unsupported = finalFiles.find(f => {
      const ext = f.fileName.split('.').pop()?.toLowerCase();
      return ext !== 'pdf' && ext !== 'jpg' && ext !== 'jpeg' && ext !== 'png' && ext !== 'webp';
    });
    
    if (unsupported) {
      setError(`File "${unsupported.fileName}" is not supported for direct printing. Please upload a PDF instead.`);
      return;
    }

    sessionStorage.setItem('printSettings', JSON.stringify(settings))
    usePrintStore.getState().setPrintSettings(settings)
    router.push('/review')
  }

  if (!hasHydrated || files.length === 0) {
    return (
      <div className="page-root" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--grey)', fontSize: '14px', fontWeight: 500 }}>Loading print options...</div>
      </div>
    )
  }

  return (
    <div className="page-root" style={{ height: '100dvh', maxHeight: '100dvh', overflow: 'hidden' }}>
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
          <line x1="1" y1="14" x2="7" y2="14"></line>
          <line x1="9" y1="8" x2="15" y2="8"></line>
          <line x1="17" y1="16" x2="23" y2="16"></line>
        </svg>
        <h2 className="dlp-heading">Configure Print Options</h2>
        <p className="dlp-sub">Choose color mode, layout, and number of copies for your documents.</p>

        <hr className="dlp-divider" />
      </div>

      <div className="desktop-right-panel" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100dvh', maxHeight: '100dvh' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', height: '100%', minHeight: 0, overflow: 'hidden' }}>
          <PrintSettingsCard
            files={files as any}
            onConfirm={handleConfirmPay}
            onPreviewClick={(id: string) => setPreviewFileId(id)}
            onBack={() => router.push('/upload')}
          />
          {error && <p style={{ color: 'var(--red)', fontSize: '12px', marginTop: '12px', textAlign: 'center' }}>{error}</p>}
          {submitting && (
            <div style={{ padding: '8px', textAlign: 'center', fontSize: '13px', color: 'var(--accent)', fontWeight: 600 }}>
              Finalizing print document...
            </div>
          )}

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
