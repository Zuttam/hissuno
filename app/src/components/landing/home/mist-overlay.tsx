'use client'

import { motion } from 'motion/react'

export function MistOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden dark:hidden" aria-hidden="true">
      {/* Layer 1: Slow drift from left */}
      <motion.div
        className="absolute -left-1/4 top-0 h-full w-[150%] opacity-50"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 30% 50%, rgba(255, 255, 255, 0.8) 0%, transparent 70%)',
        }}
        animate={{
          x: ['0%', '10%', '0%'],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      {/* Layer 2: Slow drift from right */}
      <motion.div
        className="absolute -right-1/4 top-0 h-full w-[150%] opacity-40"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 70% 60%, rgba(250, 248, 245, 0.7) 0%, transparent 60%)',
        }}
        animate={{
          x: ['0%', '-8%', '0%'],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 5,
        }}
      />
      {/* Layer 3: Top mist band */}
      <motion.div
        className="absolute left-0 top-0 h-64 w-full opacity-60"
        style={{
          background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.95) 0%, transparent 100%)',
        }}
        animate={{
          opacity: [0.6, 0.7, 0.6],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  )
}
