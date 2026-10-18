import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { parsePageRangeToSet, formatSetToPageRange } from '@/lib/pageRangeUtils'
import { PrintFile } from '@/store/usePrintStore'
import { motion, AnimatePresence } from 'framer-motion'
import Lenis from 'lenis'

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

function PdfPageCanvas({ 
  pdf, 
  pageNum, 
  selected, 
  onToggle,
  onRendered
}: { 
  pdf: any; 
  pageNum: number; 
  selected: boolean; 
  onToggle: (n: number) => void;
  onRendered?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(pageNum <= 3)
  const [isLoaded, setIsLoaded] = useState(false)

  // IntersectionObserver guarantees elements trigger visibility regardless of scroll implementation
  useEffect(() => {
    if (isVisible) return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        root: null,
        rootMargin: '800px 0px 800px 0px',
        threshold: 0,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible || !pdf) return
    let renderTask: any
    let isCancelled = false

    pdf.getPage(pageNum).then((page: any) => {
      if (isCancelled) return
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      let scale = isMobile ? 1.1 : 1.4;
      let viewport = page.getViewport({ scale })
      
      if (isMobile && viewport.width > 700) {
        scale = 700 / (viewport.width / scale);
        viewport = page.getViewport({ scale });
      }
      const canvas = canvasRef.current
      if (!canvas) return
      const context = canvas.getContext('2d')
      if (!context) return
      
      canvas.height = viewport.height
      canvas.width = viewport.width
      
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, canvas.width, canvas.height)

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      }
      renderTask = page.render(renderContext)
      renderTask.promise.then(() => {
        if (!isCancelled) {
          setIsLoaded(true)
          if (onRendered) onRendered()
        }
      }).catch((err: any) => {
        if (err.name !== 'RenderingCancelledException') {
          console.error(`Error rendering page ${pageNum}:`, err)
          setIsLoaded(true)
          if (onRendered) onRendered()
        }
      })
    })

    return () => {
      isCancelled = true
      if (renderTask) renderTask.cancel()
    }
  }, [pdf, pageNum, isVisible, onRendered])

  return (
    <motion.div 
      ref={containerRef}
      onClick={() => onToggle(pageNum)}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.015, y: -2, boxShadow: '0 12px 30px rgba(26,35,64,0.10)' }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      style={{
        width: '100%',
        maxWidth: '520px',
        border: selected ? '2.5px solid #4a5fc1' : '1.5px solid #e2e8f0',
        borderRadius: '16px',
        overflow: 'hidden',
        position: 'relative',
        cursor: 'pointer',
        background: '#fff',
        boxShadow: selected ? '0 8px 24px rgba(74,95,193,0.18)' : '0 2px 8px rgba(15,23,42,0.04)',
        transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      {/* Top Header Bar */}
      <div style={{
        width: '100%',
        padding: '10px 16px',
        background: selected ? 'rgba(74,95,193,0.07)' : '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: selected ? '#4a5fc1' : '#1e293b' }}>
          Page {pageNum}
        </span>
        <div style={{
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          border: selected ? 'none' : '2px solid #cbd5e1',
          background: selected ? '#4a5fc1' : '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}>
          {selected && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      </div>

      {/* Page Canvas Container with minHeight to ensure proper scroll bounds */}
      <div style={{ 
        position: 'relative', 
        width: '100%', 
        minHeight: '280px', 
        background: '#ffffff', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        padding: '8px'
      }}>
        <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%', height: 'auto', borderRadius: '4px' }} />
        {!isLoaded && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(2px)' }}>
            <div className="spinner" style={{ width: '26px', height: '26px', border: '2.5px solid #e2e8f0', borderTopColor: '#4a5fc1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}
      </div>
    </motion.div>
  )
}

interface FilePreviewModalProps {
  file: PrintFile;
  onClose: () => void;
  onSave: (pagesToPrint: string) => void;
}

export default function FilePreviewModal({ file, onClose, onSave }: FilePreviewModalProps) {
  const [pdf, setPdf] = useState<any>(null)
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set())
  const [isFetchingPdf, setIsFetchingPdf] = useState<boolean>(true)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  
  const pdfScrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const lenisRef = useRef<Lenis | null>(null)

  const handleResize = useCallback(() => {
    if (lenisRef.current) {
      lenisRef.current.resize()
    }
  }, [])

  // Setup Lenis smooth scrolling inside modal with automatic resize sync
  useEffect(() => {
    const container = pdfScrollRef.current
    const content = contentRef.current
    if (!container) return
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    const lenis = new Lenis({
      wrapper: container,
      content: content || undefined,
      duration: 1.0,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.5,
    })

    lenisRef.current = lenis

    let rafId: number
    const onRaf = (time: number) => {
      lenis.raf(time)
      rafId = requestAnimationFrame(onRaf)
    }
    rafId = requestAnimationFrame(onRaf)

    const resizeObserver = new ResizeObserver(() => {
      lenis.resize()
    })

    if (content) resizeObserver.observe(content)
    resizeObserver.observe(container)

    return () => {
      cancelAnimationFrame(rafId)
      resizeObserver.disconnect()
      lenis.destroy()
      lenisRef.current = null
    }
  }, [pdf])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    setSelectedPages(parsePageRangeToSet(file.pagesToPrint, file.pageCount))
  }, [file.pagesToPrint, file.pageCount])

  useEffect(() => {
    let url: string | null = null
    const isPdf = typeof file.fileName === 'string' && file.fileName.toLowerCase().endsWith('.pdf')
    
    if (file.originalFile && file.originalFile instanceof Blob && !isPdf) {
      try {
        url = URL.createObjectURL(file.originalFile)
        setObjectUrl(url)
      } catch {
        if (file.url) setObjectUrl(file.url)
      }
    } else if (!isPdf && file.url) {
      setObjectUrl(file.url)
    }

    if (file.isConverting) {
      setIsFetchingPdf(true)
      return
    }

    if (isPdf) {
      setIsFetchingPdf(true)
      try {
        if (file.originalFile && file.originalFile instanceof Blob && (file.originalFile.type === 'application/pdf' || file.fileName?.toLowerCase().endsWith('.pdf'))) {
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
  }, [file, file.isConverting, file.url])

  const handleToggle = (pageNum: number) => {
    const next = new Set(selectedPages)
    if (next.has(pageNum)) {
      next.delete(pageNum)
    } else {
      next.add(pageNum)
    }
    setSelectedPages(next)
  }

  const handleSelectAll = () => {
    const total = pdf?.numPages || file.pageCount || 1
    const all = new Set<number>()
    for (let i = 1; i <= total; i++) all.add(i)
    setSelectedPages(all)
  }

  const handleDeselectAll = () => {
    setSelectedPages(new Set())
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
        style={{ 
          position: 'fixed', 
          zIndex: 9999, 
          inset: 0, 
          background: 'rgba(15, 23, 42, 0.65)', 
          backdropFilter: 'blur(8px)', 
          WebkitBackdropFilter: 'blur(8px)', 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="modal-card" 
          style={{ 
            height: '92vh', 
            maxHeight: '880px',
            width: '100%', 
            maxWidth: '680px', 
            display: 'flex', 
            flexDirection: 'column', 
            padding: 0, 
            overflow: 'hidden', 
            margin: 'auto', 
            background: '#ffffff', 
            borderRadius: '24px', 
            boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.35)' 
          }}
        >
        
        {/* Modal Header */}
        <div style={{ 
          padding: '16px 20px', 
          borderBottom: '1px solid #e2e8f0', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          background: '#ffffff', 
          position: 'sticky', 
          top: 0, 
          zIndex: 20 
        }}>
          <div style={{ minWidth: 0, flex: 1, paddingRight: '12px' }}>
            <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Preview & Select Pages
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {file.fileName}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {pdf && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '4px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: '#334155',
                    cursor: 'pointer'
                  }}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '4px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  Clear
                </button>
              </div>
            )}

            <motion.button 
              whileHover={{ scale: 1.05, background: '#f1f5f9' }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose} 
              style={{ 
                background: '#f8fafc', 
                border: '1px solid #e2e8f0', 
                width: '34px', 
                height: '34px', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                cursor: 'pointer', 
                flexShrink: 0, 
                color: '#475569' 
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </motion.button>
          </div>
        </div>

        {/* Scrollable Document Body with Lenis and ResizeObserver */}
        <div 
          id="pdf-scroll-container" 
          ref={pdfScrollRef}
          style={{ 
            flex: 1, 
            minHeight: 0,
            overflowY: 'auto', 
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch', 
            padding: '16px', 
            background: '#f8fafc',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(74,95,193,0.3) transparent'
          }}
        >
          {file.isConverting ? (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '300px', padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'rgba(74,95,193,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', animation: 'float 2s infinite ease-in-out' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4a5fc1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                Preparing slides for preview...
              </div>
              <div style={{ fontSize: '14px', color: '#64748b', maxWidth: '320px', lineHeight: 1.5, marginBottom: '24px' }}>
                Converting presentation to high-resolution print pages. This will open automatically in a moment.
              </div>
              <div style={{ width: '220px', height: '6px', background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, #4a5fc1, #3747a6, #4a5fc1)', animation: 'shimmer 1.5s infinite linear', backgroundSize: '200% 100%' }}></div>
              </div>
              <style>{`
                @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
                @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
              `}</style>
            </div>
          ) : pdf ? (
            <div 
              ref={contentRef}
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '20px', 
                alignItems: 'center', 
                padding: '8px 0 60px',
                width: '100%'
              }}
            >
              {Array.from({ length: pdf.numPages }, (_, i) => i + 1).map(pageNum => (
                <PdfPageCanvas 
                  key={pageNum} 
                  pdf={pdf} 
                  pageNum={pageNum} 
                  selected={selectedPages.has(pageNum)} 
                  onToggle={handleToggle}
                  onRendered={handleResize}
                />
              ))}
            </div>
          ) : isFetchingPdf ? (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '300px', color: '#64748b' }}>
              <div className="spinner" style={{ width: '38px', height: '38px', border: '3px solid #e2e8f0', borderTopColor: '#4a5fc1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '16px' }}></div>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>Loading Document Preview...</div>
              <div style={{ fontSize: '13px', marginTop: '4px', color: '#64748b' }}>Rendering pages for page selection</div>
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
          ) : isImage && (objectUrl || file.url) ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '300px', padding: '20px' }}>
              <img 
                src={objectUrl || file.url} 
                alt={file.fileName || "Preview"} 
                style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }} 
                onError={() => setErrorMsg("Could not load image preview. The file link may have expired.")}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '300px', color: '#64748b' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" style={{ marginBottom: '16px' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>Preview not available</div>
              <div style={{ fontSize: '13px', marginTop: '4px', color: '#64748b' }}>
                {file.conversionError ? `Conversion Error: ${file.conversionError}` : (errorMsg || 'Please set the page range manually.')}
              </div>
            </div>
          )}
        </div>

        {/* Modal Sticky Bottom Bar */}
        <div style={{ 
          padding: '14px 20px', 
          borderTop: '1px solid #e2e8f0', 
          background: '#ffffff', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          position: 'sticky', 
          bottom: 0, 
          zIndex: 20 
        }}>
          <div>
            <div style={{ fontSize: '0.88rem', color: '#64748b', fontWeight: 500 }}>
              <strong style={{ color: '#0f172a', fontSize: '1rem', fontWeight: 700 }}>{selectedPages.size}</strong> of {pdf?.numPages || file.pageCount || 1} pages selected
            </div>
          </div>

          <motion.button 
            whileHover={selectedPages.size > 0 ? { scale: 1.02 } : {}}
            whileTap={selectedPages.size > 0 ? { scale: 0.98 } : {}}
            onClick={handleSave}
            disabled={selectedPages.size === 0 || file.isConverting}
            style={{
              background: selectedPages.size === 0 || file.isConverting ? '#cbd5e1' : '#1a2340',
              color: '#ffffff',
              border: 'none',
              padding: '11px 24px',
              borderRadius: '50px',
              fontSize: '0.90rem',
              fontWeight: 600,
              cursor: selectedPages.size === 0 || file.isConverting ? 'not-allowed' : 'pointer',
              boxShadow: selectedPages.size === 0 || file.isConverting ? 'none' : '0 4px 14px rgba(26,35,64,0.25)',
              transition: 'all 0.2s'
            }}
          >
            Apply Selection
          </motion.button>
        </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
