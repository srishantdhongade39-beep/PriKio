'use client'

import { useState, useEffect } from 'react'

export default function Kiosk() {
  const [otp, setOtp] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [successData, setSuccessData] = useState<any>(null)
  const [currentTime, setCurrentTime] = useState<string>('')
  
  const [currentPage, setCurrentPage] = useState(1)
  const [printingState, setPrintingState] = useState<'idle' | 'printing' | 'completed'>('idle')
  const [activeFileIndex, setActiveFileIndex] = useState(0)

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}))
    }
    updateTime()
    const interval = setInterval(updateTime, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length < 4) return
    setVerifying(true)
    setError('')

    try {
      const res = await fetch('/api/kiosk/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp_entered: otp })
      })
      const result = await res.json()
      if (res.ok && result.success) {
        setSuccessData({
          job_id: result.job_id,
          files: result.files || []
        })
        
        setActiveFileIndex(0)
        setCurrentPage(1)
        setPrintingState('printing')
      } else {
        setError(result.message || 'Invalid OTP')
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  // Simulates printing page by page for each file sequentially
  useEffect(() => {
    if (printingState !== 'printing' || !successData || !successData.files || successData.files.length === 0) return

    const activeFile = successData.files[activeFileIndex]
    if (!activeFile) return

    const intervalTime = 1200 // 1.2 seconds per page simulation
    const timer = setInterval(() => {
      if (currentPage < activeFile.page_count) {
        setCurrentPage((prev) => prev + 1)
      } else {
        // Current file printed completely! Check for remaining files
        if (activeFileIndex < successData.files.length - 1) {
          setActiveFileIndex((prev) => prev + 1)
          setCurrentPage(1)
        } else {
          clearInterval(timer)
          handlePrintingComplete()
        }
      }
    }, intervalTime)

    return () => clearInterval(timer)
  }, [printingState, successData, activeFileIndex, currentPage])

  const handlePrintingComplete = async () => {
    setPrintingState('completed')
    if (successData?.job_id) {
      try {
        await fetch(`/api/print-jobs/${successData.job_id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed' })
        })
      } catch (err) {
        console.error('Failed to update print job status:', err)
      }
    }
  }

  // Auto-refresh/reset kiosk after print job finishes
  useEffect(() => {
    if (printingState !== 'completed') return

    const timer = setTimeout(() => {
      // Perform a full page reload to return to a clean "Enter OTP Code" screen for the next user
      window.location.href = '/kiosk'
    }, 5000)

    return () => clearTimeout(timer)
  }, [printingState])

  return (
    <div style={{ background: 'var(--body-bg)', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sans)' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .animate-fade-in { animation: fadeIn 0.5s ease-out both; }
        .animate-scale-up { animation: scaleUp 0.4s ease-out both; }
        .animate-bounce-in { animation: bounceIn 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) both; }
        .animate-slide-right-1 { animation: slideRight 0.4s ease-out both; }
        .animate-slide-right-2 { animation: slideRight 0.4s 0.1s ease-out both; }
        .animate-slide-right-3 { animation: slideRight 0.4s 0.2s ease-out both; }
        
        @keyframes slideRight {
          from { transform: translateX(-20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes scaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes bounceIn {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); opacity: 0.8; }
          70% { transform: scale(0.9); opacity: 0.9; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes drawCheck {
          from { stroke-dashoffset: 50; }
          to { stroke-dashoffset: 0; }
        }

        .kiosk-btn-primary {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 50%, rgba(0, 0, 0, 0.05) 50%, rgba(0, 0, 0, 0.15) 100%), var(--navy);
          color: #fff; padding: 24px 60px; border-radius: 9999px;
          font-size: 24px; font-weight: 600; border: 1px solid rgba(13, 31, 60, 0.8);
          cursor: pointer;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -1px 0 rgba(0, 0, 0, 0.2), 0 10px 25px rgba(13, 31, 60, 0.15);
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s, background 0.2s;
          position: relative; overflow: hidden;
          display: inline-flex; align-items: center; justify-content: center;
        }
        .kiosk-btn-primary:hover:not(:disabled) {
          transform: translateY(-3px) scale(1.02);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -1px 0 rgba(0, 0, 0, 0.15), 0 15px 30px rgba(13, 31, 60, 0.25);
        }
        .kiosk-btn-primary:active:not(:disabled) {
          transform: translateY(0) scale(0.98);
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3), 0 4px 6px rgba(13, 31, 60, 0.1);
        }
        .kiosk-btn-primary:disabled {
          opacity: 0.6; cursor: not-allowed;
        }
        .kiosk-btn-primary::after {
          content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25), transparent);
          transform: skewX(-20deg);
        }
        .kiosk-btn-primary:hover:not(:disabled)::after {
          left: 150%; transition: left 0.8s ease-in-out;
        }

        .kiosk-btn-secondary {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(0, 0, 0, 0.01) 50%, rgba(0, 0, 0, 0.05) 100%), transparent;
          color: var(--gd); padding: 24px 60px; border-radius: 9999px;
          font-size: 24px; font-weight: 500; border: 2px solid var(--border);
          cursor: pointer;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8), inset 0 -1px 0 rgba(0, 0, 0, 0.05), 0 4px 10px rgba(0, 0, 0, 0.05);
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s, border-color 0.2s, background 0.2s;
          position: relative; overflow: hidden;
          display: inline-flex; align-items: center; justify-content: center;
        }
        .kiosk-btn-secondary:hover:not(:disabled) {
          border-color: var(--accent);
          transform: translateY(-3px) scale(1.02);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), inset 0 -1px 0 rgba(0, 0, 0, 0.07), 0 10px 20px rgba(0, 0, 0, 0.08);
        }
        .kiosk-btn-secondary:active:not(:disabled) {
          transform: translateY(0) scale(0.98);
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.03);
        }
        .kiosk-btn-secondary::after {
          content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
          transform: skewX(-20deg);
        }
        .kiosk-btn-secondary:hover:not(:disabled)::after {
          left: 150%; transition: left 0.8s ease-in-out;
        }
        .kiosk-btn-secondary:disabled {
          opacity: 0.6; cursor: not-allowed;
        }

        .kiosk-input {
          transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .kiosk-input:focus {
          border-color: var(--accent) !important;
          box-shadow: 0 0 0 6px rgba(43, 78, 170, 0.15);
          transform: scale(1.02);
        }
        .kiosk-error-shake {
          animation: shake 0.5s ease-in-out;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
      `}} />
      <div style={{ width: '1920px', height: '1080px', background: 'var(--bg)', position: 'relative', overflow: 'hidden', borderRadius: '24px', boxShadow: '0 40px 100px rgba(0,0,0,0.1)', transform: 'scale(0.6)', transformOrigin: 'center' }}>
        
        <header style={{ background: 'var(--navy)', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 60px' }}>
          <div style={{ color: '#fff', fontSize: '24px', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase' }}>CampusPrint Kiosk</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '20px', fontWeight: 400, display: 'flex', gap: '40px', alignItems: 'center' }}>
            <span>LIB-04</span>
            <span>{currentTime}</span>
          </div>
        </header>

        {successData ? (
          <div style={{ display: 'flex', height: 'calc(1080px - 120px)' }}>
            <aside style={{ width: '400px', borderRight: '2px solid var(--border)', padding: '60px', display: 'flex', flexDirection: 'column', gap: '40px' }}>
              <div className="animate-slide-right-1" style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '0.2em', color: 'var(--grey)', textTransform: 'uppercase' }}>Current Session</div>
              <div className="animate-slide-right-1">
                <h3 style={{ fontSize: '32px', fontWeight: 600, color: 'var(--gd)', marginBottom: '8px' }}>User Session</h3>
                <p style={{ fontSize: '18px', fontWeight: 400, color: 'var(--grey)' }}>Verified via OTP</p>
              </div>
              <hr className="animate-slide-right-1" style={{ border: 'none', borderTop: '2px solid var(--border)', margin: '20px 0' }} />
              <div className="animate-slide-right-2" style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '0.2em', color: 'var(--grey)', textTransform: 'uppercase', marginBottom: '-20px' }}>Print Queue</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '40px', overflowY: 'auto', maxHeight: '420px', paddingRight: '5px' }}>
                {successData.files.map((file: any, index: number) => {
                  const isFilePrinting = printingState === 'printing' && index === activeFileIndex;
                  const isFileCompleted = index < activeFileIndex || printingState === 'completed';
                  
                  // Calculate individual file progress
                  let fileProgress = 0;
                  if (isFileCompleted) fileProgress = 100;
                  else if (isFilePrinting) fileProgress = Math.round((currentPage / file.page_count) * 100);

                  return (
                    <div key={index} className="animate-slide-right-2" style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px 24px', background: isFilePrinting ? 'var(--accent-s)' : 'var(--gl)', border: isFilePrinting ? '2px solid var(--accent)' : '2px solid transparent', borderRadius: '16px', transition: 'all 0.3s ease' }}>
                      
                      {/* Interactive Loading Circle for each file */}
                      <div style={{ position: 'relative', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg style={{ transform: 'rotate(-90deg)', width: '56px', height: '56px' }} viewBox="0 0 40 40">
                          <circle cx="20" cy="20" r="17" fill="none" stroke="#E5E7EB" strokeWidth="3" />
                          <circle 
                            cx="20" 
                            cy="20" 
                            r="17" 
                            fill="none" 
                            stroke={isFileCompleted ? '#31C48D' : 'var(--accent)'} 
                            strokeWidth="3" 
                            strokeLinecap="round" 
                            strokeDasharray="106.8" 
                            strokeDashoffset={106.8 - (106.8 * fileProgress) / 100}
                            style={{ transition: 'stroke-dashoffset 0.3s ease, stroke 0.3s' }}
                          />
                        </svg>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: isFileCompleted ? '#31C48D' : 'var(--gd)' }}>
                          {isFileCompleted ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          ) : isFilePrinting ? (
                            `${fileProgress}%`
                          ) : (
                            '0%'
                          )}
                        </div>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '20px', fontWeight: 600, color: isFilePrinting ? 'var(--accent)' : 'var(--gd)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.filename}</div>
                        <div style={{ fontSize: '15px', fontWeight: 400, color: 'var(--grey-mid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.page_count} pages • {file.color_mode} • {file.sides}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="animate-slide-right-3" style={{ marginTop: 'auto' }}>
                <button 
                  onClick={() => { setSuccessData(null); setOtp(''); setPrintingState('idle'); }} 
                  disabled={printingState === 'completed'}
                  className="kiosk-btn-secondary"
                  style={{ width: '100%' }}
                >
                  {printingState === 'completed' ? 'Session Ending...' : 'End Session'}
                </button>
              </div>
            </aside>
            <main style={{ flex: 1, padding: '80px 120px', position: 'relative', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: '48px', fontWeight: 600, color: 'var(--gd)', marginBottom: '60px', opacity: 0, animation: 'fadeIn 0.5s ease-out forwards' }}>
                {printingState === 'completed' ? 'Printing Complete' : 'Printing in Progress'}
              </h2>
              
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '-45px' }}>
                {printingState === 'completed' ? (
                  <div className="animate-scale-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '32px' }}>
                    <div className="animate-bounce-in" style={{ width: '220px', height: '220px', borderRadius: '50%', background: '#DEF7EC', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 24px 48px rgba(49, 196, 141, 0.15)' }}>
                      <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#31C48D" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 50, strokeDashoffset: 50, animation: 'drawCheck 0.6s 0.3s ease-out forwards' }}>
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: '40px', fontWeight: 700, color: 'var(--gd)', marginBottom: '16px' }}>All Documents Printed!</div>
                      <div style={{ fontSize: '22px', fontWeight: 400, color: 'var(--grey)', marginBottom: '24px' }}>Please collect your prints from the tray below.</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: 'var(--grey)', fontSize: '18px', opacity: 0.8 }}>
                        <svg style={{ animation: 'spin 1.5s linear infinite', width: '22px', height: '22px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.1)"/>
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor"/>
                        </svg>
                        <span>Session ending, reloading in 5 seconds...</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  (() => {
                    const activeFile = successData.files[activeFileIndex];
                    if (!activeFile) return null;
                    return (
                      <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '60px' }}>
                        <div style={{ position: 'relative', width: '160px', height: '160px' }}>
                          <svg style={{ transform: 'rotate(-90deg)', width: '160px', height: '160px' }} viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="46" fill="none" stroke="#E5E7EB" strokeWidth="8"></circle>
                            <circle cx="50" cy="50" r="46" fill="none" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round" strokeDasharray="289" strokeDashoffset={289 - (289 * currentPage) / activeFile.page_count}></circle>
                          </svg>
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: '48px', fontWeight: 600, color: 'var(--gd)' }}>
                            {currentPage}<span style={{ fontSize: '24px', color: 'var(--grey)' }}>/{activeFile.page_count}</span>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '32px', fontWeight: 600, color: 'var(--gd)', marginBottom: '12px' }}>Processing {activeFile.filename}...</div>
                          <div style={{ fontSize: '22px', fontWeight: 500, color: 'var(--accent)', marginBottom: '8px' }}>Page {currentPage} of {activeFile.page_count}</div>
                          <div style={{ fontSize: '18px', fontWeight: 400, color: 'var(--grey)' }}>Please collect printed sheets from the tray below.</div>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            </main>
          </div>
        ) : (
          <div className="animate-fade-in" style={{ position: 'absolute', inset: '120px 0 0 0', background: 'rgba(255, 255, 255, 0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: '80px', fontWeight: 600, color: 'var(--gd)', marginBottom: '24px' }}>Enter <i style={{ color: 'var(--accent)', fontStyle: 'italic' }}>OTP Code</i></h1>
            <p style={{ fontSize: '24px', fontWeight: 300, color: 'var(--grey-mid)', lineHeight: 1.5, textAlign: 'center', marginBottom: '60px' }}>Enter the 4-digit code shown on your phone to release your prints.</p>
            
            <form onSubmit={handleVerify} className="animate-scale-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px' }}>
              <input 
                type="text" 
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                placeholder="0000"
                className="kiosk-input"
                style={{ fontSize: '64px', fontFamily: 'var(--serif)', letterSpacing: '0.2em', textAlign: 'center', border: '2px solid var(--border)', borderRadius: '24px', padding: '20px 40px', width: '400px', outline: 'none', color: 'var(--gd)' }}
              />
              {error && <p className="kiosk-error-shake" style={{ color: 'var(--red)', fontSize: '24px' }}>{error}</p>}
              <button 
                type="submit" 
                disabled={otp.length !== 4 || verifying}
                className="kiosk-btn-primary"
              >
                {verifying ? 'Verifying...' : 'Verify Print Job'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
