'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import { usePrintStore } from '@/store/usePrintStore'

function StatusScreen() {
  const router = useRouter()
  
  const { globalOtp, globalJobId } = usePrintStore()
  
  const [timeLeft, setTimeLeft] = useState(300)
  const [showOTP, setShowOTP] = useState(false)
  const [copied, setCopied] = useState(false)

  const [jobStatus, setJobStatus] = useState('pending')

  useEffect(() => {
    let currentJobId = globalJobId || sessionStorage.getItem('printJobId');
    if (!currentJobId) {
      router.push('/');
      return;
    }

    const fetchStatus = async () => {
      try {
        // Call Supabase API directly using REST to avoid client lib overhead
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseKey) return;

        // Fetch Job Status
        const statusRes = await fetch(`${supabaseUrl}/rest/v1/print_jobs?id=eq.${currentJobId}&select=status`, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        const statusData = await statusRes.json();
        if (statusData && statusData.length > 0 && statusData[0].status) {
          setJobStatus(statusData[0].status);
        }

        // Fetch OTP if missing
        if (!globalOtp) {
          const otpRes = await fetch(`${supabaseUrl}/rest/v1/otp_sessions?print_job_id=eq.${currentJobId}&select=otp_code`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
          });
          const otpData = await otpRes.json();
          if (otpData && otpData.length > 0 && otpData[0].otp_code) {
            usePrintStore.getState().setJobData(currentJobId, otpData[0].otp_code);
          }
        }
      } catch (err) {
        console.error("Failed to recover session", err);
      }
    };

    fetchStatus();
    const statusInterval = setInterval(fetchStatus, 3000);

    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => {
      clearInterval(interval);
      clearInterval(statusInterval);
    }
  }, [globalOtp, globalJobId, router])

  const expired = timeLeft === 0;
  const mins = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const secs = String(timeLeft % 60).padStart(2, "0");

  const handleCopy = () => {
    if (!globalOtp) return;
    navigator.clipboard.writeText(globalOtp);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const otpDigits = globalOtp ? globalOtp.split("") : ["-","-","-","-"];
  const isPrinting = jobStatus === 'verified' || jobStatus === 'printing';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700;800&display=swap');

        .vk-root {
          height: 100dvh; width: 100vw;
          display: flex; overflow: hidden;
          font-family: 'Quicksand', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #ffffff;
        }
        
        .vk-root * {
          font-family: inherit;
        }

        /* Desktop split */
        .vk-left {
          width: 44%; background: #0d1f3c;
          display: flex; flex-direction: column;
          justify-content: center; padding: clamp(32px,5vw,72px);
          flex-shrink: 0; position: relative; overflow: hidden;
        }
        .vk-left::before {
          content: ''; position: absolute; top: -20%; left: -20%; width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(43,78,170,0.4) 0%, rgba(0,0,0,0) 70%);
          border-radius: 50%; pointer-events: none;
        }
        .vk-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(255,255,255,0.06); border-radius: 20px; border: 1px solid rgba(255,255,255,0.1);
          padding: 8px 16px; font-size: 11px; font-weight: 700;
          letter-spacing: 0.15em; color: #cbd5e1; margin-bottom: 40px;
          width: fit-content; position: relative; z-index: 1;
        }
        .vk-badge-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 10px rgba(34,197,94,0.6); }
        .vk-left-icon { font-size: 32px; margin-bottom: 24px; opacity: 0.8; position: relative; z-index: 1; }
        .vk-left-title {
          font-size: clamp(32px,4vw,48px); color: #fff;
          font-weight: 800; letter-spacing: -0.02em;
          margin-bottom: 16px; line-height: 1.1; position: relative; z-index: 1;
        }
        .vk-left-sub { font-size: 16px; color: #94a3b8; line-height: 1.6; max-width: 300px; font-weight: 500; position: relative; z-index: 1; }
        .vk-dots { display: flex; gap: 8px; margin-top: 48px; position: relative; z-index: 1; }
        .vk-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.15); transition: background 0.3s; }
        .vk-dot.active { background: #4a5fc1; box-shadow: 0 0 10px rgba(74,95,193,0.5); }

        /* Right panel */
        .vk-right {
          flex: 1; background: #FFFFFF;
          display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
          padding: 0; overflow: hidden;
          position: relative;
        }
        
        .vk-header-container {
          width: 100%;
          padding: 0;
          z-index: 10;
          flex-shrink: 0;
        }

        /* Main Content Card (Matching OrderReview Style) */
        .vk-card {
          background: #fff;
          border-radius: 0;
          box-shadow: none;
          width: min(440px, 100%);
          padding: 40px 32px;
          text-align: center;
          display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
          margin: 0 auto 0 auto;
          flex: 1;
          position: relative;
          overflow: hidden;
        }
        .vk-card-title {
          font-size: 20px; color: #1a2340;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .vk-btn-primary {
          width: 100%; padding: 14px; border-radius: 50px;
          background: #1a2340; color: #fff; border: none;
          font-size: 15px; font-weight: 600; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          margin-bottom: 12px; transition: opacity 0.2s;
        }
        .vk-btn-primary:hover { opacity: 0.88; }
        .vk-btn-regen {
          width: 100%; padding: 14px; border-radius: 50px;
          background: #1a2340; color: #fff; border: none;
          font-size: 15px; font-weight: 600; cursor: pointer;
          transition: opacity 0.2s;
        }
        .vk-btn-regen:hover { opacity: 0.88; }
        .vk-btn-secondary {
          width: 100%; padding: 14px; border-radius: 50px;
          background: #f0f1f7; color: #1a2340; border: none;
          font-size: 15px; font-weight: 700; cursor: pointer;
          transition: background 0.2s;
        }
        .vk-btn-secondary:hover { background: #e2e4ef; }
        
        .vk-sheet-overlay {
           position: absolute; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
           opacity: 0; pointer-events: none; transition: opacity 0.4s ease;
           z-index: 10;
        }
        .vk-sheet-overlay.open {
           opacity: 1; pointer-events: auto;
        }

        .vk-bottom-sheet {
           position: absolute; bottom: 0; left: 0; right: 0;
           background: #fff; border-top-left-radius: 28px; border-top-right-radius: 28px;
           padding: 40px 32px 50px; transform: translateY(100%);
           transition: transform 0.4s cubic-bezier(0.32, 0.72, 0, 1);
           z-index: 20; box-shadow: 0 -24px 48px rgba(0,0,0,0.2);
           display: flex; flex-direction: column; align-items: center;
        }
        .vk-bottom-sheet.open {
           transform: translateY(0);
        }
        .vk-bs-close {
           position: absolute; top: 16px; right: 16px;
           background: #f0f1f7; border: none; border-radius: 50%;
           width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
           color: #1a2340; cursor: pointer; transition: background 0.2s;
        }
        .vk-bs-close:hover { background: #e2e4ef; }

        /* Mobile Overrides */
        @media (max-width: 639px) {
          .vk-root { flex-direction: column; }
          .vk-left { 
            display: none;
          }
          .vk-left-sub { margin: 0 auto; }
          .vk-dots { justify-content: center; margin-top: 32px; }
          .vk-right { 
            border-radius: 0;
            margin-top: 0; z-index: 2; padding: 0;
            overflow-y: auto; overflow-x: hidden;
          }
          .vk-card {
            max-width: 100%;
            max-height: none;
            height: auto;
            border-radius: 0;
            box-shadow: none;
            padding: 10px 24px 60px;
            margin: 0;
            justify-content: flex-start;
          }
          .vk-bottom-sheet {
            position: fixed;
          }
        }
        .vk-mascot {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          width: 100%; margin-bottom: 24px;
        }
        .vk-mascot-img {
          width: 100%; max-width: 380px; height: auto; max-height: 45vh;
          object-fit: contain; mix-blend-mode: darken; filter: contrast(1.1) brightness(1.2);
        }

        /* Pulse Animation */
        @keyframes ripple {
          0% { box-shadow: 0 0 0 0 rgba(43, 78, 170, 0.4); }
          70% { box-shadow: 0 0 0 30px rgba(43, 78, 170, 0); }
          100% { box-shadow: 0 0 0 0 rgba(43, 78, 170, 0); }
        }
        @keyframes fadeIn { 
          from { opacity: 0; } 
          to { opacity: 1; } 
        }
        @keyframes slideUp { 
          from { transform: translateY(100%); } 
          to { transform: translateY(0); } 
        }
        .hardware-sync-container {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 40px; text-align: center;
        }
        .pulse-circle {
          width: 80px; height: 80px; border-radius: 50%;
          background: var(--accent);
          display: flex; align-items: center; justify-content: center;
          color: white; margin-bottom: 24px;
          animation: ripple 2s infinite;
        }
      `}</style>

      <div className="vk-root">
        {/* Left info panel */}
        <div className="vk-left">
          <div className="vk-badge"><div className="vk-badge-dot" /> OTP — ACTIVE</div>
          <svg className="vk-left-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '40px', height: '40px', color: 'rgba(255,255,255,0.9)' }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <h1 className="vk-left-title">Verify Kiosk</h1>
          <p className="vk-left-sub">Enter the code on the kiosk screen to authorize your print queue.</p>

        </div>

        {/* Right content panel */}
        <div className="vk-right">
          <div className="vk-header-container">
            <AppHeader title="CampusPrint" subtitle="" hideBack />
          </div>
          
          <div className="vk-card">
            {isPrinting ? (
              <div className="hardware-sync-container" style={{ flex: 1, width: '100%' }}>
                <div className="pulse-circle">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <h2 className="vk-card-title">Printing Started!</h2>
                <p style={{ color: '#8892a4', fontSize: '14px', marginBottom: '32px', maxWidth: '280px' }}>
                  The hardware has synced successfully. Your document is now printing.
                </p>
                <button className="vk-btn-secondary" onClick={() => router.push('/')} style={{ marginTop: 'auto' }}>Return Home</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="vk-mascot">
                    <img src="/mascot.png" alt="CampusPrint Mascot" className="vk-mascot-img" />
                  </div>
                  <h2 className="vk-card-title">OTP Code</h2>
                  <p style={{ color: '#8892a4', fontSize: '14px', marginBottom: '32px' }}>Use this OTP to authorize your print queue at the kiosk.</p>

                  {!expired && (
                    <p style={{ color: '#8892a4', fontSize: '13px', marginBottom: '0' }}>Expires in <span style={{ color: '#4a5fc1', fontWeight: 600 }}>{mins}:{secs}</span></p>
                  )}
                  {expired && (
                    <p style={{ color: '#e53e3e', fontWeight: 700, marginBottom: '0', letterSpacing: '0.08em', fontSize: '13px' }}>EXPIRED</p>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', paddingTop: '20px' }}>
                  {expired ? (
                    <button className="vk-btn-secondary" onClick={() => router.push('/')}>Return Home</button>
                  ) : (
                    <>
                      <button className="vk-btn-primary" onClick={() => setShowOTP(true)}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        View OTP Code
                      </button>
                      <button className="vk-btn-secondary" onClick={() => router.push('/')}>Return Home</button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Bottom Sheet for OTP */}
            {!isPrinting && (
              <>
                <div 
                  className={`vk-sheet-overlay ${showOTP ? 'open' : ''}`}
                  onClick={() => setShowOTP(false)}
                />
                <div className={`vk-bottom-sheet ${showOTP ? 'open' : ''}`}>
                  <button className="vk-bs-close" onClick={() => setShowOTP(false)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                  
                  <h2 style={{ fontSize: '26px', color: '#1a2340', fontWeight: 800, margin: '0 0 32px' }}>OTP Code</h2>
                  
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(12px,3vw,20px)', marginBottom: '40px' }}>
                    {otpDigits.map((d, i) => (
                      <div key={i} style={{ width: '64px', height: '76px', background: '#f5f6ff', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '42px', fontWeight: 700, color: '#1a2340', border: '2px solid #e2e4ef' }}>
                        {d}
                      </div>
                    ))}
                  </div>
                  
                  <button className="vk-btn-primary" onClick={handleCopy} style={{ padding: '16px', fontSize: '16px', marginBottom: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                    {copied ? "Copied to Clipboard!" : "Copy OTP Code"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default function Status() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '40px', color: 'var(--grey)' }}>Loading...</div>}>
      <StatusScreen />
    </Suspense>
  )
}
