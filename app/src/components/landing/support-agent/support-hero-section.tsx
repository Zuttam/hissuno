'use client'

import { motion } from 'motion/react'
import { Button } from '@/components/ui'
import { useWaterWebGLOptional } from '@/components/water-webgl/WaterWebGLContext'
import { useCTA } from '@/components/landing/cta-context'
import { WATER_EASINGS } from '@/components/landing/scroll-animation-config'

export function SupportHeroSection() {
  const water = useWaterWebGLOptional()
  const { openWaitlist } = useCTA()

  const handleCTAClick = (e: React.MouseEvent) => {
    water?.triggerRipple(e.clientX, e.clientY, 1.5)
    openWaitlist('support_hero')
  }

  const heroAnimation = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
  }

  return (
    <section className="relative overflow-hidden px-6 md:px-12">
      {/* Atmospheric gradient for onsen atmosphere - light mode only */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-0"
        style={{
          background: 'radial-gradient(ellipse 100% 80% at 50% 20%, rgba(200, 228, 225, 0.4) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />

      <motion.div
        {...heroAnimation}
        transition={{ duration: 1.2, ease: WATER_EASINGS.float, delay: 0.2 }}
        className="relative z-10 mx-auto max-w-4xl text-center"
      >
        <h1 className="mt-12 font-mono text-4xl font-bold tracking-tight text-[var(--foreground)] md:text-6xl">
          Stop Answering the
          <span className="block bg-gradient-to-r from-[var(--accent-teal)] to-[var(--accent-selected)] bg-clip-text text-transparent">
            Same Questions
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--text-secondary)] md:text-xl">
          AI support that reduces noise, gives instant answers, and works across every channel — no setup required.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center">
          <Button
            size="lg"
            onClick={handleCTAClick}
            className="w-full bg-[var(--accent-selected)] hover:opacity-90 sm:w-auto"
          >
            Join Waitlist
          </Button>
          <p className="mt-2 text-sm text-[var(--text-tertiary)]">
            Join now and get free credits
          </p>
        </div>
      </motion.div>
    </section>
  )
}
