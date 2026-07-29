'use client'

import { motion } from 'framer-motion'
import React from 'react'

interface FadeInProps {
  children: React.ReactNode
  delay?: number
  className?: string
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
  distance?: number
}

export default function FadeIn({
  children,
  delay = 0,
  className = '',
  direction = 'up',
  distance = 24
}: FadeInProps) {
  
  const getInitialPosition = () => {
    switch (direction) {
      case 'up': return { y: distance }
      case 'down': return { y: -distance }
      case 'left': return { x: distance }
      case 'right': return { x: -distance }
      default: return {}
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, ...getInitialPosition() }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{
        duration: 0.6,
        delay,
        ease: [0.22, 1, 0.36, 1] // Consistent premium easing curve
      }}
      className={className}
      style={{ willChange: 'transform, opacity' }} // Force compositor layer for smooth scroll
    >
      {children}
    </motion.div>
  )
}
