import React, { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { parsePageRangeToSet, formatSetToPageRange } from '@/lib/pageRangeUtils'
import { PrintFile } from '@/store/usePrintStore'
import { motion, AnimatePresence } from 'framer-motion'

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

function PdfPageCanvas({ pdf, pageNum, selected, onToggle }: { pdf: any, pageNum: number, selected: boolean, onToggle: (n: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(pageNum <= 2)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (isVisible) return; // already visible

    const scrollContainer = document.getElementById('pdf-scroll-container');
    if (!scrollContainer) return;

    const checkVisibility = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      
      // If the page is within 1000px of the visible scroll area
      if (rect.top < containerRect.bottom + 1000 && rect.bottom > containerRect.top - 1000) {
        setIsVisible(true);
      }
    };

    scrollContainer.addEventListener('scroll', checkVisibility, { passive: true });
    // Check initially in case it's already in view but pageNum > 2
    setTimeout(checkVisibility, 100);

    return () => scrollContainer.removeEventListener('scroll', checkVisibility);
  }, [isVisible])

  useEffect(() => {
    if (!isVisible) return
    let renderTask: any
    pdf.getPage(pageNum).then((page: any) => {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      let scale = isMobile ? 1.0 : 1.5;
      let viewport = page.getViewport({ scale })
      
      // Memory safety cap for Android Chrome
      if (isMobile && viewport.width > 1000) {
        scale = 1000 / (viewport.width / scale);
        viewport = page.getViewport({ scale });
      }
      const canvas = canvasRef.current
      if (!canvas) return
      const context = canvas.getContext('2d')
      if (!context) return
      
      canvas.height = viewport.height
      canvas.width = viewport.width
      
      // Reset transform and clear to fix React Strict Mode double-render glitches
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, canvas.width, canvas.height)

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      }
      renderTask = page.render(renderContext)
      renderTask.promise.then(() => {
        setIsLoaded(true)
      }).catch((err: any) => {
        // Ignore task cancellation errors, log others
        if (err.name !== 'RenderingCancelledException') {
          console.error(`Error rendering page ${pageNum}:`, err)
          setIsLoaded(true) // still reveal canvas so user can see it's blank or error
        }
      })
    })
    return () => {
      if (renderTask) renderTask.cancel()
    }
  }, [pdf, pageNum, isVisible])

  return (
    <motion.div 
      ref={containerRef}
      onClick={() => onToggle(pageNum)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: selected ? 1 : 0.85, y: 0 }}
      whileHover={{ scale: 1.02, y: -4, boxShadow: '0 12px 32px rgba(26,35,64,0.12)' }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      style={{
        border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
        borderRadius: '16px',
        overflow: 'hidden',
        position: 'relative',
        cursor: 'pointer',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: '650px',
        minHeight: isLoaded ? 'auto' : '800px',
        margin: '0 auto',
        boxShadow: selected ? '0 12px 32px rgba(74,95,193,0.25)' : '0 4px 12px rgba(0,0,0,0.05)',
        transformOrigin: 'center'
      }}
    >
      {!isLoaded && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: 'var(--grey)' }}>
          <div className="spinner" style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      
      <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', display: isLoaded ? 'block' : 'none' }} />
      
      <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: '14px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px' }}>
        Page {pageNum}
      </div>
      
      {/* Checkbox indicator */}
      <AnimatePresence>
        {selected ? (
          <motion.div 
            key="selected"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            style={{ position: 'absolute', top: 16, right: 16, background: 'var(--accent)', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(74,95,193,0.4)', zIndex: 10 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </motion.div>
        ) : (
          <motion.div 
            key="unselected"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.85)', border: '2px solid rgba(0,0,0,0.1)', borderRadius: '50%', width: '32px', height: '32px', zIndex: 10 }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function FilePreviewModal({ 
  file, 
  onSave, 
  onClose 
}: { 
  file: PrintFile, 
  onSave: (range: string) => void, 
  onClose: () => void 
}) {
  const [pdf, setPdf] = useState<any>(null)
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set())
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isFetchingPdf, setIsFetchingPdf] = useState(true)

  useEffect(() => {
    setSelectedPages(parsePageRangeToSet(file.pagesToPrint, file.pageCount))
  }, [file])

  useEffect(() => {
    if (!file.originalFile && !file.url) {
      setErrorMsg("File data is missing.")
      setIsFetchingPdf(false)
      return
    }

    let url: string | null = null;
    try {
      if (file.originalFile) {
        url = URL.createObjectURL(file.originalFile)
        setObjectUrl(url)
      }
    } catch (e) {
      console.error("Blob creation error:", e);
    }
    
    const isPdf = typeof file.originalFile?.type === 'string' && file.originalFile.type === 'application/pdf' 
                  || typeof file.fileName === 'string' && file.fileName.toLowerCase().endsWith('.pdf')
    
    if (isPdf) {
      setIsFetchingPdf(true)
      try {
        // If the local file is a native PDF, read it directly (instant)
        if (file.originalFile && file.originalFile.type === 'application/pdf') {
          file.originalFile.arrayBuffer().then(buffer => {
            pdfjsLib.getDocument({ 
              data: buffer,
              cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
              cMapPacked: true,
              standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`
            }).promise.then(loadedPdf => {
              setPdf(loadedPdf)
              setIsFetchingPdf(false)
            }).catch(err => {
              console.error(err)
              setErrorMsg(err.message || 'Failed to load PDF document.')
              setIsFetchingPdf(false)
            })
          }).catch(err => {
            console.error(err)
            setErrorMsg('Failed to read file data.')
            setIsFetchingPdf(false)
          })
        } 
        // Otherwise, if it was converted (like a PPTX), fetch the converted PDF from Supabase
        else if (file.url) {
          fetch(file.url)
            .then(res => res.arrayBuffer())
            .then(buffer => {
              pdfjsLib.getDocument({ 
                data: buffer,
                cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
                cMapPacked: true,
                standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`
              }).promise.then(loadedPdf => {
                setPdf(loadedPdf)
                setIsFetchingPdf(false)
              }).catch(err => {
                console.error(err)
                setErrorMsg(err.message || 'Failed to load converted PDF.')
                setIsFetchingPdf(false)
              })
            }).catch(err => {
              console.error(err)
              setErrorMsg('Failed to download converted PDF for preview.')
              setIsFetchingPdf(false)
            })
        } else {
           setIsFetchingPdf(false)
        }
      } catch (err: any) {
        console.error("Synchronous error starting PDF.js:", err);
        setErrorMsg(err.message || 'Critical error starting PDF renderer.');
        setIsFetchingPdf(false)
      }
    } else {
      setIsFetchingPdf(false)
    }

    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [file])

  const handleToggle = (pageNum: number) => {
    const next = new Set(selectedPages)
    if (next.has(pageNum)) {
      next.delete(pageNum)
    } else {
      next.add(pageNum)
    }
    setSelectedPages(next)
  }

  const handleSave = () => {
    onSave(formatSetToPageRange(selectedPages, file.pageCount))
  }

  const isImage = typeof file.originalFile?.type === 'string' && file.originalFile.type.startsWith('image/') ||
                  typeof file.fileName === 'string' && /\.(jpg|jpeg|png|gif|webp)$/i.test(file.fileName)

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="modal-overlay" 
        style={{ position: 'fixed', zIndex: 9999, inset: 0, background: 'rgba(13, 31, 60, 0.4)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex' }}
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="modal-card" 
          style={{ height: '90vh', width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', margin: 'auto', background: '#fff', borderRadius: '24px', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}
        >
        
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 20 }}>
          <div style={{ fontWeight: 700, fontSize: '18px', color: 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '16px', letterSpacing: '-0.02em' }}>
            Preview: {file.fileName}
          </div>
          <motion.button 
            whileHover={{ scale: 1.05, background: '#f1f5f9' }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose} 
            style={{ background: 'var(--gl)', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, color: 'var(--navy)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </motion.button>
        </div>

        <div id="pdf-scroll-container" data-lenis-prevent="true" style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '16px', background: 'var(--body-bg)' }}>
          {pdf ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center', padding: '16px 0' }}>
              {Array.from({ length: pdf.numPages }, (_, i) => i + 1).map(pageNum => (
                <PdfPageCanvas 
                  key={pageNum} 
                  pdf={pdf} 
                  pageNum={pageNum} 
                  selected={selectedPages.has(pageNum)} 
                  onToggle={handleToggle} 
                />
              ))}
            </div>
          ) : isFetchingPdf ? (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--grey)' }}>
              <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }}></div>
              <div style={{ fontWeight: 500, color: 'var(--gd)' }}>Loading Preview...</div>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>Fetching converted document</div>
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
          ) : isImage && objectUrl ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <img src={objectUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '12px' }} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--grey)' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '16px' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              <div style={{ fontWeight: 500, color: 'var(--gd)' }}>Preview not available</div>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>{errorMsg || 'Please set the page range manually.'}</div>
            </div>
          )}
        </div>

        <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', bottom: 0, zIndex: 20 }}>
          <div style={{ fontSize: '14px', color: 'var(--grey-mid)', fontWeight: 500 }}>
            <strong style={{ color: 'var(--navy)' }}>{selectedPages.size}</strong> {selectedPages.size === 1 ? 'page' : 'pages'} selected
          </div>
          <motion.button 
            whileHover={selectedPages.size > 0 ? { scale: 1.03 } : {}}
            whileTap={selectedPages.size > 0 ? { scale: 0.97 } : {}}
            onClick={handleSave}
            disabled={selectedPages.size === 0}
            style={{
              background: selectedPages.size === 0 ? 'var(--grey)' : 'var(--navy)',
              color: '#fff',
              border: 'none',
              padding: '14px 28px',
              borderRadius: '9999px',
              fontSize: '15px',
              fontWeight: 700,
              letterSpacing: '-0.01em',
              cursor: selectedPages.size === 0 ? 'not-allowed' : 'pointer',
              boxShadow: selectedPages.size > 0 ? '0 8px 20px rgba(26,35,64,0.2)' : 'none',
              transition: 'background 0.2s, color 0.2s, box-shadow 0.2s'
            }}
          >
            Save Selection
          </motion.button>
        </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
