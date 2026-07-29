'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import FadeIn from '@/components/animations/FadeIn'
import './desktop-landing.css'

export default function LandingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSignIn = () => {
    setLoading(true)
    router.push('/scan')
  }

  return (
    <>
      <div className="desktop-only-landing">
        
        {/* Top Navigation Bar */}
        <header className="top-nav-pill">
          <button className="menu-btn" onClick={() => setMenuOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <button className="account-btn" onClick={() => router.push('/auth/login')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </button>
        </header>

        {/* Menu Overlay */}
        {menuOpen && (
          <div className="menu-overlay">
            <div className="menu-card">
              <div className="menu-header">
                <button className="close-btn" onClick={() => setMenuOpen(false)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="menu-links">
                <a href="#">About Us</a>
                <a href="#">Features</a>
                <a href="#">Franchise</a>
                <a href="#">Contact Us</a>
              </div>
            </div>
          </div>
        )}

        <section className="hero">
          <div className="hero-top-elements">
            <div className="hero-badge">
              <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
              <span>OFFICIAL ON-CAMPUS PRINTING SERVICE</span>
            </div>
          </div>


          <div className="ring-canvas" aria-hidden="true">
            <div className="ring-outer"></div>
            <div className="ring-inner"></div>
            <div className="ring-core"></div>
          </div>

          <div className="logo-row">
            <img src="/logo.png" alt="Presidency University" className="real-logo" />
          </div>

          <div className="hero-content">
            <h1 className="hero-headline">
              Digital Thoughts<br/>
              <span className="accent-italic">&amp; Physical</span> Reality
            </h1>
            <p className="hero-sub">
              Your fast, secure, and hassle-free on-campus printing solution.
            </p>
            <div className="hero-cta-row">
              <button className="btn-primary" onClick={handleSignIn} disabled={loading}>
                {loading ? "Loading..." : "Print Now ↗"}
              </button>
            </div>
          </div>
        </section>


<section className="workflow">
  <div className="section-label">Workflow</div>

  <div className="workflow-grid">
    <FadeIn delay={0}>
      <div className="workflow-card">
        <div className="step-num">01.</div>
        <div className="step-title">Scan to Start</div>
        <p className="step-desc">Tap your student ID or scan the QR code at any campus kiosk to begin your session instantly.</p>
      </div>
    </FadeIn>
    <FadeIn delay={0.1}>
      <div className="workflow-card">
        <div className="step-num">02.</div>
        <div className="step-title">Cloud Upload</div>
        <p className="step-desc">Upload directly from your device or pull files from your university cloud account in seconds.</p>
      </div>
    </FadeIn>
    <FadeIn delay={0.2}>
      <div className="workflow-card">
        <div className="step-num">03.</div>
        <div className="step-title">Instant Pay</div>
        <p className="step-desc">Pay via UPI, scan a QR code, or use your pre-loaded academic credits — no cash required.</p>
      </div>
    </FadeIn>
    <FadeIn delay={0.3}>
      <div className="workflow-card active">
        <div className="step-num">04.</div>
        <div className="step-title">Collect Print</div>
        <p className="step-desc">Retrieve your documents with a secure OTP. Every job is ready within moments of payment.</p>
      </div>
    </FadeIn>
  </div>
</section>


<section className="capabilities">
  <div className="section-label">Capabilities</div>

  <div className="cap-grid">
    <FadeIn delay={0}>
      <div className="cap-card">
        <svg className="cap-icon" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="6" y="12" width="32" height="22" rx="3" stroke="#0D1F3C" stroke-width="1.6"/>
          <path d="M14 12V8h16v4" stroke="#0D1F3C" stroke-width="1.6" stroke-linecap="round"/>
          <path d="M14 34v2h16v-2" stroke="#0D1F3C" stroke-width="1.6" stroke-linecap="round"/>
          <circle cx="34" cy="18" r="2" fill="#0D1F3C"/>
        </svg>
        <div className="cap-title">Campus-Wide</div>
        <p className="cap-desc">Access 12+ printer stations across all buildings, labs, and the main library. Any kiosk, any time.</p>
      </div>
    </FadeIn>
    <FadeIn delay={0.1}>
      <div className="cap-card">
        <svg className="cap-icon" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22 8 L36 16 L36 32 L22 40 L8 32 L8 16 Z" stroke="#0D1F3C" stroke-width="1.6" stroke-linejoin="round"/>
          <path d="M22 8 L22 24 M22 24 L8 16 M22 24 L36 16" stroke="#2B4EAA" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <div className="cap-title">Cloud Storage</div>
        <p className="cap-desc">Save documents to your account and reprint from any kiosk without re-uploading. Encrypted at rest.</p>
      </div>
    </FadeIn>
    <FadeIn delay={0.2}>
      <div className="cap-card">
        <svg className="cap-icon" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="22" cy="22" r="14" stroke="#0D1F3C" stroke-width="1.6"/>
          <path d="M22 15 L22 22 L28 25" stroke="#2B4EAA" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div className="cap-title">Instant Output</div>
        <p className="cap-desc">High-speed laser and colour inkjet printing. Most jobs complete within 60 seconds of payment confirmation.</p>
      </div>
    </FadeIn>
    <FadeIn delay={0.3}>
      <div className="cap-card">
        <svg className="cap-icon" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="10" y="8" width="24" height="30" rx="3" stroke="#0D1F3C" stroke-width="1.6"/>
          <line x1="15" y1="16" x2="29" y2="16" stroke="#2B4EAA" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="15" y1="21" x2="29" y2="21" stroke="#2B4EAA" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="15" y1="26" x2="23" y2="26" stroke="#2B4EAA" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <div className="cap-title">Any Format</div>
        <p className="cap-desc">PDF, DOCX, PPTX, JPEG — all formats supported. Auto-fit to page, duplex, colour or mono, your choice.</p>
      </div>
    </FadeIn>
  </div>
</section>


<section className="faq-section" style={{ padding: '80px 8vw', background: 'var(--bg)' }}>
  <div className="section-label">FAQ</div>
  
  <div className="faq-grid" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '800px', margin: '0 auto' }}>
    
    <FadeIn delay={0}>
      <div className="faq-item" style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', background: '#FAFAFA' }}>
        <h3 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: '18px', fontWeight: 700, color: 'var(--navy)', marginBottom: '8px' }}>How do I pay for my prints?</h3>
        <p style={{ fontFamily: 'Quicksand, sans-serif', fontSize: '15px', color: '#8892a4', lineHeight: 1.6, fontWeight: 500 }}>We support UPI, Netbanking, and pre-loaded Academic Credits. All payments are securely processed and your print job begins immediately upon confirmation.</p>
      </div>
    </FadeIn>

    <FadeIn delay={0.1}>
      <div className="faq-item" style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', background: '#FAFAFA' }}>
        <h3 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: '18px', fontWeight: 700, color: 'var(--navy)', marginBottom: '8px' }}>What formats are supported?</h3>
        <p style={{ fontFamily: 'Quicksand, sans-serif', fontSize: '15px', color: '#8892a4', lineHeight: 1.6, fontWeight: 500 }}>We currently support PDF, DOCX, PPTX, JPG, and PNG files. We highly recommend converting your documents to PDF before uploading to ensure perfect formatting.</p>
      </div>
    </FadeIn>

    <FadeIn delay={0.2}>
      <div className="faq-item" style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', background: '#FAFAFA' }}>
        <h3 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: '18px', fontWeight: 700, color: 'var(--navy)', marginBottom: '8px' }}>Where are the kiosks located?</h3>
        <p style={{ fontFamily: 'Quicksand, sans-serif', fontSize: '15px', color: '#8892a4', lineHeight: 1.6, fontWeight: 500 }}>You can find CampusPrint kiosks in the Main Library, Student Union Building, Science Block A, and the Engineering Wing. Check the Kiosk Map for real-time availability.</p>
      </div>
    </FadeIn>

  </div>
</section>


<footer>
  <div className="footer-top">
    <div>
      <div className="footer-brand">Presidency University</div>
      <div className="footer-brand-sub">Information Technology Services</div>
    </div>
    <div>
      <div className="footer-links-col">
        <h4>Service</h4>
        <ul>
          <li><a href="#">Kiosk Map</a></li>
          <li><a href="#">Support Desk</a></li>
          <li><a href="#">Status Page</a></li>
        </ul>
      </div>
      <div className="footer-links-col">
        <h4>Legal</h4>
        <ul>
          <li><a href="#">Privacy Policy</a></li>
          <li><a href="#">Usage Terms</a></li>
          <li><a href="#">Refunds</a></li>
        </ul>
      </div>
    </div>
  </div>
  <div className="footer-copy">
    &copy; 2025 Presidency University · All rights reserved
  </div>
</footer>
      </div>
    </>
  )
}
