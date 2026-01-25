'use client'

import { motion } from 'motion/react'
import { WATER_EASINGS } from '@/components/landing/scroll-animation-config'

export function RoadmapHeroSection() {
  // Hero uses timed animations (not scroll-triggered) since it's above the fold
  const heroAnimation = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
  }

  return (
    <section className="relative overflow-hidden px-6 py-16 md:px-12 md:py-24">
      {/* Atmospheric gradient */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-0"
        style={{
          background:
            'radial-gradient(ellipse 100% 80% at 50% 20%, rgba(200, 228, 225, 0.4) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />

      <motion.div
        {...heroAnimation}
        transition={{ duration: 1.2, ease: WATER_EASINGS.float, delay: 0.2 }}
        className="relative z-10 mx-auto max-w-4xl text-center"
      >
        <h1 className="font-mono text-4xl font-bold tracking-tight text-[var(--foreground)] md:text-5xl">
          Product{' '}
          <span className="bg-gradient-to-r from-[var(--accent-teal)] to-[var(--accent-selected)] bg-clip-text text-transparent">
            Roadmap
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--text-secondary)]">
          Transparency matters. Here&apos;s what we&apos;ve shipped, what we&apos;re building now,
          and where we&apos;re heading next.
        </p>
      </motion.div>
    </section>
  )
}
