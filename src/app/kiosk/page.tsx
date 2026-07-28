'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import './kiosk.css'

type Profile = {
  id: string
  full_name: string
  student_id: string
  department: string
  wallet_balance: number
}

type Job = {
  id: string
  file_name: string
  page_count: number
  color_mode: string
  sides: string
  status: string
}

export default function KioskPage() {
  const [scale, setScale] = useState(1)
  const [marginAdjustment, setMarginAdjustment] = useState(0)

  const [isOffline, setIsOffline] = useState(false)
  const [rfidWaiting, setRfidWaiting] = useState(true)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])

  const [printingPageIndex, setPrintingPageIndex] = useState(1)
  
  const [rfidBuffer, setRfidBuffer] = useState('')
  const supabase = createClient()

  // Scaling logic
  useEffect(() => {
    const updateScale = () => {
      const availableWidth = window.innerWidth
      const availableHeight = window.innerHeight
      // Fit to available width/height
      const scaleX = availableWidth / 1920
      const scaleY = availableHeight / 1080
      const newScale = Math.min(scaleX, scaleY, 1)
      setScale(newScale)
      const scaledHeight = 1080 * newScale
      setMarginAdjustment(1080 - scaledHeight)
    }
    window.addEventListener('resize', updateScale)
    updateScale()
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  // RFID keydown listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (rfidBuffer.length > 0 && rfidWaiting && !isOffline) {
          handleRfidTap(rfidBuffer)
          setRfidBuffer('')
        }
      } else if (e.key.length === 1 && rfidWaiting) {
        setRfidBuffer((prev) => prev + e.key)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [rfidBuffer, rfidWaiting, isOffline])

  const handleRfidTap = async (rfid: string) => {
    try {
      const res = await fetch('/api/kiosk/rfid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: rfid })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setProfile(data.profile)
        setJobs(data.jobs)
        setRfidWaiting(false)
        setPrintingPageIndex(1)
      } else {
        alert(data.message || 'Error processing RFID')
      }
    } catch (err) {
      console.error(err)
      alert('Network error')
    }
  }

  const handleEndSession = () => {
    setProfile(null)
    setJobs([])
    setRfidWaiting(true)
  }

  // Realtime Subscription
  useEffect(() => {
    if (rfidWaiting || !profile) return;
    
    const channel = supabase
      .channel(`kiosk_jobs_${profile.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'print_jobs'
      }, (payload) => {
         const updatedJob = payload.new as Job;
         setJobs(prev => prev.map(j => j.id === updatedJob.id ? { ...j, status: updatedJob.status } : j));
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    }
  }, [rfidWaiting, profile, supabase]);

  // Derived state from real jobs array
  const currentJob = jobs.find(j => j.status === 'printing' || j.status === 'processing');
  const currentJobIndex = jobs.findIndex(j => j.id === currentJob?.id);
  const hasFinishedAll = !rfidWaiting && jobs.length > 0 && jobs.every(j => j.status === 'ready' || j.status === 'completed');

  // End session if all finished
  useEffect(() => {
    if (hasFinishedAll) {
      const t = setTimeout(() => {
        handleEndSession();
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [hasFinishedAll]);

  // Simulate page increment while printing
  useEffect(() => {
    if (currentJob) {
      setPrintingPageIndex(1);
      const timer = setInterval(() => {
        setPrintingPageIndex(prev => {
          if (prev < currentJob.page_count - 1) {
             return prev + 1;
          }
          return prev; // cap at 99% until status updates
        });
      }, 2000);
      return () => clearInterval(timer);
    }
  }, [currentJob?.id, currentJob?.page_count]);

  const isPrinting = !!currentJob;

  // Calculate circular progress (0 to 100%)
  let totalPagesInCurrentJob = currentJob?.page_count || 1;
  let progressPercentage = isPrinting ? Math.floor((printingPageIndex / totalPagesInCurrentJob) * 100) : 0;
  if (isPrinting && progressPercentage > 99) progressPercentage = 99;
  if (hasFinishedAll) progressPercentage = 100;
  
  // Circumference for r=46 is ~289 (used 298 in CSS, let's stick to exactly calculating it)
  const circumference = 289;
  const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: '#ECEEF2', fontFamily: '"DM Sans", sans-serif' }}>
      
      {/* Dev Tools for testing */}
      <div style={{ position: 'fixed', top: 10, right: 10, zIndex: 9999, display: 'flex', gap: 10 }}>
        <button onClick={() => setRfidWaiting(true)} className="p-2 bg-gray-600 rounded text-xs text-white">Reset</button>
        <button onClick={() => handleRfidTap('S12345')} className="p-2 bg-gray-600 rounded text-xs text-white">Mock Tap (S12345)</button>
      </div>

      <div 
        className="kiosk-screen flex flex-col relative"
        style={{
          transform: `scale(${scale})`,
          marginBottom: `-${marginAdjustment}px`,
        }}
      >
        <header className="kiosk-header">
          <div className="kiosk-header-logo">CampusPrint Kiosk</div>
          <div className="kiosk-header-meta">
            <span>Lib-Main-01</span>
            <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </header>
        
        <div className="kiosk-layout">
          <aside className="kiosk-sidebar">
            <div style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '0.2em', color: 'var(--grey)', textTransform: 'uppercase' }}>
              Current Session
            </div>
            <div>
              <h3 style={{ fontSize: '32px', fontWeight: 600, color: 'var(--gd)', marginBottom: '8px' }}>
                {profile ? profile.full_name : 'Guest'}
              </h3>
              <p className="meta-text">{profile?.department} • Balance: ₹{profile?.wallet_balance}</p>
            </div>
            <hr style={{ border: 'none', borderTop: '2px solid var(--border)', margin: '20px 0' }} />
            <div style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '0.2em', color: 'var(--grey)', textTransform: 'uppercase', marginBottom: '-20px' }}>
              Print Queue
            </div>
            
            <div className="file-list">
              {jobs.length === 0 ? (
                <div className="meta-text" style={{ fontStyle: 'italic' }}>No active jobs found.</div>
              ) : (
                jobs.map((job) => {
                  const isActive = job.status === 'printing' || job.status === 'processing';
                  const isPending = job.status === 'pending';
                  const isComplete = job.status === 'ready' || job.status === 'completed';

                  return (
                    <div key={job.id} className="file-row" style={{ opacity: isPending || isComplete ? 0.5 : 1 }}>
                      <div className="file-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                          <line x1="16" y1="13" x2="8" y2="13"></line>
                          <line x1="16" y1="17" x2="8" y2="17"></line>
                          <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                      </div>
                      <div className="file-info">
                        <div className="file-name">{job.file_name}</div>
                        <div className="file-meta">{job.page_count} pages • {job.color_mode} • {job.sides}</div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            <div style={{ marginTop: 'auto' }}>
              <button className="btn-outline" style={{ width: '100%' }} onClick={handleEndSession}>End Session</button>
            </div>
          </aside>
          
          <main className="kiosk-main">
            <h2 className="screen-title" style={{ marginBottom: '60px' }}>
              {hasFinishedAll ? 'All Printing Completed' : 'Printing in Progress'}
            </h2>
            
            {!rfidWaiting && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '60px', marginBottom: '80px' }}>
                <div className="queue-ring-wrap">
                  <svg className="queue-ring" viewBox="0 0 100 100">
                    <circle className="queue-track" cx="50" cy="50" r="46"></circle>
                    <circle 
                      className="queue-progress" 
                      cx="50" cy="50" r="46" 
                      style={{ 
                        strokeDasharray: circumference, 
                        strokeDashoffset: strokeDashoffset 
                      }}
                    ></circle>
                  </svg>
                  <div className="queue-text">
                    {hasFinishedAll ? '✓' : currentJobIndex + 1}
                    {!hasFinishedAll && <span style={{ fontSize: '24px', color: 'var(--grey)' }}>/{jobs.length}</span>}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '32px', fontWeight: 600, color: 'var(--gd)', marginBottom: '12px' }}>
                    {hasFinishedAll ? 'Thank you!' : isPrinting ? `Processing Page ${printingPageIndex}...` : 'Waiting for next job...'}
                  </div>
                  <div className="meta-text">
                    {hasFinishedAll ? 'You may collect your documents.' : 'Please do not remove your documents until finished.'}
                  </div>
                </div>
              </div>
            )}

            <div style={{ background: 'var(--gl)', borderRadius: '24px', padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                <div style={{ width: '64px', height: '64px', background: '#fff', border: '2px solid var(--border)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--grey)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--gd)', marginBottom: '8px' }}>Need more copies?</div>
                  <div className="meta-text">You can reprint this job from your history.</div>
                </div>
              </div>
              <button className="btn-primary" style={{ padding: '20px 40px', fontSize: '20px' }}>Open Dashboard</button>
            </div>
          </main>
        </div>

        {/* RFID Welcome Overlay */}
        {rfidWaiting && (
          <div className="overlay" style={{ background: 'rgba(255, 255, 255, 0.95)' }}>
            <div className="hero-rings">
              <div className="ring ring-1"></div>
              <div className="ring ring-2"></div>
              <div className="ring ring-3"></div>
            </div>
            <div className="rfid-graphic" onClick={() => handleRfidTap('S12345')}>
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                <line x1="2" y1="10" x2="22" y2="10"></line>
                <path d="M7 15h.01"></path>
                <path d="M11 15h2"></path>
              </svg>
            </div>
            <h1 className="hero">Tap your <i>ID Card</i></h1>
            <p className="body-text" style={{ marginTop: '20px', textAlign: 'center' }}>
              Place your Presidency University ID card<br />on the reader below to begin.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
