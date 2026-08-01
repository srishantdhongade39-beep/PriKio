'use client'

import { useState, useRef } from "react"
import { useRouter } from 'next/navigation'
import { usePrintStore } from '@/store/usePrintStore'
import AppHeader from '@/components/AppHeader'
import SmoothScrollBox from '@/components/SmoothScrollBox'
import { getPdfPageCount, convertImageToPdfBlob } from '@/lib/clientDocUtils'
import { createClient } from '@/lib/supabase/client'

export default function UploadScreen() {
  const router = useRouter()
  const [files, setFiles] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadIndex, setUploadIndex] = useState(1)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleFiles = async (incoming: FileList | File[]) => {
    const allowedExtensions = ['.pdf', '.docx', '.doc', '.txt', '.xlsx', '.xls', '.csv', '.pptx', '.ppt', '.jpg', '.jpeg', '.png', '.html', '.htm', '.xml', '.webp']
    const validFiles: File[] = []
    let rejectedCount = 0

    Array.from(incoming).forEach(f => {
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase()
      if (allowedExtensions.includes(ext)) {
        validFiles.push(f)
      } else {
        rejectedCount++
      }
    })

    if (rejectedCount > 0) {
      alert(`Skipped ${rejectedCount} file(s). Only Document, Spreadsheet, Presentation, Image, and Code formats are supported.`)
    }

    // Fast client-side pre-processing for instant page counts and image-to-PDF conversion
    const processedItems = await Promise.all(
      validFiles.map(async (f) => {
        let activeBlob: Blob = f
        let activeFileName = f.name
        let pageCount = 1
        const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase()

        if (ext === '.pdf') {
          pageCount = await getPdfPageCount(f)
        } else if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
          const converted = await convertImageToPdfBlob(f)
          activeBlob = converted.blob
          activeFileName = converted.fileName
          pageCount = 1
        }

        return {
          id: Math.random().toString(36).slice(2),
          file: activeBlob,
          originalFile: f,
          name: activeFileName,
          size: (f.size / 1024 / 1024).toFixed(2) + " MB",
          pageCount: pageCount,
          pagesToPrint: "All",
          isReadyPdf: ext === '.pdf' || activeFileName.endsWith('.pdf')
        }
      })
    )

    setFiles((prev) => [...prev, ...processedItems])
  }

  const removeFile = (id: string) =>
    setFiles((prev) => prev.filter((f) => f.id !== id))

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleContinue = async () => {
    if (files.length === 0) return
    setUploading(true)
    setUploadProgress(0)
    setUploadIndex(files.length)
    abortControllerRef.current = new AbortController()

    try {
      // ─────────────────────────────────────────────────────────────
      // ULTRA-FAST DIRECT PATH: Metadata Init + Direct Supabase Upload
      // ─────────────────────────────────────────────────────────────
      setUploadProgress(20)

      // 1. Initialize session and get signed upload URLs / storage paths
      const initRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          files: files.map(f => ({
            fileName: f.name,
            fileType: f.file?.type || 'application/octet-stream',
            pageCount: f.pageCount
          }))
        })
      })

      if (!initRes.ok) {
        const errData = await initRes.json()
        throw new Error(errData.error || 'Failed to initialize upload session')
      }

      const sessionData = await initRes.json()
      const supabase = createClient()
      const totalFiles = files.length
      let completedUploads = 0

      // 2. Upload each file directly to Supabase Storage in parallel
      const uploadPromises = sessionData.files.map(async (serverFile: any, index: number) => {
        const localItem = files[index]
        const uploadBlob = localItem.file instanceof Blob 
          ? localItem.file 
          : new Blob([localItem.file])

        // Direct upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(serverFile.storage_path, uploadBlob, {
            upsert: true,
            contentType: localItem.file?.type || 'application/octet-stream'
          })

        if (uploadError) {
          // Fallback to signed URL PUT if standard upload has RLS restriction
          if (serverFile.signedUploadUrl) {
            const putRes = await fetch(serverFile.signedUploadUrl, {
              method: 'PUT',
              body: uploadBlob,
              headers: { 'Content-Type': localItem.file?.type || 'application/octet-stream' }
            })
            if (!putRes.ok) throw new Error('Signed direct upload failed')
          } else {
            throw new Error(uploadError.message)
          }
        }

        completedUploads++
        const progressPercent = 25 + Math.round((completedUploads / totalFiles) * 70)
        setUploadProgress(progressPercent)
      })

      await Promise.all(uploadPromises)
      setUploadProgress(100)

      // 3. Format store items
      const formattedResults = sessionData.files.map((serverFile: any, index: number) => {
        const originalItem = files[index]
        const needsConversion = !!serverFile.needsConversion
        return {
          id: Math.random().toString(36).substring(7),
          job_id: sessionData.job_id,
          otp: sessionData.otp,
          storagePath: serverFile.storage_path,
          fileName: serverFile.filename,
          fileSizeMb: originalItem.size.replace(" MB", ""),
          pageCount: serverFile.page_count || originalItem.pageCount || 1,
          pagesToPrint: originalItem.pagesToPrint,
          url: serverFile.url,
          originalFile: originalItem.file,
          isConverting: needsConversion
        }
      })

      usePrintStore.getState().setFiles(formattedResults)
      if (formattedResults.length > 0) {
        usePrintStore.getState().setJobData(sessionData.job_id, sessionData.otp)
      }

      // 4. Trigger non-blocking async background conversion for Office/PPT docs
      formattedResults.forEach((item: any) => {
        if (item.isConverting) {
          fetch('/api/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jobId: item.job_id,
              storagePath: item.storagePath,
              fileName: item.fileName,
              fileId: item.id
            })
          })
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                usePrintStore.getState().updateFile(item.id, {
                  url: data.convertedUrl,
                  fileName: data.convertedFileName,
                  storagePath: data.storagePath,
                  pageCount: data.pageCount,
                  isConverting: false
                })
              } else {
                usePrintStore.getState().updateFile(item.id, {
                  isConverting: false,
                  conversionError: data.error || 'Conversion failed'
                })
              }
            })
            .catch(err => {
              console.error('Background conversion error:', err)
              usePrintStore.getState().updateFile(item.id, {
                isConverting: false,
                conversionError: err.message
              })
            })
        }
      })

      // Immediately route to print-settings without blocking!
      router.push('/print-settings')

    } catch (err: any) {
      if (err.name === 'AbortError' || err.message === 'AbortError') {
        console.log('Upload cancelled')
      } else {
        console.error(err)
        alert('Upload failed: ' + (err.message || 'Unknown error occurred.'))
      }
      setUploading(false)
    }
  }

  const cancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setUploading(false)
    setUploadProgress(0)
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap');
        
        .up-root {
          height: 100vh;
          height: 100dvh;
          width: 100vw;
          display: flex; overflow: hidden;
          font-family: 'Quicksand', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #1a2340;
        }
        
        .up-root * {
          font-family: inherit;
        }

        /* Left panel */
        .up-left {
          width: 45%; background: #1a2340;
          display: flex; flex-direction: column;
          justify-content: center;
          padding: clamp(32px,5vw,72px); flex-shrink: 0;
        }
        .up-step {
          display: inline-flex; align-items: center;
          background: rgba(255,255,255,0.08); border-radius: 20px;
          padding: 6px 14px; font-size: 11px; font-weight: 700;
          letter-spacing: 0.1em; color: #a0aec0;
          margin-bottom: 40px; width: fit-content;
        }
        .up-left-icon { font-size: 32px; margin-bottom: 20px; opacity: 0.7; }
        .up-left-title {
          font-family: 'Quicksand', sans-serif !important;
          font-size: clamp(32px, 4vw, 48px); color: #fff;
          font-weight: 800; letter-spacing: -0.02em;
          margin-bottom: 16px; line-height: 1.1;
        }
        .up-left-sub { font-size: 16px; color: #94a3b8; line-height: 1.6; max-width: 300px; font-weight: 500; }
        .up-dots { display: flex; gap: 8px; margin-top: 48px; }
        .up-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.2); }
        .up-dot.active { background: #4a5fc1; }

        /* Right panel */
        .up-right {
          flex: 1; background: #ffffff;
          display: flex; align-items: center; justify-content: center;
          padding: 0; overflow: hidden;
        }

        /* Card */
        .up-card {
          background: #fff; border-radius: 0;
          width: 100%; height: 100%;
          display: flex; flex-direction: column;
          overflow: hidden; box-shadow: none;
        }

        /* Scrollable body */
        .up-card-body {
          flex: 1; overflow-y: auto; padding: 80px 20px 0;
          -webkit-overflow-scrolling: touch;
          display: flex; flex-direction: column; align-items: center;
        }
        .up-card-inner {
          width: 100%; max-width: 440px; display: flex; flex-direction: column; flex: 1;
        }

        /* Empty Dropzone / Illustration */
        .up-dropzone {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 30px 20px; text-align: center;
        }
        .up-headline {
          font-family: 'Quicksand', sans-serif !important;
          font-size: 28px; font-weight: 600; color: #1a2340;
          margin: 20px 0 12px; line-height: 1.2;
        }
        .up-subline {
          font-size: 14px; color: #8892a4; line-height: 1.5;
          max-width: 260px; margin-bottom: 24px;
        }
        .up-select-btn {
          background: #f0f1f7; color: #1a2340;
          border: none; padding: 12px 24px; border-radius: 50px;
          font-size: 15px; font-weight: 700; cursor: pointer;
          display: inline-flex; align-items: center; gap: 8px;
          transition: background 0.2s, transform 0.1s;
        }
        .up-select-btn:hover { background: #e2e4ef; transform: scale(1.02); }

        .up-hint {
          display: flex; align-items: center; gap: 6px;
          font-size: 12px; color: #22c55e; margin-bottom: 8px;
        }
        .up-formats { font-size: 11px; color: #a0aec0; margin-bottom: 20px; }

        /* Add more (compact) */
        .up-add-more {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 12px 18px; border-radius: 14px;
          border: 1.8px dashed #cbd5e1; cursor: pointer;
          font-size: 13.5px; color: #334155; font-weight: 600;
          margin-top: 10px; margin-bottom: 16px; background: #ffffff; width: 100%;
          transition: all 0.2s ease; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.02);
        }
        .up-add-more:hover { border-color: #4f46e5; color: #4f46e5; background: #f5f7ff; transform: translateY(-1px); }

        /* Files scroll list */
        .up-files-box {
          border: 1.5px solid #e2e8f0;
          border-radius: 18px;
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
          padding: 10px;
          max-height: 50vh;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 9px;
          -webkit-overflow-scrolling: touch;
          box-shadow: inset 0 2px 5px rgba(15, 23, 42, 0.02), 0 1px 2px rgba(15, 23, 42, 0.03);
        }

        /* File cards */
        .up-file-card {
          background: #ffffff;
          border-radius: 14px;
          padding: 11px 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03);
          position: relative;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s;
        }
        .up-file-card:hover {
          border-color: #cbd5e1;
          box-shadow: 0 6px 16px -4px rgba(15, 23, 42, 0.08), 0 2px 6px -2px rgba(15, 23, 42, 0.04);
          transform: translateY(-1.5px);
        }
        .up-file-icon {
          width: 38px; height: 38px; border-radius: 10px;
          background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
          border: 1px solid rgba(79, 70, 229, 0.15);
          display: flex;
          align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .up-file-info { flex: 1; min-width: 0; padding-right: 32px; }
        .up-file-name {
          font-size: 13.5px; font-weight: 600; color: #0f172a;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          margin-bottom: 3px;
        }
        .up-file-meta { font-size: 12px; color: #64748b; font-weight: 500; }
        .up-remove {
          background: #f8fafc; border: 1px solid #e2e8f0; 
          border-radius: 50%; width: 26px; height: 26px; cursor: pointer;
          color: #64748b; font-size: 15px; display: flex; align-items: center; justify-content: center;
          position: absolute; top: 50%; right: 12px; transform: translateY(-50%);
          line-height: 1; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .up-remove:hover { background: #fee2e2; border-color: #fca5a5; color: #ef4444; transform: translateY(-50%) scale(1.1); }

        /* Footer */
        .up-footer { padding: 14px 20px 20px; flex-shrink: 0; width: 100%; max-width: 440px; margin: 0 auto; }
        .up-btn-upload {
          width: 100%; padding: 15px; border-radius: 50px;
          background: #1a2340;
          color: #fff; border: none; font-size: 15px; font-weight: 600;
          cursor: pointer; opacity: 0.35; transition: opacity 0.2s;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .up-btn-upload.active { opacity: 1; }
        .up-badge {
          background: #4a5fc1; color: #fff;
          border-radius: 20px; padding: 2px 10px;
          font-size: 12px; font-weight: 700;
        }

        /* Upload Modal Styles */
        .up-upload-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.5);
          display: flex; align-items: flex-end; justify-content: center;
          z-index: 300;
          animation: fadeIn 0.2s ease-out;
          backdrop-filter: blur(2px);
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (min-width: 640px) {
          .up-upload-overlay { align-items: center; }
          .up-upload-modal { border-radius: 24px !important; max-width: 400px !important; }
        }
        .up-upload-modal {
          background: #f8f9fa; border-radius: 24px 24px 0 0;
          padding: 32px 24px; width: 100%; max-width: 100%;
          display: flex; flex-direction: column; align-items: center;
          animation: modalSlideUp 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          box-shadow: 0 -10px 40px rgba(0,0,0,0.1);
        }
        @keyframes modalSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .up-folder-anim {
          width: 56px; height: 56px; margin-bottom: 20px;
          display: flex; align-items: center; justify-content: center;
          animation: float 2s infinite ease-in-out;
        }
        .up-folder-anim svg {
          width: 100%; height: 100%; color: #1a2340;
          filter: drop-shadow(0 4px 6px rgba(26,35,64,0.2));
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .up-upload-title {
          font-family: 'Quicksand', sans-serif !important;
          font-size: 22px; font-weight: 700; color: #1a2340;
          margin-bottom: 8px; text-align: center;
        }
        .up-upload-sub {
          font-size: 14px; color: #64748b; text-align: center;
          margin-bottom: 32px; line-height: 1.5; max-width: 280px;
          font-weight: 500;
        }
        .up-upload-progress-info {
          display: flex; justify-content: space-between; width: 100%;
          font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 10px;
        }
        .up-upload-bar-bg {
          width: 100%; height: 8px; background: #e2e8f0;
          border-radius: 8px; overflow: hidden; margin-bottom: 12px;
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);
        }
        .up-upload-bar-fill {
          height: 100%; background: #1a2340; border-radius: 8px;
          transition: width 0.3s ease;
        }
        .up-upload-note {
          font-size: 12px; color: #94a3b8; font-style: italic;
          margin-bottom: 32px; width: 100%; text-align: left;
        }
        .up-upload-cancel {
          width: 100%; padding: 14px; border-radius: 14px;
          background: #e2e8f0; color: #1e293b; border: none;
          font-size: 15px; font-weight: 700; cursor: pointer;
          transition: background 0.2s, transform 0.1s;
        }
        .up-upload-cancel:hover { background: #cbd5e1; transform: scale(0.98); }

        /* Mobile */
        @media (max-width: 768px) {
          .up-left { display: none; }
          .up-right {
            background: #fff;
            padding: 0;
          }
          .up-card { 
            max-width: 100%; 
            max-height: 100dvh; 
            height: 100dvh;
            border-radius: 0; 
            box-shadow: none;
          }
        }
      `}} />

      {/* Upload Modal Overlay */}
      {uploading && (
        <div className="up-upload-overlay">
          <div className="up-upload-modal">
            <div className="up-folder-anim">
              <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V8C22 6.9 21.1 6 20 6H12L10 4Z"/>
              </svg>
            </div>
            
            <h2 className="up-upload-title">Uploading Files...</h2>
            <p className="up-upload-sub">Please wait while we upload your files to the server.</p>
            
            <div className="up-upload-progress-info">
              <span>Uploading {uploadIndex} of {files.length} File{files.length !== 1 ? 's' : ''}...</span>
              <span>{Math.round(uploadProgress)}%</span>
            </div>
            
            <div className="up-upload-bar-bg">
              <div className="up-upload-bar-fill" style={{ width: `${Math.round(uploadProgress)}%` }}></div>
            </div>
            
            <p className="up-upload-note">We delete your files once printed</p>
            
            <button 
              className="up-upload-cancel" 
              onClick={cancelUpload}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="up-root" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
        {/* Left panel */}
        <div className="up-left">
          <div className="up-step">STEP 1 OF 3</div>
          <svg className="up-left-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '40px', height: '40px', color: 'rgba(255,255,255,0.9)' }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <h1 className="up-left-title">Upload Your Files</h1>
          <p className="up-left-sub">Select PDF, Office, Image, or Code files.</p>
        </div>

        {/* Right panel */}
        <div className="up-right">
          <div className="up-card">
            <AppHeader title="CampusPrint" subtitle="Print Anywhere on Campus" onBack={() => router.push('/scan')} />

            {/* Body */}
            <div className="up-card-body">
              <div className="up-card-inner">
                <input
                  ref={inputRef} type="file" multiple
                  accept=".pdf,.docx,.doc,.txt,.xlsx,.xls,.csv,.pptx,.ppt,.jpg,.jpeg,.png,.html,.htm,.xml,.webp"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFiles(e.target.files)
                      e.target.value = ''
                    }
                  }}
                />

              {files.length === 0 ? (
                /* Empty state */
                <div className="up-dropzone">
                  <svg viewBox="0 0 140 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', maxWidth: '200px', height: 'auto', display: 'block', margin: '0 auto' }}>
                    <g transform="rotate(-12, 110, 28)">
                      <rect x="97" y="10" width="28" height="36" rx="3" fill="#F3F4F6" stroke="#9CA3AF" strokeWidth="1.4"/>
                      <line x1="103" y1="20" x2="119" y2="20" stroke="#D1D5DB" strokeWidth="1.2" strokeLinecap="round"/>
                      <line x1="103" y1="26" x2="119" y2="26" stroke="#D1D5DB" strokeWidth="1.2" strokeLinecap="round"/>
                      <line x1="103" y1="32" x2="112" y2="32" stroke="#D1D5DB" strokeWidth="1.2" strokeLinecap="round"/>
                    </g>
                    <g transform="rotate(8, 20, 85)">
                      <rect x="10" y="72" width="24" height="30" rx="3" fill="#F3F4F6" stroke="#9CA3AF" strokeWidth="1.3" strokeDasharray="3 2"/>
                      <line x1="16" y1="80" x2="28" y2="80" stroke="#D1D5DB" strokeWidth="1.1" strokeLinecap="round"/>
                      <line x1="16" y1="86" x2="28" y2="86" stroke="#D1D5DB" strokeWidth="1.1" strokeLinecap="round"/>
                    </g>
                    <rect x="24" y="46" width="92" height="42" rx="10" fill="#f0f1f7" stroke="#1a2340" strokeWidth="1.8"/>
                    <rect x="38" y="36" width="64" height="16" rx="5" fill="#F3F4F6" stroke="#9CA3AF" strokeWidth="1.5"/>
                    <rect x="44" y="82" width="52" height="13" rx="3" fill="#fff" stroke="#1a2340" strokeWidth="1.5"/>
                    <circle cx="96" cy="61" r="3" fill="#1a2340" opacity="0.7"/>
                    <circle cx="106" cy="61" r="3" fill="#E5E7EB"/>
                    <line x1="38" y1="70" x2="102" y2="70" stroke="#1a2340" strokeWidth="1" strokeLinecap="round" opacity="0.25"/>
                  </svg>
                  
                  <h2 className="up-headline">Ready to print?</h2>
                  <p className="up-subline">Upload your documents to get started with high-quality campus printing.</p>
                  
                  <button className="up-select-btn" onClick={() => inputRef.current?.click()}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Select Files
                  </button>
                </div>
              ) : (
                /* Files listed */
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>Files to Upload</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)', color: '#ffffff', padding: '2px 8px', borderRadius: '12px', boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)' }}>{files.length}</span>
                    </div>
                    <span style={{ fontSize: '0.74rem', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                      Scroll to review
                    </span>
                  </div>

                  <SmoothScrollBox className="up-files-box" maxHeight="50vh">
                    {files.map((f) => (
                      <div className="up-file-card" key={f.id}>
                        <div className="up-file-icon">
                          {f.name.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a5fc1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a5fc1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                          )}
                        </div>
                        <div className="up-file-info">
                          <div className="up-file-name">{f.name}</div>
                          <div className="up-file-meta">
                            {f.pageCount ? `${f.pageCount} ${f.pageCount === 1 ? 'Page' : 'Pages'} • ` : ''}{f.size}
                          </div>
                        </div>
                        <button className="up-remove" onClick={() => removeFile(f.id)} title="Remove file">×</button>
                      </div>
                    ))}
                  </SmoothScrollBox>

                  <button className="up-add-more" onClick={() => inputRef.current?.click()}>
                    + Add More Files
                  </button>
                </div>
              )}

                <div className="up-hint">✓ Preview pages before you print</div>
                <div className="up-formats">Accepted formats: PDF, Office, TXT, CSV, HTML, XML, Images. Max 100MB</div>
              </div>
            </div>

            {/* Footer */}
            <div className="up-footer">
              <button
                className={`up-btn-upload${files.length > 0 && !uploading ? " active" : ""}`}
                disabled={files.length === 0 || uploading}
                onClick={handleContinue}
              >
                Upload
                {files.length > 0 && !uploading && <span className="up-badge">{files.length}</span>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
