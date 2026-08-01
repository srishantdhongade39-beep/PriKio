'use client'

import React, { useEffect, useRef, useState } from 'react'
import Lenis from 'lenis'

interface SmoothScrollBoxProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  maxHeight?: string | number
  showIndicators?: boolean
}

export default function SmoothScrollBox({
  children,
  className = '',
  style = {},
  maxHeight,
  showIndicators = true,
}: SmoothScrollBoxProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const lenisRef = useRef<Lenis | null>(null)
  const [canScrollUp, setCanScrollUp] = useState(false)
  const [canScrollDown, setCanScrollDown] = useState(false)

  const checkScrollability = () => {
    if (!wrapperRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = wrapperRef.current
    setCanScrollUp(scrollTop > 6)
    setCanScrollDown(scrollTop + clientHeight < scrollHeight - 6)
  }

  useEffect(() => {
    const wrapper = wrapperRef.current
    const content = contentRef.current
    if (!wrapper) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    const lenis = new Lenis({
      wrapper: wrapper,
      content: content || undefined,
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.4,
    })

    lenisRef.current = lenis

    let rafId: number
    const onRaf = (time: number) => {
      lenis.raf(time)
      rafId = requestAnimationFrame(onRaf)
    }
    rafId = requestAnimationFrame(onRaf)

    const handleScroll = () => {
      checkScrollability()
    }

    lenis.on('scroll', handleScroll)
    wrapper.addEventListener('scroll', handleScroll, { passive: true })

    // Resize observer to update Lenis when content changes
    const resizeObserver = new ResizeObserver(() => {
      lenis.resize()
      checkScrollability()
    })

    if (content) resizeObserver.observe(content)
    resizeObserver.observe(wrapper)

    // Initial check
    checkScrollability()

    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
      lenisRef.current = null
      resizeObserver.disconnect()
      wrapper.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return (
    <div
      className="premium-scroll-outer"
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      {/* Top ambient soft blur & gradient indicator */}
      {showIndicators && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '24px',
            background: 'linear-gradient(180deg, rgba(241, 245, 249, 0.95) 0%, rgba(241, 245, 249, 0.4) 60%, transparent 100%)',
            pointerEvents: 'none',
            zIndex: 4,
            opacity: canScrollUp ? 1 : 0,
            transform: canScrollUp ? 'translateY(0)' : 'translateY(-4px)',
            transition: 'opacity 0.25s ease, transform 0.25s ease',
          }}
        />
      )}

      <div
        ref={wrapperRef}
        className={`smooth-scroll-box ${className}`}
        data-lenis-prevent="true"
        style={{
          maxHeight: maxHeight || undefined,
          overflowY: 'auto',
          position: 'relative',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(100, 116, 139, 0.3) transparent',
          ...style,
        }}
      >
        <div ref={contentRef} style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
          {children}
        </div>
      </div>

      {/* Bottom ambient soft blur & gradient indicator */}
      {showIndicators && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '24px',
            background: 'linear-gradient(0deg, rgba(241, 245, 249, 0.95) 0%, rgba(241, 245, 249, 0.4) 60%, transparent 100%)',
            pointerEvents: 'none',
            zIndex: 4,
            opacity: canScrollDown ? 1 : 0,
            transform: canScrollDown ? 'translateY(0)' : 'translateY(4px)',
            transition: 'opacity 0.25s ease, transform 0.25s ease',
          }}
        />
      )}

      <style jsx>{`
        .smooth-scroll-box::-webkit-scrollbar {
          width: 5px;
        }
        .smooth-scroll-box::-webkit-scrollbar-track {
          background: transparent;
          margin: 6px 0;
        }
        .smooth-scroll-box::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.35);
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.5);
          transition: background 0.2s ease, transform 0.2s ease;
        }
        .smooth-scroll-box::-webkit-scrollbar-thumb:hover {
          background: rgba(79, 70, 229, 0.6);
        }
      `}</style>
    </div>
  )
}
